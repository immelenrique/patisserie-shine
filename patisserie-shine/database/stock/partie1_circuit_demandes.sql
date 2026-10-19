-- =====================================================================
-- PARTIE 1 : CIRCUIT DES DEMANDES (validation, transit, réception) ET JOURNAL INFALSIFIABLE
-- Projet : bakery-stock-management. Prérequis : sécurité phases 1-2, corrections 1-2, ventes atomiques.
-- Aucune suppression : applicable directement. Le statut « annulee » des lignes de demande demande en plus
-- partie1_contrainte_annulee.sql (SQL Editor, car il contient un DROP CONSTRAINT).
--
-- Avant : la validation d'une demande était faite par le navigateur en une dizaine d'appels séparés, erreurs
-- ignorées, sans verrou (47 demandes transférées deux fois en production, 618 unités créditées en trop à la
-- boutique). Le stock arrivait à destination au clic du valideur, sans que personne ne compte ce qui arrivait.
-- Les auteurs des mouvements étaient fournis par le navigateur (falsifiables) ou absents (52 % des mouvements).
--
-- Après :
-- 1. journal_stock : journal à ajout seul. Auteur (auth.uid()) et heure fixés par la base ; chaque ligne porte
--    l'empreinte SHA-256 de la précédente, toute modification se voit (verifier_journal_stock). Ni
--    modification ni suppression possible, même par le serveur.
-- 2. envois / envoi_lignes : la marchandise validée part « en transit » ; le stock de destination n'augmente
--    qu'à la réception, de la quantité réellement comptée. Un écart exige un motif et prévient les admins.
-- 3. Règle de contrôle croisé : un envoi validé par la personne qui l'a demandé (ou envoyé par l'atelier sans
--    validation) doit être réceptionné par une autre personne.
-- 4. Fonctions (seul chemin possible) : valider_demande_groupee, refuser_demande, annuler_envoi, receptionner_envoi,
--    envoyer_atelier_vers_boutique, verifier_journal_stock.
-- 5. Verrous : les statuts des demandes ne changent plus que par ces fonctions ; un caissier ne peut plus
--    modifier directement la quantité disponible de la boutique ou de l'atelier.
-- 6. log_mouvement_stock enregistre désormais l'auteur des mouvements du stock principal.
--
-- Annulation : partie1_annulation.sql (SQL Editor : contient des DROP)
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- Rôle de l'utilisateur connecté (compte actif uniquement), pour les règles et les fonctions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_courant()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() AND actif IS TRUE
$function$;

-- ---------------------------------------------------------------------
-- 1. Journal infalsifiable
-- ---------------------------------------------------------------------
CREATE SEQUENCE public.journal_stock_id_seq;

CREATE TABLE public.journal_stock (
  id bigint PRIMARY KEY,
  cree_le timestamptz NOT NULL,
  auteur_id uuid,
  auteur_nom text,
  lieu text NOT NULL CHECK (lieu IN ('principal', 'atelier', 'boutique', 'transit', 'ecart')),
  produit_id integer NOT NULL,
  produit_nom text,
  quantite numeric NOT NULL CHECK (quantite <> 0),
  nature text NOT NULL CHECK (nature IN ('envoi', 'annulation_envoi', 'reception', 'ecart_reception')),
  envoi_id bigint,
  motif text,
  empreinte_precedente text NOT NULL,
  empreinte text NOT NULL UNIQUE
);
COMMENT ON TABLE public.journal_stock IS 'Journal à ajout seul des mouvements de stock. Somme des quantités par lieu = mouvement net du lieu. Chaînage SHA-256 : voir verifier_journal_stock().';

