-- =====================================================================
-- Partie 12 : une application, deux boulangeries (Ouagadougou, Abidjan)
-- =====================================================================
-- Prérequis : parties 1 à 11 appliquées.
--
-- Principe :
--  - chaque compte est affecté à une boulangerie à sa création ; il ne voit et ne modifie que la sienne ;
--  - la propriétaire et les super administrateurs voient tout : ils choisissent la boulangerie affichée
--    (choisir_boulangerie), ou « toutes » pour lire l'ensemble (aucune saisie possible dans ce mode) ;
--  - chaque donnée porte sa boulangerie (colonne boulangerie_id, remplie par la base) ;
--  - une règle d'accès par table rend les boulangeries étanches. Pour qu'elle s'applique aussi à
--    l'intérieur des fonctions (qui contournaient les règles), les fonctions appartiennent désormais au
--    rôle shine_fonctions, soumis aux règles ;
--  - le journal infalsifiable du stock est chaîné par boulangerie.
-- Retour arrière : partie12_annulation.sql (SQL Editor).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Définitions d'origine gardées pour le retour arrière (partie12_annulation.sql)
-- ---------------------------------------------------------------------
CREATE TABLE public.partie12_avant (genre text NOT NULL, nom text NOT NULL, definition text NOT NULL, PRIMARY KEY (genre, nom));
ALTER TABLE public.partie12_avant ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partie12_avant FROM PUBLIC, anon, authenticated;
INSERT INTO public.partie12_avant (genre, nom, definition)
SELECT 'fonction', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND (p.prosrc ~ 'storage\.objects' OR p.prosrc ~ 'ON CONFLICT \(nom_produit\)'
        OR p.proname IN ('journal_stock_avant_insertion', 'verifier_journal_stock', 'handle_new_user', 'safe_delete_user',
                         'est_utilisateur_actif', 'annuler_vente_boutique'));
INSERT INTO public.partie12_avant (genre, nom, definition)
SELECT 'contrainte', c.conrelid::regclass::text || '.' || c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c
 WHERE c.connamespace = 'public'::regnamespace AND c.contype IN ('u', 'p')
   AND c.conrelid::regclass::text IN ('inventaires_reglages', 'prix_vente_recettes', 'produits', 'recettes', 'recettes_fiches', 'referentiel_produits')
   AND pg_get_constraintdef(c.oid) <> 'PRIMARY KEY (id)';
INSERT INTO public.partie12_avant (genre, nom, definition)
SELECT 'index', 'inventaires_un_en_cours', pg_get_indexdef('public.inventaires_un_en_cours'::regclass);

-- ---------------------------------------------------------------------
-- 1. Les boulangeries
-- ---------------------------------------------------------------------
CREATE TABLE public.boulangeries (
  id integer PRIMARY KEY,
  nom text NOT NULL UNIQUE,
  adresse text,
  telephones text,
  actif boolean NOT NULL DEFAULT true
);
INSERT INTO public.boulangeries (id, nom, adresse, telephones) VALUES
  (1, 'Ouagadougou', E'Balkuis, non loin de la station Shell\nOuagadougou', '74 48 67 98 / 05 07 39 00'),
  (2, 'Abidjan', NULL, NULL);
ALTER TABLE public.boulangeries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boulangeries lisibles par les comptes" ON public.boulangeries FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.boulangeries FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.boulangeries FROM authenticated;
GRANT SELECT ON public.boulangeries TO authenticated;

-- Affectation des comptes : boulangerie_id (employés, gérants) ; boulangerie_active (super administrateurs :
-- boulangerie affichée, NULL = toutes)
ALTER TABLE public.profiles
  ADD COLUMN boulangerie_id integer REFERENCES public.boulangeries (id),
  ADD COLUMN boulangerie_active integer REFERENCES public.boulangeries (id);
UPDATE public.profiles SET boulangerie_id = 1 WHERE NOT coalesce(is_super_admin, false);
UPDATE public.profiles SET boulangerie_active = 1 WHERE coalesce(is_super_admin, false);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_boulangerie_affectee
  CHECK (coalesce(is_super_admin, false) OR boulangerie_id IS NOT NULL);

