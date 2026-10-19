-- =====================================================================
-- PARTIE 2 : STOCK PRINCIPAL ET FIN DES ÉCRITURES DIRECTES
-- Projet : bakery-stock-management. Prérequis : partie 1 (circuit des demandes) appliquée.
-- À exécuter dans le SQL Editor de Supabase (contient un DROP CONSTRAINT : la liste des types de mouvement
-- du journal s'agrandit).
--
-- Avant : le stock principal était modifié directement depuis le navigateur (création, réapprovisionnement,
-- correction de quantité, changement d'unité, suppression qui effaçait l'historique) ; un gérant ou la
-- production pouvait modifier toutes les quantités sans trace ; « marquer comme utilisé » comptait double ;
-- tout utilisateur connecté pouvait changer un prix de vente ou insérer de faux mouvements.
--
-- Après :
-- 1. Fonctions (seul chemin) : creer_produit, reapprovisionner_produit (clé anti-doublon), modifier_produit
--    (unité modifiable seulement sans stock), ajuster_stock_principal et ajuster_stock_atelier (motif
--    obligatoire), vider_stock_atelier, archiver_produit (au lieu de supprimer, seulement sans stock),
--    utiliser_stock_boutique (une seule écriture).
-- 2. Journal : achats, corrections, utilisations, ventes et annulations de ventes y sont inscrits.
-- 3. Verrous : plus personne ne modifie directement une quantité de stock ; prix de vente et type d'article
--    réservés au propriétaire et aux gérants ; historique (mouvements_stock, entrees_boutique,
--    utilisations_boutique) écrit uniquement par la base ; produits non supprimables.
--
-- Annulation : partie2_annulation.sql (SQL Editor)
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Journal : nouveaux types de mouvement, clé anti-doublon, auteur pour les appels serveur
-- ---------------------------------------------------------------------
ALTER TABLE public.journal_stock DROP CONSTRAINT journal_stock_nature_check;
ALTER TABLE public.journal_stock ADD CONSTRAINT journal_stock_nature_check CHECK (nature IN (
  'envoi', 'annulation_envoi', 'reception', 'ecart_reception',
  'achat', 'ajustement', 'utilisation', 'vente', 'annulation_vente', 'production'));
ALTER TABLE public.journal_stock ADD COLUMN cle uuid;
CREATE UNIQUE INDEX journal_stock_cle_key ON public.journal_stock (cle) WHERE cle IS NOT NULL;
CREATE INDEX journal_stock_produit_idx ON public.journal_stock (produit_id, lieu);

-- Auteur : l'utilisateur connecté ; pour un appel serveur sans utilisateur (annulation de vente),
-- l'admin vérifié que la fonction appelante a placé dans shine.auteur. Un utilisateur connecté a toujours
-- un auth.uid() : il ne peut pas se faire passer pour un autre.
CREATE OR REPLACE FUNCTION public.journal_stock_avant_insertion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_precedente text;
BEGIN
  -- Une écriture à la fois : l'ordre des identifiants est l'ordre du chaînage
  PERFORM pg_advisory_xact_lock(hashtext('public.journal_stock'));
  NEW.id := nextval('public.journal_stock_id_seq');
  NEW.cree_le := clock_timestamp();
  NEW.auteur_id := coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid);
  NEW.auteur_nom := (SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = NEW.auteur_id);
  SELECT empreinte INTO v_precedente FROM journal_stock ORDER BY id DESC LIMIT 1;
  NEW.empreinte_precedente := coalesce(v_precedente, 'origine');
  NEW.empreinte := encode(sha256(convert_to(public.journal_stock_contenu(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.journal_ecrire_cle(p_lieu text, p_produit_id integer, p_produit_nom text,
  p_quantite numeric, p_nature text, p_motif text, p_cle uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  INSERT INTO journal_stock (lieu, produit_id, produit_nom, quantite, nature, motif, cle)
  VALUES (p_lieu, p_produit_id, p_produit_nom, p_quantite, p_nature, p_motif, p_cle)
$function$;

-- Une même clé déjà utilisée : l'opération a déjà été enregistrée (nouvel essai après une coupure)
CREATE OR REPLACE FUNCTION public.cle_deja_utilisee(p_cle uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_cle IS NULL THEN
    RETURN false;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
  RETURN EXISTS (SELECT 1 FROM journal_stock WHERE cle = p_cle);
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. Produits : archivage au lieu de suppression
-- ---------------------------------------------------------------------
ALTER TABLE public.produits ADD COLUMN actif boolean NOT NULL DEFAULT true;
ALTER TABLE public.produits ADD COLUMN archive_le timestamptz;
ALTER TABLE public.produits ADD COLUMN archive_par uuid;
ALTER TABLE public.produits ADD COLUMN motif_archivage text;

-- Stock restant d'un produit, tous lieux confondus (pour l'archivage et le changement d'unité)
CREATE OR REPLACE FUNCTION public.stock_total_produit(p_produit_id integer)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce((SELECT quantite_restante FROM produits WHERE id = p_produit_id), 0)
       + coalesce((SELECT sum(quantite_disponible) FROM stock_atelier WHERE produit_id = p_produit_id), 0)
       + coalesce((SELECT sum(coalesce(quantite_disponible, 0) - coalesce(quantite_vendue, 0) - coalesce(quantite_utilisee, 0))
                     FROM stock_boutique WHERE produit_id = p_produit_id), 0)
       + coalesce((SELECT sum(el.quantite_envoyee) FROM envoi_lignes el JOIN envois e ON e.id = el.envoi_id
                    WHERE el.produit_id = p_produit_id AND e.statut = 'en_transit'), 0)
$function$;

-- ---------------------------------------------------------------------
-- 3. Fonctions du stock principal (propriétaire, gérants ; achats aussi pour la production)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_produit(p_nom text, p_date_achat date, p_quantite numeric, p_prix_total numeric,
  p_unite_id integer, p_prix_vente numeric DEFAULT NULL, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id integer;
  v_prix_unitaire numeric;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production peuvent créer un produit' USING ERRCODE = '42501';
  END IF;
  IF public.cle_deja_utilisee(p_cle) THEN
    SELECT produit_id INTO v_id FROM journal_stock WHERE cle = p_cle;
    RETURN jsonb_build_object('produit_id', v_id, 'deja_enregistre', true);
  END IF;
  IF p_nom IS NULL OR length(trim(p_nom)) = 0 THEN
    RAISE EXCEPTION 'Le nom du produit est obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 OR p_prix_total IS NULL OR p_prix_total < 0 THEN
    RAISE EXCEPTION 'Quantité et prix d''achat invalides' USING ERRCODE = '22023';
  END IF;
  v_prix_unitaire := p_prix_total / p_quantite;

  INSERT INTO produits (nom, date_achat, prix_achat, quantite, quantite_restante, unite_id, created_by)
  VALUES (trim(p_nom), coalesce(p_date_achat, current_date), v_prix_unitaire, p_quantite, p_quantite, p_unite_id, auth.uid())
  RETURNING id INTO v_id;

  IF p_prix_vente IS NOT NULL AND p_prix_vente > 0 THEN
    INSERT INTO prix_vente_produits (produit_id, prix, marge_pourcentage, actif)
    VALUES (v_id, p_prix_vente, CASE WHEN v_prix_unitaire > 0 THEN (p_prix_vente - v_prix_unitaire) / v_prix_unitaire * 100 ELSE 0 END, true);
  END IF;

  PERFORM journal_ecrire_cle('principal', v_id, trim(p_nom), p_quantite, 'achat',
    'Création du produit : ' || p_quantite || ' pour ' || p_prix_total || ' F', p_cle);
  RETURN jsonb_build_object('produit_id', v_id, 'deja_enregistre', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reapprovisionner_produit(p_produit_id integer, p_quantite numeric, p_prix_total numeric,
  p_date_achat date DEFAULT NULL, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p record;
  v_prix_moyen numeric;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production peuvent réapprovisionner' USING ERRCODE = '42501';
  END IF;
  IF public.cle_deja_utilisee(p_cle) THEN
    RETURN jsonb_build_object('produit_id', p_produit_id, 'deja_enregistre', true);
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 OR p_prix_total IS NULL OR p_prix_total < 0 THEN
    RAISE EXCEPTION 'Quantité et prix d''achat invalides' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_p FROM produits WHERE id = p_produit_id FOR UPDATE;
  IF NOT FOUND OR NOT v_p.actif THEN
    RAISE EXCEPTION 'Produit introuvable ou archivé' USING ERRCODE = 'P0002';
  END IF;
  -- Prix moyen pondéré sur les quantités achetées (même calcul qu'avant)
  v_prix_moyen := (v_p.quantite * coalesce(v_p.prix_achat, 0) + p_prix_total) / (v_p.quantite + p_quantite);

  UPDATE produits
     SET quantite = quantite + p_quantite, quantite_restante = quantite_restante + p_quantite,
         prix_achat = v_prix_moyen, date_achat = coalesce(p_date_achat, date_achat), updated_at = now()
   WHERE id = p_produit_id;
  PERFORM journal_ecrire_cle('principal', p_produit_id, v_p.nom, p_quantite, 'achat',
    'Réapprovisionnement : ' || p_quantite || ' pour ' || p_prix_total || ' F', p_cle);
  RETURN jsonb_build_object('produit_id', p_produit_id, 'deja_enregistre', false,
    'quantite_restante', v_p.quantite_restante + p_quantite, 'prix_achat', v_prix_moyen);
END;
$function$;

-- Informations du produit (sans les quantités). L'unité ne change que si le produit n'a plus de stock nulle part :
-- sinon toutes les quantités seraient réinterprétées (des grammes lus comme des kilos).
CREATE OR REPLACE FUNCTION public.modifier_produit(p_produit_id integer, p_nom text, p_date_achat date,
  p_prix_achat numeric, p_unite_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p record;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production peuvent modifier un produit' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_p FROM produits WHERE id = p_produit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_unite_id IS DISTINCT FROM v_p.unite_id AND public.stock_total_produit(p_produit_id) <> 0 THEN
    RAISE EXCEPTION 'L''unité ne peut changer que pour un produit sans stock (sinon les quantités seraient faussées)'
      USING ERRCODE = '55000';
  END IF;
  IF p_prix_achat IS NOT NULL AND p_prix_achat < 0 THEN
    RAISE EXCEPTION 'Prix d''achat invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE produits
     SET nom = coalesce(nullif(trim(p_nom), ''), nom), date_achat = coalesce(p_date_achat, date_achat),
         prix_achat = coalesce(p_prix_achat, prix_achat), unite_id = p_unite_id, updated_at = now()
   WHERE id = p_produit_id;
  RETURN jsonb_build_object('produit_id', p_produit_id);
END;
$function$;

-- Correction de la quantité restante (recomptage, casse, erreur…) : propriétaire et gérants, motif obligatoire
CREATE OR REPLACE FUNCTION public.ajuster_stock_principal(p_produit_id integer, p_nouvelle_quantite numeric, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p record;
  v_ecart numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent corriger le stock principal' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de la correction' USING ERRCODE = '22023';
  END IF;
  IF p_nouvelle_quantite IS NULL OR p_nouvelle_quantite < 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_p FROM produits WHERE id = p_produit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable' USING ERRCODE = 'P0002';
  END IF;
  v_ecart := p_nouvelle_quantite - v_p.quantite_restante;
  IF v_ecart = 0 THEN
    RETURN jsonb_build_object('produit_id', p_produit_id, 'ecart', 0);
  END IF;
  -- quantite (cumul des achats) doit rester >= quantite_restante (contrainte positive_quantities)
  UPDATE produits SET quantite_restante = p_nouvelle_quantite, quantite = greatest(quantite, p_nouvelle_quantite), updated_at = now()
   WHERE id = p_produit_id;
  PERFORM journal_ecrire_cle('principal', p_produit_id, v_p.nom, v_ecart, 'ajustement', trim(p_motif), NULL);
  RETURN jsonb_build_object('produit_id', p_produit_id, 'ecart', v_ecart);
END;
$function$;

CREATE OR REPLACE FUNCTION public.archiver_produit(p_produit_id integer, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p record;
  v_stock numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent archiver un produit' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de l''archivage' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_p FROM produits WHERE id = p_produit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_p.actif THEN
    RAISE EXCEPTION 'Ce produit est déjà archivé' USING ERRCODE = '55000';
  END IF;
  v_stock := public.stock_total_produit(p_produit_id);
  IF v_stock <> 0 THEN
    RAISE EXCEPTION 'Il reste % en stock (principal, atelier, boutique ou en transit) : corrigez d''abord le stock avec un motif', v_stock
      USING ERRCODE = '55000';
  END IF;
  UPDATE produits SET actif = false, archive_le = now(), archive_par = auth.uid(), motif_archivage = trim(p_motif), updated_at = now()
   WHERE id = p_produit_id;
  RETURN jsonb_build_object('produit_id', p_produit_id, 'archive', true);
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. Atelier et boutique
-- ---------------------------------------------------------------------
-- Correction du stock atelier (en attendant l'enregistrement des productions) : propriétaire et gérants, motif obligatoire
CREATE OR REPLACE FUNCTION public.ajuster_stock_atelier(p_produit_id integer, p_nouvelle_quantite numeric, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_s record;
  v_ecart numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent corriger le stock atelier' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de la correction' USING ERRCODE = '22023';
  END IF;
  IF p_nouvelle_quantite IS NULL OR p_nouvelle_quantite < 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  SELECT sa.id, sa.quantite_disponible, p.nom INTO v_s
    FROM stock_atelier sa JOIN produits p ON p.id = sa.produit_id WHERE sa.produit_id = p_produit_id FOR UPDATE OF sa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit absent du stock atelier' USING ERRCODE = 'P0002';
  END IF;
  v_ecart := p_nouvelle_quantite - v_s.quantite_disponible;
  IF v_ecart <> 0 THEN
    UPDATE stock_atelier SET quantite_disponible = p_nouvelle_quantite, updated_at = now() WHERE id = v_s.id;
    PERFORM journal_ecrire_cle('atelier', p_produit_id, v_s.nom, v_ecart, 'ajustement', trim(p_motif), NULL);
  END IF;
  RETURN jsonb_build_object('produit_id', p_produit_id, 'ecart', v_ecart);
END;
$function$;

-- « Vider tout le stock atelier » : une correction motivée par produit, dans le journal
CREATE OR REPLACE FUNCTION public.vider_stock_atelier(p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_s record;
  v_nb integer := 0;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent vider le stock atelier' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif' USING ERRCODE = '22023';
  END IF;
  FOR v_s IN SELECT produit_id FROM stock_atelier WHERE quantite_disponible <> 0 ORDER BY produit_id LOOP
    PERFORM public.ajuster_stock_atelier(v_s.produit_id::integer, 0, p_motif);
    v_nb := v_nb + 1;
  END LOOP;
  RETURN jsonb_build_object('produits_vides', v_nb);
END;
$function$;

-- Utilisation en boutique d'un article non vendable (emballage, fourniture…). Remplace la double écriture
-- de l'écran, qui comptait chaque utilisation deux fois (écran + déclencheur).
CREATE OR REPLACE FUNCTION public.utiliser_stock_boutique(p_stock_id integer, p_quantite numeric, p_raison text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_s record;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_boutique') THEN
    RAISE EXCEPTION 'Seuls la boutique et les gérants peuvent enregistrer une utilisation' USING ERRCODE = '42501';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  SELECT sb.*, coalesce(sb.nom_produit, p.nom) AS nom,
         coalesce(sb.quantite_disponible, 0) - coalesce(sb.quantite_vendue, 0) - coalesce(sb.quantite_utilisee, 0) AS reel
    INTO v_s FROM stock_boutique sb LEFT JOIN produits p ON p.id = sb.produit_id WHERE sb.id = p_stock_id FOR UPDATE OF sb;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_s.reel < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant : % disponible(s)', greatest(v_s.reel, 0) USING ERRCODE = '23514';
  END IF;
  -- Le déclencheur de utilisations_boutique ajoute la quantité à quantite_utilisee
  INSERT INTO utilisations_boutique (stock_boutique_id, quantite_utilisee, utilisateur_id, raison, date_utilisation)
  VALUES (p_stock_id, p_quantite, auth.uid(), coalesce(nullif(trim(p_raison), ''), 'Utilisation en boutique'), now());
  PERFORM journal_ecrire_cle('boutique', v_s.produit_id, v_s.nom, -p_quantite, 'utilisation',
    coalesce(nullif(trim(p_raison), ''), 'Utilisation en boutique'), NULL);
  RETURN jsonb_build_object('stock_id', p_stock_id, 'quantite', p_quantite);
END;
$function$;

-- Ventes et annulations de ventes inscrites au journal (déclencheurs : tous les chemins sont couverts)
CREATE OR REPLACE FUNCTION public.journal_ligne_vente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.produit_id IS NOT NULL AND coalesce(NEW.quantite, 0) <> 0 THEN
    PERFORM journal_ecrire_cle('boutique', NEW.produit_id, NEW.nom_produit, -NEW.quantite, 'vente',
      'Ticket ' || (SELECT numero_ticket FROM ventes WHERE id = NEW.vente_id), NULL);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.journal_annulation_vente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_l record;
BEGIN
  IF NEW.statut = 'annulee' AND OLD.statut IS DISTINCT FROM 'annulee' THEN
    FOR v_l IN SELECT produit_id, nom_produit, quantite FROM lignes_vente
                WHERE vente_id = NEW.id AND produit_id IS NOT NULL AND coalesce(quantite, 0) <> 0 LOOP
      PERFORM journal_ecrire_cle('boutique', v_l.produit_id, v_l.nom_produit, v_l.quantite, 'annulation_vente',
        'Annulation du ticket ' || NEW.numero_ticket, NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER journal_ligne_vente AFTER INSERT ON public.lignes_vente
  FOR EACH ROW EXECUTE FUNCTION public.journal_ligne_vente();
CREATE TRIGGER journal_annulation_vente AFTER UPDATE OF statut ON public.ventes
  FOR EACH ROW EXECUTE FUNCTION public.journal_annulation_vente();

-- La vente s'exécute désormais avec les droits du propriétaire : les quantités vendues ne sont plus
-- modifiables directement depuis l'application
CREATE OR REPLACE FUNCTION public.enregistrer_vente_boutique(p_items jsonb, p_montant_donne numeric, p_cle uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_vendeur uuid := auth.uid();
  v_produit_id integer;
  v_quantite numeric;
  v_stock record;
  v_lignes jsonb := '[]'::jsonb;
  v_ligne jsonb;
  v_total numeric := 0;
  v_vente_id integer;
  v_ticket text;
  v_created_at timestamp;
  v_existante record;
BEGIN
  IF v_vendeur IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non connecté' USING ERRCODE = '42501';
  END IF;
  -- La fonction s'exécute avec les droits du propriétaire (les quantités ne sont plus modifiables directement) :
  -- le compte doit être actif, comme l'exigeaient les règles d'accès
  IF public.role_courant() IS NULL THEN
    RAISE EXCEPTION 'Compte inactif' USING ERRCODE = '42501';
  END IF;

  -- Même clé = même panier renvoyé par la caisse (réponse perdue lors d'une coupure) : on rend la vente
  -- déjà enregistrée au lieu d'en créer une seconde. Le verrou fait attendre un envoi simultané de la
  -- même clé jusqu'à la fin du premier.
  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    SELECT id, vendeur_id INTO v_existante FROM ventes WHERE cle_idempotence = p_cle;
    IF FOUND THEN
      IF v_existante.vendeur_id IS DISTINCT FROM v_vendeur THEN
        RAISE EXCEPTION 'Clé de vente déjà utilisée' USING ERRCODE = '22023';
      END IF;
      RETURN (
        SELECT jsonb_build_object(
          'id', v.id,
          'numero_ticket', v.numero_ticket,
          'total', v.total,
          'montant_donne', v.montant_donne,
          'monnaie_rendue', v.monnaie_rendue,
          'vendeur_id', v.vendeur_id,
          'statut', v.statut,
          'created_at', v.created_at,
          'deja_enregistree', true,
          'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', l.produit_id, 'nom', l.nom_produit, 'prix', l.prix_unitaire,
                                                'quantite', l.quantite, 'total', l.total) ORDER BY l.id)
              FROM lignes_vente l WHERE l.vente_id = v.id), '[]'::jsonb)
        )
        FROM ventes v WHERE v.id = v_existante.id
      );
    END IF;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide' USING ERRCODE = '22023';
  END IF;

  -- Un même produit peut apparaître plusieurs fois : on regroupe. L'ordre fixe des verrous évite
  -- les interblocages entre deux caisses.
  FOR v_produit_id, v_quantite IN
    SELECT (e->>'id')::integer, sum((e->>'quantite')::numeric)
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1
    ORDER BY 1
  LOOP
    IF v_produit_id IS NULL OR v_quantite IS NULL OR v_quantite <= 0 THEN
      RAISE EXCEPTION 'Article invalide dans le panier' USING ERRCODE = '22023';
    END IF;

    SELECT sb.id,
           COALESCE(sb.nom_produit, p.nom, 'Produit #' || v_produit_id) AS nom,
           sb.prix_vente,
           COALESCE(sb.quantite_disponible, 0) - COALESCE(sb.quantite_vendue, 0) - COALESCE(sb.quantite_utilisee, 0) AS stock_reel
      INTO v_stock
      FROM stock_boutique sb
      LEFT JOIN produits p ON p.id = sb.produit_id
     WHERE sb.produit_id = v_produit_id
     ORDER BY sb.id
     LIMIT 1
       FOR UPDATE OF sb;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit % introuvable en boutique', v_produit_id USING ERRCODE = 'P0002';
    END IF;
    IF v_stock.prix_vente IS NULL OR v_stock.prix_vente <= 0 THEN
      RAISE EXCEPTION 'Aucun prix de vente défini pour « % »', v_stock.nom USING ERRCODE = '22023';
    END IF;
    IF v_stock.stock_reel < v_quantite THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : % disponible(s), % demandé(s)',
        v_stock.nom, greatest(v_stock.stock_reel, 0), v_quantite USING ERRCODE = '23514';
    END IF;

    UPDATE stock_boutique
       SET quantite_vendue = COALESCE(quantite_vendue, 0) + v_quantite,
           updated_at = NOW()
     WHERE id = v_stock.id;

    v_lignes := v_lignes || jsonb_build_object(
      'id', v_produit_id,
      'nom', v_stock.nom,
      'prix', v_stock.prix_vente,
      'quantite', v_quantite,
      'total', v_stock.prix_vente * v_quantite
    );
    v_total := v_total + v_stock.prix_vente * v_quantite;
  END LOOP;

  IF p_montant_donne IS NULL OR p_montant_donne < v_total THEN
    RAISE EXCEPTION 'Montant donné insuffisant : le total est de % FCFA', v_total USING ERRCODE = '22023';
  END IF;

  v_ticket := 'V-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 5);

  INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, statut, cle_idempotence)
  VALUES (v_ticket, v_total, p_montant_donne, p_montant_donne - v_total, v_vendeur, 'validee', p_cle)
  RETURNING id, created_at INTO v_vente_id, v_created_at;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(v_lignes) LOOP
    INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total)
    VALUES (v_vente_id, (v_ligne->>'id')::integer, v_ligne->>'nom', (v_ligne->>'quantite')::numeric,
            (v_ligne->>'prix')::numeric, (v_ligne->>'total')::numeric);
    INSERT INTO sorties_boutique (vente_id, produit_id, quantite, prix_unitaire, total)
    VALUES (v_vente_id, (v_ligne->>'id')::integer, (v_ligne->>'quantite')::numeric,
            (v_ligne->>'prix')::numeric, (v_ligne->>'total')::numeric);
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_vente_id,
    'numero_ticket', v_ticket,
    'total', v_total,
    'montant_donne', p_montant_donne,
    'monnaie_rendue', p_montant_donne - v_total,
    'vendeur_id', v_vendeur,
    'statut', 'validee',
    'created_at', v_created_at,
    'deja_enregistree', false,
    'items', v_lignes
  );
END;
$function$;

-- Annulation de vente (serveur) : l'admin vérifié devient l'auteur des lignes du journal
CREATE OR REPLACE FUNCTION public.annuler_vente_boutique(p_vente_id integer, p_motif text, p_annule_par uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  v_vente record;
  v_ligne record;
  v_jours integer;
  v_restaures jsonb := '[]'::jsonb;
  v_erreurs jsonb := '[]'::jsonb;
BEGIN
  -- Appelée par le serveur (service_role, sans utilisateur connecté) : auteur du journal = l'admin vérifié
  PERFORM set_config('shine.auteur', p_annule_par::text, true);
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN
    RAISE EXCEPTION 'Le motif doit contenir au moins 10 caractères' USING ERRCODE = '22023';
  END IF;

  -- Le verrou sur la vente empêche deux annulations simultanées
  SELECT id, numero_ticket, total, statut, created_at INTO v_vente
    FROM ventes WHERE id = p_vente_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_vente.statut = 'annulee' THEN
    RAISE EXCEPTION 'Cette vente a déjà été annulée' USING ERRCODE = '55000';
  END IF;
  IF v_vente.statut IS DISTINCT FROM 'validee' THEN
    RAISE EXCEPTION 'Impossible d''annuler une vente avec le statut : %', v_vente.statut USING ERRCODE = '55000';
  END IF;

  -- Même règle que l'API : refus au-delà de 7 jours pleins
  v_jours := floor(extract(epoch FROM (localtimestamp - v_vente.created_at)) / 86400);
  IF v_jours > 7 THEN
    RAISE EXCEPTION 'Délai dépassé : cette vente date de % jours. Le délai maximum d''annulation est de 7 jours.', v_jours
      USING ERRCODE = '55000';
  END IF;

  FOR v_ligne IN
    SELECT produit_id, nom_produit, quantite FROM lignes_vente WHERE vente_id = p_vente_id ORDER BY produit_id
  LOOP
    UPDATE stock_boutique
       SET quantite_vendue = greatest(0, COALESCE(quantite_vendue, 0) - v_ligne.quantite),
           updated_at = NOW()
     WHERE produit_id = v_ligne.produit_id;

    IF FOUND THEN
      INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite, commentaire, utilisateur_id, reference_id)
      VALUES (v_ligne.produit_id, 'restauration_annulation', v_ligne.quantite,
              'Annulation vente ' || v_vente.numero_ticket, p_annule_par, p_vente_id);
      v_restaures := v_restaures || jsonb_build_object('nom', v_ligne.nom_produit, 'quantite', v_ligne.quantite);
    ELSE
      v_erreurs := v_erreurs || to_jsonb(format('Produit %s : stock introuvable', COALESCE(v_ligne.nom_produit, v_ligne.produit_id::text)));
    END IF;
  END LOOP;

  UPDATE ventes SET statut = 'annulee' WHERE id = p_vente_id;

  INSERT INTO annulations_ventes (vente_id, numero_ticket, montant_annule, motif, annule_par, annule_le)
  VALUES (p_vente_id, v_vente.numero_ticket, v_vente.total, trim(p_motif), p_annule_par, NOW());

  RETURN jsonb_build_object(
    'numero_ticket', v_vente.numero_ticket,
    'montant', v_vente.total,
    'produitsRestores', v_restaures,
    'erreurs', CASE WHEN jsonb_array_length(v_erreurs) > 0 THEN v_erreurs END
  );
END;
$function$;

-- Production envoyée en boutique (module encore peu utilisé, refait plus tard) : droits du propriétaire pour
-- traverser les verrous, journal, et le prix existant n'est plus écrasé par le prix par défaut de 1000 F
CREATE OR REPLACE FUNCTION public.trigger_production_vers_boutique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_produit_fini_id INTEGER;
  v_prix_vente DECIMAL;
  v_unite_id INTEGER;
BEGIN
  IF NEW.destination = 'Boutique' AND NEW.statut = 'termine' THEN
    SELECT id INTO v_unite_id FROM unites WHERE value = 'pcs' OR value = 'unité' LIMIT 1;
    IF v_unite_id IS NULL THEN
      v_unite_id := 1;
    END IF;
    SELECT id INTO v_produit_fini_id FROM produits WHERE nom ILIKE NEW.produit LIMIT 1;
    IF v_produit_fini_id IS NULL THEN
      INSERT INTO produits (nom, date_achat, prix_achat, quantite, quantite_restante, unite_id, created_by)
      VALUES (NEW.produit, COALESCE(NEW.date_production::date, CURRENT_DATE), COALESCE(NEW.cout_ingredients, 0),
              NEW.quantite, 0, v_unite_id, NEW.producteur_id)
      RETURNING id INTO v_produit_fini_id;
    END IF;
    v_prix_vente := COALESCE(NEW.cout_ingredients, 0) * 1.5;
    IF v_prix_vente <= 0 THEN
      v_prix_vente := 1000;
    END IF;
    PERFORM ajouter_stock_boutique(v_produit_fini_id, NEW.quantite, 'Production', NEW.id, NEW.producteur_id);
    UPDATE stock_boutique SET prix_vente = v_prix_vente, updated_at = NOW()
     WHERE produit_id = v_produit_fini_id AND (prix_vente IS NULL OR prix_vente <= 0);
    PERFORM journal_ecrire_cle('boutique', v_produit_fini_id, NEW.produit, NEW.quantite, 'production',
      'Production #' || NEW.id || ' envoyée directement en boutique', NULL);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erreur lors de l''ajout au stock boutique: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. Verrous : plus aucune écriture directe des quantités, de l'historique ni des prix de vente
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_quantites_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Les lignes de % ne se créent ou ne se suppriment que par les fonctions de stock', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  IF NEW.quantite_disponible IS DISTINCT FROM OLD.quantite_disponible
     OR (TG_TABLE_NAME = 'stock_boutique' AND (NEW.quantite_vendue IS DISTINCT FROM OLD.quantite_vendue
                                              OR NEW.quantite_utilisee IS DISTINCT FROM OLD.quantite_utilisee))
     OR (TG_TABLE_NAME = 'stock_atelier' AND NEW.produit_id IS DISTINCT FROM OLD.produit_id) THEN
    RAISE EXCEPTION 'Les quantités (%) ne changent que par une réception, une vente ou une correction motivée', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  -- Prix de vente et type d'article : réservés au propriétaire et aux gérants
  IF TG_TABLE_NAME = 'stock_boutique'
     AND (NEW.prix_vente IS DISTINCT FROM OLD.prix_vente OR NEW.type_produit IS DISTINCT FROM OLD.type_produit
          OR NEW.produit_id IS DISTINCT FROM OLD.produit_id)
     AND public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent changer le prix ou le type d''un article' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_produits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Un produit se crée par creer_produit (enregistré au journal)' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un produit ne se supprime pas : il s''archive (archiver_produit), son historique est conservé' USING ERRCODE = '42501';
  END IF;
  IF NEW.quantite IS DISTINCT FROM OLD.quantite OR NEW.quantite_restante IS DISTINCT FROM OLD.quantite_restante
     OR NEW.unite_id IS DISTINCT FROM OLD.unite_id OR NEW.actif IS DISTINCT FROM OLD.actif
     OR NEW.archive_le IS DISTINCT FROM OLD.archive_le OR NEW.archive_par IS DISTINCT FROM OLD.archive_par
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Quantités, unité et archivage ne changent que par les fonctions du stock principal' USING ERRCODE = '42501';
  END IF;
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production modifient les produits' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER proteger_produits BEFORE INSERT OR UPDATE OR DELETE ON public.produits
  FOR EACH ROW EXECUTE FUNCTION public.proteger_produits();

-- Historique écrit uniquement par la base (déclencheurs et fonctions) : pas de fausses lignes depuis l'application
REVOKE INSERT, UPDATE, DELETE ON public.mouvements_stock FROM authenticated;
REVOKE INSERT ON public.entrees_boutique FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.utilisations_boutique FROM authenticated;
-- ajouter_stock_boutique n'est appelée que par le déclencheur de production
REVOKE EXECUTE ON FUNCTION public.ajouter_stock_boutique(integer, numeric, character varying, integer, uuid) FROM authenticated;

-- ---------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.journal_ecrire_cle(text, integer, text, numeric, text, text, uuid), public.cle_deja_utilisee(uuid),
  public.stock_total_produit(integer), public.journal_ligne_vente(), public.journal_annulation_vente(), public.proteger_produits(),
  public.creer_produit(text, date, numeric, numeric, integer, numeric, uuid), public.reapprovisionner_produit(integer, numeric, numeric, date, uuid),
  public.modifier_produit(integer, text, date, numeric, integer), public.ajuster_stock_principal(integer, numeric, text),
  public.archiver_produit(integer, text), public.ajuster_stock_atelier(integer, numeric, text), public.vider_stock_atelier(text),
  public.utiliser_stock_boutique(integer, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.journal_ecrire_cle(text, integer, text, numeric, text, text, uuid), public.cle_deja_utilisee(uuid),
  public.stock_total_produit(integer), public.journal_ligne_vente(), public.journal_annulation_vente(), public.proteger_produits()
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.creer_produit(text, date, numeric, numeric, integer, numeric, uuid),
  public.reapprovisionner_produit(integer, numeric, numeric, date, uuid), public.modifier_produit(integer, text, date, numeric, integer),
  public.ajuster_stock_principal(integer, numeric, text), public.archiver_produit(integer, text),
  public.ajuster_stock_atelier(integer, numeric, text), public.vider_stock_atelier(text),
  public.utiliser_stock_boutique(integer, numeric, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
