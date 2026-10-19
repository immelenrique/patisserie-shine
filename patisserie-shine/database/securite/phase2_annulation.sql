-- =====================================================================
-- ANNULATION de la phase 2 : revient exactement à l'état « phase 1 seule ».
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 7. Droits par défaut des fonctions futures
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

DO $$
DECLARE
  t text;
BEGIN
  -- 6. Règle « compte actif » sur les 20 tables déjà protégées
  FOREACH t IN ARRAY ARRAY[
    'annulations_ventes', 'consommations_atelier', 'demandes_groupees', 'depenses_comptables',
    'lignes_vente_cuisine', 'modules', 'mouvements_stock', 'mouvements_stock_cuisine',
    'notifications', 'password_change_log', 'permissions', 'productions', 'produits_cuisine',
    'recettes', 'referentiel_produits', 'role_permissions', 'roles_custom', 'stock_cuisine',
    'user_permissions', 'ventes_cuisine'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS phase2_compte_actif_requis ON public.%I', t);
  END LOOP;

  -- 5. Vues : retour au comportement par défaut
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I RESET (security_invoker)', t);
  END LOOP;

  -- 4. Historique des ventes et audit : règle unique de la phase 1
  FOREACH t IN ARRAY ARRAY['ventes', 'lignes_vente', 'sorties_boutique', 'entrees_boutique', 'arrets_caisse',
                           'audit_prix_changes', 'audit_prix_simple'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS phase2_lecture ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS phase2_ajout ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS phase2_modification_admin ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS phase2_suppression_admin ON public.%I', t);
    EXECUTE format('CREATE POLICY phase1_utilisateurs_connectes ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 3. profiles
DROP TRIGGER IF EXISTS proteger_profils ON public.profiles;
DROP FUNCTION IF EXISTS public.proteger_profils();
CREATE POLICY phase1_utilisateurs_connectes ON public.profiles AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2. safe_delete_user d'origine
CREATE OR REPLACE FUNCTION public.safe_delete_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
  v_user_name TEXT;
BEGIN
  -- Récupérer le nom pour le log
  SELECT nom INTO v_user_name FROM profiles WHERE id = p_user_id;

  -- Supprimer l'utilisateur auth (si possible)
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignorer si déjà supprimé
  END;

  -- Supprimer le profil (les contraintes ON DELETE feront le reste)
  DELETE FROM profiles WHERE id = p_user_id;

  v_result := json_build_object(
    'success', true,
    'message', format('Utilisateur "%s" supprimé. Tout l''historique est conservé avec références anonymisées (NULL).', COALESCE(v_user_name, 'Sans nom'))
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN v_result;
END;
$function$;
ALTER FUNCTION public.safe_delete_user(uuid) RESET search_path;

-- 1. Fonctions : tous les connectés retrouvent EXECUTE (état phase 1)
DROP FUNCTION IF EXISTS public.est_admin();
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

COMMIT;
