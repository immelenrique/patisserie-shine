-- =====================================================================
-- ANNULATION de corrections_2_roles.sql : remet les deux contraintes d'origine.
-- Échoue (sans rien modifier) si un profil a entre-temps reçu le rôle employe_production
-- ou employe_cuisine : il faudrait d'abord lui redonner un rôle accepté par les deux.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'employe_boutique'::character varying, 'employe_cuisine'::character varying])::text[])));
ALTER TABLE public.profiles ADD CONSTRAINT valid_role
  CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'employe_production'::character varying, 'employe_boutique'::character varying])::text[])));

COMMIT;