-- Boulangerie de la personne connectée (ou de l'auteur désigné par une route serveur) ;
-- NULL = pas de restriction (super administrateur en mode « toutes », ou base sans utilisateur) ;
-- 0 = aucune (compte inconnu) : ne voit rien.
CREATE OR REPLACE FUNCTION public.boulangerie_courante()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid);
  v_p record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(is_super_admin, false) AS sa, boulangerie_id, boulangerie_active INTO v_p FROM profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  IF v_p.sa THEN
    RETURN v_p.boulangerie_active;
  END IF;
  RETURN coalesce(v_p.boulangerie_id, 0);
END;
$function$;

-- Boulangerie d'une nouvelle donnée : celle de la personne connectée ; sans personne connectée (SQL Editor,
-- base seule), Ouagadougou, la boulangerie d'origine. Un super administrateur en mode « toutes » doit d'abord
-- choisir une boulangerie (NULL : la saisie est refusée).
CREATE OR REPLACE FUNCTION public.boulangerie_saisie()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE WHEN coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid) IS NULL THEN 1
              ELSE public.boulangerie_courante() END
$function$;

-- ---------------------------------------------------------------------
-- 2. Le rôle des fonctions, soumis aux règles d'accès
-- ---------------------------------------------------------------------
CREATE ROLE shine_fonctions NOLOGIN INHERIT NOBYPASSRLS;
GRANT shine_fonctions TO postgres;
-- Membre d'authenticated : accès au schéma auth (auth.uid()) et mêmes règles « compte actif requis »
GRANT authenticated TO shine_fonctions;

-- Compte actif : la personne connectée, ou l'auteur désigné par une route serveur (annulation de vente)
CREATE OR REPLACE FUNCTION public.est_utilisateur_actif()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid) AND actif IS TRUE
  )
$function$;
GRANT USAGE, CREATE ON SCHEMA public TO shine_fonctions;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO shine_fonctions;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO shine_fonctions;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shine_fonctions;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO shine_fonctions;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO shine_fonctions;

-- Présence d'un reçu dans le stockage (lu par la base, sans règle d'accès) : les fonctions n'interrogent plus
-- storage.objects elles-mêmes
CREATE OR REPLACE FUNCTION public.recu_present(p_chemin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = p_chemin)
$function$;
CREATE OR REPLACE FUNCTION public.recu_du_compte(p_chemin text, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'depenses-pieces-jointes' AND o.name = p_chemin
                   AND (o.owner_id = p_uid::text OR o.owner = p_uid))
$function$;
REVOKE ALL ON FUNCTION public.recu_present(text), public.recu_du_compte(text, uuid), public.boulangerie_courante(), public.boulangerie_saisie() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recu_present(text), public.recu_du_compte(text, uuid) TO shine_fonctions, service_role;
GRANT EXECUTE ON FUNCTION public.boulangerie_courante(), public.boulangerie_saisie() TO authenticated, shine_fonctions, service_role;

DO $$
DECLARE
  v record;
  v_def text;
  v_neuf text;
BEGIN
  FOR v IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
            AND p.prosrc ~ 'storage\.objects' AND p.proname NOT IN ('recu_present', 'recu_du_compte') LOOP
    v_def := pg_get_functiondef(v.oid);
    v_neuf := regexp_replace(v_def,
      'EXISTS \(SELECT 1 FROM storage\.objects o WHERE o\.bucket_id = ''depenses-pieces-jointes'' AND o\.name = v_chemin\s+AND \(o\.owner_id = v_uid::text OR o\.owner = v_uid\)\)',
      'public.recu_du_compte(v_chemin, v_uid)', 'g');
    v_neuf := regexp_replace(v_neuf,
      'EXISTS \(SELECT 1 FROM storage\.objects o WHERE o\.bucket_id = ''depenses-pieces-jointes'' AND o\.name = ([a-z]+->>''chemin'')\)',
      'public.recu_present(\1)', 'g');
    IF v_neuf ~ 'storage\.objects' THEN
      RAISE EXCEPTION 'Lecture du stockage non reconnue dans %', v.oid::regprocedure;
    END IF;
    EXECUTE v_neuf;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Chaque donnée porte sa boulangerie ; règles d'accès étanches
