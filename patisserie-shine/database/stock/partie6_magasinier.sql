-- =====================================================================
-- Partie 6 : le magasinier, et les achats confirmés sur facture par la propriétaire
-- =====================================================================
-- Prérequis : parties 1 à 5 appliquées.
--
-- Le magasinier :
--  - réceptionne la marchandise achetée : il l'entre au stock principal (creer_produit,
--    reapprovisionner_produit), avec la dépense et la photo du reçu (partie 4) ;
--  - fait sortir la marchandise : il valide ou refuse seul les demandes de la boutique et de l'atelier ;
--  - est prévenu de chaque nouvelle demande et voit les envois qui partent du stock principal.
-- Il ne peut pas : corriger une quantité du stock, modifier un prix d'achat, archiver un produit,
-- annuler un envoi, réceptionner un envoi, tenir une caisse, voir le récapitulatif.
-- Ses sorties sont contrôlées par la personne qui reçoit : elle compte sans voir la quantité envoyée (partie 1).
--
-- La propriétaire confirme chaque achat avec la facture (quantité et montant) : « conforme » ou
-- « non conforme » avec ce qui ne correspond pas. Une confirmation ne se modifie pas et ne se supprime pas.
-- Un achat non conforme prévient les gérants et la personne qui l'a saisi ; la correction du stock
-- se fait ensuite par une correction motivée (partie 2).
--
-- Contient un DROP CONSTRAINT (liste des rôles) : à exécuter dans le SQL Editor.
-- Retour arrière : partie6_annulation.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Le rôle magasinier
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employe_boutique', 'employe_production', 'employe_cuisine', 'magasinier'));

-- ---------------------------------------------------------------------
-- 2. Sorties : le magasinier valide ou refuse les demandes (seul changement : le contrôle du rôle)
-- ---------------------------------------------------------------------
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
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls le magasinier, le propriétaire et les gérants peuvent valider une demande' USING ERRCODE = '42501';
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
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'magasinier') THEN
    RAISE EXCEPTION 'Seuls le magasinier, le propriétaire et les gérants peuvent refuser une demande' USING ERRCODE = '42501';
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

-- ---------------------------------------------------------------------
-- 3. Entrées : le magasinier enregistre les achats (seul changement : le contrôle du rôle)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. Le magasinier est prévenu des demandes et voit les envois du stock principal
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_demandeur_nom VARCHAR; v_message TEXT; v_details TEXT; v_m RECORD;
BEGIN
  SELECT nom INTO v_demandeur_nom FROM profiles WHERE id = NEW.demandeur_id;
  v_message := 'Nouvelle demande de ' || COALESCE(v_demandeur_nom, 'Utilisateur');
  v_details := 'Destination: ' || NEW.destination || ' - ' || NEW.nombre_produits || ' produit(s)';
  PERFORM notify_all_admins('demande_nouvelle', v_message, v_details, '/demandes#' || NEW.id);
  -- Le magasinier valide les demandes : il est prévenu comme les gérants
  FOR v_m IN SELECT id FROM profiles WHERE role = 'magasinier' AND actif = TRUE LOOP
    PERFORM send_notification(v_m.id, 'demande_nouvelle', v_message, v_details, '/demandes#' || NEW.id, 'haute');
  END LOOP;
  RETURN NEW;
END; $function$;

CREATE POLICY "Envois du stock principal visibles par le magasinier" ON public.envois FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'magasinier' AND origine = 'principal');

-- ---------------------------------------------------------------------
-- 5. Confirmation des achats sur facture par la propriétaire
-- ---------------------------------------------------------------------
CREATE TABLE public.confirmations_achats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  depense_id integer NOT NULL UNIQUE REFERENCES public.depenses_comptables (id),
  conforme boolean NOT NULL,
  commentaire text,
  par uuid NOT NULL REFERENCES public.profiles (id),
  le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT confirmation_non_conforme_motivee CHECK (conforme OR length(trim(coalesce(commentaire, ''))) >= 3)
);
CREATE TRIGGER confirmations_achats_inalterables BEFORE UPDATE OR DELETE ON public.confirmations_achats
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER confirmations_achats_inalterables_vidage BEFORE TRUNCATE ON public.confirmations_achats
  FOR EACH STATEMENT EXECUTE FUNCTION public.interdire_modification();
ALTER TABLE public.confirmations_achats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Confirmations lisibles par le propriétaire et les gérants" ON public.confirmations_achats
  FOR SELECT TO authenticated USING ((SELECT public.role_courant()) = 'admin');
REVOKE ALL ON public.confirmations_achats FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.confirmations_achats FROM authenticated;

