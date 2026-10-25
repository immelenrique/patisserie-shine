-- =====================================================================
-- Remise à zéro de la plateforme (demandée par la propriétaire) : SQL Editor
-- =====================================================================
-- Efface toutes les données de l'application : ventes, demandes, envois, stocks, produits, recettes,
-- productions, dépenses, caisses, inventaires, pertes, notifications, journaux et historiques.
-- Garde ce qu'il faut pour se reconnecter et retravailler : comptes et rôles (profiles, permissions,
-- modules, rôles), unités, réglages des inventaires, journal des mots de passe, liste de la partie 11.
--
-- Prérequis : la sauvegarde sauvegarde_20261025 existe et correspond aux données actuelles ; sinon
-- le script s'arrête sans rien effacer. Restauration possible depuis cette sauvegarde.
-- Les protections (journaux inaltérables) sont levées le temps de l'effacement puis remises.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE garder (t text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO garder VALUES ('profiles'), ('user_permissions'), ('permissions'), ('role_permissions'), ('roles_custom'),
  ('modules'), ('unites'), ('inventaires_reglages'), ('password_change_log'), ('partie11_truncate_retire');

CREATE TEMP TABLE effacer ON COMMIT DROP AS
SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT IN (SELECT t FROM garder);

DO $$
DECLARE
  v record;
  n bigint;
  v_liste text;
BEGIN
  -- 1. La sauvegarde doit exister et contenir chaque table à effacer, avec au moins autant de lignes
  IF to_regclass('sauvegarde_20261025.inventaire') IS NULL THEN
    RAISE EXCEPTION 'Sauvegarde sauvegarde_20261025 absente : rien n''est effacé';
  END IF;
  FOR v IN SELECT e.t, i.lignes FROM effacer e LEFT JOIN sauvegarde_20261025.inventaire i ON i.table_nom = e.t LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v.t) INTO n;
    IF v.lignes IS NULL AND n > 0 THEN
      RAISE EXCEPTION 'Table % absente de la sauvegarde (% lignes) : rien n''est effacé', v.t, n;
    END IF;
    IF n > coalesce(v.lignes, 0) THEN
      RAISE EXCEPTION 'Table % : % lignes, plus que la sauvegarde (%). Refaire une sauvegarde avant d''effacer', v.t, n, v.lignes;
    END IF;
  END LOOP;

  -- 2. Aucune table gardée ne doit dépendre d'une table effacée (sinon l'effacement l'emporterait aussi)
  SELECT string_agg(DISTINCT conrelid::regclass::text || ' → ' || confrelid::regclass::text, ', ') INTO v_liste
    FROM pg_constraint
   WHERE contype = 'f' AND conrelid::regclass::text IN (SELECT t FROM garder) AND confrelid::regclass::text IN (SELECT t FROM effacer);
  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION 'Tables gardées liées à des tables effacées : % — rien n''est effacé', v_liste;
  END IF;

  -- 3. Seules les protections connues contre le vidage existent ; elles sont levées puis remises
  SELECT string_agg(tgname, ', ') INTO v_liste FROM pg_trigger
   WHERE NOT tgisinternal AND (tgtype & 32) = 32 AND tgrelid::regclass::text IN (SELECT t FROM effacer)
     AND tgname NOT IN ('journal_stock_inalterable_vidage', 'journal_depenses_inalterable_vidage', 'confirmations_achats_inalterables_vidage');
  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION 'Protection contre le vidage inconnue : % — rien n''est effacé', v_liste;
  END IF;
END $$;

ALTER TABLE public.journal_stock DISABLE TRIGGER journal_stock_inalterable_vidage;
ALTER TABLE public.journal_depenses DISABLE TRIGGER journal_depenses_inalterable_vidage;
ALTER TABLE public.confirmations_achats DISABLE TRIGGER confirmations_achats_inalterables_vidage;

DO $$
BEGIN
  EXECUTE (SELECT 'TRUNCATE ' || string_agg(format('public.%I', t), ', ' ORDER BY t) || ' RESTART IDENTITY' FROM effacer);
END $$;

-- Les numéros repartent de 1, y compris les compteurs non rattachés à leur table (nextval('…') en valeur par défaut)
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT DISTINCT (regexp_match(pg_get_expr(d.adbin, d.adrelid), 'nextval\(''([^'']+)''::regclass\)'))[1] AS seq
             FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
            WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN (SELECT t FROM effacer)
              AND pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%' LOOP
    EXECUTE format('ALTER SEQUENCE %s RESTART', v.seq);
  END LOOP;
END $$;

ALTER TABLE public.journal_stock ENABLE TRIGGER journal_stock_inalterable_vidage;
ALTER TABLE public.journal_depenses ENABLE TRIGGER journal_depenses_inalterable_vidage;
ALTER TABLE public.confirmations_achats ENABLE TRIGGER confirmations_achats_inalterables_vidage;

-- Contrôle : tout est vide, les comptes sont là, les protections sont actives
DO $$
DECLARE
  v record;
  n bigint;
BEGIN
  FOR v IN SELECT t FROM effacer LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v.t) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Table % non vide après effacement', v.t; END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.profiles) = 0 THEN RAISE EXCEPTION 'Comptes perdus : annulation'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('journal_stock_inalterable_vidage', 'journal_depenses_inalterable_vidage',
             'confirmations_achats_inalterables_vidage') AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'Protection non remise : annulation';
  END IF;
END $$;

SELECT (SELECT count(*) FROM effacer) AS tables_videes, (SELECT count(*) FROM public.profiles) AS comptes_gardes,
       (public.verifier_journal_stock())->>'intact' AS journal_intact;

COMMIT;