-- ---------------------------------------------------------------------
-- Tables communes aux deux boulangeries (comptes, droits, unités) : pas de colonne boulangerie_id
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT c.relname AS t FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
            AND c.relname <> ALL (ARRAY['boulangeries', 'profiles', 'partie12_avant', 'unites', 'modules', 'permissions',
              'role_permissions', 'roles_custom', 'user_permissions', 'password_change_log', 'partie11_truncate_retire']) ORDER BY 1 LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN boulangerie_id integer NOT NULL DEFAULT 1 REFERENCES public.boulangeries (id)', v.t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN boulangerie_id SET DEFAULT public.boulangerie_saisie()', v.t);
    EXECUTE format('CREATE INDEX %I ON public.%I (boulangerie_id)', left(v.t, 45) || '_boulangerie_idx', v.t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v.t);
    EXECUTE format('CREATE POLICY boulangerie_etanche ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC '
      'USING (boulangerie_id = (SELECT public.boulangerie_courante()) OR (SELECT public.boulangerie_courante()) IS NULL%s) '
      'WITH CHECK (boulangerie_id = (SELECT public.boulangerie_courante()) OR (SELECT public.boulangerie_courante()) IS NULL)',
      v.t, CASE WHEN v.t = 'notifications' THEN ' OR destinataire_id = auth.uid()' ELSE '' END);
  END LOOP;
  -- Le rôle des fonctions lit et écrit toutes les tables (dans la limite de la règle d'étanchéité)
  FOR v IN SELECT c.relname AS t FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v.t);
    EXECUTE format('CREATE POLICY acces_fonctions ON public.%I AS PERMISSIVE FOR ALL TO shine_fonctions USING (true) WITH CHECK (true)', v.t);
  END LOOP;
END $$;

-- Comptes : chacun voit ceux de sa boulangerie, les super administrateurs et lui-même
-- (sans sous-requête : les anciennes règles de cette table s'y référent elles-mêmes, une sous-requête ici
-- provoquerait « infinite recursion »)
CREATE POLICY boulangerie_etanche ON public.profiles AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (boulangerie_id = public.boulangerie_courante() OR public.boulangerie_courante() IS NULL
         OR boulangerie_id IS NULL OR id = auth.uid())
  WITH CHECK (boulangerie_id = public.boulangerie_courante() OR public.boulangerie_courante() IS NULL
         OR boulangerie_id IS NULL OR id = auth.uid());

-- Un compte ne change pas lui-même de boulangerie ; seul un super administrateur affecte ou réaffecte
CREATE OR REPLACE FUNCTION public.proteger_affectation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NOT public.est_super_admin() THEN
    IF TG_OP = 'UPDATE' AND (NEW.boulangerie_id IS DISTINCT FROM OLD.boulangerie_id OR NEW.boulangerie_active IS DISTINCT FROM OLD.boulangerie_active) THEN
      RAISE EXCEPTION 'Seule la propriétaire change la boulangerie d''un compte' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.boulangerie_id IS DISTINCT FROM public.boulangerie_courante() THEN
      RAISE EXCEPTION 'Un compte est créé dans votre boulangerie' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER profiles_affectation BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_affectation();

-- Nouveau compte : boulangerie transmise par la route de création
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, nom, role, actif, force_password_change, created_at, updated_at, boulangerie_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau Utilisateur'),
    'employe_boutique',
    true,
    true,
    NOW(),
    NOW(),
    coalesce(nullif(NEW.raw_user_meta_data->>'boulangerie_id', '')::integer, public.boulangerie_saisie())
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Erreur création profil automatique: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. Noms uniques par boulangerie (la même farine, la même recette peuvent exister des deux côtés)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v record;
  v_cols text;
BEGIN
  FOR v IN SELECT c.conname, c.conrelid::regclass AS t, c.contype, pg_get_constraintdef(c.oid) AS def
             FROM pg_constraint c
            WHERE c.connamespace = 'public'::regnamespace AND c.contype IN ('u', 'p')
              AND c.conrelid::regclass::text IN ('inventaires_reglages', 'prix_vente_recettes', 'produits', 'recettes', 'recettes_fiches', 'referentiel_produits')
              AND pg_get_constraintdef(c.oid) <> 'PRIMARY KEY (id)' LOOP
    v_cols := substring(v.def FROM '\((.*)\)');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v.t, v.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s (boulangerie_id, %s)', v.t, v.conname,
      CASE WHEN v.contype = 'p' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END, v_cols);
  END LOOP;
