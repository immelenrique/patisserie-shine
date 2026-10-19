-- =====================================================================
-- Partie 4 : chaque achat de stock est une dépense, avec son reçu
-- =====================================================================
-- Prérequis : parties 1, 2 et 3 appliquées ; espace de fichiers « depenses-pieces-jointes » (existant).
--
-- Avant :
--  - un achat (création ou réapprovisionnement) ne créait aucune dépense, et aucun reçu ne lui était lié ;
--  - la comptabilité estimait les achats en multipliant le prix moyen par la quantité cumulée de tout
--    l'historique du produit, comptée dans la période du dernier réapprovisionnement : chiffres faux ;
--  - une dépense pouvait être modifiée ou supprimée sans laisser de trace.
-- Maintenant :
--  - creer_produit et reapprovisionner_produit créent, dans la même opération, la dépense de l'achat
--    (montant payé, date, auteur), reliée à sa ligne du journal du stock ;
--  - joindre_recu ajoute un reçu (photo ou PDF déjà déposé par l'utilisateur) : on ajoute, on ne retire pas ;
--  - la dépense d'un achat ne se modifie (montant, date, produit, auteur) ni ne se supprime ;
--  - toute création, modification ou suppression de dépense est écrite dans journal_depenses (ajout seul) ;
--  - le récapitulatif liste les achats, signale ceux sans reçu, les reçus disparus et les dépenses modifiées.
-- Aucune suppression : peut être exécuté directement. Retour arrière : partie4_annulation.sql (SQL Editor).
-- Limite : les fichiers sont gardés par le service de stockage de Supabase, où la base ne peut pas poser de
-- verrou ; un reçu supprimé là-bas reste donc possible, mais il est détecté et signalé au propriétaire.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Lien entre une dépense et l'achat qui l'a créée
-- ---------------------------------------------------------------------
ALTER TABLE public.depenses_comptables ADD COLUMN achat_journal_id bigint UNIQUE REFERENCES public.journal_stock(id);
COMMENT ON COLUMN public.depenses_comptables.achat_journal_id IS 'Ligne du journal du stock de l''achat qui a créé cette dépense (création ou réapprovisionnement). Renseigné uniquement par la base.';

-- ---------------------------------------------------------------------
-- 2. Journal des dépenses (ajout seul)
-- ---------------------------------------------------------------------
CREATE TABLE public.journal_depenses (
  id bigserial PRIMARY KEY,
  le timestamptz NOT NULL DEFAULT clock_timestamp(),
  auteur_id uuid,
  action text NOT NULL CHECK (action IN ('creation', 'modification', 'suppression')),
  depense_id integer NOT NULL,
  champs text[],
  recu_ajoute_seulement boolean NOT NULL DEFAULT false,
  avant jsonb,
  apres jsonb
);
COMMENT ON TABLE public.journal_depenses IS 'Historique à ajout seul des dépenses : qui a créé, modifié ou supprimé quoi, avec l''état avant et après.';
CREATE INDEX journal_depenses_le_idx ON public.journal_depenses (le);

CREATE TRIGGER journal_depenses_inalterable BEFORE UPDATE OR DELETE ON public.journal_depenses
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER journal_depenses_inalterable_vidage BEFORE TRUNCATE ON public.journal_depenses
  FOR EACH STATEMENT EXECUTE FUNCTION public.interdire_modification();

REVOKE ALL ON public.journal_depenses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.journal_depenses_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.journal_depenses TO authenticated;
GRANT ALL ON public.journal_depenses TO service_role;
GRANT ALL ON SEQUENCE public.journal_depenses_id_seq TO service_role;
ALTER TABLE public.journal_depenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Journal des dépenses lisible par les admins" ON public.journal_depenses FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin');

CREATE OR REPLACE FUNCTION public.journal_depense_ecrire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_avant jsonb;
  v_apres jsonb;
  v_champs text[];
  v_recu_seul boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO journal_depenses (auteur_id, action, depense_id, apres)
    VALUES (coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid), 'creation', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO journal_depenses (auteur_id, action, depense_id, avant)
    VALUES (coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid), 'suppression', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  v_avant := to_jsonb(OLD) - 'updated_at';
  v_apres := to_jsonb(NEW) - 'updated_at';
  IF v_avant = v_apres THEN
    RETURN NEW;
  END IF;
  SELECT array_agg(k ORDER BY k) INTO v_champs
    FROM jsonb_object_keys(v_apres) k WHERE v_apres -> k IS DISTINCT FROM v_avant -> k;
  -- Ajout d'un reçu sans rien retirer : ce n'est pas une modification à signaler
  v_recu_seul := v_champs = ARRAY['pieces_jointes']
    AND coalesce(NEW.pieces_jointes, '[]'::jsonb) @> coalesce(OLD.pieces_jointes, '[]'::jsonb);
  INSERT INTO journal_depenses (auteur_id, action, depense_id, champs, recu_ajoute_seulement, avant, apres)
  VALUES (coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid), 'modification', NEW.id, v_champs, v_recu_seul,
          to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$function$;

CREATE TRIGGER journal_depenses_suivi AFTER INSERT OR UPDATE OR DELETE ON public.depenses_comptables
  FOR EACH ROW EXECUTE FUNCTION public.journal_depense_ecrire();

-- ---------------------------------------------------------------------
-- 3. Dépense d'un achat : ni modifiable (montant, date, produit, auteur) ni supprimable depuis l'application ;
--    ses reçus ne s'ajoutent que par joindre_recu. Les fonctions de la base passent (elles ne s'exécutent pas
--    sous le rôle « authenticated »).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_depenses()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.achat_journal_id IS NOT NULL THEN
      RAISE EXCEPTION 'La dépense d''un achat de stock est créée par l''achat lui-même' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.achat_journal_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Dépense liée à un achat de stock : elle ne peut pas être supprimée' USING ERRCODE = '42501';
  END IF;
  IF NEW.montant IS DISTINCT FROM OLD.montant OR NEW.date_depense IS DISTINCT FROM OLD.date_depense
     OR NEW.type_depense IS DISTINCT FROM OLD.type_depense OR NEW.reference_produit_id IS DISTINCT FROM OLD.reference_produit_id
     OR NEW.achat_journal_id IS DISTINCT FROM OLD.achat_journal_id OR NEW.utilisateur_id IS DISTINCT FROM OLD.utilisateur_id
     OR NEW.details IS DISTINCT FROM OLD.details THEN
    RAISE EXCEPTION 'Dépense liée à un achat de stock : montant, date, produit et auteur ne se modifient pas' USING ERRCODE = '42501';
  END IF;
  IF NEW.pieces_jointes IS DISTINCT FROM OLD.pieces_jointes THEN
    RAISE EXCEPTION 'Les reçus d''un achat s''ajoutent avec « Ajouter le reçu » et ne se retirent pas' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER proteger_depenses BEFORE INSERT OR UPDATE OR DELETE ON public.depenses_comptables
  FOR EACH ROW EXECUTE FUNCTION public.proteger_depenses();

