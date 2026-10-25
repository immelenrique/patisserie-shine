-- =====================================================================
-- Partie 11 : plus de vidage de table (TRUNCATE) par les comptes connectés
-- =====================================================================
-- Prérequis : parties 1 à 10 appliquées.
--
-- Avant : les comptes connectés avaient le droit TRUNCATE sur presque toutes les tables. Ce droit vide une table
-- d'un coup, sans tenir compte des règles d'accès ni des protections ligne par ligne. Le site ne permet pas
-- de l'utiliser (l'API n'expose pas TRUNCATE), mais rien ne justifie de le garder.
-- Maintenant : ce droit est retiré sur toutes les tables, et les tables créées plus tard ne le reçoivent plus.
-- La liste des tables concernées est gardée pour le retour arrière.
-- Aucune suppression : peut être exécuté directement. Retour arrière : partie11_annulation.sql (SQL Editor).
-- =====================================================================

BEGIN;

CREATE TABLE public.partie11_truncate_retire (role text NOT NULL, table_nom text NOT NULL, PRIMARY KEY (role, table_nom));
ALTER TABLE public.partie11_truncate_retire ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partie11_truncate_retire FROM PUBLIC, anon, authenticated;

INSERT INTO public.partie11_truncate_retire (role, table_nom)
SELECT r.rolname, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
   AND has_table_privilege(r.rolname, c.oid, 'TRUNCATE')
   AND c.relname <> 'partie11_truncate_retire';

-- Droits par défaut de postgres qui donnaient TRUNCATE (gardés sous le nom de table « (défaut) »)
INSERT INTO public.partie11_truncate_retire (role, table_nom)
SELECT DISTINCT g.rolname, '(défaut)'
  FROM pg_default_acl d, aclexplode(d.defaclacl) x JOIN pg_roles g ON g.oid = x.grantee
 WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'
   AND x.privilege_type = 'TRUNCATE' AND g.rolname IN ('anon', 'authenticated');

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT role, table_nom FROM public.partie11_truncate_retire WHERE table_nom <> '(défaut)' LOOP
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM %I', v.table_nom, v.role);
  END LOOP;
END $$;

-- Tables créées plus tard par postgres : plus de TRUNCATE pour les comptes connectés ni anonymes
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

COMMIT;