-- Contenu haché d'une ligne : même formule à l'écriture et à la vérification
CREATE OR REPLACE FUNCTION public.journal_stock_contenu(j public.journal_stock)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT concat_ws('|', j.empreinte_precedente, j.id,
    to_char(j.cree_le AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    coalesce(j.auteur_id::text, ''), j.lieu, j.produit_id, j.quantite::text, j.nature,
    coalesce(j.envoi_id::text, ''), coalesce(j.motif, ''))
$function$;

CREATE OR REPLACE FUNCTION public.journal_stock_avant_insertion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_precedente text;
BEGIN
  -- Une écriture à la fois : l'ordre des identifiants est l'ordre du chaînage
  PERFORM pg_advisory_xact_lock(hashtext('public.journal_stock'));
  NEW.id := nextval('public.journal_stock_id_seq');
  NEW.cree_le := clock_timestamp();
  NEW.auteur_id := auth.uid();
  NEW.auteur_nom := (SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = NEW.auteur_id);
  SELECT empreinte INTO v_precedente FROM journal_stock ORDER BY id DESC LIMIT 1;
  NEW.empreinte_precedente := coalesce(v_precedente, 'origine');
  NEW.empreinte := encode(sha256(convert_to(public.journal_stock_contenu(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.interdire_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'Table % : les lignes ne peuvent être ni modifiées ni supprimées', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER journal_stock_avant_insertion BEFORE INSERT ON public.journal_stock
  FOR EACH ROW EXECUTE FUNCTION public.journal_stock_avant_insertion();
CREATE TRIGGER journal_stock_inalterable BEFORE UPDATE OR DELETE ON public.journal_stock
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER journal_stock_inalterable_vidage BEFORE TRUNCATE ON public.journal_stock
  FOR EACH STATEMENT EXECUTE FUNCTION public.interdire_modification();

-- Écriture interne (appelée uniquement par les fonctions de cette partie)
CREATE OR REPLACE FUNCTION public.journal_ecrire(p_lieu text, p_produit_id integer, p_produit_nom text,
  p_quantite numeric, p_nature text, p_envoi_id bigint, p_motif text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  INSERT INTO journal_stock (lieu, produit_id, produit_nom, quantite, nature, envoi_id, motif)
  VALUES (p_lieu, p_produit_id, p_produit_nom, p_quantite, p_nature, p_envoi_id, p_motif)
$function$;

-- Vérification du chaînage : renvoie le premier identifiant altéré, ou NULL si tout est intact
CREATE OR REPLACE FUNCTION public.verifier_journal_stock()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  j journal_stock;
  v_precedente text := 'origine';
  v_nb bigint := 0;
BEGIN
  -- Admin connecté, serveur, ou connexion directe à la base (SQL Editor : aucun jeton)
  IF coalesce(public.role_courant(), '') <> 'admin' AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  FOR j IN SELECT * FROM journal_stock ORDER BY id LOOP
    IF j.empreinte_precedente <> v_precedente
       OR j.empreinte <> encode(sha256(convert_to(public.journal_stock_contenu(j), 'UTF8')), 'hex') THEN
      RETURN jsonb_build_object('intact', false, 'premiere_ligne_alteree', j.id, 'lignes_verifiees', v_nb);
    END IF;
    v_precedente := j.empreinte;
    v_nb := v_nb + 1;
  END LOOP;
  RETURN jsonb_build_object('intact', true, 'lignes_verifiees', v_nb);
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. Envois (marchandise en transit) et leurs lignes
-- ---------------------------------------------------------------------
CREATE TABLE public.envois (
  id bigserial PRIMARY KEY,
  origine text NOT NULL CHECK (origine IN ('principal', 'atelier')),
  destination text NOT NULL CHECK (destination IN ('atelier', 'boutique')),
  demande_groupee_id bigint UNIQUE REFERENCES public.demandes_groupees(id),
  cle uuid UNIQUE,
  statut text NOT NULL DEFAULT 'en_transit' CHECK (statut IN ('en_transit', 'recu', 'annule')),
  demandeur_id uuid,
  valideur_id uuid NOT NULL,
  auto_validation boolean NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  receptionnaire_id uuid,
  recu_le timestamptz,
  avec_ecart boolean,
  annule_par uuid,
  annule_le timestamptz,
  motif_annulation text,
  CHECK (origine <> destination)
);
COMMENT ON COLUMN public.envois.auto_validation IS 'Vrai si la personne qui a validé (ou envoyé) est aussi celle qui a demandé : la réception doit alors être faite par une autre personne.';

CREATE TABLE public.envoi_lignes (
  id bigserial PRIMARY KEY,
  envoi_id bigint NOT NULL REFERENCES public.envois(id),
  produit_id integer NOT NULL,
  produit_nom text,
  unite text,
  quantite_demandee numeric,
  quantite_envoyee numeric NOT NULL CHECK (quantite_envoyee > 0),
  quantite_recue numeric CHECK (quantite_recue >= 0),
  motif_ecart text,
  UNIQUE (envoi_id, produit_id)
);

CREATE INDEX envois_statut_destination_idx ON public.envois (statut, destination);
CREATE INDEX journal_stock_cree_le_idx ON public.journal_stock (cree_le);
CREATE INDEX journal_stock_envoi_idx ON public.journal_stock (envoi_id);

CREATE TRIGGER envois_sans_suppression BEFORE DELETE ON public.envois
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER envoi_lignes_sans_suppression BEFORE DELETE ON public.envoi_lignes
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();

-- Lecture seule depuis l'application ; écriture uniquement par les fonctions
REVOKE ALL ON public.journal_stock, public.envois, public.envoi_lignes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.journal_stock_id_seq, public.envois_id_seq, public.envoi_lignes_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.journal_stock, public.envois, public.envoi_lignes TO authenticated;
GRANT ALL ON public.journal_stock, public.envois, public.envoi_lignes TO service_role;
GRANT ALL ON SEQUENCE public.journal_stock_id_seq, public.envois_id_seq, public.envoi_lignes_id_seq TO service_role;

ALTER TABLE public.journal_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envoi_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journal lisible par les admins" ON public.journal_stock FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin');
-- Chacun voit les envois qui le concernent : admins tout, boutique les envois vers la boutique,
-- production ceux qui partent de l'atelier ou y arrivent
CREATE POLICY "Envois visibles selon le lieu" ON public.envois FOR SELECT TO authenticated
  USING (
    (SELECT public.role_courant()) = 'admin'
    OR ((SELECT public.role_courant()) = 'employe_boutique' AND destination = 'boutique')
    OR ((SELECT public.role_courant()) = 'employe_production' AND (destination = 'atelier' OR origine = 'atelier'))
  );
CREATE POLICY "Lignes visibles avec leur envoi" ON public.envoi_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.envois e WHERE e.id = envoi_id));

-- ---------------------------------------------------------------------
-- 3. Fonctions du circuit
-- ---------------------------------------------------------------------

-- Validation par le propriétaire ou un gérant : stock principal décompté, marchandise en transit.
-- p_quantites (facultatif) : {"<produit_id>": quantité validée}, au plus la quantité demandée ; 0 = ligne refusée.
CREATE OR REPLACE FUNCTION public.valider_demande_groupee(p_groupe_id bigint, p_quantites jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_groupe record;
  v_destination text;
  v_envoi bigint;
  v_ligne record;
  v_quantite numeric;
  v_produit record;
  v_auto boolean;
  v_lignes jsonb := '[]'::jsonb;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent valider une demande' USING ERRCODE = '42501';
  END IF;
  IF p_quantites IS NOT NULL AND jsonb_typeof(p_quantites) <> 'object' THEN
    RAISE EXCEPTION 'Quantités validées invalides' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_groupe FROM demandes_groupees WHERE id = p_groupe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_groupe.statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée (statut : %)', v_groupe.statut USING ERRCODE = '55000';
  END IF;
  v_destination := CASE WHEN v_groupe.destination = 'Boutique' THEN 'boutique'
                        WHEN v_groupe.destination IN ('Production', 'Atelier') THEN 'atelier' END;
  IF v_destination IS NULL THEN
    RAISE EXCEPTION 'Destination inconnue : %', v_groupe.destination USING ERRCODE = '22023';
  END IF;

  v_auto := v_groupe.demandeur_id IS NOT DISTINCT FROM v_uid;
  INSERT INTO envois (origine, destination, demande_groupee_id, demandeur_id, valideur_id, auto_validation)
  VALUES ('principal', v_destination, p_groupe_id, v_groupe.demandeur_id, v_uid, v_auto)
  RETURNING id INTO v_envoi;

  -- Ordre fixe des verrous (par produit) : pas d'interblocage entre deux validations
  FOR v_ligne IN
    SELECT produit_id, sum(quantite) AS quantite FROM demandes
     WHERE demande_groupee_id = p_groupe_id AND statut = 'en_attente'
     GROUP BY produit_id ORDER BY produit_id
  LOOP
    v_quantite := v_ligne.quantite;
    IF p_quantites ? v_ligne.produit_id::text THEN
      BEGIN
        v_quantite := (p_quantites ->> v_ligne.produit_id::text)::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Quantité validée invalide pour le produit %', v_ligne.produit_id USING ERRCODE = '22023';
      END;
      IF v_quantite IS NULL OR v_quantite < 0 OR v_quantite > v_ligne.quantite THEN
        RAISE EXCEPTION 'La quantité validée doit être comprise entre 0 et la quantité demandée (%)', v_ligne.quantite
          USING ERRCODE = '22023';
      END IF;
    END IF;
    CONTINUE WHEN v_quantite = 0;

    SELECT p.id, p.nom, p.quantite_restante, u.label AS unite INTO v_produit
      FROM produits p LEFT JOIN unites u ON u.id = p.unite_id
     WHERE p.id = v_ligne.produit_id
       FOR UPDATE OF p;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit % introuvable dans le stock principal', v_ligne.produit_id USING ERRCODE = 'P0002';
    END IF;
    IF v_produit.quantite_restante < v_quantite THEN
      RAISE EXCEPTION 'Stock principal insuffisant pour « % » : % disponible(s), % demandé(s)',
        v_produit.nom, v_produit.quantite_restante, v_quantite USING ERRCODE = '23514';
    END IF;

    UPDATE produits SET quantite_restante = quantite_restante - v_quantite, updated_at = now() WHERE id = v_produit.id;
    INSERT INTO envoi_lignes (envoi_id, produit_id, produit_nom, unite, quantite_demandee, quantite_envoyee)
    VALUES (v_envoi, v_produit.id, v_produit.nom, v_produit.unite, v_ligne.quantite, v_quantite);
    PERFORM journal_ecrire('principal', v_produit.id, v_produit.nom, -v_quantite, 'envoi', v_envoi, NULL);
    PERFORM journal_ecrire('transit', v_produit.id, v_produit.nom, v_quantite, 'envoi', v_envoi, NULL);
    v_lignes := v_lignes || jsonb_build_object('produit_id', v_produit.id, 'produit_nom', v_produit.nom,
      'unite', v_produit.unite, 'quantite_demandee', v_ligne.quantite, 'quantite_envoyee', v_quantite);
  END LOOP;

  IF jsonb_array_length(v_lignes) = 0 THEN
    RAISE EXCEPTION 'Aucune quantité à envoyer : utilisez « Refuser »' USING ERRCODE = '22023';
  END IF;

  UPDATE demandes d
     SET statut = CASE WHEN EXISTS (SELECT 1 FROM envoi_lignes el WHERE el.envoi_id = v_envoi AND el.produit_id = d.produit_id)
                       THEN 'validee' ELSE 'refusee' END,
         valideur_id = v_uid, date_validation = now(), updated_at = now()
   WHERE d.demande_groupee_id = p_groupe_id AND d.statut = 'en_attente';
  -- Le déclencheur prevent_invalid_status_changes impose le passage par en_traitement
  UPDATE demandes_groupees SET statut = 'en_traitement' WHERE id = p_groupe_id;
  UPDATE demandes_groupees
     SET statut = 'validee', valideur_id = v_uid, date_validation = now(),
         details_validation = jsonb_build_object('envoi_id', v_envoi, 'auto_validation', v_auto)
   WHERE id = p_groupe_id;

  RETURN jsonb_build_object('envoi_id', v_envoi, 'destination', v_destination, 'auto_validation', v_auto, 'lignes', v_lignes);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refuser_demande(p_groupe_id bigint, p_raison text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_statut text;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent refuser une demande' USING ERRCODE = '42501';
  END IF;
  SELECT statut INTO v_statut FROM demandes_groupees WHERE id = p_groupe_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_statut <> 'en_attente' THEN
    RAISE EXCEPTION 'Cette demande a déjà été traitée (statut : %)', v_statut USING ERRCODE = '55000';
  END IF;

  UPDATE demandes SET statut = 'refusee', valideur_id = v_uid, date_validation = now(), updated_at = now()
   WHERE demande_groupee_id = p_groupe_id AND statut = 'en_attente';
  UPDATE demandes_groupees SET statut = 'en_traitement' WHERE id = p_groupe_id;
  UPDATE demandes_groupees
     SET statut = 'refusee', valideur_id = v_uid, date_validation = now(),
         details_validation = jsonb_build_object('refus', jsonb_build_object('par', v_uid, 'date', now(), 'raison', nullif(trim(p_raison), '')))
   WHERE id = p_groupe_id;
  RETURN jsonb_build_object('statut', 'refusee');
END;
$function$;

-- Envoi direct atelier → boutique (produits finis), sans validation : l'expéditeur ne peut pas réceptionner.
-- p_lignes : [{"produit_id": .., "quantite": ..}] ; p_cle : identifiant du formulaire contre les doubles envois.
CREATE OR REPLACE FUNCTION public.envoyer_atelier_vers_boutique(p_lignes jsonb, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_envoi bigint;
  v_ligne record;
  v_stock record;
  v_lignes jsonb := '[]'::jsonb;
BEGIN
  IF public.role_courant() NOT IN ('admin', 'employe_production') OR public.role_courant() IS NULL THEN
    RAISE EXCEPTION 'Seuls la production et les gérants peuvent envoyer depuis l''atelier' USING ERRCODE = '42501';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Aucun produit à envoyer' USING ERRCODE = '22023';
  END IF;

  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    SELECT id INTO v_envoi FROM envois WHERE cle = p_cle;
    IF FOUND THEN
      RETURN jsonb_build_object('envoi_id', v_envoi, 'deja_enregistre', true);
    END IF;
  END IF;

  INSERT INTO envois (origine, destination, cle, demandeur_id, valideur_id, auto_validation)
  VALUES ('atelier', 'boutique', p_cle, v_uid, v_uid, true)
  RETURNING id INTO v_envoi;

  FOR v_ligne IN
    SELECT (e->>'produit_id')::integer AS produit_id, sum((e->>'quantite')::numeric) AS quantite
      FROM jsonb_array_elements(p_lignes) e GROUP BY 1 ORDER BY 1
  LOOP
    IF v_ligne.produit_id IS NULL OR v_ligne.quantite IS NULL OR v_ligne.quantite <= 0 THEN
      RAISE EXCEPTION 'Ligne d''envoi invalide' USING ERRCODE = '22023';
    END IF;
    SELECT sa.id, sa.quantite_disponible, p.nom, u.label AS unite INTO v_stock
      FROM stock_atelier sa JOIN produits p ON p.id = sa.produit_id LEFT JOIN unites u ON u.id = p.unite_id
     WHERE sa.produit_id = v_ligne.produit_id
       FOR UPDATE OF sa;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit % absent du stock atelier', v_ligne.produit_id USING ERRCODE = 'P0002';
    END IF;
    IF v_stock.quantite_disponible < v_ligne.quantite THEN
      RAISE EXCEPTION 'Stock atelier insuffisant pour « % » : % disponible(s), % demandé(s)',
        v_stock.nom, v_stock.quantite_disponible, v_ligne.quantite USING ERRCODE = '23514';
    END IF;
    UPDATE stock_atelier SET quantite_disponible = quantite_disponible - v_ligne.quantite, updated_at = now()
     WHERE id = v_stock.id;
    INSERT INTO envoi_lignes (envoi_id, produit_id, produit_nom, unite, quantite_envoyee)
    VALUES (v_envoi, v_ligne.produit_id, v_stock.nom, v_stock.unite, v_ligne.quantite);
    PERFORM journal_ecrire('atelier', v_ligne.produit_id, v_stock.nom, -v_ligne.quantite, 'envoi', v_envoi, NULL);
    PERFORM journal_ecrire('transit', v_ligne.produit_id, v_stock.nom, v_ligne.quantite, 'envoi', v_envoi, NULL);
    v_lignes := v_lignes || jsonb_build_object('produit_id', v_ligne.produit_id, 'produit_nom', v_stock.nom,
      'unite', v_stock.unite, 'quantite_envoyee', v_ligne.quantite);
  END LOOP;

  RETURN jsonb_build_object('envoi_id', v_envoi, 'deja_enregistre', false, 'lignes', v_lignes);
END;
$function$;

-- Annulation d'un envoi pas encore réceptionné : le lieu d'origine récupère exactement ce qui était parti
CREATE OR REPLACE FUNCTION public.annuler_envoi(p_envoi_id bigint, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_envoi record;
  v_ligne record;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent annuler un envoi' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de l''annulation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_envoi FROM envois WHERE id = p_envoi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envoi introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_envoi.statut = 'recu' THEN
    RAISE EXCEPTION 'Cet envoi a déjà été réceptionné : il ne peut plus être annulé' USING ERRCODE = '55000';
  END IF;
  IF v_envoi.statut = 'annule' THEN
    RAISE EXCEPTION 'Cet envoi a déjà été annulé' USING ERRCODE = '55000';
  END IF;

  FOR v_ligne IN SELECT * FROM envoi_lignes WHERE envoi_id = p_envoi_id ORDER BY produit_id LOOP
    IF v_envoi.origine = 'principal' THEN
      PERFORM 1 FROM produits WHERE id = v_ligne.produit_id FOR UPDATE;
      UPDATE produits SET quantite_restante = quantite_restante + v_ligne.quantite_envoyee, updated_at = now()
       WHERE id = v_ligne.produit_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produit % introuvable dans le stock principal', v_ligne.produit_id USING ERRCODE = 'P0002';
      END IF;
    ELSE
      INSERT INTO stock_atelier (produit_id, quantite_disponible, transfere_par)
      VALUES (v_ligne.produit_id, v_ligne.quantite_envoyee, v_uid)
      ON CONFLICT (produit_id) DO UPDATE
        SET quantite_disponible = stock_atelier.quantite_disponible + EXCLUDED.quantite_disponible, updated_at = now();
    END IF;
    PERFORM journal_ecrire('transit', v_ligne.produit_id, v_ligne.produit_nom, -v_ligne.quantite_envoyee, 'annulation_envoi', p_envoi_id, trim(p_motif));
    PERFORM journal_ecrire(v_envoi.origine, v_ligne.produit_id, v_ligne.produit_nom, v_ligne.quantite_envoyee, 'annulation_envoi', p_envoi_id, trim(p_motif));
  END LOOP;

  UPDATE envois SET statut = 'annule', annule_par = v_uid, annule_le = now(), motif_annulation = trim(p_motif)
   WHERE id = p_envoi_id;

  IF v_envoi.demande_groupee_id IS NOT NULL THEN
    UPDATE demandes SET statut = 'annulee', updated_at = now()
     WHERE demande_groupee_id = v_envoi.demande_groupee_id AND statut = 'validee';
    UPDATE demandes_groupees
       SET statut = 'annulee',
           details_validation = coalesce(details_validation, '{}'::jsonb)
             || jsonb_build_object('annulation', jsonb_build_object('par', v_uid, 'date', now(), 'raison', trim(p_motif)))
     WHERE id = v_envoi.demande_groupee_id;
  END IF;

  RETURN jsonb_build_object('envoi_id', p_envoi_id, 'statut', 'annule');
END;
$function$;

-- Réception comptée par la destination.
-- p_lignes : [{"produit_id": .., "quantite_recue": .., "motif": ".."}], une entrée par produit de l'envoi.
-- Premier appel (p_confirmer = false) : si les quantités comptées diffèrent de l'envoi, rien n'est écrit et les
-- écarts sont renvoyés, pour recompter ou motiver. Second appel (p_confirmer = true) : enregistrement, un motif
-- étant obligatoire pour chaque écart.
CREATE OR REPLACE FUNCTION public.receptionner_envoi(p_envoi_id bigint, p_lignes jsonb, p_confirmer boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := public.role_courant();
  v_envoi record;
  v_ligne record;
  v_saisie jsonb;
  v_recue numeric;
  v_motif text;
  v_ecarts jsonb := '[]'::jsonb;
  v_stock_id integer;
  v_source text;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Compte inactif ou non connecté' USING ERRCODE = '42501';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'Quantités reçues manquantes' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_envoi FROM envois WHERE id = p_envoi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envoi introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_envoi.statut = 'recu' THEN
    RAISE EXCEPTION 'Cet envoi a déjà été réceptionné' USING ERRCODE = '55000';
  END IF;
  IF v_envoi.statut = 'annule' THEN
    RAISE EXCEPTION 'Cet envoi a été annulé' USING ERRCODE = '55000';
  END IF;
  IF NOT (v_role = 'admin'
          OR (v_envoi.destination = 'boutique' AND v_role = 'employe_boutique')
          OR (v_envoi.destination = 'atelier' AND v_role = 'employe_production')) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas réceptionner un envoi destiné à : %', v_envoi.destination USING ERRCODE = '42501';
  END IF;
  IF v_envoi.auto_validation AND v_uid = v_envoi.valideur_id THEN
    RAISE EXCEPTION 'Cet envoi a été validé ou envoyé par la personne qui l''a demandé : la réception doit être faite par une autre personne'
      USING ERRCODE = '42501';
  END IF;

  -- Contrôle de la saisie : chaque produit de l'envoi, et seulement eux, avec une quantité >= 0
  IF (SELECT count(DISTINCT e->>'produit_id') FROM jsonb_array_elements(p_lignes) e) <> jsonb_array_length(p_lignes)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_lignes) e
                 WHERE NOT EXISTS (SELECT 1 FROM envoi_lignes el WHERE el.envoi_id = p_envoi_id AND el.produit_id::text = e->>'produit_id'))
     OR EXISTS (SELECT 1 FROM envoi_lignes el WHERE el.envoi_id = p_envoi_id
                 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_lignes) e WHERE e->>'produit_id' = el.produit_id::text)) THEN
    RAISE EXCEPTION 'La réception doit indiquer une quantité pour chaque produit de l''envoi' USING ERRCODE = '22023';
  END IF;

  FOR v_ligne IN SELECT * FROM envoi_lignes WHERE envoi_id = p_envoi_id ORDER BY produit_id LOOP
    SELECT e INTO v_saisie FROM jsonb_array_elements(p_lignes) e WHERE e->>'produit_id' = v_ligne.produit_id::text;
    BEGIN
      v_recue := (v_saisie->>'quantite_recue')::numeric;
    EXCEPTION WHEN others THEN
      v_recue := NULL;
    END;
    IF v_recue IS NULL OR v_recue < 0 THEN
      RAISE EXCEPTION 'Quantité reçue invalide pour « % »', v_ligne.produit_nom USING ERRCODE = '22023';
    END IF;
    IF v_recue <> v_ligne.quantite_envoyee THEN
      v_ecarts := v_ecarts || jsonb_build_object('produit_id', v_ligne.produit_id, 'produit_nom', v_ligne.produit_nom,
        'unite', v_ligne.unite, 'quantite_envoyee', v_ligne.quantite_envoyee, 'quantite_comptee', v_recue,
        'motif', nullif(trim(v_saisie->>'motif'), ''));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_ecarts) > 0 AND NOT coalesce(p_confirmer, false) THEN
    RETURN jsonb_build_object('statut', 'ecarts', 'ecarts', v_ecarts);
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_ecarts) x WHERE length(coalesce(x->>'motif', '')) < 3) THEN
    RAISE EXCEPTION 'Indiquez un motif pour chaque écart' USING ERRCODE = '22023';
  END IF;

  v_source := CASE WHEN v_envoi.origine = 'principal' THEN 'Stock Principal' ELSE 'Atelier' END;
  FOR v_ligne IN SELECT * FROM envoi_lignes WHERE envoi_id = p_envoi_id ORDER BY produit_id LOOP
    SELECT e INTO v_saisie FROM jsonb_array_elements(p_lignes) e WHERE e->>'produit_id' = v_ligne.produit_id::text;
    v_recue := (v_saisie->>'quantite_recue')::numeric;
    v_motif := CASE WHEN v_recue <> v_ligne.quantite_envoyee THEN trim(v_saisie->>'motif') END;

    UPDATE envoi_lignes SET quantite_recue = v_recue, motif_ecart = v_motif WHERE id = v_ligne.id;

    IF v_recue > 0 THEN
      IF v_envoi.destination = 'boutique' THEN
        SELECT id INTO v_stock_id FROM stock_boutique WHERE produit_id = v_ligne.produit_id ORDER BY id LIMIT 1 FOR UPDATE;
        IF FOUND THEN
          UPDATE stock_boutique SET quantite_disponible = coalesce(quantite_disponible, 0) + v_recue, updated_at = now()
           WHERE id = v_stock_id;
        ELSE
          INSERT INTO stock_boutique (produit_id, nom_produit, quantite_disponible, quantite_vendue, quantite_utilisee,
                                      prix_vente, type_produit, transfere_par)
          VALUES (v_ligne.produit_id, v_ligne.produit_nom, v_recue, 0, 0,
                  (SELECT prix FROM prix_vente_produits WHERE produit_id = v_ligne.produit_id AND actif ORDER BY created_at DESC LIMIT 1),
                  'vendable', v_uid);
        END IF;
        INSERT INTO entrees_boutique (produit_id, quantite, source, source_id, type_entree, ajoute_par)
        VALUES (v_ligne.produit_id, v_recue, v_source, p_envoi_id, 'Reception', v_uid);
      ELSE
        INSERT INTO stock_atelier (produit_id, quantite_disponible, transfere_par)
        VALUES (v_ligne.produit_id, v_recue, v_uid)
        ON CONFLICT (produit_id) DO UPDATE
          SET quantite_disponible = stock_atelier.quantite_disponible + EXCLUDED.quantite_disponible,
              transfere_par = EXCLUDED.transfere_par, updated_at = now();
      END IF;
    END IF;

    PERFORM journal_ecrire('transit', v_ligne.produit_id, v_ligne.produit_nom, -v_ligne.quantite_envoyee, 'reception', p_envoi_id, NULL);
    IF v_recue > 0 THEN
      PERFORM journal_ecrire(v_envoi.destination, v_ligne.produit_id, v_ligne.produit_nom, v_recue, 'reception', p_envoi_id, NULL);
    END IF;
    IF v_recue <> v_ligne.quantite_envoyee THEN
      PERFORM journal_ecrire('ecart', v_ligne.produit_id, v_ligne.produit_nom, v_ligne.quantite_envoyee - v_recue, 'ecart_reception', p_envoi_id, v_motif);
    END IF;
  END LOOP;

  UPDATE envois SET statut = 'recu', receptionnaire_id = v_uid, recu_le = now(), avec_ecart = jsonb_array_length(v_ecarts) > 0
   WHERE id = p_envoi_id;

  IF jsonb_array_length(v_ecarts) > 0 THEN
    PERFORM notify_all_admins('alerte_generale',
      'Écart à la réception de l''envoi #' || p_envoi_id,
      (SELECT string_agg(x->>'produit_nom' || ' : envoyé ' || (x->>'quantite_envoyee') || ', reçu ' || (x->>'quantite_comptee')
                         || ' (' || (x->>'motif') || ')', ' ; ') FROM jsonb_array_elements(v_ecarts) x),
      '/receptions#' || p_envoi_id);
  END IF;

  RETURN jsonb_build_object('statut', 'recu', 'envoi_id', p_envoi_id, 'avec_ecart', jsonb_array_length(v_ecarts) > 0, 'ecarts', v_ecarts);
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. Verrous sur les écritures directes depuis l'application (rôle authenticated)
--    Dans les fonctions ci-dessus (SECURITY DEFINER), current_user est le propriétaire : non concerné.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_demandes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'demandes' THEN
      IF NOT EXISTS (SELECT 1 FROM demandes_groupees g WHERE g.id = NEW.demande_groupee_id
                       AND g.demandeur_id = auth.uid() AND g.statut = 'en_attente') THEN
        RAISE EXCEPTION 'Une ligne de demande doit appartenir à une de vos demandes en attente' USING ERRCODE = '42501';
      END IF;
      NEW.demandeur_id := auth.uid();
    END IF;
    NEW.statut := 'en_attente';
    NEW.valideur_id := NULL;
    NEW.date_validation := NULL;
    IF TG_TABLE_NAME = 'demandes_groupees' THEN
      NEW.details_validation := NULL;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Une demande ne peut être modifiée ou supprimée que par les fonctions de validation' USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER proteger_demandes BEFORE INSERT OR UPDATE OR DELETE ON public.demandes
  FOR EACH ROW EXECUTE FUNCTION public.proteger_demandes();
CREATE TRIGGER proteger_demandes BEFORE INSERT OR UPDATE OR DELETE ON public.demandes_groupees
  FOR EACH ROW EXECUTE FUNCTION public.proteger_demandes();

-- Quantité disponible boutique et atelier : plus aucune modification directe par un caissier.
-- (Les admins et la production gardent provisoirement l'accès direct pour les écrans non encore convertis :
-- partie 2.) Les ventes ne touchent que quantite_vendue et restent possibles.
CREATE OR REPLACE FUNCTION public.proteger_quantites_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_user <> 'authenticated' OR public.role_courant() IN ('admin', 'employe_production') THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.quantite_disponible IS NOT DISTINCT FROM OLD.quantite_disponible THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La quantité disponible (%) ne change que par une réception ou une fonction de stock', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER proteger_quantites_stock BEFORE INSERT OR UPDATE OR DELETE ON public.stock_boutique
  FOR EACH ROW EXECUTE FUNCTION public.proteger_quantites_stock();
CREATE TRIGGER proteger_quantites_stock BEFORE INSERT OR UPDATE OR DELETE ON public.stock_atelier
  FOR EACH ROW EXECUTE FUNCTION public.proteger_quantites_stock();

-- ---------------------------------------------------------------------
-- 5. Auteur des mouvements du stock principal (déclencheur existant) : auth.uid() au lieu de vide
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_mouvement_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_type_mouvement varchar;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.quantite_restante IS DISTINCT FROM OLD.quantite_restante THEN
    v_type_mouvement := CASE WHEN NEW.quantite_restante < OLD.quantite_restante THEN 'sortie' ELSE 'entree' END;
    INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite, quantite_avant, quantite_apres, utilisateur_id, created_at)
    VALUES (NEW.id, v_type_mouvement, abs(NEW.quantite_restante - OLD.quantite_restante),
            OLD.quantite_restante, NEW.quantite_restante, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.role_courant(), public.journal_stock_contenu(public.journal_stock),
  public.journal_stock_avant_insertion(), public.interdire_modification(),
  public.journal_ecrire(text, integer, text, numeric, text, bigint, text), public.verifier_journal_stock(),
  public.valider_demande_groupee(bigint, jsonb), public.refuser_demande(bigint, text),
  public.envoyer_atelier_vers_boutique(jsonb, uuid), public.annuler_envoi(bigint, text),
  public.receptionner_envoi(bigint, jsonb, boolean), public.proteger_demandes(), public.proteger_quantites_stock()
  FROM PUBLIC, anon;
-- Fonctions internes et de déclencheur : aucun appel direct (un déclencheur s'exécute sans ce droit)
REVOKE ALL ON FUNCTION public.journal_ecrire(text, integer, text, numeric, text, bigint, text),
  public.journal_stock_contenu(public.journal_stock), public.journal_stock_avant_insertion(),
  public.interdire_modification(), public.proteger_demandes(), public.proteger_quantites_stock()
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.role_courant(), public.verifier_journal_stock(),
  public.valider_demande_groupee(bigint, jsonb), public.refuser_demande(bigint, text),
  public.envoyer_atelier_vers_boutique(jsonb, uuid), public.annuler_envoi(bigint, text),
  public.receptionner_envoi(bigint, jsonb, boolean)
  TO authenticated, service_role;

-- Ancienne validation : elle commençait par decrement_stock puis changeait les statuts, désormais refusés.
-- Un écran resté ouvert avec l'ancien code échoue donc dès la première étape, sans rien modifier.
REVOKE EXECUTE ON FUNCTION public.decrement_stock(integer, numeric) FROM authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
