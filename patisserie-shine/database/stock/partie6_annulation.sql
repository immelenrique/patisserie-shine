-- =====================================================================
-- Annulation de la partie 6 (magasinier, confirmation des achats) : SQL Editor
-- =====================================================================
-- Refusée tant qu'un compte a le rôle magasinier : changez d'abord son rôle (écran Équipe).
-- Les confirmations d'achats déjà faites sont supprimées avec leur table : la liste est affichée
-- ci-dessous avant l'annulation, pour la garder si besoin.
-- Achats, dépenses, reçus, demandes et envois restent tels quels.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'magasinier') THEN
    RAISE EXCEPTION 'Des comptes ont encore le rôle magasinier : changez leur rôle avant d''annuler la partie 6';
  END IF;
END $$;

-- Pour mémoire : les confirmations qui vont disparaître
SELECT c.depense_id, d.description, d.montant, c.conforme, c.commentaire, c.le
  FROM public.confirmations_achats c JOIN public.depenses_comptables d ON d.id = c.depense_id ORDER BY c.le;

DROP FUNCTION public.achats_a_confirmer();
DROP FUNCTION public.confirmer_achat(integer, boolean, text);
DROP TABLE public.confirmations_achats;
DROP POLICY "Envois du stock principal visibles par le magasinier" ON public.envois;

