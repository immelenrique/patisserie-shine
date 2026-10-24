-- =====================================================================
-- Partie 9 : production de l'atelier par recette, rendement surveillé, recettes protégées
-- =====================================================================
-- Prérequis : parties 1 à 8 appliquées.
--
-- Avant :
--  - une production n'enlevait aucune matière du stock atelier : un vol de farine ou de beurre restait invisible ;
--  - une production « Boutique » ajoutait directement le stock boutique, sans envoi ni comptage à l'arrivée ;
--  - n'importe quel compte connecté pouvait modifier une recette (donc les quantités à retirer).
-- Maintenant (décisions de la propriétaire) :
--  - chaque recette indique ce qu'elle donne environ (rendement N par fournée) et une marge acceptée
--    (ex. N-3 à N+2) : la boulangerie n'est pas une science exacte ;
--  - declarer_production(recette, fournées, quantité obtenue) retire du stock atelier les matières de la recette
--    (fournées × quantités) ; s'il en manque au stock enregistré, la production est acceptée : on retire ce qui
--    est enregistré (jamais en dessous de zéro) et le manque est simplement noté ;
--  - le produit fini entre au stock atelier ; « produire et envoyer » crée aussitôt l'envoi vers la boutique,
--    que la boutique compte à l'arrivée sans voir la quantité (partie 1) ;
--  - une quantité obtenue hors de la marge (fournées × [N - marge, N + marge]) prévient le propriétaire et les gérants ;
--  - les recettes ne se modifient que par le propriétaire et les gérants, et chaque changement est gardé.
-- Aucune suppression : peut être exécuté directement. Retour arrière : partie9_annulation.sql (SQL Editor).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Fiches de recette (rendement et marge) et historique des recettes
-- ---------------------------------------------------------------------
CREATE TABLE public.recettes_fiches (
  nom_produit varchar PRIMARY KEY,
  rendement numeric NOT NULL CHECK (rendement > 0),        -- produits obtenus par fournée
  marge_moins numeric NOT NULL DEFAULT 0 CHECK (marge_moins >= 0),
  marge_plus numeric NOT NULL DEFAULT 0 CHECK (marge_plus >= 0),
  produit_fini text NOT NULL CHECK (length(trim(produit_fini)) >= 2),   -- nom du produit vendu (ex. « Cake nature »)
  modifie_par uuid REFERENCES public.profiles (id),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CHECK (marge_moins < rendement)
);

CREATE TABLE public.journal_recettes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom_produit varchar NOT NULL,
  action text NOT NULL CHECK (action IN ('enregistrement', 'suppression')),
  avant jsonb,
  apres jsonb,
  motif text,
  par uuid REFERENCES public.profiles (id),
  le timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER journal_recettes_inalterable BEFORE UPDATE OR DELETE ON public.journal_recettes
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER recettes_fiches_sans_suppression BEFORE DELETE ON public.recettes_fiches
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();

ALTER TABLE public.recettes_fiches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_recettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fiches lisibles par les comptes actifs" ON public.recettes_fiches FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) IS NOT NULL);
CREATE POLICY "Historique des recettes lisible par les gérants" ON public.journal_recettes FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin');
REVOKE ALL ON public.recettes_fiches, public.journal_recettes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.recettes_fiches, public.journal_recettes FROM authenticated;

-- Les recettes ne s'écrivent plus en direct (n'importe quel compte connecté pouvait les changer)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.recettes FROM authenticated;

-- ---------------------------------------------------------------------
-- 2. Productions : ce qui a été consommé et obtenu
-- ---------------------------------------------------------------------
ALTER TABLE public.productions
  ADD COLUMN recette varchar,
  ADD COLUMN produit_id integer,
  ADD COLUMN fournees numeric,
  ADD COLUMN quantite_attendue numeric,
  ADD COLUMN quantite_min numeric,
  ADD COLUMN quantite_max numeric,
  ADD COLUMN hors_marge boolean,
  ADD COLUMN matieres jsonb,
  ADD COLUMN envoi_id bigint REFERENCES public.envois (id),
  ADD COLUMN cle uuid UNIQUE;