-- Création de la dépense d'un achat (interne)
CREATE OR REPLACE FUNCTION public.depense_achat_creer(p_type text, p_produit_id integer, p_nom text, p_quantite numeric,
  p_unite_id integer, p_prix_total numeric, p_date date, p_journal_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id integer;
  v_unite text := (SELECT coalesce(label, value) FROM unites WHERE id = p_unite_id);
BEGIN
  INSERT INTO depenses_comptables (type_depense, description, montant, reference_produit_id, date_depense, utilisateur_id,
    details, pieces_jointes, categorie, achat_journal_id)
  VALUES (p_type, 'Achat ' || p_nom || ' : ' || p_quantite || coalesce(' ' || v_unite, ''), p_prix_total, p_produit_id,
    coalesce(p_date, current_date), auth.uid(),
    jsonb_build_object('produit_id', p_produit_id, 'quantite', p_quantite, 'unite', v_unite,
      'prix_unitaire', CASE WHEN p_quantite > 0 THEN round(p_prix_total / p_quantite, 4) END),
    '[]'::jsonb, 'Achat de stock', p_journal_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- Dépense d'un achat déjà enregistré avec cette clé (nouvel essai après une coupure)
CREATE OR REPLACE FUNCTION public.depense_de_cle(p_cle uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT d.id FROM depenses_comptables d JOIN journal_stock j ON j.id = d.achat_journal_id WHERE j.cle = p_cle
$function$;

-- ---------------------------------------------------------------------
-- 4. Achats : même comportement qu'en partie 2, plus la dépense créée dans la même opération
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

-- ---------------------------------------------------------------------
-- 5. Ajouter un reçu à une dépense : le fichier doit avoir été déposé par la personne elle-même dans l'espace
--    « depenses-pieces-jointes » ; on ajoute, on ne retire jamais. Auteur de la dépense, ou propriétaire / gérant.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.joindre_recu(p_depense_id integer, p_fichier jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_d record;
  v_chemin text := nullif(trim(p_fichier ->> 'chemin'), '');
BEGIN
  IF public.role_courant() IS NULL THEN
    RAISE EXCEPTION 'Compte inactif ou non connecté' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_d FROM depenses_comptables WHERE id = p_depense_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dépense introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_d.utilisateur_id IS DISTINCT FROM v_uid AND public.role_courant() <> 'admin' THEN
    RAISE EXCEPTION 'Seul l''auteur de la dépense, le propriétaire ou un gérant peut ajouter un reçu' USING ERRCODE = '42501';
  END IF;
  IF v_chemin IS NULL OR v_chemin NOT LIKE v_uid::text || '/%' THEN
    RAISE EXCEPTION 'Fichier invalide' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = v_chemin
                  AND (o.owner_id = v_uid::text OR o.owner = v_uid)) THEN
    RAISE EXCEPTION 'Le fichier du reçu est introuvable : recommencez l''envoi de la photo' USING ERRCODE = 'P0002';
  END IF;
  -- Même fichier envoyé deux fois (coupure, double clic) : rien à ajouter
  IF coalesce(v_d.pieces_jointes, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('chemin', v_chemin)) THEN
    RETURN v_d.pieces_jointes;
  END IF;
  UPDATE depenses_comptables
     SET pieces_jointes = coalesce(pieces_jointes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'nom', left(coalesce(nullif(p_fichier ->> 'nom', ''), 'recu'), 200), 'chemin', v_chemin,
           'type', left(coalesce(p_fichier ->> 'type', ''), 100), 'taille', (p_fichier ->> 'taille')::bigint,
           'date_upload', now(), 'ajoute_par', v_uid)),
         updated_at = now()
   WHERE id = p_depense_id
   RETURNING pieces_jointes INTO v_d.pieces_jointes;
  RETURN v_d.pieces_jointes;
END;
$function$;

REVOKE ALL ON FUNCTION public.journal_depense_ecrire(), public.proteger_depenses(),
  public.depense_achat_creer(text, integer, text, numeric, integer, numeric, date, bigint), public.depense_de_cle(uuid),
  public.joindre_recu(integer, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.journal_depense_ecrire(), public.proteger_depenses(),
  public.depense_achat_creer(text, integer, text, numeric, integer, numeric, date, bigint), public.depense_de_cle(uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.joindre_recu(integer, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Récapitulatif : achats, achats sans reçu, reçus disparus, dépenses modifiées ou supprimées
-- ---------------------------------------------------------------------
-- (définition complète ci-dessous, générée à partir de celle de la partie 3)
CREATE OR REPLACE FUNCTION public.recap_periode(p_du date, p_au date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_debut timestamptz;
  v_fin timestamptz;
  -- ventes.created_at est sans fuseau (heure du serveur, UTC)
  v_debut_utc timestamp;
  v_fin_utc timestamp;
  v_demandes jsonb;
  v_decisions jsonb;
  v_envois jsonb;
  v_transit jsonb;
  v_meme jsonb;
  v_ecarts jsonb;
  v_mouvements jsonb;
  v_ventes jsonb;
  v_articles jsonb;
  v_annulations jsonb;
  v_depenses jsonb;
  v_archives jsonb;
  v_comptes jsonb;
  v_attente jsonb;
  v_achats jsonb;
  v_sans_recu jsonb;
  v_recus_disparus jsonb;
  v_depenses_modifiees jsonb;
BEGIN
  IF NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Récapitulatif réservé au propriétaire' USING ERRCODE = '42501';
  END IF;
  IF p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Période invalide' USING ERRCODE = '22023';
  END IF;
  IF p_au - p_du > 92 THEN
    RAISE EXCEPTION 'Période limitée à 3 mois' USING ERRCODE = '22023';
  END IF;

  v_debut := p_du::timestamp AT TIME ZONE 'Africa/Ouagadougou';
  v_fin := (p_au + 1)::timestamp AT TIME ZONE 'Africa/Ouagadougou';
  v_debut_utc := v_debut AT TIME ZONE 'UTC';
  v_fin_utc := v_fin AT TIME ZONE 'UTC';

  -- Demandes faites pendant la période
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'le', g.created_at, 'demandeur', recap_nom(g.demandeur_id),
           'destination', g.destination, 'statut', g.statut,
           'lignes', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', u.label, 'quantite', d.quantite)
                                                ORDER BY p.nom), '[]'::jsonb)
                        FROM demandes d LEFT JOIN produits p ON p.id = d.produit_id LEFT JOIN unites u ON u.id = p.unite_id
                       WHERE d.demande_groupee_id = g.id))
         ORDER BY g.created_at), '[]'::jsonb)
    INTO v_demandes
    FROM demandes_groupees g
   WHERE g.created_at >= v_debut AND g.created_at < v_fin;

  -- Validations et refus décidés pendant la période
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'le', g.date_validation, 'statut', g.statut, 'destination', g.destination,
           'demandeur', recap_nom(g.demandeur_id), 'valideur', recap_nom(g.valideur_id),
           'auto_validation', coalesce(e.auto_validation, g.valideur_id = g.demandeur_id),
           'envoi_id', e.id, 'raison_refus', g.details_validation -> 'refus' ->> 'raison',
           'lignes', CASE WHEN e.id IS NOT NULL THEN
               (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', l.produit_nom, 'unite', l.unite,
                         'demandee', l.quantite_demandee, 'validee', l.quantite_envoyee) ORDER BY l.produit_nom), '[]'::jsonb)
                  FROM envoi_lignes l WHERE l.envoi_id = e.id)
             ELSE
               (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', u.label,
                         'demandee', d.quantite, 'validee', CASE WHEN d.statut = 'refusee' THEN 0 END) ORDER BY p.nom), '[]'::jsonb)
                  FROM demandes d LEFT JOIN produits p ON p.id = d.produit_id LEFT JOIN unites u ON u.id = p.unite_id
                 WHERE d.demande_groupee_id = g.id)
             END)
         ORDER BY g.date_validation), '[]'::jsonb)
    INTO v_decisions
    FROM demandes_groupees g
    LEFT JOIN envois e ON e.demande_groupee_id = g.id
   WHERE g.date_validation >= v_debut AND g.date_validation < v_fin
     AND g.statut IN ('validee', 'refusee', 'partiellement_validee');

  -- Envois : partis, reçus ou annulés pendant la période
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'origine', e.origine, 'destination', e.destination, 'statut', e.statut,
           'demande_id', e.demande_groupee_id, 'demandeur', recap_nom(e.demandeur_id),
           'valideur', recap_nom(e.valideur_id), 'auto_validation', e.auto_validation, 'parti_le', e.cree_le,
           'receptionnaire', recap_nom(e.receptionnaire_id), 'recu_le', e.recu_le, 'avec_ecart', e.avec_ecart,
           'meme_personne', e.receptionnaire_id = e.valideur_id,
           'annule_par', recap_nom(e.annule_par), 'annule_le', e.annule_le, 'motif_annulation', e.motif_annulation,
           'lignes', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', l.produit_nom, 'unite', l.unite,
                        'demandee', l.quantite_demandee, 'envoyee', l.quantite_envoyee, 'recue', l.quantite_recue,
                        'ecart', l.quantite_recue - l.quantite_envoyee, 'motif_ecart', l.motif_ecart) ORDER BY l.produit_nom), '[]'::jsonb)
                        FROM envoi_lignes l WHERE l.envoi_id = e.id))
         ORDER BY e.cree_le), '[]'::jsonb)
    INTO v_envois
    FROM envois e
   WHERE (e.cree_le >= v_debut AND e.cree_le < v_fin)
      OR (e.recu_le >= v_debut AND e.recu_le < v_fin)
      OR (e.annule_le >= v_debut AND e.annule_le < v_fin);

  -- Alerte : marchandise en transit depuis plus de 24 h (état actuel, quelle que soit la période)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'origine', e.origine, 'destination', e.destination, 'parti_le', e.cree_le,
           'valideur', recap_nom(e.valideur_id), 'demandeur', recap_nom(e.demandeur_id),
           'heures', floor(extract(epoch FROM now() - e.cree_le) / 3600),
           'lignes', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', l.produit_nom, 'unite', l.unite,
                        'envoyee', l.quantite_envoyee) ORDER BY l.produit_nom), '[]'::jsonb)
                        FROM envoi_lignes l WHERE l.envoi_id = e.id))
         ORDER BY e.cree_le), '[]'::jsonb)
    INTO v_transit
    FROM envois e
   WHERE e.statut = 'en_transit' AND e.cree_le < now() - interval '24 hours';

  -- Alerte : validé (ou envoyé) et réceptionné par la même personne pendant la période
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'origine', e.origine, 'destination', e.destination, 'recu_le', e.recu_le,
           'personne', recap_nom(e.valideur_id), 'demandeur', recap_nom(e.demandeur_id), 'avec_ecart', e.avec_ecart)
         ORDER BY e.recu_le), '[]'::jsonb)
    INTO v_meme
    FROM envois e
   WHERE e.statut = 'recu' AND e.receptionnaire_id = e.valideur_id
     AND e.recu_le >= v_debut AND e.recu_le < v_fin;

  -- Alerte : écarts constatés à la réception pendant la période
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'envoi_id', e.id, 'origine', e.origine, 'destination', e.destination, 'recu_le', e.recu_le,
           'produit', l.produit_nom, 'unite', l.unite, 'envoyee', l.quantite_envoyee, 'recue', l.quantite_recue,
           'ecart', l.quantite_recue - l.quantite_envoyee, 'motif', l.motif_ecart,
           'valideur', recap_nom(e.valideur_id), 'receptionnaire', recap_nom(e.receptionnaire_id))
         ORDER BY e.recu_le, l.produit_nom), '[]'::jsonb)
    INTO v_ecarts
    FROM envois e JOIN envoi_lignes l ON l.envoi_id = e.id
   WHERE e.statut = 'recu' AND l.quantite_recue IS DISTINCT FROM l.quantite_envoyee
     AND e.recu_le >= v_debut AND e.recu_le < v_fin;

  -- Achats, corrections, utilisations et production (journal infalsifiable)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'le', j.cree_le, 'nature', j.nature, 'lieu', j.lieu, 'produit', j.produit_nom,
           'unite', u.label, 'quantite', j.quantite, 'motif', j.motif, 'auteur', recap_nom(j.auteur_id))
         ORDER BY j.id), '[]'::jsonb)
    INTO v_mouvements
    FROM journal_stock j
    LEFT JOIN produits p ON p.id = j.produit_id
    LEFT JOIN unites u ON u.id = p.unite_id
   WHERE j.nature IN ('achat', 'ajustement', 'utilisation', 'production')
     AND j.cree_le >= v_debut AND j.cree_le < v_fin;

  -- Ventes de la boutique
  SELECT jsonb_build_object(
           'nombre', count(*) FILTER (WHERE v.statut IS DISTINCT FROM 'annulee'),
           'total', coalesce(sum(v.total) FILTER (WHERE v.statut IS DISTINCT FROM 'annulee'), 0),
           'par_vendeur', coalesce((
             SELECT jsonb_agg(jsonb_build_object('vendeur', x.vendeur, 'nombre', x.nombre, 'total', x.total) ORDER BY x.total DESC)
               FROM (SELECT recap_nom(v2.vendeur_id) AS vendeur, count(*) AS nombre, sum(v2.total) AS total
                       FROM ventes v2
                      WHERE v2.created_at >= v_debut_utc AND v2.created_at < v_fin_utc AND v2.statut IS DISTINCT FROM 'annulee'
                      GROUP BY v2.vendeur_id) x), '[]'::jsonb))
    INTO v_ventes
    FROM ventes v
   WHERE v.created_at >= v_debut_utc AND v.created_at < v_fin_utc;

  SELECT coalesce(jsonb_agg(jsonb_build_object('produit', x.produit, 'quantite', x.quantite, 'total', x.total)
         ORDER BY x.quantite DESC, x.produit), '[]'::jsonb)
    INTO v_articles
    FROM (SELECT lv.nom_produit AS produit, sum(lv.quantite) AS quantite, sum(lv.total) AS total
            FROM lignes_vente lv JOIN ventes v ON v.id = lv.vente_id
           WHERE v.created_at >= v_debut_utc AND v.created_at < v_fin_utc AND v.statut IS DISTINCT FROM 'annulee'
           GROUP BY lv.nom_produit) x;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'le', a.annule_le, 'ticket', a.numero_ticket, 'montant', a.montant_annule, 'motif', a.motif,
           'annule_par', recap_nom(a.annule_par), 'vendeur', recap_nom(v.vendeur_id))
         ORDER BY a.annule_le), '[]'::jsonb)
    INTO v_annulations
    FROM annulations_ventes a LEFT JOIN ventes v ON v.id = a.vente_id
   WHERE a.annule_le >= v_debut AND a.annule_le < v_fin;

  -- Dépenses (date de la dépense)
  SELECT jsonb_build_object(
           'total', coalesce(sum(d.montant), 0),
           'lignes', coalesce(jsonb_agg(jsonb_build_object(
             'date', d.date_depense, 'type', d.type_depense, 'categorie', d.categorie, 'description', d.description,
             'montant', d.montant, 'facture', d.numero_facture,
             'pieces', CASE WHEN jsonb_typeof(d.pieces_jointes) = 'array' THEN jsonb_array_length(d.pieces_jointes) ELSE 0 END,
             'par', recap_nom(d.utilisateur_id)) ORDER BY d.date_depense, d.id), '[]'::jsonb))
    INTO v_depenses
    FROM depenses_comptables d
   WHERE d.date_depense >= p_du AND d.date_depense <= p_au;

  -- Produits archivés
  SELECT coalesce(jsonb_agg(jsonb_build_object('le', p.archive_le, 'produit', p.nom, 'motif', p.motif_archivage,
           'par', recap_nom(p.archive_par)) ORDER BY p.archive_le), '[]'::jsonb)
    INTO v_archives
    FROM produits p
   WHERE p.archive_le >= v_debut AND p.archive_le < v_fin;

  -- Comptes : mots de passe changés ou réinitialisés, profils modifiés, comptes créés
  SELECT coalesce(jsonb_agg(x.o ORDER BY x.le), '[]'::jsonb)
    INTO v_comptes
    FROM (SELECT l.changed_at AS le, jsonb_build_object('le', l.changed_at, 'compte', recap_nom(l.user_id),
                   'par', recap_nom(l.changed_by), 'par_autre', l.changed_by IS NOT NULL AND l.changed_by <> l.user_id, 'action', l.reason) AS o
            FROM password_change_log l
           WHERE l.changed_at >= v_debut AND l.changed_at < v_fin
          UNION ALL
          SELECT p.created_at, jsonb_build_object('le', p.created_at, 'compte', recap_nom(p.id), 'par', NULL,
                   'par_autre', false, 'action', 'Compte créé (rôle actuel : ' || coalesce(p.role, '?') || ')')
            FROM profiles p
           WHERE p.created_at >= v_debut AND p.created_at < v_fin) x;

  -- Achats de stock enregistrés pendant la période (dépense créée par l'achat lui-même)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'depense_id', d.id, 'le', d.created_at, 'date', d.date_depense, 'description', d.description,
           'montant', d.montant, 'par', recap_nom(d.utilisateur_id),
           'recus', coalesce((SELECT jsonb_agg(jsonb_build_object('nom', x->>'nom', 'chemin', x->>'chemin',
                        'present', EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = x->>'chemin')))
                      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.pieces_jointes) = 'array' THEN d.pieces_jointes ELSE '[]'::jsonb END) x), '[]'::jsonb))
         ORDER BY d.created_at), '[]'::jsonb)
    INTO v_achats
    FROM depenses_comptables d
   WHERE d.achat_journal_id IS NOT NULL AND d.created_at >= v_debut AND d.created_at < v_fin;

  SELECT coalesce(jsonb_agg(a), '[]'::jsonb) INTO v_sans_recu
    FROM jsonb_array_elements(v_achats) a WHERE jsonb_array_length(a->'recus') = 0;

  -- Reçus dont le fichier a disparu du stockage (état actuel, toutes dépenses)
  SELECT coalesce(jsonb_agg(jsonb_build_object('depense_id', d.id, 'date', d.date_depense, 'description', d.description,
           'montant', d.montant, 'fichier', x->>'nom', 'ajoute_le', x->>'date_upload') ORDER BY d.id), '[]'::jsonb)
    INTO v_recus_disparus
    FROM depenses_comptables d
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.pieces_jointes) = 'array' THEN d.pieces_jointes ELSE '[]'::jsonb END) x
   WHERE x ? 'chemin'
     AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = x->>'chemin');

  -- Dépenses modifiées ou supprimées pendant la période (l'ajout d'un reçu n'est pas signalé)
  SELECT coalesce(jsonb_agg(jsonb_build_object('le', j.le, 'action', j.action, 'depense_id', j.depense_id,
           'par', recap_nom(j.auteur_id), 'champs', to_jsonb(j.champs),
           'description', coalesce(j.apres->>'description', j.avant->>'description'),
           'montant_avant', (j.avant->>'montant')::numeric, 'montant_apres', (j.apres->>'montant')::numeric)
         ORDER BY j.le), '[]'::jsonb)
    INTO v_depenses_modifiees
    FROM journal_depenses j
   WHERE j.le >= v_debut AND j.le < v_fin AND j.action <> 'creation' AND NOT j.recu_ajoute_seulement;

  -- Demandes encore en attente (état actuel)
  SELECT jsonb_build_object('nombre', count(*), 'plus_ancienne', min(g.created_at))
    INTO v_attente
    FROM demandes_groupees g WHERE g.statut = 'en_attente';

  RETURN jsonb_build_object(
    'du', p_du, 'au', p_au, 'genere_le', now(),
    'chiffres', jsonb_build_object(
      'demandes', jsonb_array_length(v_demandes),
      'validations', (SELECT count(*) FROM jsonb_array_elements(v_decisions) x WHERE x->>'statut' <> 'refusee'),
      'refus', (SELECT count(*) FROM jsonb_array_elements(v_decisions) x WHERE x->>'statut' = 'refusee'),
      'auto_validations', (SELECT count(*) FROM jsonb_array_elements(v_decisions) x WHERE (x->>'auto_validation')::boolean),
      'receptions', (SELECT count(*) FROM jsonb_array_elements(v_envois) x
                      WHERE (x->>'recu_le')::timestamptz >= v_debut AND (x->>'recu_le')::timestamptz < v_fin),
      'ecarts', jsonb_array_length(v_ecarts),
      'transit_24h', jsonb_array_length(v_transit),
      'meme_personne', jsonb_array_length(v_meme),
      'corrections', (SELECT count(*) FROM jsonb_array_elements(v_mouvements) x WHERE x->>'nature' = 'ajustement'),
      'annulations_ventes', jsonb_array_length(v_annulations),
      'comptes_par_autre', (SELECT count(*) FROM jsonb_array_elements(v_comptes) x WHERE (x->>'par_autre')::boolean),
      'achats', (SELECT coalesce(sum((a->>'montant')::numeric), 0) FROM jsonb_array_elements(v_achats) a),
      'achats_sans_recu', jsonb_array_length(v_sans_recu),
      'recus_disparus', jsonb_array_length(v_recus_disparus),
      'depenses_modifiees', jsonb_array_length(v_depenses_modifiees),
      'chiffre_affaires', v_ventes->'total',
      'depenses', v_depenses->'total'),
    'alertes', jsonb_build_object('transit_24h', v_transit, 'meme_personne', v_meme, 'ecarts', v_ecarts,
      'achats_sans_recu', v_sans_recu, 'recus_disparus', v_recus_disparus, 'depenses_modifiees', v_depenses_modifiees),
    'achats', v_achats,
    'demandes', v_demandes,
    'decisions', v_decisions,
    'envois', v_envois,
    'mouvements', v_mouvements,
    'ventes', v_ventes || jsonb_build_object('articles', v_articles, 'annulations', v_annulations),
    'depenses', v_depenses,
    'archives', v_archives,
    'comptes', v_comptes,
    'en_attente', v_attente,
    'journal', public.verifier_journal_stock());
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
