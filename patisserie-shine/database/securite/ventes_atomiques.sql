-- =====================================================================
-- VENTES ATOMIQUES (boutique) : enregistrement et annulation en une seule transaction
-- Projet : bakery-stock-management. Prérequis : phases 1 et 2 et corrections 1 appliquées.
-- Aucune suppression : applicable directement.
--
-- Avant : la vente était écrite en plusieurs appels séparés depuis le navigateur, erreurs ignorées
--   (19 ventes validées sans aucune ligne, 31 ventes au total incohérent en production), le prix et le
--   total venaient du navigateur, le stock n'était pas vérifié côté serveur (5 stocks négatifs) et deux
--   caisses simultanées pouvaient écraser le décompte. L'annulation rendait le stock avant de marquer la
--   vente annulée, sans verrou : deux annulations simultanées rendaient le stock deux fois.
--
-- 1. enregistrer_vente_boutique(p_items, p_montant_donne) : appelée par la caisse (utilisateur connecté,
--    RLS appliquée). Verrouille les lignes de stock, vérifie le stock réel (disponible - vendu - utilisé),
--    prend le prix en base, calcule total et monnaie, écrit vente + lignes + sorties + décompte : tout ou rien.
-- 2. annuler_vente_boutique(p_vente_id, p_motif, p_annule_par) : appelée uniquement par la route serveur
--    /api/admin/cancel-sale (service_role, après contrôle admin). Verrouille la vente, vérifie statut et délai
--    de 7 jours, rend le stock, trace les mouvements, marque la vente annulée, enregistre l'annulation.
--
-- Annulation : ventes_atomiques_annulation.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.enregistrer_vente_boutique(p_items jsonb, p_montant_donne numeric)
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
BEGIN
  IF v_vendeur IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non connecté' USING ERRCODE = '42501';
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

  INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, statut)
  VALUES (v_ticket, v_total, p_montant_donne, p_montant_donne - v_total, v_vendeur, 'validee')
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

-- Droits : la vente pour les connectés ; l'annulation uniquement pour le serveur
REVOKE EXECUTE ON FUNCTION public.enregistrer_vente_boutique(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_vente_boutique(jsonb, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.annuler_vente_boutique(integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_vente_boutique(integer, text, uuid) TO service_role;

COMMIT;
