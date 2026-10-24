-- =====================================================================
-- Annulation de la partie 7 : la production peut de nouveau entrer des achats au stock principal
-- (fonctions remises dans leur version de la partie 6). Aucune suppression : exécutable directement.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.creer_produit(p_nom text, p_date_achat date, p_quantite numeric, p_prix_total numeric, p_unite_id integer, p_prix_vente numeric DEFAULT NULL::numeric, p_cle uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id integer;
  v_prix_unitaire numeric;
  v_depense integer;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants, le magasinier et la production peuvent créer un produit' USING ERRCODE = '42501';
  END IF;
  IF public.cle_deja_utilisee(p_cle) THEN
    SELECT produit_id INTO v_id FROM journal_stock WHERE cle = p_cle;
    RETURN jsonb_build_object('produit_id', v_id, 'deja_enregistre', true, 'depense_id', public.depense_de_cle(p_cle));
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
  v_depense := public.depense_achat_creer('achat_stock', v_id, trim(p_nom), p_quantite, p_unite_id, p_prix_total,
    p_date_achat, currval('public.journal_stock_id_seq'));
  RETURN jsonb_build_object('produit_id', v_id, 'deja_enregistre', false, 'depense_id', v_depense);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reapprovisionner_produit(p_produit_id integer, p_quantite numeric, p_prix_total numeric, p_date_achat date DEFAULT NULL::date, p_cle uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p record;
  v_prix_moyen numeric;
  v_depense integer;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants, le magasinier et la production peuvent réapprovisionner' USING ERRCODE = '42501';
  END IF;
  IF public.cle_deja_utilisee(p_cle) THEN
    RETURN jsonb_build_object('produit_id', p_produit_id, 'deja_enregistre', true, 'depense_id', public.depense_de_cle(p_cle));
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
  v_depense := public.depense_achat_creer('reapprovisionnement_stock', p_produit_id, v_p.nom, p_quantite, v_p.unite_id,
    p_prix_total, p_date_achat, currval('public.journal_stock_id_seq'));
  RETURN jsonb_build_object('produit_id', p_produit_id, 'deja_enregistre', false, 'depense_id', v_depense,
    'quantite_restante', v_p.quantite_restante + p_quantite, 'prix_achat', v_prix_moyen);
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
