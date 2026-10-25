-- =====================================================================
-- Partie 10 : cuisine sécurisée, comme la boutique
-- =====================================================================
-- Prérequis : parties 1 à 9 appliquées.
--
-- Avant :
--  - l'écran de caisse cuisine écrivait lui-même la vente, ses lignes, le stock et les mouvements :
--    le prix et le total venaient du navigateur, et une coupure entre deux écritures laissait une vente
--    sans baisse de stock (ou l'inverse) ;
--  - un double clic enregistrait la vente deux fois ;
--  - n'importe quel compte cuisine pouvait modifier le stock cuisine, et l'historique des mouvements
--    pouvait être modifié ou effacé ;
--  - une vente pouvait être supprimée sans trace ;
--  - la caissière cuisine n'avait ni ouverture ni clôture de caisse.
-- Maintenant :
--  - enregistrer_vente_cuisine : prix et stock lus par la base, vente, lignes, stock et mouvements en une
--    seule fois ; la même vente envoyée deux fois n'est enregistrée qu'une fois (clé) ;
--  - annuler_vente_cuisine : réservée au propriétaire et aux gérants, motif obligatoire, 7 jours au plus,
--    stock remis et annulation gardée ;
--  - entree_stock_cuisine et ajuster_stock_cuisine : réservées au propriétaire et aux gérants, toujours
--    tracées (motif obligatoire pour une correction) ;
--  - ventes, lignes, stock et mouvements de la cuisine ne s'écrivent plus que par ces fonctions ;
--    l'historique des mouvements et les annulations ne se modifient plus ; aucune vente ne se supprime ;
--  - la caissière cuisine ouvre et clôture sa caisse à l'aveugle comme en boutique : ses ventes cuisine
--    comptent dans le montant attendu ;
--  - recap_cuisine : ventes par vendeur, annulations, entrées et corrections de stock, ventes faites
--    sans caisse ouverte.
-- Aucune suppression : peut être exécuté directement. Retour arrière : partie10_annulation.sql (SQL Editor).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Tables : anti-doublon des ventes, annulations tracées, historique inaltérable
-- ---------------------------------------------------------------------
ALTER TABLE public.ventes_cuisine ADD COLUMN cle uuid UNIQUE;

CREATE TABLE public.annulations_ventes_cuisine (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vente_cuisine_id integer NOT NULL UNIQUE REFERENCES public.ventes_cuisine (id),
  numero_ticket varchar,
  montant numeric NOT NULL,
  motif text NOT NULL CHECK (length(trim(motif)) >= 10),
  annule_par uuid NOT NULL REFERENCES public.profiles (id),
  annule_le timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER annulations_ventes_cuisine_inalterables BEFORE UPDATE OR DELETE ON public.annulations_ventes_cuisine
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
-- L'historique des mouvements de la cuisine ne se modifie plus et ne s'efface plus
CREATE TRIGGER mouvements_stock_cuisine_inalterables BEFORE UPDATE OR DELETE ON public.mouvements_stock_cuisine
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER ventes_cuisine_sans_suppression BEFORE DELETE ON public.ventes_cuisine
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER lignes_vente_cuisine_sans_suppression BEFORE DELETE ON public.lignes_vente_cuisine
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();

ALTER TABLE public.annulations_ventes_cuisine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Annulations cuisine lisibles par la cuisine et les gérants" ON public.annulations_ventes_cuisine
  FOR SELECT TO authenticated USING ((SELECT public.role_courant()) IN ('admin', 'employe_cuisine'));
REVOKE ALL ON public.annulations_ventes_cuisine FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.annulations_ventes_cuisine FROM authenticated;

-- Ventes, lignes, stock et mouvements de la cuisine ne s'écrivent plus que par les fonctions ci-dessous
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ventes_cuisine, public.lignes_vente_cuisine,
  public.stock_cuisine, public.mouvements_stock_cuisine FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. Vente en cuisine : prix et stock de la base, une seule fois même en cas de double envoi
-- ---------------------------------------------------------------------
-- p_items : [{"id": <produit_cuisine_id>, "quantite": 2}, …]
CREATE OR REPLACE FUNCTION public.enregistrer_vente_cuisine(p_items jsonb, p_montant_donne numeric, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id integer;
  v_q numeric;
  v_s record;
  v_lignes jsonb := '[]'::jsonb;
  v_l jsonb;
  v_total numeric := 0;
  v_vente integer;
  v_ticket text;
  v_ex record;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_cuisine') THEN
    RAISE EXCEPTION 'Seuls la cuisine, le propriétaire et les gérants vendent en cuisine' USING ERRCODE = '42501';
  END IF;
  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    SELECT * INTO v_ex FROM ventes_cuisine WHERE cle = p_cle;
    IF FOUND THEN
      IF v_ex.vendeur_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Clé de vente déjà utilisée' USING ERRCODE = '22023';
      END IF;
      RETURN jsonb_build_object('id', v_ex.id, 'numero_ticket', v_ex.numero_ticket, 'total', v_ex.total,
        'montant_donne', v_ex.montant_donne, 'monnaie_rendue', v_ex.monnaie_rendue, 'deja_enregistree', true,
        'items', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', l.produit_cuisine_id, 'nom', l.nom_produit, 'prix', l.prix_unitaire,
                   'quantite', l.quantite, 'total', l.sous_total) ORDER BY l.id), '[]'::jsonb)
                   FROM lignes_vente_cuisine l WHERE l.vente_cuisine_id = v_ex.id));
    END IF;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide' USING ERRCODE = '22023';
  END IF;

  -- Articles regroupés, verrous dans un ordre fixe (pas d'interblocage entre deux caisses)
  FOR v_id, v_q IN SELECT (e->>'id')::integer, sum((e->>'quantite')::numeric) FROM jsonb_array_elements(p_items) e GROUP BY 1 ORDER BY 1 LOOP
    IF v_id IS NULL OR v_q IS NULL OR v_q <= 0 THEN
      RAISE EXCEPTION 'Article invalide dans le panier' USING ERRCODE = '22023';
    END IF;
    SELECT sc.id, sc.quantite_disponible, pc.nom, coalesce(nullif(sc.prix_vente, 0), pc.prix_vente) AS prix, pc.actif
      INTO v_s
      FROM stock_cuisine sc JOIN produits_cuisine pc ON pc.id = sc.produit_cuisine_id
     WHERE sc.produit_cuisine_id = v_id
       FOR UPDATE OF sc;
    IF NOT FOUND OR NOT coalesce(v_s.actif, true) THEN
      RAISE EXCEPTION 'Produit % introuvable en cuisine', v_id USING ERRCODE = 'P0002';
    END IF;
    IF v_s.prix IS NULL OR v_s.prix <= 0 THEN
      RAISE EXCEPTION 'Aucun prix de vente défini pour « % »', v_s.nom USING ERRCODE = '22023';
    END IF;
    IF coalesce(v_s.quantite_disponible, 0) < v_q THEN
      RAISE EXCEPTION 'Stock insuffisant pour « % » : % disponible(s), % demandé(s)', v_s.nom, greatest(coalesce(v_s.quantite_disponible, 0), 0), v_q
        USING ERRCODE = '23514';
    END IF;
    v_lignes := v_lignes || jsonb_build_object('id', v_id, 'nom', v_s.nom, 'prix', v_s.prix, 'quantite', v_q, 'total', v_s.prix * v_q,
      'stock_id', v_s.id, 'avant', coalesce(v_s.quantite_disponible, 0));
    v_total := v_total + v_s.prix * v_q;
  END LOOP;

  IF p_montant_donne IS NULL OR p_montant_donne < v_total THEN
    RAISE EXCEPTION 'Montant donné insuffisant : le total est de % FCFA', v_total USING ERRCODE = '22023';
  END IF;

  v_ticket := 'C-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 5);
  INSERT INTO ventes_cuisine (numero_ticket, vendeur_id, total, montant_donne, monnaie_rendue, statut, cle)
  VALUES (v_ticket, v_uid, v_total, p_montant_donne, p_montant_donne - v_total, 'validee', p_cle)
  RETURNING id INTO v_vente;

  FOR v_l IN SELECT * FROM jsonb_array_elements(v_lignes) LOOP
    INSERT INTO lignes_vente_cuisine (vente_cuisine_id, produit_cuisine_id, nom_produit, quantite, prix_unitaire, sous_total)
    VALUES (v_vente, (v_l->>'id')::integer, v_l->>'nom', (v_l->>'quantite')::numeric, (v_l->>'prix')::numeric, (v_l->>'total')::numeric);
    UPDATE stock_cuisine
       SET quantite_disponible = quantite_disponible - (v_l->>'quantite')::numeric,
           quantite_vendue = coalesce(quantite_vendue, 0) + (v_l->>'quantite')::numeric, updated_at = now()
     WHERE id = (v_l->>'stock_id')::integer;
    INSERT INTO mouvements_stock_cuisine (produit_cuisine_id, type_mouvement, quantite, quantite_avant, quantite_apres,
                                          utilisateur_id, reference_id, commentaire)
    VALUES ((v_l->>'id')::integer, 'vente', (v_l->>'quantite')::numeric, (v_l->>'avant')::numeric,
            (v_l->>'avant')::numeric - (v_l->>'quantite')::numeric, v_uid, v_vente, 'Vente - Ticket ' || v_ticket);
  END LOOP;

  RETURN jsonb_build_object('id', v_vente, 'numero_ticket', v_ticket, 'total', v_total, 'montant_donne', p_montant_donne,
    'monnaie_rendue', p_montant_donne - v_total, 'deja_enregistree', false,
    'items', (SELECT jsonb_agg(x - 'stock_id' - 'avant') FROM jsonb_array_elements(v_lignes) x));
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. Annulation d'une vente (propriétaire et gérants), motif obligatoire, 7 jours au plus
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.annuler_vente_cuisine(p_vente_id integer, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_v record;
  v_l record;
  v_avant numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants annulent une vente' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN
    RAISE EXCEPTION 'Le motif doit contenir au moins 10 caractères' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_v FROM ventes_cuisine WHERE id = p_vente_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_v.statut = 'annulee' THEN
    RAISE EXCEPTION 'Cette vente a déjà été annulée' USING ERRCODE = '55000';
  END IF;
  IF now() - v_v.created_at > interval '8 days' THEN
    RAISE EXCEPTION 'Délai dépassé : une vente s''annule dans les 7 jours' USING ERRCODE = '55000';
  END IF;
  FOR v_l IN SELECT produit_cuisine_id, quantite FROM lignes_vente_cuisine WHERE vente_cuisine_id = p_vente_id ORDER BY produit_cuisine_id LOOP
    SELECT quantite_disponible INTO v_avant FROM stock_cuisine WHERE produit_cuisine_id = v_l.produit_cuisine_id FOR UPDATE;
    UPDATE stock_cuisine
       SET quantite_disponible = coalesce(quantite_disponible, 0) + v_l.quantite,
           quantite_vendue = greatest(0, coalesce(quantite_vendue, 0) - v_l.quantite), updated_at = now()
     WHERE produit_cuisine_id = v_l.produit_cuisine_id;
    INSERT INTO mouvements_stock_cuisine (produit_cuisine_id, type_mouvement, quantite, quantite_avant, quantite_apres,
                                          utilisateur_id, reference_id, commentaire, raison)
    VALUES (v_l.produit_cuisine_id, 'entree', v_l.quantite, coalesce(v_avant, 0), coalesce(v_avant, 0) + v_l.quantite,
            v_uid, p_vente_id, 'Annulation de la vente ' || v_v.numero_ticket, trim(p_motif));
  END LOOP;
  UPDATE ventes_cuisine SET statut = 'annulee', updated_at = now() WHERE id = p_vente_id;
  INSERT INTO annulations_ventes_cuisine (vente_cuisine_id, numero_ticket, montant, motif, annule_par)
  VALUES (p_vente_id, v_v.numero_ticket, v_v.total, trim(p_motif), v_uid);
  RETURN jsonb_build_object('numero_ticket', v_v.numero_ticket, 'montant', v_v.total);
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. Entrées et corrections du stock cuisine (propriétaire et gérants), toujours tracées
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entree_stock_cuisine(p_produit_cuisine_id integer, p_quantite numeric,
  p_prix_vente numeric DEFAULT NULL, p_commentaire text DEFAULT NULL, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_avant numeric;
  v_nom text;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants ajoutent du stock en cuisine' USING ERRCODE = '42501';
  END IF;
  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    IF EXISTS (SELECT 1 FROM mouvements_stock_cuisine WHERE type_mouvement = 'entree' AND raison = 'cle:' || p_cle::text) THEN
      RETURN jsonb_build_object('produit_cuisine_id', p_produit_cuisine_id, 'deja_enregistre', true);
    END IF;
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  IF p_prix_vente IS NOT NULL AND p_prix_vente < 0 THEN
    RAISE EXCEPTION 'Prix de vente invalide' USING ERRCODE = '22023';
  END IF;
  SELECT nom INTO v_nom FROM produits_cuisine WHERE id = p_produit_cuisine_id AND coalesce(actif, true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit cuisine introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT quantite_disponible INTO v_avant FROM stock_cuisine WHERE produit_cuisine_id = p_produit_cuisine_id FOR UPDATE;
  IF FOUND THEN
    UPDATE stock_cuisine SET quantite_disponible = coalesce(quantite_disponible, 0) + p_quantite,
           prix_vente = coalesce(p_prix_vente, prix_vente), updated_at = now()
     WHERE produit_cuisine_id = p_produit_cuisine_id;
  ELSE
    INSERT INTO stock_cuisine (produit_cuisine_id, quantite_disponible, quantite_vendue, prix_vente)
    VALUES (p_produit_cuisine_id, p_quantite, 0, p_prix_vente);
  END IF;
  INSERT INTO mouvements_stock_cuisine (produit_cuisine_id, type_mouvement, quantite, quantite_avant, quantite_apres,
                                        utilisateur_id, commentaire, raison)
  VALUES (p_produit_cuisine_id, 'entree', p_quantite, coalesce(v_avant, 0), coalesce(v_avant, 0) + p_quantite, auth.uid(),
          coalesce(nullif(trim(p_commentaire), ''), 'Entrée en stock cuisine'), CASE WHEN p_cle IS NOT NULL THEN 'cle:' || p_cle::text END);
  RETURN jsonb_build_object('produit_cuisine_id', p_produit_cuisine_id, 'deja_enregistre', false,
    'quantite_disponible', coalesce(v_avant, 0) + p_quantite);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ajuster_stock_cuisine(p_produit_cuisine_id integer, p_nouvelle_quantite numeric, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_avant numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants corrigent le stock cuisine' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de la correction' USING ERRCODE = '22023';
  END IF;
  IF p_nouvelle_quantite IS NULL OR p_nouvelle_quantite < 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  SELECT quantite_disponible INTO v_avant FROM stock_cuisine WHERE produit_cuisine_id = p_produit_cuisine_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit absent du stock cuisine' USING ERRCODE = 'P0002';
  END IF;
  IF p_nouvelle_quantite <> coalesce(v_avant, 0) THEN
    UPDATE stock_cuisine SET quantite_disponible = p_nouvelle_quantite, updated_at = now() WHERE produit_cuisine_id = p_produit_cuisine_id;
    INSERT INTO mouvements_stock_cuisine (produit_cuisine_id, type_mouvement, quantite, quantite_avant, quantite_apres,
                                          utilisateur_id, commentaire, raison)
    VALUES (p_produit_cuisine_id, 'ajustement', abs(p_nouvelle_quantite - coalesce(v_avant, 0)), coalesce(v_avant, 0), p_nouvelle_quantite,
            auth.uid(), 'Correction : ' || coalesce(v_avant, 0) || ' → ' || p_nouvelle_quantite, trim(p_motif));
  END IF;
  RETURN jsonb_build_object('produit_cuisine_id', p_produit_cuisine_id, 'ecart', p_nouvelle_quantite - coalesce(v_avant, 0));
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. Récapitulatif (propriétaire)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recap_cuisine(p_du date, p_au date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_debut timestamptz := p_du::timestamp AT TIME ZONE 'Africa/Ouagadougou';
  v_fin timestamptz := (p_au + 1)::timestamp AT TIME ZONE 'Africa/Ouagadougou';
BEGIN
  IF NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé au propriétaire' USING ERRCODE = '42501';
  END IF;
  IF p_du IS NULL OR p_au IS NULL OR p_au < p_du OR p_au - p_du > 92 THEN
    RAISE EXCEPTION 'Période invalide' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'ventes', (SELECT jsonb_build_object('nombre', count(*), 'total', coalesce(sum(total), 0),
        'par_vendeur', coalesce((SELECT jsonb_agg(jsonb_build_object('vendeur', x.vendeur, 'nombre', x.nombre, 'total', x.total) ORDER BY x.total DESC)
          FROM (SELECT recap_nom(vendeur_id) AS vendeur, count(*) AS nombre, sum(total) AS total FROM ventes_cuisine
                 WHERE created_at >= v_debut AND created_at < v_fin AND statut IS DISTINCT FROM 'annulee' GROUP BY vendeur_id) x), '[]'::jsonb))
      FROM ventes_cuisine WHERE created_at >= v_debut AND created_at < v_fin AND statut IS DISTINCT FROM 'annulee'),
    'annulations', (SELECT coalesce(jsonb_agg(jsonb_build_object('le', a.annule_le, 'ticket', a.numero_ticket, 'montant', a.montant,
        'motif', a.motif, 'annule_par', recap_nom(a.annule_par), 'vendeur', recap_nom(v.vendeur_id)) ORDER BY a.annule_le), '[]'::jsonb)
      FROM annulations_ventes_cuisine a JOIN ventes_cuisine v ON v.id = a.vente_cuisine_id WHERE a.annule_le >= v_debut AND a.annule_le < v_fin),
    'mouvements', (SELECT coalesce(jsonb_agg(jsonb_build_object('le', m.created_at, 'type', m.type_mouvement, 'produit', p.nom,
        'quantite', m.quantite, 'avant', m.quantite_avant, 'apres', m.quantite_apres, 'par', recap_nom(m.utilisateur_id),
        'commentaire', m.commentaire, 'motif', CASE WHEN m.raison LIKE 'cle:%' THEN NULL ELSE m.raison END) ORDER BY m.created_at), '[]'::jsonb)
      FROM mouvements_stock_cuisine m LEFT JOIN produits_cuisine p ON p.id = m.produit_cuisine_id
     WHERE m.created_at >= v_debut AND m.created_at < v_fin AND m.type_mouvement IN ('entree', 'ajustement', 'sortie')),
    'hors_caisse', (SELECT coalesce(jsonb_agg(jsonb_build_object('vendeur', x.vendeur, 'nombre', x.nombre, 'total', x.total)), '[]'::jsonb)
      FROM (SELECT recap_nom(v.vendeur_id) AS vendeur, count(*) AS nombre, sum(v.total) AS total
              FROM ventes_cuisine v
             WHERE v.created_at >= v_debut AND v.created_at < v_fin AND v.statut IS DISTINCT FROM 'annulee'
               AND NOT EXISTS (SELECT 1 FROM caisses_actives c WHERE c.caissier_id = v.vendeur_id AND v.created_at >= c.date_ouverture
                                 AND (c.date_fermeture IS NULL OR v.created_at <= c.date_fermeture))
             GROUP BY v.vendeur_id) x));
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.enregistrer_vente_cuisine(jsonb, numeric, uuid), public.annuler_vente_cuisine(integer, text),
  public.entree_stock_cuisine(integer, numeric, numeric, text, uuid), public.ajuster_stock_cuisine(integer, numeric, text),
  public.recap_cuisine(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_vente_cuisine(jsonb, numeric, uuid), public.annuler_vente_cuisine(integer, text),
  public.entree_stock_cuisine(integer, numeric, numeric, text, uuid), public.ajuster_stock_cuisine(integer, numeric, text),
  public.recap_cuisine(date, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Caisse : la cuisine ouvre et clôture comme la boutique
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ouvrir_caisse(p_fond numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_c record;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('employe_boutique', 'employe_cuisine', 'admin') THEN
    RAISE EXCEPTION 'Seuls la boutique, la cuisine, le propriétaire et les gérants tiennent une caisse' USING ERRCODE = '42501';
  END IF;
  IF p_fond IS NULL OR p_fond < 0 THEN
    RAISE EXCEPTION 'Fond de caisse invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte';
  IF FOUND THEN
    RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', true, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
  END IF;
  BEGIN
    INSERT INTO caisses_actives (caissier_id, date_ouverture, fond_caisse_initial, statut, poste_caisse, details)
    VALUES (v_uid, now(), p_fond, 'ouverte', 'principal', jsonb_build_object('comptages', '[]'::jsonb))
    RETURNING * INTO v_c;
  EXCEPTION WHEN unique_violation THEN
    -- Ouverte au même instant par un double clic : on renvoie celle qui existe
    SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte';
    RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', true, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
  END;
  RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', false, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
END;
$function$;

-- ---------------------------------------------------------------------
-- 8. Clôture : comptage à l'aveugle, ventes boutique et cuisine dans l'attendu
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cloturer_caisse(p_montant numeric, p_confirmer boolean DEFAULT false, p_motif text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_c record;
  v_nb integer;
  v_total numeric;
  v_theorique numeric;
  v_comptages jsonb;
  v_releve bigint;
  v_ecart numeric;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('employe_boutique', 'employe_cuisine', 'admin') THEN
    RAISE EXCEPTION 'Seuls la boutique, la cuisine, le propriétaire et les gérants tiennent une caisse' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant < 0 THEN
    RAISE EXCEPTION 'Montant compté invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune caisse ouverte à votre nom' USING ERRCODE = 'P0002';
  END IF;

  -- Montant attendu : fond + ventes validées de cette personne depuis l'ouverture (ventes.created_at est en UTC, sans fuseau)
  SELECT count(*), coalesce(sum(total), 0) INTO v_nb, v_total
    FROM ventes
   WHERE vendeur_id = v_uid AND statut IS DISTINCT FROM 'annulee'
     AND created_at >= (v_c.date_ouverture AT TIME ZONE 'UTC');
  -- Ventes cuisine de la même personne (ventes_cuisine.created_at porte le fuseau)
  SELECT v_nb + count(*), v_total + coalesce(sum(total), 0) INTO v_nb, v_total
    FROM ventes_cuisine
   WHERE vendeur_id = v_uid AND statut IS DISTINCT FROM 'annulee'
     AND created_at >= v_c.date_ouverture;
  v_theorique := coalesce(v_c.fond_caisse_initial, 0) + v_total;
  v_ecart := p_montant - v_theorique;

  -- Chaque comptage est gardé, même ceux qui ont été refaits
  v_comptages := coalesce(v_c.details -> 'comptages', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('montant', p_montant, 'le', now()));

  IF v_ecart <> 0 AND NOT coalesce(p_confirmer, false) THEN
    UPDATE caisses_actives SET details = coalesce(details, '{}'::jsonb) || jsonb_build_object('comptages', v_comptages), updated_at = now()
     WHERE id = v_c.id;
    -- Le montant attendu n'est pas révélé : on recompte
    RETURN jsonb_build_object('statut', 'ecart', 'comptages', jsonb_array_length(v_comptages));
  END IF;
  IF v_ecart <> 0 AND (p_motif IS NULL OR length(trim(p_motif)) < 3) THEN
    RAISE EXCEPTION 'Motif obligatoire pour clôturer avec un écart' USING ERRCODE = '22023';
  END IF;

  INSERT INTO releves_caisse (caisse_active_id, caissier_id, date_releve, fond_caisse_initial, total_ventes, nombre_ventes,
    montant_theorique, montant_reel, details_ventes, duree_shift, statut, observations)
  VALUES (v_c.id, v_uid, now(), coalesce(v_c.fond_caisse_initial, 0), v_total, v_nb, v_theorique, p_montant,
    jsonb_build_object('comptages', v_comptages), left(date_trunc('minute', now() - v_c.date_ouverture)::text, 20), 'complete',
    nullif(trim(coalesce(p_motif, '')), ''))
  RETURNING id INTO v_releve;

  UPDATE caisses_actives
     SET statut = 'fermee', date_fermeture = now(), montant_final = p_montant, releve_id = v_releve,
         details = coalesce(details, '{}'::jsonb) || jsonb_build_object('comptages', v_comptages), updated_at = now()
   WHERE id = v_c.id;

  IF v_ecart <> 0 THEN
    PERFORM notify_all_admins('alerte_generale',
      'Écart de caisse : ' || coalesce((SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = v_uid), '?')
        || ' (' || CASE WHEN v_ecart > 0 THEN '+' ELSE '' END || v_ecart || ' F)',
      'Attendu ' || v_theorique || ' F (fond ' || coalesce(v_c.fond_caisse_initial, 0) || ' + ventes ' || v_total || '), compté '
        || p_montant || ' F en ' || jsonb_array_length(v_comptages) || ' comptage(s). Motif : ' || trim(p_motif),
      '/caisse');
  END IF;

  RETURN jsonb_build_object('statut', 'cloturee', 'releve_id', v_releve, 'fond', coalesce(v_c.fond_caisse_initial, 0),
    'total_ventes', v_total, 'nombre_ventes', v_nb, 'attendu', v_theorique, 'compte', p_montant, 'ecart', v_ecart,
    'comptages', jsonb_array_length(v_comptages));
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
