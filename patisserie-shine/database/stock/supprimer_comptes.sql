-- =====================================================================
-- Suppression des comptes, sauf rabi et admin1 (demandée par la propriétaire) : SQL Editor
-- =====================================================================
-- Supprime les comptes de connexion (auth.users) et leurs profils ; leurs droits individuels et leur
-- historique de mots de passe partent avec eux. Les mentions « accordé par » / « modifié par » qui
-- désignaient ces comptes sont remises à vide.
-- Sécurités : s'arrête sans rien supprimer si rabi (super administrateur) ou admin1 manque, ou si
-- la sauvegarde sauvegarde_20261025 des comptes est absente (restauration possible depuis elle).
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = 'rabi' AND coalesce(is_super_admin, false) AND actif) THEN
    RAISE EXCEPTION 'Le compte rabi (super administrateur actif) est introuvable : rien n''est supprimé';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = 'admin1') THEN
    RAISE EXCEPTION 'Le compte admin1 est introuvable : rien n''est supprimé';
  END IF;
  IF to_regclass('sauvegarde_20261025.auth_users') IS NULL OR to_regclass('sauvegarde_20261025.profiles') IS NULL THEN
    RAISE EXCEPTION 'Sauvegarde des comptes absente : rien n''est supprimé';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.username NOT IN ('rabi', 'admin1')
               AND NOT EXISTS (SELECT 1 FROM sauvegarde_20261025.auth_users s WHERE s.id = p.id)) THEN
    RAISE EXCEPTION 'Un compte à supprimer n''est pas dans la sauvegarde : rien n''est supprimé';
  END IF;
END $$;

UPDATE public.user_permissions SET accorded_by = NULL
 WHERE accorded_by IN (SELECT id FROM public.profiles WHERE username NOT IN ('rabi', 'admin1'));
UPDATE public.password_change_log SET changed_by = NULL
 WHERE changed_by IN (SELECT id FROM public.profiles WHERE username NOT IN ('rabi', 'admin1'));

-- Le profil suit le compte de connexion (suppression en cascade), avec ses droits et son historique
DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE username NOT IN ('rabi', 'admin1'));
DELETE FROM public.profiles WHERE username NOT IN ('rabi', 'admin1');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 2 THEN
    RAISE EXCEPTION 'Contrôle : il devrait rester 2 comptes, annulation';
  END IF;
END $$;

SELECT username, role, coalesce(is_super_admin, false) AS super_admin FROM public.profiles ORDER BY username;

COMMIT;