-- Une production ne s'écrit plus en direct (l'ancienne voie ajoutait le stock boutique sans comptage)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.productions FROM authenticated;
CREATE TRIGGER productions_sans_suppression BEFORE DELETE ON public.productions
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();

-- ---------------------------------------------------------------------
-- 3. Recettes : enregistrement, réglage, suppression (propriétaire et gérants)
-- ---------------------------------------------------------------------
-- État complet d'une recette (lignes et fiche), pour l'historique
CREATE OR REPLACE FUNCTION public.recette_etat(p_nom text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'lignes', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit_id', r.produit_ingredient_id, 'produit', p.nom,
                 'quantite', r.quantite_necessaire) ORDER BY p.nom), '[]'::jsonb)
                 FROM recettes r LEFT JOIN produits p ON p.id = r.produit_ingredient_id WHERE r.nom_produit = p_nom),
    'fiche', (SELECT jsonb_build_object('rendement', f.rendement, 'marge_moins', f.marge_moins, 'marge_plus', f.marge_plus,
                 'produit_fini', f.produit_fini) FROM recettes_fiches f WHERE f.nom_produit = p_nom))
$function$;

-- Enregistre une recette : ses ingrédients [{"produit_id": 1, "quantite": 2.5}, …] (par fournée), son rendement,
-- sa marge et le nom du produit fini. Les ingrédients remplacent les anciens ; l'ancienne version est gardée.
CREATE OR REPLACE FUNCTION public.recette_enregistrer(p_nom text, p_lignes jsonb, p_rendement numeric,
  p_marge_moins numeric, p_marge_plus numeric, p_produit_fini text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nom text := trim(coalesce(p_nom, ''));
  v_avant jsonb;
  v_x jsonb;
  v_q numeric;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants modifient les recettes' USING ERRCODE = '42501';
  END IF;
  IF length(v_nom) < 2 THEN
    RAISE EXCEPTION 'Nom de recette obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Une recette a au moins un ingrédient' USING ERRCODE = '22023';
  END IF;
  IF p_rendement IS NULL OR p_rendement <= 0 OR coalesce(p_marge_moins, 0) < 0 OR coalesce(p_marge_plus, 0) < 0
     OR coalesce(p_marge_moins, 0) >= p_rendement THEN
    RAISE EXCEPTION 'Rendement ou marge invalide' USING ERRCODE = '22023';
  END IF;
  IF p_produit_fini IS NULL OR length(trim(p_produit_fini)) < 2 THEN
    RAISE EXCEPTION 'Indiquez le nom du produit fini' USING ERRCODE = '22023';
  END IF;
  -- Un seul enregistrement à la fois pour une même recette
  PERFORM pg_advisory_xact_lock(hashtextextended('recette:' || v_nom, 0));
  v_avant := public.recette_etat(v_nom);

  DELETE FROM recettes WHERE nom_produit = v_nom;
  FOR v_x IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    BEGIN
      v_q := (v_x ->> 'quantite')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Quantité d''ingrédient invalide' USING ERRCODE = '22023';
    END;
    IF v_q IS NULL OR v_q <= 0 THEN
      RAISE EXCEPTION 'Quantité d''ingrédient invalide' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produits WHERE id = (v_x ->> 'produit_id')::integer) THEN
      RAISE EXCEPTION 'Ingrédient % introuvable', v_x ->> 'produit_id' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO recettes (nom_produit, produit_ingredient_id, quantite_necessaire, created_by)
    VALUES (v_nom, (v_x ->> 'produit_id')::integer, v_q, auth.uid());
  END LOOP;

  INSERT INTO recettes_fiches (nom_produit, rendement, marge_moins, marge_plus, produit_fini, modifie_par, modifie_le)
  VALUES (v_nom, p_rendement, coalesce(p_marge_moins, 0), coalesce(p_marge_plus, 0), trim(p_produit_fini), auth.uid(), now())
  ON CONFLICT (nom_produit) DO UPDATE
    SET rendement = EXCLUDED.rendement, marge_moins = EXCLUDED.marge_moins, marge_plus = EXCLUDED.marge_plus,
        produit_fini = EXCLUDED.produit_fini, modifie_par = EXCLUDED.modifie_par, modifie_le = now();

  INSERT INTO journal_recettes (nom_produit, action, avant, apres, par)
  VALUES (v_nom, 'enregistrement', CASE WHEN jsonb_array_length(v_avant -> 'lignes') = 0 AND v_avant -> 'fiche' = 'null'::jsonb THEN NULL ELSE v_avant END,
          public.recette_etat(v_nom), auth.uid());
  RETURN public.recette_etat(v_nom);
