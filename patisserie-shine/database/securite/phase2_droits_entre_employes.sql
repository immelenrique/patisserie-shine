-- =====================================================================
-- PHASE 2 : droits entre utilisateurs connectés
-- Projet : bakery-stock-management (Pâtisserie Shine). Prérequis : phase 1 appliquée.
--
-- Effets :
--   1. Fonctions : un employé connecté ne peut plus exécuter que les 7 fonctions nécessaires
--      (règles RLS, déclencheurs, 2 appels de l'application). Les ~95 autres, dont les
--      SECURITY DEFINER comme create_user_with_profile, lui sont retirées.
--   2. safe_delete_user : réservée aux admins actifs ; refuse le propriétaire et son propre compte.
--   3. profiles : seul un admin peut créer ou modifier un profil (l'écran Utilisateurs est réservé
--      aux admins) ; personne ne peut supprimer un profil depuis le navigateur. Un déclencheur
--      protège en plus : le droit super admin, le compte propriétaire et le nom d'utilisateur.
--   4. Ventes, lignes de vente, sorties, entrées boutique, arrêts de caisse : les employés
--      ajoutent et lisent, seuls les admins modifient ou suppriment. Tables d'audit des prix :
--      ajout et lecture uniquement, plus aucune modification ni suppression.
--   5. Les 23 vues respectent désormais RLS (security_invoker) au lieu de le contourner.
--   6. Compte actif exigé aussi sur les 20 tables qui avaient déjà RLS.
--   7. Fonctions créées à l'avenir : plus exécutables par PUBLIC (donc par anon) par défaut.
--
-- Les routes serveur (service_role) et le tableau de bord Supabase ne sont pas concernés.
-- Annulation : phase2_annulation.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 0. Fonction d'aide : l'utilisateur connecté est-il un admin actif ?
--    Même règle que l'application : rôle admin ou compte « proprietaire ».
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND actif IS TRUE AND (role = 'admin' OR username = 'proprietaire')
  )
$$;

-- ---------------------------------------------------------------------
-- 1. Fonctions : ne laisser aux connectés que le strict nécessaire
--    (les fonctions de déclencheur n'ont pas besoin du droit EXECUTE pour se déclencher)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
GRANT EXECUTE ON FUNCTION
  public.est_utilisateur_actif(),                                   -- règles RLS
  public.est_admin(),                                               -- règles RLS
  public.notify_all_admins(character varying, text, text, character varying),                    -- déclencheur notify_new_demande
  public.send_notification(uuid, character varying, text, text, character varying, character varying), -- déclencheur notify_demande_status_change
  public.ajouter_stock_boutique(integer, numeric, character varying, integer, uuid),             -- déclencheur trigger_production_vers_boutique
  public.decrement_stock(integer, numeric),                         -- application : validation des demandes
  public.safe_delete_user(uuid)                                     -- application : suppression définitive d'un utilisateur
TO authenticated;

-- ---------------------------------------------------------------------
-- 2. safe_delete_user : contrôles avant toute suppression
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_delete_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result JSON;
  v_user_name TEXT;
  v_username TEXT;
BEGIN
  -- Appel depuis le navigateur : réservé aux admins actifs
  IF auth.role() = 'authenticated' AND NOT public.est_admin() THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent supprimer un utilisateur' USING ERRCODE = '42501';
  END IF;

  SELECT nom, username INTO v_user_name, v_username FROM profiles WHERE id = p_user_id;

  IF v_username = 'proprietaire' THEN
    RAISE EXCEPTION 'Le compte propriétaire ne peut pas être supprimé' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte' USING ERRCODE = '42501';
  END IF;

  -- Suppression : logique d'origine inchangée
  BEGIN
    BEGIN
      DELETE FROM auth.users WHERE id = p_user_id;
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ignorer si déjà supprimé
    END;

    DELETE FROM profiles WHERE id = p_user_id;

    v_result := json_build_object(
      'success', true,
      'message', format('Utilisateur "%s" supprimé. Tout l''historique est conservé avec références anonymisées (NULL).', COALESCE(v_user_name, 'Sans nom'))
    );
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      v_result := json_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
      RETURN v_result;
  END;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. profiles : écriture réservée aux admins
--    Restent en place : lecture pour les connectés, « Admins can insert/update profiles »,
--    et les règles restrictives « compte actif » de la phase 1. Aucune règle DELETE :
--    la suppression ne passe que par safe_delete_user ou les routes serveur.
-- ---------------------------------------------------------------------
DROP POLICY phase1_utilisateurs_connectes ON public.profiles;

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
  IF NEW.username IS DISTINCT FROM OLD.username OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Le nom d''utilisateur et l''identifiant ne peuvent pas être modifiés' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER proteger_profils
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_profils();

-- ---------------------------------------------------------------------
-- 4. Historique des ventes et des stocks : ajout libre, modification réservée aux admins
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ventes', 'lignes_vente', 'sorties_boutique', 'entrees_boutique', 'arrets_caisse'] LOOP
    EXECUTE format('DROP POLICY phase1_utilisateurs_connectes ON public.%I', t);
    EXECUTE format('CREATE POLICY phase2_lecture ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY phase2_ajout ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY phase2_modification_admin ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.est_admin())) WITH CHECK ((SELECT public.est_admin()))', t);
    EXECUTE format('CREATE POLICY phase2_suppression_admin ON public.%I FOR DELETE TO authenticated USING ((SELECT public.est_admin()))', t);
  END LOOP;

  -- Audit des prix : écrit par les déclencheurs, ne doit jamais être modifié ni effacé
  FOREACH t IN ARRAY ARRAY['audit_prix_changes', 'audit_prix_simple'] LOOP
    EXECUTE format('DROP POLICY phase1_utilisateurs_connectes ON public.%I', t);
    EXECUTE format('CREATE POLICY phase2_lecture ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY phase2_ajout ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
  END LOOP;

-- ---------------------------------------------------------------------
-- 5. Les vues respectent RLS
-- ---------------------------------------------------------------------
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', t);
  END LOOP;

-- ---------------------------------------------------------------------
-- 6. Compte actif exigé sur les 20 tables qui avaient déjà RLS
-- ---------------------------------------------------------------------
  FOREACH t IN ARRAY ARRAY[
    'annulations_ventes', 'consommations_atelier', 'demandes_groupees', 'depenses_comptables',
    'lignes_vente_cuisine', 'modules', 'mouvements_stock', 'mouvements_stock_cuisine',
    'notifications', 'password_change_log', 'permissions', 'productions', 'produits_cuisine',
    'recettes', 'referentiel_produits', 'role_permissions', 'roles_custom', 'stock_cuisine',
    'user_permissions', 'ventes_cuisine'
  ] LOOP
    EXECUTE format('CREATE POLICY phase2_compte_actif_requis ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.est_utilisateur_actif())) WITH CHECK ((SELECT public.est_utilisateur_actif()))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. Fonctions futures : plus de droit d'exécution automatique pour PUBLIC (donc anon).
--    Les droits par défaut du schéma public continuent de les ouvrir à authenticated et service_role.
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