-- Fonctions remises dans leur version de la partie 5
CREATE OR REPLACE FUNCTION public.valider_demande_groupee(p_groupe_id bigint, p_quantites jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_groupe record;
  v_destination text;
  v_envoi bigint;
  v_ligne record;
  v_quantite numeric;
  v_produit record;
  v_auto boolean;
  v_lignes jsonb := '[]'::jsonb;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent valider une demande' USING ERRCODE = '42501';
  END IF;
  IF p_quantites IS NOT NULL AND jsonb_typeof(p_quantites) <> 'object' THEN
    RAISE EXCEPTION 'Quantités validées invalides' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_groupe FROM demandes_groupees WHERE id = p_groupe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_groupe.statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée (statut : %)', v_groupe.statut USING ERRCODE = '55000';
  END IF;
  v_destination := CASE WHEN v_groupe.destination = 'Boutique' THEN 'boutique'
                        WHEN v_groupe.destination IN ('Production', 'Atelier') THEN 'atelier' END;
  IF v_destination IS NULL THEN
    RAISE EXCEPTION 'Destination inconnue : %', v_groupe.destination USING ERRCODE = '22023';
  END IF;

  v_auto := v_groupe.demandeur_id IS NOT DISTINCT FROM v_uid;
  INSERT INTO envois (origine, destination, demande_groupee_id, demandeur_id, valideur_id, auto_validation)
  VALUES ('principal', v_destination, p_groupe_id, v_groupe.demandeur_id, v_uid, v_auto)
  RETURNING id INTO v_envoi;

  -- Ordre fixe des verrous (par produit) : pas d'interblocage entre deux validations
  FOR v_ligne IN
    SELECT produit_id, sum(quantite) AS quantite FROM demandes
     WHERE demande_groupee_id = p_groupe_id AND statut = 'en_attente'
     GROUP BY produit_id ORDER BY produit_id
  LOOP
    v_quantite := v_ligne.quantite;
    IF p_quantites ? v_ligne.produit_id::text THEN
      BEGIN
        v_quantite := (p_quantites ->> v_ligne.produit_id::text)::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Quantité validée invalide pour le produit %', v_ligne.produit_id USING ERRCODE = '22023';
      END;
      IF v_quantite IS NULL OR v_quantite < 0 OR v_quantite > v_ligne.quantite THEN
        RAISE EXCEPTION 'La quantité validée doit être comprise entre 0 et la quantité demandée (%)', v_ligne.quantite
          USING ERRCODE = '22023';
      END IF;
    END IF;
    CONTINUE WHEN v_quantite = 0;

    SELECT p.id, p.nom, p.quantite_restante, u.label AS unite INTO v_produit
      FROM produits p LEFT JOIN unites u ON u.id = p.unite_id
     WHERE p.id = v_ligne.produit_id
       FOR UPDATE OF p;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit % introuvable dans le stock principal', v_ligne.produit_id USING ERRCODE = 'P0002';
    END IF;
    IF v_produit.quantite_restante < v_quantite THEN
      RAISE EXCEPTION 'Stock principal insuffisant pour « % » : % disponible(s), % demandé(s)',
        v_produit.nom, v_produit.quantite_restante, v_quantite USING ERRCODE = '23514';
    END IF;

    UPDATE produits SET quantite_restante = quantite_restante - v_quantite, updated_at = now() WHERE id = v_produit.id;
    INSERT INTO envoi_lignes (envoi_id, produit_id, produit_nom, unite, quantite_demandee, quantite_envoyee)
    VALUES (v_envoi, v_produit.id, v_produit.nom, v_produit.unite, v_ligne.quantite, v_quantite);
    PERFORM journal_ecrire('principal', v_produit.id, v_produit.nom, -v_quantite, 'envoi', v_envoi, NULL);
    PERFORM journal_ecrire('transit', v_produit.id, v_produit.nom, v_quantite, 'envoi', v_envoi, NULL);
    v_lignes := v_lignes || jsonb_build_object('produit_id', v_produit.id, 'produit_nom', v_produit.nom,
      'unite', v_produit.unite, 'quantite_demandee', v_ligne.quantite, 'quantite_envoyee', v_quantite);
  END LOOP;

  IF jsonb_array_length(v_lignes) = 0 THEN
    RAISE EXCEPTION 'Aucune quantité à envoyer : utilisez « Refuser »' USING ERRCODE = '22023';
  END IF;

  UPDATE demandes d
     SET statut = CASE WHEN EXISTS (SELECT 1 FROM envoi_lignes el WHERE el.envoi_id = v_envoi AND el.produit_id = d.produit_id)
                       THEN 'validee' ELSE 'refusee' END,
         valideur_id = v_uid, date_validation = now(), updated_at = now()
   WHERE d.demande_groupee_id = p_groupe_id AND d.statut = 'en_attente';
  -- Le déclencheur prevent_invalid_status_changes impose le passage par en_traitement
  UPDATE demandes_groupees SET statut = 'en_traitement' WHERE id = p_groupe_id;
  UPDATE demandes_groupees
     SET statut = 'validee', valideur_id = v_uid, date_validation = now(),
         details_validation = jsonb_build_object('envoi_id', v_envoi, 'auto_validation', v_auto)
   WHERE id = p_groupe_id;

  RETURN jsonb_build_object('envoi_id', v_envoi, 'destination', v_destination, 'auto_validation', v_auto, 'lignes', v_lignes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refuser_demande(p_groupe_id bigint, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_statut text;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent refuser une demande' USING ERRCODE = '42501';
  END IF;
  SELECT statut INTO v_statut FROM demandes_groupees WHERE id = p_groupe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée (statut : %)', v_statut USING ERRCODE = '55000';
  END IF;

  UPDATE demandes SET statut = 'refusee', valideur_id = v_uid, date_validation = now(), updated_at = now()
   WHERE demande_groupee_id = p_groupe_id AND statut = 'en_attente';
  UPDATE demandes_groupees SET statut = 'en_traitement' WHERE id = p_groupe_id;
  UPDATE demandes_groupees
     SET statut = 'refusee', valideur_id = v_uid, date_validation = now(),
         details_validation = jsonb_build_object('refus', jsonb_build_object('par', v_uid, 'date', now(), 'raison', nullif(trim(p_raison), '')))
   WHERE id = p_groupe_id;
  RETURN jsonb_build_object('statut', 'refusee');
END;
$function$;

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
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production peuvent créer un produit' USING ERRCODE = '42501';
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
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls le propriétaire, les gérants et la production peuvent réapprovisionner' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.notify_new_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_demandeur_nom VARCHAR; v_message TEXT; v_details TEXT;
BEGIN
  SELECT nom INTO v_demandeur_nom FROM profiles WHERE id = NEW.demandeur_id;
  v_message := 'Nouvelle demande de ' || COALESCE(v_demandeur_nom, 'Utilisateur');
  v_details := 'Destination: ' || NEW.destination || ' - ' || NEW.nombre_produits || ' produit(s)';
  PERFORM notify_all_admins('demande_nouvelle', v_message, v_details, '/demandes#' || NEW.id);
  RETURN NEW;
END; $function$;

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employe_boutique', 'employe_production', 'employe_cuisine'));

NOTIFY pgrst, 'reload schema';

COMMIT;
