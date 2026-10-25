-- =====================================================================
-- Annulation de la partie 12 (deux boulangeries) : SQL Editor
-- =====================================================================
-- Refuse si des données appartiennent à une autre boulangerie qu'Ouagadougou (elles seraient mélangées).
-- Remet les fonctions, les clés uniques et les droits d'avant la partie 12, retire les colonnes
-- boulangerie_id, la table des boulangeries et le rôle shine_fonctions.
-- =====================================================================

BEGIN;

-- Les réglages d'inventaire d'Abidjan ont été créés par la partie 12
ALTER TABLE public.inventaires_reglages DISABLE TRIGGER inventaires_reglages_sans_suppression;
DELETE FROM public.inventaires_reglages WHERE boulangerie_id <> 1;
ALTER TABLE public.inventaires_reglages ENABLE TRIGGER inventaires_reglages_sans_suppression;

DO $$
DECLARE
  v record;
  n bigint;
BEGIN
  FOR v IN SELECT c.table_name AS t FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.column_name = 'boulangerie_id' AND c.table_name <> 'profiles' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE boulangerie_id <> 1', v.t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Table % : % ligne(s) d''une autre boulangerie : annulation impossible sans perte', v.t, n;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE boulangerie_id <> 1) THEN
    RAISE EXCEPTION 'Des comptes sont affectés à une autre boulangerie : annulation impossible';
  END IF;
END $$;

-- 1. Les fonctions reviennent à postgres
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT p.oid FROM pg_proc p WHERE p.proowner = 'shine_fonctions'::regrole LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', v.oid::regprocedure);
  END LOOP;
END $$;

-- 2. Règles d'accès de la partie 12
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT schemaname, tablename, policyname FROM pg_policies
            WHERE schemaname = 'public' AND policyname IN ('boulangerie_etanche', 'acces_fonctions') LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', v.policyname, v.schemaname, v.tablename);
  END LOOP;
END $$;

DROP TRIGGER profiles_affectation ON public.profiles;
DROP FUNCTION public.proteger_affectation();
DROP FUNCTION public.ma_boulangerie();
DROP FUNCTION public.choisir_boulangerie(integer);
DROP FUNCTION public.modifier_boulangerie(integer, text, text);

-- 3. Clés uniques et index d'origine
DROP INDEX public.inventaires_un_en_cours;
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT split_part(nom, '.', 1) AS t, split_part(nom, '.', 2) AS c, definition FROM public.partie12_avant WHERE genre = 'contrainte' LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v.t, v.c);
  END LOOP;
END $$;

-- 4. Colonnes boulangerie_id
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT c.table_name AS t FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.column_name = 'boulangerie_id' AND c.table_name <> 'profiles' LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN boulangerie_id', v.t);
  END LOOP;
END $$;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_boulangerie_affectee;
ALTER TABLE public.profiles DROP COLUMN boulangerie_id, DROP COLUMN boulangerie_active;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT split_part(nom, '.', 1) AS t, split_part(nom, '.', 2) AS c, definition FROM public.partie12_avant WHERE genre = 'contrainte' LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', v.t, v.c, v.definition);
  END LOOP;
  EXECUTE (SELECT definition FROM public.partie12_avant WHERE genre = 'index' AND nom = 'inventaires_un_en_cours');
  -- 5. Fonctions d'origine
  FOR v IN SELECT definition FROM public.partie12_avant WHERE genre = 'fonction' LOOP
    EXECUTE v.definition;
  END LOOP;
END $$;

DROP FUNCTION public.recu_present(text);
DROP FUNCTION public.recu_du_compte(text, uuid);
DROP FUNCTION public.boulangerie_saisie();
DROP FUNCTION public.boulangerie_courante();
DROP TABLE public.boulangeries;
DROP TABLE public.partie12_avant;

-- 6. Le rôle des fonctions (ses droits, y compris par défaut, partent avec lui)
DROP OWNED BY shine_fonctions;
DROP ROLE shine_fonctions;

NOTIFY pgrst, 'reload schema';

COMMIT;
