-- =====================================================================
-- ANNULATION de ventes_idempotence.sql (contient des DROP : SQL Editor de Supabase).
-- À n'appliquer qu'après avoir remis en place l'ancien code de la caisse, qui n'envoie plus de clé.
-- Les clés déjà enregistrées sont perdues (les ventes, elles, sont conservées).
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION public.enregistrer_vente_boutique(jsonb, numeric, uuid);

-- Corps d'origine (ventes_atomiques.sql)
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

DROP INDEX public.ventes_cle_idempotence_key;
ALTER TABLE public.ventes DROP COLUMN cle_idempotence;

NOTIFY pgrst, 'reload schema';

COMMIT;
