-- =====================================================================
-- ANNULATION de la phase 1 : remet la base exactement dans l'état d'avant
-- (y compris les failles). À n'utiliser qu'en cas de problème bloquant.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'unites', 'produits', 'demandes', 'stock_atelier', 'stock_boutique',
    'ventes', 'lignes_vente', 'entrees_boutique', 'sorties_boutique',
    'prix_vente_produits', 'prix_vente_recettes', 'utilisations_boutique',
    'arrets_caisse', 'caisses_actives', 'releves_caisse', 'incidents_caisse',
    'audit_prix_changes', 'audit_prix_simple',
    'prix_baseline_surveillance', 'prix_baseline_surveillance_backup'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS phase1_utilisateurs_connectes ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS phase1_compte_actif_requis ON public.%I', t);
  END LOOP;
END $$;

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS phase1_utilisateurs_connectes ON public.profiles;
DROP POLICY IF EXISTS phase1_compte_actif_requis_insert ON public.profiles;
DROP POLICY IF EXISTS phase1_compte_actif_requis_update ON public.profiles;
DROP POLICY IF EXISTS phase1_compte_actif_requis_delete ON public.profiles;

DROP FUNCTION IF EXISTS public.est_utilisateur_actif();

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

-- handle_new_user d'origine
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, nom, role, actif, force_password_change, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employe_boutique'),
    true,
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Erreur création profil automatique: %', SQLERRM;
    RETURN NEW;
END;
$function$;

COMMIT;
