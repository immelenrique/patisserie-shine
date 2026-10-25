-- =====================================================================
-- Annulation de la partie 11 (TRUNCATE retiré) : SQL Editor
-- =====================================================================
-- Rend le droit TRUNCATE aux comptes qui l'avaient, table par table, comme avant la partie 11,
-- puis supprime la liste gardée.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT role, table_nom FROM public.partie11_truncate_retire WHERE table_nom <> '(défaut)' AND to_regclass(format('public.%I', table_nom)) IS NOT NULL LOOP
    EXECUTE format('GRANT TRUNCATE ON public.%I TO %I', v.table_nom, v.role);
  END LOOP;
  FOR v IN SELECT role FROM public.partie11_truncate_retire WHERE table_nom = '(défaut)' LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO %I', v.role);
  END LOOP;
END $$;

DROP TABLE public.partie11_truncate_retire;

COMMIT;
