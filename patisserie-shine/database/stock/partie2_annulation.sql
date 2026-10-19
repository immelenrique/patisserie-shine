-- =====================================================================
-- ANNULATION de partie2_stock_principal.sql (SQL Editor : contient des DROP).
-- À n'appliquer qu'après avoir remis en place l'ancien code de l'application (écrans Stock principal,
-- Stock atelier, Stock boutique), qui n'appelle plus ces fonctions.
-- Restent en place (sans effet sur l'ancien code) : la liste élargie des types de mouvement du journal,
-- car les lignes déjà écrites ne peuvent pas être effacées. Les produits archivés réapparaissent
-- (les colonnes d'archivage sont supprimées).
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER proteger_produits ON public.produits;
DROP TRIGGER journal_ligne_vente ON public.lignes_vente;
DROP TRIGGER journal_annulation_vente ON public.ventes;

DROP FUNCTION public.creer_produit(text, date, numeric, numeric, integer, numeric, uuid);
DROP FUNCTION public.reapprovisionner_produit(integer, numeric, numeric, date, uuid);
DROP FUNCTION public.modifier_produit(integer, text, date, numeric, integer);
DROP FUNCTION public.ajuster_stock_principal(integer, numeric, text);
DROP FUNCTION public.archiver_produit(integer, text);
DROP FUNCTION public.vider_stock_atelier(text);
DROP FUNCTION public.ajuster_stock_atelier(integer, numeric, text);
DROP FUNCTION public.utiliser_stock_boutique(integer, numeric, text);
DROP FUNCTION public.journal_ligne_vente();
DROP FUNCTION public.journal_annulation_vente();
DROP FUNCTION public.proteger_produits();
DROP FUNCTION public.stock_total_produit(integer);
DROP FUNCTION public.cle_deja_utilisee(uuid);
DROP FUNCTION public.journal_ecrire_cle(text, integer, text, numeric, text, text, uuid);

ALTER TABLE public.produits DROP COLUMN motif_archivage;
ALTER TABLE public.produits DROP COLUMN archive_par;
ALTER TABLE public.produits DROP COLUMN archive_le;
ALTER TABLE public.produits DROP COLUMN actif;
DROP INDEX public.journal_stock_produit_idx;
DROP INDEX public.journal_stock_cle_key;
ALTER TABLE public.journal_stock DROP COLUMN cle;

-- Définitions d'avant la partie 2
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
  NEW.auteur_id := auth.uid();
  NEW.auteur_nom := (SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = NEW.auteur_id);
  SELECT empreinte INTO v_precedente FROM journal_stock ORDER BY id DESC LIMIT 1;
  NEW.empreinte_precedente := coalesce(v_precedente, 'origine');
  NEW.empreinte := encode(sha256(convert_to(public.journal_stock_contenu(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_quantites_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' OR public.role_courant() IN ('admin', 'employe_production') THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.quantite_disponible IS NOT DISTINCT FROM OLD.quantite_disponible THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La quantité disponible (%) ne change que par une réception ou une fonction de stock', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION public.enregistrer_vente_boutique(p_items jsonb, p_montant_donne numeric, p_cle uuid)
RETURNS jsonb
LANGUAGE plpgsql
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

-- Définition d'origine (production, 2026-10-19)
CREATE OR REPLACE FUNCTION public.trigger_production_vers_boutique()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_produit_fini_id INTEGER;
  v_prix_vente DECIMAL;
  v_unite_id INTEGER;
BEGIN
  -- Vérifier si la destination est "Boutique"
  IF NEW.destination = 'Boutique' AND NEW.statut = 'termine' THEN
    
    -- Obtenir l'unité par défaut (pièces)
    SELECT id INTO v_unite_id FROM unites WHERE value = 'pcs' OR value = 'unité' LIMIT 1;
    IF v_unite_id IS NULL THEN
      v_unite_id := 1; -- Valeur par défaut
    END IF;
    
    -- Essayer de trouver le produit fini correspondant
    SELECT id INTO v_produit_fini_id
    FROM produits 
    WHERE nom ILIKE NEW.produit
    LIMIT 1;
    
    -- Si le produit n'existe pas, le créer automatiquement
    IF v_produit_fini_id IS NULL THEN
      INSERT INTO produits (
        nom, 
        date_achat, 
        prix_achat, 
        quantite, 
        quantite_restante,
        unite_id,
        created_by
      ) VALUES (
        NEW.produit,
        COALESCE(NEW.date_production::date, CURRENT_DATE),
        COALESCE(NEW.cout_ingredients, 0), -- Coût de production
        NEW.quantite,
        0, -- Ne pas ajouter au stock principal
        v_unite_id,
        NEW.producteur_id
      ) RETURNING id INTO v_produit_fini_id;
    END IF;
    
    -- Calculer un prix de vente (coût + marge de 50% par exemple)
    v_prix_vente := COALESCE(NEW.cout_ingredients, 0) * 1.5;
    IF v_prix_vente <= 0 THEN
      v_prix_vente := 1000; -- Prix par défaut
    END IF;
    
    -- Ajouter au stock boutique
    PERFORM ajouter_stock_boutique(
      v_produit_fini_id,
      NEW.quantite,
      'Production',
      NEW.id,
      NEW.producteur_id
    );
    
    -- Mettre à jour le prix de vente dans stock_boutique
    UPDATE stock_boutique 
    SET prix_vente = v_prix_vente, updated_at = NOW()
    WHERE produit_id = v_produit_fini_id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log l'erreur mais ne pas empêcher la production
  RAISE WARNING 'Erreur lors de l''ajout au stock boutique: %', SQLERRM;
  RETURN NEW;
END;
$function$;

GRANT INSERT, UPDATE, DELETE ON public.mouvements_stock TO authenticated;
GRANT INSERT ON public.entrees_boutique TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.utilisations_boutique TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajouter_stock_boutique(integer, numeric, character varying, integer, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
