-- =====================================================================
-- Partie 3 : récapitulatif pour le propriétaire (affiché dans l'application, aucun e-mail)
-- =====================================================================
-- Prérequis : parties 1 et 2 appliquées.
-- Le récapitulatif est calculé à la demande à partir des données d'origine (demandes, envois, journal,
-- ventes, dépenses) : rien n'est stocké, rien n'est à nettoyer, et n'importe quelle période se régénère.
-- Aucune suppression : peut être exécuté directement.
-- Retour arrière : partie3_annulation.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Super administrateur (compte actif)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid() AND actif IS TRUE), false)
$function$;

-- Nom affiché d'un compte : « Nom (identifiant) »
CREATE OR REPLACE FUNCTION public.recap_nom(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE WHEN nullif(trim(nom), '') IS NULL OR trim(nom) = username THEN username
              ELSE trim(nom) || ' (' || username || ')' END
    FROM public.profiles WHERE id = p_id
$function$;

-- ---------------------------------------------------------------------
-- 2. Comptes des super administrateurs : seul un super administrateur change leur rôle ou leur statut
--    (avant : seul le compte « proprietaire » était protégé, un gérant pouvait désactiver rabi)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_profils()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_appelant_super boolean;
BEGIN
  -- Routes serveur (service_role) et tableau de bord : pas de restriction supplémentaire
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(is_super_admin, false) INTO v_appelant_super FROM profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.is_super_admin, false) AND NOT coalesce(v_appelant_super, false) THEN
      RAISE EXCEPTION 'Seul un super administrateur peut attribuer ce droit' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin AND NOT coalesce(v_appelant_super, false) THEN
    RAISE EXCEPTION 'Seul un super administrateur peut modifier ce droit' USING ERRCODE = '42501';
  END IF;
  IF OLD.username = 'proprietaire' AND OLD.id IS DISTINCT FROM auth.uid()
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif) THEN
    RAISE EXCEPTION 'Le rôle et le statut du propriétaire ne peuvent être modifiés que par lui-même' USING ERRCODE = '42501';
  END IF;
  IF coalesce(OLD.is_super_admin, false) AND NOT coalesce(v_appelant_super, false)
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif) THEN
    RAISE EXCEPTION 'Le rôle et le statut d''un super administrateur ne peuvent être modifiés que par un super administrateur' USING ERRCODE = '42501';
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Le nom d''utilisateur et l''identifiant ne peuvent pas être modifiés' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. Récapitulatif d'une période (dates incluses, heure de Ouagadougou)
-- ---------------------------------------------------------------------
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
      'chiffre_affaires', v_ventes->'total',
      'depenses', v_depenses->'total'),
    'alertes', jsonb_build_object('transit_24h', v_transit, 'meme_personne', v_meme, 'ecarts', v_ecarts),
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

REVOKE ALL ON FUNCTION public.est_super_admin(), public.recap_nom(uuid), public.recap_periode(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recap_nom(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.est_super_admin(), public.recap_periode(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.est_super_admin(), public.recap_nom(uuid), public.recap_periode(date, date) TO service_role;

-- ---------------------------------------------------------------------
-- 4. Super administrateurs : rabi et proprietaire (décision du 2026-10-19). admin1 redevient un admin simple.
-- ---------------------------------------------------------------------
UPDATE public.profiles SET is_super_admin = false WHERE username = 'admin1' AND is_super_admin;

COMMIT;
