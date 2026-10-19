-- =====================================================================
-- PHASE 1 : fermer l'accès aux visiteurs non connectés (rôle « anon »)
-- Projet : bakery-stock-management (Pâtisserie Shine)
--
-- Effets :
--   1. Le rôle anon perd tout droit sur les tables, vues, séquences et fonctions du schéma public.
--   2. RLS est activé sur les 21 tables qui ne l'avaient pas, avec :
--        - une règle permissive : tout utilisateur connecté garde les accès qu'il a aujourd'hui ;
--        - une règle restrictive : il faut un profil ACTIF (actif = true) pour lire ou écrire
--          (exception : la lecture de « profiles », nécessaire à l'écran de connexion).
--   3. handle_new_user ne fait plus confiance au rôle fourni lors d'une inscription.
--
-- Ce qui NE change PAS : les utilisateurs connectés et actifs gardent exactement leurs accès,
-- les API serveur (service_role) ne sont pas concernées, les 20 tables déjà protégées non plus.
-- Annulation : 11_phase1_annulation.sql
-- =====================================================================

BEGIN;

-- Ne jamais attendre plus de 5 s un verrou (sinon tout est annulé, rien n'est modifié)
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Fonction d'aide : l'utilisateur connecté a-t-il un profil actif ?
--    SECURITY DEFINER pour lire profiles sans repasser par ses propres règles RLS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_utilisateur_actif()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND actif IS TRUE
  )
$$;

-- ---------------------------------------------------------------------
-- 2. RLS sur les 21 tables non protégées
-- ---------------------------------------------------------------------
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
    EXECUTE format(
      'CREATE POLICY phase1_utilisateurs_connectes ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format(
      'CREATE POLICY phase1_compte_actif_requis ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.est_utilisateur_actif())) WITH CHECK ((SELECT public.est_utilisateur_actif()))', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- profiles : la lecture reste ouverte aux connectés (l'écran de connexion lit le profil
-- pour refuser un compte désactivé) ; l'écriture exige un compte actif.
CREATE POLICY phase1_utilisateurs_connectes ON public.profiles AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY phase1_compte_actif_requis_insert ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_utilisateur_actif()));
CREATE POLICY phase1_compte_actif_requis_update ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT public.est_utilisateur_actif())) WITH CHECK ((SELECT public.est_utilisateur_actif()));
CREATE POLICY phase1_compte_actif_requis_delete ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.est_utilisateur_actif()));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Retirer au rôle anon tout accès au schéma public
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;      -- tables ET vues
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- PostgreSQL donne EXECUTE à PUBLIC par défaut : il faut le retirer à PUBLIC aussi,
-- puis le redonner explicitement aux rôles connectés (les déclencheurs en ont besoin).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Objets créés à l'avenir dans public : plus de droits automatiques pour anon
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ---------------------------------------------------------------------
-- 4. handle_new_user : le rôle n'est plus pris dans les métadonnées d'inscription.
--    La route /api/admin/create-user fixe le rôle choisi par l'admin juste après.
-- ---------------------------------------------------------------------
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
    'employe_boutique',
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
