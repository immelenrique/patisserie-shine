-- =====================================================================
-- CORRECTIONS 2 : rôles des profils (contient des DROP : à exécuter dans le SQL Editor de Supabase)
--
-- profiles.role porte deux contraintes contradictoires :
--   profiles_role_check : admin, employe_boutique, employe_cuisine
--   valid_role          : admin, employe_production, employe_boutique
-- Seuls « admin » et « employe_boutique » passent les deux : créer un « Employé Production »
-- ou un « Employé Cuisine » depuis l'écran Utilisateurs échoue. On les remplace par une seule
-- contrainte autorisant les 4 rôles proposés par l'application.
-- Les profils existants (admin, employe_boutique) restent tous valides.
--
-- Annulation : corrections_2_annulation.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT valid_role;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'employe_boutique', 'employe_production', 'employe_cuisine'));

COMMIT;