-- « conforme » : la facture correspond à la quantité et au montant saisis.
-- « non conforme » : commentaire obligatoire ; les gérants et l'auteur de l'achat sont prévenus.
CREATE OR REPLACE FUNCTION public.confirmer_achat(p_depense_id integer, p_conforme boolean, p_commentaire text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_d record;
  v_c record;
  v_commentaire text := nullif(trim(coalesce(p_commentaire, '')), '');
  v_id bigint;
BEGIN
  IF NOT public.est_super_admin() THEN
    RAISE EXCEPTION 'Seul le propriétaire confirme les achats avec la facture' USING ERRCODE = '42501';
  END IF;
  IF p_conforme IS NULL THEN
    RAISE EXCEPTION 'Indiquez si l''achat est conforme à la facture' USING ERRCODE = '22023';
  END IF;
  -- Verrou sur la dépense : deux confirmations simultanées du même achat passent l'une après l'autre
  SELECT * INTO v_d FROM depenses_comptables WHERE id = p_depense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépense introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_d.achat_journal_id IS NULL THEN
    RAISE EXCEPTION 'Cette dépense n''est pas un achat de stock' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM confirmations_achats WHERE depense_id = p_depense_id;
  IF FOUND THEN
    RETURN jsonb_build_object('confirmation_id', v_c.id, 'conforme', v_c.conforme, 'deja_confirme', true);
  END IF;
  IF NOT p_conforme AND (v_commentaire IS NULL OR length(v_commentaire) < 3) THEN
    RAISE EXCEPTION 'Indiquez ce qui ne correspond pas à la facture' USING ERRCODE = '22023';
  END IF;

  INSERT INTO confirmations_achats (depense_id, conforme, commentaire, par)
  VALUES (p_depense_id, p_conforme, v_commentaire, v_uid)
  RETURNING id INTO v_id;

  IF NOT p_conforme THEN
    PERFORM notify_all_admins('alerte_generale',
      'Achat non conforme à la facture : ' || v_d.description,
      'Saisi par ' || coalesce(recap_nom(v_d.utilisateur_id), '?') || ' le ' || to_char(v_d.created_at AT TIME ZONE 'Africa/Ouagadougou', 'DD/MM/YYYY HH24:MI')
        || ' (' || v_d.montant || ' F). Constat : ' || v_commentaire,
      '/stock');
    IF v_d.utilisateur_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_d.utilisateur_id AND role = 'admin') THEN
      PERFORM send_notification(v_d.utilisateur_id, 'alerte_generale', 'Achat non conforme à la facture : ' || v_d.description,
        'Constat du propriétaire : ' || v_commentaire, '/stock', 'haute');
    END IF;
  END IF;

  RETURN jsonb_build_object('confirmation_id', v_id, 'conforme', p_conforme, 'deja_confirme', false);
END;
$function$;

-- Achats à confirmer (état actuel, les plus anciens d'abord) et achats non conformes des 30 derniers jours
CREATE OR REPLACE FUNCTION public.achats_a_confirmer()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_a jsonb;
  v_nombre integer;
  v_nc jsonb;
BEGIN
  IF NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé au propriétaire' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_nombre
    FROM depenses_comptables d
   WHERE d.achat_journal_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM confirmations_achats c WHERE c.depense_id = d.id);

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'le'), '[]'::jsonb) INTO v_a
    FROM (SELECT jsonb_build_object(
             'depense_id', d.id, 'le', d.created_at, 'description', d.description,
             'nature', CASE WHEN d.type_depense = 'achat_stock' THEN 'nouveau produit' ELSE 'réapprovisionnement' END,
             'produit', j.produit_nom, 'quantite', j.quantite, 'unite', u.label, 'montant', d.montant,
             'prix_unitaire', CASE WHEN j.quantite > 0 THEN round(d.montant / j.quantite, 2) END,
             'par', recap_nom(d.utilisateur_id),
             'recus', coalesce((SELECT jsonb_agg(jsonb_build_object('nom', r->>'nom', 'chemin', r->>'chemin',
                          'present', EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = r->>'chemin')))
                        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.pieces_jointes) = 'array' THEN d.pieces_jointes ELSE '[]'::jsonb END) r), '[]'::jsonb)) AS x
            FROM depenses_comptables d
            JOIN journal_stock j ON j.id = d.achat_journal_id
            LEFT JOIN produits p ON p.id = j.produit_id
            LEFT JOIN unites u ON u.id = p.unite_id
           WHERE d.achat_journal_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM confirmations_achats c WHERE c.depense_id = d.id)
           ORDER BY d.created_at
           LIMIT 100) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'depense_id', d.id, 'le', c.le, 'achete_le', d.created_at, 'description', d.description, 'montant', d.montant,
           'par', recap_nom(d.utilisateur_id), 'constate_par', recap_nom(c.par), 'commentaire', c.commentaire)
         ORDER BY c.le DESC), '[]'::jsonb)
    INTO v_nc
    FROM confirmations_achats c JOIN depenses_comptables d ON d.id = c.depense_id
   WHERE NOT c.conforme AND c.le >= now() - interval '30 days';

  RETURN jsonb_build_object('nombre', v_nombre, 'a_confirmer', v_a, 'non_conformes', v_nc);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirmer_achat(integer, boolean, text), public.achats_a_confirmer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmer_achat(integer, boolean, text), public.achats_a_confirmer() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