END $$;
DROP INDEX public.inventaires_un_en_cours;
CREATE UNIQUE INDEX inventaires_un_en_cours ON public.inventaires (boulangerie_id, lieu) WHERE statut = 'en_cours';

-- Réglages d'inventaire d'Abidjan : les mêmes qu'à Ouagadougou pour commencer
INSERT INTO public.inventaires_reglages (boulangerie_id, lieu, mode, nombre, frequence, jour)
SELECT 2, lieu, mode, nombre, frequence, jour FROM public.inventaires_reglages WHERE boulangerie_id = 1;

-- « ON CONFLICT » sur un nom : désormais par boulangerie
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ~ 'ON CONFLICT \(nom_produit\)' LOOP
    EXECUTE replace(pg_get_functiondef(v.oid), 'ON CONFLICT (nom_produit)', 'ON CONFLICT (boulangerie_id, nom_produit)');
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. Journal infalsifiable : une chaîne par boulangerie
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journal_stock_avant_insertion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_precedente text;
BEGIN
  -- Une écriture à la fois par boulangerie : l'ordre des identifiants est l'ordre du chaînage
  PERFORM pg_advisory_xact_lock(hashtext('public.journal_stock'), NEW.boulangerie_id);
  NEW.id := nextval('public.journal_stock_id_seq');
  NEW.cree_le := clock_timestamp();
  NEW.auteur_id := coalesce(auth.uid(), nullif(current_setting('shine.auteur', true), '')::uuid);
  NEW.auteur_nom := (SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = NEW.auteur_id);
  SELECT empreinte INTO v_precedente FROM journal_stock WHERE boulangerie_id = NEW.boulangerie_id ORDER BY id DESC LIMIT 1;
  NEW.empreinte_precedente := coalesce(v_precedente, 'origine');
  NEW.empreinte := encode(sha256(convert_to(public.journal_stock_contenu(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verifier_journal_stock()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  j journal_stock;
  v_b integer;
  v_precedente text;
  v_nb bigint := 0;
BEGIN
  -- Admin connecté, serveur, ou connexion directe à la base (SQL Editor : aucun jeton)
  IF coalesce(public.role_courant(), '') <> 'admin' AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  -- Chaque boulangerie a sa chaîne (seules les lignes visibles sont vérifiées)
  FOR v_b IN SELECT DISTINCT boulangerie_id FROM journal_stock ORDER BY 1 LOOP
    v_precedente := 'origine';
    FOR j IN SELECT * FROM journal_stock WHERE boulangerie_id = v_b ORDER BY id LOOP
      IF j.empreinte_precedente <> v_precedente
         OR j.empreinte <> encode(sha256(convert_to(public.journal_stock_contenu(j), 'UTF8')), 'hex') THEN
        RETURN jsonb_build_object('intact', false, 'premiere_ligne_alteree', j.id, 'lignes_verifiees', v_nb, 'boulangerie', v_b);
      END IF;
      v_precedente := j.empreinte;
      v_nb := v_nb + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('intact', true, 'lignes_verifiees', v_nb);
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. Choix de la boulangerie affichée (propriétaire) et coordonnées
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ma_boulangerie()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_b integer := public.boulangerie_courante();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'courante', (SELECT to_jsonb(b) FROM boulangeries b WHERE b.id = v_b),
    'toutes', v_b IS NULL,
    'peut_choisir', public.est_super_admin(),
    'liste', CASE WHEN public.est_super_admin() THEN (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM boulangeries b WHERE b.actif) END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.choisir_boulangerie(p_boulangerie_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.est_super_admin() THEN
    RAISE EXCEPTION 'Seule la propriétaire choisit la boulangerie affichée' USING ERRCODE = '42501';
  END IF;
  IF p_boulangerie_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM boulangeries WHERE id = p_boulangerie_id AND actif) THEN
    RAISE EXCEPTION 'Boulangerie inconnue' USING ERRCODE = 'P0002';
  END IF;
  UPDATE profiles SET boulangerie_active = p_boulangerie_id, updated_at = now() WHERE id = auth.uid();
  RETURN public.ma_boulangerie();
END;
$function$;

CREATE OR REPLACE FUNCTION public.modifier_boulangerie(p_boulangerie_id integer, p_adresse text, p_telephones text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.est_super_admin() THEN
    RAISE EXCEPTION 'Seule la propriétaire modifie les coordonnées' USING ERRCODE = '42501';
  END IF;
  UPDATE boulangeries SET adresse = nullif(trim(p_adresse), ''), telephones = nullif(trim(p_telephones), '') WHERE id = p_boulangerie_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boulangerie inconnue' USING ERRCODE = 'P0002';
  END IF;
  RETURN (SELECT to_jsonb(b) FROM boulangeries b WHERE b.id = p_boulangerie_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.ma_boulangerie(), public.choisir_boulangerie(integer), public.modifier_boulangerie(integer, text, text),
  public.proteger_affectation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ma_boulangerie(), public.choisir_boulangerie(integer), public.modifier_boulangerie(integer, text, text)
  TO authenticated, service_role;

-- Suppression d'un compte : seulement dans sa boulangerie (sauf propriétaire)
DO $$
BEGIN
  IF to_regprocedure('public.safe_delete_user(uuid)') IS NOT NULL THEN
    EXECUTE regexp_replace(pg_get_functiondef('public.safe_delete_user(uuid)'::regprocedure),
      '(\n\s*BEGIN\s*\n)',
      E'\\1  IF NOT public.est_super_admin() AND (SELECT boulangerie_id FROM public.profiles WHERE id = p_user_id) IS DISTINCT FROM public.boulangerie_courante() THEN\n    RAISE EXCEPTION ''Compte d''''une autre boulangerie'' USING ERRCODE = ''42501'';\n  END IF;\n');
  END IF;
END $$;

-- Annulation de vente (route serveur) : seulement une vente de la boulangerie de l'admin qui annule
DO $$
DECLARE
  v_def text;
BEGIN
  IF to_regprocedure('public.annuler_vente_boutique(integer, text, uuid)') IS NOT NULL THEN
    v_def := pg_get_functiondef('public.annuler_vente_boutique(integer, text, uuid)'::regprocedure);
    IF strpos(v_def, 'SELECT id, numero_ticket, total, statut, created_at INTO v_vente') = 0
       OR strpos(v_def, E'IF v_vente.statut = ''annulee'' THEN') = 0 THEN
      RAISE EXCEPTION 'annuler_vente_boutique : définition inattendue';
    END IF;
    v_def := replace(v_def, 'SELECT id, numero_ticket, total, statut, created_at INTO v_vente',
                            'SELECT id, numero_ticket, total, statut, created_at, boulangerie_id INTO v_vente');
    v_def := replace(v_def, E'IF v_vente.statut = ''annulee'' THEN',
      E'IF v_vente.boulangerie_id IS DISTINCT FROM public.boulangerie_courante() THEN\n    RAISE EXCEPTION ''Cette vente appartient à une autre boulangerie : choisissez-la d''''abord'' USING ERRCODE = ''42501'';\n  END IF;\n  IF v_vente.statut = ''annulee'' THEN');
    EXECUTE v_def;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 7. Toutes les fonctions passent au rôle soumis aux règles, y compris les fonctions internes appelées par
--    les autres (sauf celles qu'utilisent les règles elles-mêmes, et celles qui touchent aux comptes de
--    connexion ou au stockage)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT p.oid FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
              AND p.proname NOT IN ('boulangerie_courante', 'boulangerie_saisie', 'role_courant', 'est_super_admin', 'est_admin', 'est_utilisateur_actif',
                                    'safe_delete_user', 'handle_new_user', 'recu_present', 'recu_du_compte', 'proteger_affectation')
              AND p.prosrc !~ 'auth\.(users|identities|sessions)|storage\.'
              AND NOT EXISTS (SELECT 1 FROM pg_policies pol WHERE pol.qual ~ ('\m' || p.proname || '\(') OR pol.with_check ~ ('\m' || p.proname || '\('))
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO shine_fonctions', v.oid::regprocedure);
  END LOOP;
END $$;

-- Les fonctions créées ci-dessus sont appelables par le rôle des fonctions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shine_fonctions;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO shine_fonctions;

NOTIFY pgrst, 'reload schema';

COMMIT;