END;
$function$;

-- Supprime une recette (ses ingrédients), avec un motif ; la fiche et l'historique restent
CREATE OR REPLACE FUNCTION public.recette_supprimer(p_nom text, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_avant jsonb;
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants modifient les recettes' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de la suppression' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('recette:' || trim(p_nom), 0));
  v_avant := public.recette_etat(trim(p_nom));
  IF jsonb_array_length(v_avant -> 'lignes') = 0 THEN
    RAISE EXCEPTION 'Recette introuvable' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM recettes WHERE nom_produit = trim(p_nom);
  INSERT INTO journal_recettes (nom_produit, action, avant, motif, par)
  VALUES (trim(p_nom), 'suppression', v_avant, trim(p_motif), auth.uid());
  RETURN jsonb_build_object('nom_produit', trim(p_nom), 'supprimee', true);
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. Déclarer une production
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.declarer_production(p_recette text, p_fournees numeric, p_quantite numeric,
  p_envoyer boolean DEFAULT false, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_f record;
  v_l record;
  v_id integer;
  v_pf integer;
  v_unite integer;
  v_dispo numeric;
  v_besoin numeric;
  v_retire numeric;
  v_matieres jsonb := '[]'::jsonb;
  v_cout numeric := 0;
  v_min numeric;
  v_max numeric;
  v_hors boolean;
  v_envoi jsonb;
  v_prix numeric;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('admin', 'employe_production') THEN
    RAISE EXCEPTION 'Seuls la production et les gérants déclarent une production' USING ERRCODE = '42501';
  END IF;
  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    SELECT id INTO v_id FROM productions WHERE cle = p_cle;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('production_id', v_id, 'deja_enregistre', true);
    END IF;
  END IF;
  IF p_fournees IS NULL OR p_fournees <= 0 OR p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Nombre de fournées et quantité obtenue doivent être positifs' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_f FROM recettes_fiches WHERE nom_produit = trim(p_recette);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recette « % » sans rendement : à compléter dans Recettes (propriétaire ou gérant)', p_recette USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM recettes WHERE nom_produit = v_f.nom_produit) THEN
    RAISE EXCEPTION 'Recette « % » sans ingrédients', p_recette USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO productions (produit, quantite, destination, date_production, statut, producteur_id, recette, fournees, cle)
  VALUES (v_f.produit_fini, p_quantite, 'Atelier', (now() AT TIME ZONE 'Africa/Ouagadougou')::date, 'termine', v_uid,
          v_f.nom_produit, p_fournees, p_cle)
  RETURNING id INTO v_id;

  -- Matières : fournées × quantités de la recette, retirées du stock atelier enregistré (jamais en dessous de zéro)
  FOR v_l IN SELECT r.produit_ingredient_id AS produit_id, p.nom, u.label AS unite, r.quantite_necessaire, p.prix_achat
               FROM recettes r JOIN produits p ON p.id = r.produit_ingredient_id LEFT JOIN unites u ON u.id = p.unite_id
              WHERE r.nom_produit = v_f.nom_produit ORDER BY r.produit_ingredient_id LOOP
    v_besoin := v_l.quantite_necessaire * p_fournees;
    SELECT quantite_disponible INTO v_dispo FROM stock_atelier WHERE produit_id = v_l.produit_id FOR UPDATE;
    v_retire := least(v_besoin, greatest(coalesce(v_dispo, 0), 0));
    IF v_retire > 0 THEN
      UPDATE stock_atelier SET quantite_disponible = quantite_disponible - v_retire, updated_at = now(), derniere_maj = now()
       WHERE produit_id = v_l.produit_id;
      PERFORM journal_ecrire_cle('atelier', v_l.produit_id, v_l.nom, -v_retire, 'production',
        'Production n°' || v_id || ' : ' || v_f.nom_produit || ' (' || p_fournees || ' fournée(s))', NULL);
    END IF;
    v_cout := v_cout + v_retire * coalesce(v_l.prix_achat, 0);
    v_matieres := v_matieres || jsonb_build_object('produit_id', v_l.produit_id, 'produit', v_l.nom, 'unite', v_l.unite,
      'besoin', v_besoin, 'retire', v_retire, 'manque', v_besoin - v_retire);
  END LOOP;

  -- Produit fini : trouvé par son nom, sinon créé ; il entre au stock atelier
  SELECT id INTO v_pf FROM produits WHERE lower(trim(nom)) = lower(v_f.produit_fini) ORDER BY id LIMIT 1;
  IF v_pf IS NULL THEN
    SELECT id INTO v_unite FROM unites WHERE label ILIKE 'pi%ce%' ORDER BY id LIMIT 1;
    INSERT INTO produits (nom, date_achat, prix_achat, quantite, quantite_restante, unite_id, created_by)
    -- Quantité d'origine = première production (contrainte du produit) ; rien au stock principal
    VALUES (v_f.produit_fini, current_date, round(v_cout / p_quantite, 2), p_quantite, 0, coalesce(v_unite, 1), v_uid)
    RETURNING id INTO v_pf;
  END IF;
  -- Prix de vente en boutique : celui de la recette, si le produit fini n'en a pas encore
  IF NOT EXISTS (SELECT 1 FROM prix_vente_produits WHERE produit_id = v_pf AND actif) THEN
    SELECT prix_vente INTO v_prix FROM prix_vente_recettes WHERE nom_produit = v_f.nom_produit AND actif ORDER BY created_at DESC LIMIT 1;
    IF v_prix > 0 THEN
      INSERT INTO prix_vente_produits (produit_id, prix, actif) VALUES (v_pf, v_prix, true);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM stock_atelier WHERE produit_id = v_pf) THEN
    UPDATE stock_atelier SET quantite_disponible = quantite_disponible + p_quantite, updated_at = now(), derniere_maj = now()
     WHERE produit_id = v_pf;
  ELSE
    INSERT INTO stock_atelier (produit_id, quantite_disponible, transfere_par) VALUES (v_pf, p_quantite, v_uid);
  END IF;
  PERFORM journal_ecrire_cle('atelier', v_pf, v_f.produit_fini, p_quantite, 'production',
    'Production n°' || v_id || ' : ' || v_f.nom_produit || ' (' || p_fournees || ' fournée(s))', NULL);

  -- Rendement : la quantité obtenue doit rester dans la marge acceptée
  v_min := p_fournees * (v_f.rendement - v_f.marge_moins);
  v_max := p_fournees * (v_f.rendement + v_f.marge_plus);
  v_hors := p_quantite < v_min OR p_quantite > v_max;
  UPDATE productions
     SET produit_id = v_pf, cout_ingredients = round(v_cout), matieres = v_matieres,
         quantite_attendue = p_fournees * v_f.rendement, quantite_min = v_min, quantite_max = v_max, hors_marge = v_hors
   WHERE id = v_id;
  IF v_hors THEN
    PERFORM notify_all_admins('alerte_generale',
      'Rendement hors marge : ' || v_f.produit_fini || ' ' || p_quantite || ' obtenus pour ' || v_min || ' à ' || v_max || ' attendus',
      'Production n°' || v_id || ' (' || v_f.nom_produit || ', ' || p_fournees || ' fournée(s)) déclarée par ' || coalesce(recap_nom(v_uid), '?'),
      '/production');
  END IF;

  IF coalesce(p_envoyer, false) THEN
    v_envoi := public.envoyer_atelier_vers_boutique(jsonb_build_array(jsonb_build_object('produit_id', v_pf, 'quantite', p_quantite)), NULL);
    -- La destination reste « Atelier » : l'ancien déclencheur ajoutait le stock boutique à toute production « Boutique »
    UPDATE productions SET envoi_id = (v_envoi ->> 'envoi_id')::bigint WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('production_id', v_id, 'deja_enregistre', false, 'produit_id', v_pf, 'produit', v_f.produit_fini,
    'quantite', p_quantite, 'attendu', p_fournees * v_f.rendement, 'min', v_min, 'max', v_max, 'hors_marge', v_hors,
    'cout', round(v_cout), 'matieres', v_matieres, 'envoi_id', (v_envoi ->> 'envoi_id')::bigint);
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. Récapitulatif (propriétaire) : productions, rendements, recettes modifiées
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recap_productions(p_du date, p_au date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_debut timestamptz := p_du::timestamp AT TIME ZONE 'Africa/Ouagadougou';
  v_fin timestamptz := (p_au + 1)::timestamp AT TIME ZONE 'Africa/Ouagadougou';
BEGIN
  IF NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé au propriétaire' USING ERRCODE = '42501';
  END IF;
  IF p_du IS NULL OR p_au IS NULL OR p_au < p_du OR p_au - p_du > 92 THEN
    RAISE EXCEPTION 'Période invalide' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'productions', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'le', p.created_at, 'recette', p.recette,
        'produit', p.produit, 'fournees', p.fournees, 'quantite', p.quantite, 'attendu', p.quantite_attendue, 'min', p.quantite_min,
        'max', p.quantite_max, 'hors_marge', p.hors_marge, 'cout', p.cout_ingredients, 'par', recap_nom(p.producteur_id),
        'envoi_id', p.envoi_id, 'destination', p.destination,
        'manques', (SELECT coalesce(jsonb_agg(m) FILTER (WHERE (m->>'manque')::numeric > 0), '[]'::jsonb) FROM jsonb_array_elements(coalesce(p.matieres, '[]'::jsonb)) m))
        ORDER BY p.created_at), '[]'::jsonb)
      FROM productions p WHERE p.created_at >= v_debut AND p.created_at < v_fin),
    'recettes_modifiees', (SELECT coalesce(jsonb_agg(jsonb_build_object('le', j.le, 'recette', j.nom_produit, 'action', j.action,
        'par', recap_nom(j.par), 'avant', j.avant, 'apres', j.apres, 'motif', j.motif) ORDER BY j.le), '[]'::jsonb)
      FROM journal_recettes j WHERE j.le >= v_debut AND j.le < v_fin),
    'recettes_sans_rendement', (SELECT coalesce(jsonb_agg(DISTINCT r.nom_produit), '[]'::jsonb)
      FROM recettes r WHERE NOT EXISTS (SELECT 1 FROM recettes_fiches f WHERE f.nom_produit = r.nom_produit)));
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.recette_etat(text), public.recette_enregistrer(text, jsonb, numeric, numeric, numeric, text),
  public.recette_supprimer(text, text), public.declarer_production(text, numeric, numeric, boolean, uuid),
  public.recap_productions(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recette_etat(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recette_enregistrer(text, jsonb, numeric, numeric, numeric, text),
  public.recette_supprimer(text, text), public.declarer_production(text, numeric, numeric, boolean, uuid),
  public.recap_productions(date, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
