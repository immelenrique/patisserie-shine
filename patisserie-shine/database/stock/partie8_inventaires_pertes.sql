-- =====================================================================
-- Partie 8 : inventaires à l'aveugle et pertes validées par la propriétaire
-- =====================================================================
-- Prérequis : parties 1 à 7 appliquées.
--
-- Inventaires (stock principal, atelier, boutique) :
--  - la personne compte sans voir la quantité attendue ; la base la note au moment du comptage ;
--  - « tirage » : la base tire au hasard N produits à compter (personne ne sait lesquels à l'avance) ;
--    « complet » : tous les produits du lieu qui ont du stock ;
--  - à la fin, les produits qui ne correspondent pas sont désignés (sans les quantités) et recomptés ;
--    si l'écart demeure, un motif est obligatoire ; le stock est alors mis au compté, l'écart est inscrit
--    au journal (« inventaire ») et le propriétaire et les gérants sont prévenus avec sa valeur ;
--  - rythme réglé par le propriétaire : au départ, atelier chaque soir (tirage de 10 produits),
--    stock principal et boutique une fois par semaine (complet, le lundi) ;
--  - qui compte : le magasinier (stock principal), la production (atelier), la boutique (boutique),
--    le propriétaire et les gérants (partout).
-- Pertes (casse, périmé, raté) :
--  - déclarées par la personne du lieu, avec quantité et motif ; elles attendent la décision du
--    propriétaire : acceptée, le stock baisse et la perte est inscrite au journal (« perte ») ;
--    refusée, avec un motif ; la personne est prévenue dans les deux cas.
--
-- Contient un DROP CONSTRAINT (types de mouvement du journal) : à exécuter dans le SQL Editor.
-- Retour arrière : partie8_annulation.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Deux nouveaux types de mouvement au journal
-- ---------------------------------------------------------------------
ALTER TABLE public.journal_stock DROP CONSTRAINT journal_stock_nature_check;
ALTER TABLE public.journal_stock ADD CONSTRAINT journal_stock_nature_check
  CHECK (nature IN ('envoi', 'annulation_envoi', 'reception', 'ecart_reception', 'achat', 'ajustement', 'utilisation',
                    'vente', 'annulation_vente', 'production', 'inventaire', 'perte'));

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
CREATE TABLE public.inventaires_reglages (
  lieu text PRIMARY KEY CHECK (lieu IN ('principal', 'atelier', 'boutique')),
  mode text NOT NULL CHECK (mode IN ('tirage', 'complet')),
  nombre integer NOT NULL DEFAULT 10 CHECK (nombre BETWEEN 1 AND 200),
  frequence text NOT NULL CHECK (frequence IN ('aucune', 'quotidienne', 'hebdomadaire')),
  jour smallint NOT NULL DEFAULT 1 CHECK (jour BETWEEN 1 AND 7),   -- 1 = lundi … 7 = dimanche
  modifie_par uuid REFERENCES public.profiles (id),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.inventaires_reglages (lieu, mode, nombre, frequence, jour) VALUES
  ('atelier', 'tirage', 10, 'quotidienne', 1),
  ('principal', 'complet', 10, 'hebdomadaire', 1),
  ('boutique', 'complet', 10, 'hebdomadaire', 1);

CREATE TABLE public.inventaires (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lieu text NOT NULL CHECK (lieu IN ('principal', 'atelier', 'boutique')),
  mode text NOT NULL CHECK (mode IN ('tirage', 'complet')),
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'annule')),
  ouvert_par uuid NOT NULL REFERENCES public.profiles (id),
  ouvert_le timestamptz NOT NULL DEFAULT now(),
  cloture_par uuid REFERENCES public.profiles (id),
  cloture_le timestamptz,
  nb_produits integer NOT NULL DEFAULT 0,
  nb_ecarts integer,
  valeur_ecarts numeric,
  annule_par uuid REFERENCES public.profiles (id),
  motif_annulation text
);
-- Un seul inventaire en cours par lieu (aussi en cas de double appui simultané)
CREATE UNIQUE INDEX inventaires_un_en_cours ON public.inventaires (lieu) WHERE statut = 'en_cours';

CREATE TABLE public.inventaire_lignes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inventaire_id bigint NOT NULL REFERENCES public.inventaires (id),
  produit_id integer NOT NULL,
  produit_nom text NOT NULL,
  unite text,
  quantite_comptee numeric CHECK (quantite_comptee >= 0),
  quantite_theorique numeric,      -- notée par la base au moment du comptage, jamais montrée avant la fin
  comptages jsonb NOT NULL DEFAULT '[]'::jsonb,
  compte_par uuid REFERENCES public.profiles (id),
  compte_le timestamptz,
  ecart numeric,
  prix_unitaire numeric,
  motif text,
  UNIQUE (inventaire_id, produit_id)
);

CREATE TABLE public.pertes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lieu text NOT NULL CHECK (lieu IN ('principal', 'atelier', 'boutique')),
  produit_id integer NOT NULL,
  produit_nom text NOT NULL,
  unite text,
  quantite numeric NOT NULL CHECK (quantite > 0),
  motif text NOT NULL CHECK (length(trim(motif)) >= 3),
  prix_unitaire numeric,
  declare_par uuid NOT NULL REFERENCES public.profiles (id),
  declare_le timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  decide_par uuid REFERENCES public.profiles (id),
  decide_le timestamptz,
  motif_refus text,
  cle uuid UNIQUE
);
CREATE INDEX pertes_en_attente_idx ON public.pertes (statut) WHERE statut = 'en_attente';

-- Rien ne se supprime ; tout s'écrit par les fonctions ci-dessous
CREATE TRIGGER inventaires_sans_suppression BEFORE DELETE ON public.inventaires
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER inventaire_lignes_sans_suppression BEFORE DELETE ON public.inventaire_lignes
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER pertes_sans_suppression BEFORE DELETE ON public.pertes
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();
CREATE TRIGGER inventaires_reglages_sans_suppression BEFORE DELETE ON public.inventaires_reglages
  FOR EACH ROW EXECUTE FUNCTION public.interdire_modification();

ALTER TABLE public.inventaires_reglages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaire_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pertes ENABLE ROW LEVEL SECURITY;
-- Les quantités attendues ne sont lisibles que par le propriétaire et les gérants
CREATE POLICY "Réglages lisibles par les comptes actifs" ON public.inventaires_reglages FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) IS NOT NULL);
CREATE POLICY "Inventaires lisibles par le propriétaire et les gérants" ON public.inventaires FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin');
CREATE POLICY "Lignes lisibles par le propriétaire et les gérants" ON public.inventaire_lignes FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin');
CREATE POLICY "Pertes lisibles par leur auteur et les gérants" ON public.pertes FOR SELECT TO authenticated
  USING ((SELECT public.role_courant()) = 'admin' OR declare_par = (SELECT auth.uid()));
REVOKE ALL ON public.inventaires_reglages, public.inventaires, public.inventaire_lignes, public.pertes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventaires_reglages, public.inventaires, public.inventaire_lignes, public.pertes FROM authenticated;

-- ---------------------------------------------------------------------
-- 3. Outils internes : qui travaille où, stock d'un produit dans un lieu
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peut_compter(p_lieu text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE public.role_courant()
           WHEN 'admin' THEN true
           WHEN 'magasinier' THEN p_lieu = 'principal'
           WHEN 'employe_production' THEN p_lieu = 'atelier'
           WHEN 'employe_boutique' THEN p_lieu = 'boutique'
           ELSE false END
$function$;

-- Stock enregistré d'un produit dans un lieu (boutique : reçu - vendu - utilisé)
CREATE OR REPLACE FUNCTION public.stock_lieu(p_lieu text, p_produit_id integer)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT coalesce(CASE p_lieu
    WHEN 'principal' THEN (SELECT quantite_restante FROM produits WHERE id = p_produit_id)
    WHEN 'atelier' THEN (SELECT quantite_disponible FROM stock_atelier WHERE produit_id = p_produit_id)
    WHEN 'boutique' THEN (SELECT coalesce(quantite_disponible, 0) - coalesce(quantite_vendue, 0) - coalesce(quantite_utilisee, 0)
                            FROM stock_boutique WHERE produit_id = p_produit_id)
  END, 0)
$function$;

-- Change le stock enregistré d'un produit dans un lieu (appelée uniquement par les fonctions de cette partie)
CREATE OR REPLACE FUNCTION public.stock_lieu_modifier(p_lieu text, p_produit_id integer, p_delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_lieu = 'principal' THEN
    UPDATE produits SET quantite_restante = quantite_restante + p_delta, updated_at = now() WHERE id = p_produit_id;
  ELSIF p_lieu = 'atelier' THEN
    UPDATE stock_atelier SET quantite_disponible = quantite_disponible + p_delta, updated_at = now(), derniere_maj = now()
     WHERE produit_id = p_produit_id;
  ELSE
    UPDATE stock_boutique SET quantite_disponible = coalesce(quantite_disponible, 0) + p_delta, updated_at = now()
     WHERE produit_id = p_produit_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit % absent du lieu %', p_produit_id, p_lieu USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

-- Produits d'un lieu qui ont du stock, avec leur unité et leur prix unitaire (coût d'achat, sinon prix de vente)
CREATE OR REPLACE FUNCTION public.produits_du_lieu(p_lieu text)
RETURNS TABLE (produit_id integer, nom text, unite text, stock numeric, prix_unitaire numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p.id, p.nom::text, u.label::text, p.quantite_restante, p.prix_achat
    FROM produits p LEFT JOIN unites u ON u.id = p.unite_id
   WHERE p_lieu = 'principal' AND coalesce(p.actif, true) AND p.quantite_restante <> 0
  UNION ALL
  SELECT p.id, p.nom::text, u.label::text, sa.quantite_disponible, p.prix_achat
    FROM stock_atelier sa JOIN produits p ON p.id = sa.produit_id LEFT JOIN unites u ON u.id = p.unite_id
   WHERE p_lieu = 'atelier' AND sa.quantite_disponible <> 0
  UNION ALL
  SELECT sb.produit_id, coalesce(sb.nom_produit, p.nom)::text, u.label::text,
         coalesce(sb.quantite_disponible, 0) - coalesce(sb.quantite_vendue, 0) - coalesce(sb.quantite_utilisee, 0),
         coalesce(nullif(p.prix_achat, 0), sb.prix_vente)
    FROM stock_boutique sb LEFT JOIN produits p ON p.id = sb.produit_id LEFT JOIN unites u ON u.id = p.unite_id
   WHERE p_lieu = 'boutique' AND sb.produit_id IS NOT NULL
     AND coalesce(sb.quantite_disponible, 0) - coalesce(sb.quantite_vendue, 0) - coalesce(sb.quantite_utilisee, 0) <> 0
$function$;

-- ---------------------------------------------------------------------
-- 4. Inventaires
-- ---------------------------------------------------------------------
-- Ouvre l'inventaire du lieu (ou renvoie celui qui est en cours) : la liste des produits à compter, sans quantités.
-- Le mode (tirage ou complet) vient du réglage ; le propriétaire et les gérants peuvent le choisir.
CREATE OR REPLACE FUNCTION public.inventaire_ouvrir(p_lieu text, p_mode text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_r record;
  v_i record;
  v_mode text;
  v_deja boolean := true;
BEGIN
  IF NOT public.peut_compter(p_lieu) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas faire l''inventaire de ce lieu' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_i FROM inventaires WHERE lieu = p_lieu AND statut = 'en_cours';
  IF NOT FOUND THEN
    SELECT * INTO v_r FROM inventaires_reglages WHERE lieu = p_lieu;
    v_mode := CASE WHEN p_mode IS NOT NULL AND public.role_courant() = 'admin' THEN p_mode ELSE v_r.mode END;
    IF v_mode NOT IN ('tirage', 'complet') THEN
      RAISE EXCEPTION 'Mode d''inventaire invalide' USING ERRCODE = '22023';
    END IF;
    BEGIN
      INSERT INTO inventaires (lieu, mode, ouvert_par) VALUES (p_lieu, v_mode, v_uid) RETURNING * INTO v_i;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO v_i FROM inventaires WHERE lieu = p_lieu AND statut = 'en_cours';
    END;
    IF v_i.ouvert_par = v_uid AND v_i.nb_produits = 0 THEN
      v_deja := false;
      -- Tirage : N produits au hasard parmi ceux qui ont du stock ; complet : tous
      INSERT INTO inventaire_lignes (inventaire_id, produit_id, produit_nom, unite, prix_unitaire)
      SELECT v_i.id, x.produit_id, x.nom, x.unite, x.prix_unitaire
        FROM (SELECT * FROM produits_du_lieu(p_lieu) ORDER BY random()
               LIMIT CASE WHEN v_mode = 'tirage' THEN v_r.nombre ELSE NULL END) x;
      UPDATE inventaires SET nb_produits = (SELECT count(*) FROM inventaire_lignes WHERE inventaire_id = v_i.id)
       WHERE id = v_i.id RETURNING * INTO v_i;
      IF v_i.nb_produits = 0 THEN
        -- Annule toute l'ouverture (rien n'est enregistré)
        RAISE EXCEPTION 'Aucun produit en stock dans ce lieu' USING ERRCODE = 'P0002';
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('inventaire_id', v_i.id, 'lieu', v_i.lieu, 'mode', v_i.mode, 'deja_ouvert', v_deja,
    'ouvert_le', v_i.ouvert_le, 'ouvert_par', recap_nom(v_i.ouvert_par),
    'lignes', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit_id', l.produit_id, 'nom', l.produit_nom, 'unite', l.unite,
                 'compte', l.quantite_comptee, 'comptages', jsonb_array_length(l.comptages)) ORDER BY l.produit_nom), '[]'::jsonb)
                 FROM inventaire_lignes l WHERE l.inventaire_id = v_i.id));
END;
$function$;

-- Enregistre des comptages : [{"produit_id": 1, "quantite": 12}, …]. La quantité attendue est notée au même instant.
CREATE OR REPLACE FUNCTION public.inventaire_compter(p_inventaire_id bigint, p_lignes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_i record;
  v_x jsonb;
  v_q numeric;
  v_n integer := 0;
BEGIN
  SELECT * INTO v_i FROM inventaires WHERE id = p_inventaire_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventaire introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.peut_compter(v_i.lieu) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas faire l''inventaire de ce lieu' USING ERRCODE = '42501';
  END IF;
  IF v_i.statut <> 'en_cours' THEN
    RAISE EXCEPTION 'Cet inventaire est terminé' USING ERRCODE = '55000';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' THEN
    RAISE EXCEPTION 'Comptages manquants' USING ERRCODE = '22023';
  END IF;
  FOR v_x IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    BEGIN
      v_q := (v_x ->> 'quantite')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Quantité comptée invalide' USING ERRCODE = '22023';
    END;
    IF v_q IS NULL OR v_q < 0 THEN
      RAISE EXCEPTION 'Quantité comptée invalide' USING ERRCODE = '22023';
    END IF;
    UPDATE inventaire_lignes l
       SET quantite_comptee = v_q,
           quantite_theorique = public.stock_lieu(v_i.lieu, l.produit_id),
           comptages = l.comptages || jsonb_build_array(jsonb_build_object('quantite', v_q, 'le', now(), 'par', v_uid)),
           compte_par = v_uid, compte_le = now()
     WHERE l.inventaire_id = p_inventaire_id AND l.produit_id = (v_x ->> 'produit_id')::integer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit % hors de cet inventaire', v_x ->> 'produit_id' USING ERRCODE = '22023';
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('comptes', v_n,
    'restants', (SELECT count(*) FROM inventaire_lignes WHERE inventaire_id = p_inventaire_id AND quantite_comptee IS NULL));
END;
$function$;

-- Termine l'inventaire. Si des produits ne correspondent pas : on les désigne (sans les quantités) pour les
-- recompter ; après un recomptage, s'ils ne correspondent toujours pas, un motif par produit est obligatoire
-- (p_motifs = {"<produit_id>": "motif", …}). Le stock est alors mis au compté et l'écart inscrit au journal.
CREATE OR REPLACE FUNCTION public.inventaire_cloturer(p_inventaire_id bigint, p_motifs jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_i record;
  v_l record;
  v_motif text;
  v_recompter jsonb := '[]'::jsonb;
  v_motif_requis jsonb := '[]'::jsonb;
  v_ecarts jsonb := '[]'::jsonb;
  v_valeur numeric := 0;
  v_nb integer := 0;
  v_restants integer;
BEGIN
  SELECT * INTO v_i FROM inventaires WHERE id = p_inventaire_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventaire introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.peut_compter(v_i.lieu) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas faire l''inventaire de ce lieu' USING ERRCODE = '42501';
  END IF;
  IF v_i.statut <> 'en_cours' THEN
    RAISE EXCEPTION 'Cet inventaire est terminé' USING ERRCODE = '55000';
  END IF;
  SELECT count(*) INTO v_restants FROM inventaire_lignes WHERE inventaire_id = p_inventaire_id AND quantite_comptee IS NULL;
  IF v_restants > 0 THEN
    RAISE EXCEPTION '% produit(s) pas encore compté(s)', v_restants USING ERRCODE = '22023';
  END IF;
  IF p_motifs IS NOT NULL AND jsonb_typeof(p_motifs) <> 'object' THEN
    RAISE EXCEPTION 'Motifs invalides' USING ERRCODE = '22023';
  END IF;

  FOR v_l IN SELECT * FROM inventaire_lignes WHERE inventaire_id = p_inventaire_id
              AND quantite_comptee <> quantite_theorique ORDER BY produit_nom LOOP
    v_motif := nullif(trim(coalesce(p_motifs ->> v_l.produit_id::text, '')), '');
    IF v_motif IS NOT NULL AND length(v_motif) >= 3 THEN
      CONTINUE;
    END IF;
    IF jsonb_array_length(v_l.comptages) < 2 THEN
      v_recompter := v_recompter || jsonb_build_object('produit_id', v_l.produit_id, 'nom', v_l.produit_nom, 'unite', v_l.unite);
    ELSE
      v_motif_requis := v_motif_requis || jsonb_build_object('produit_id', v_l.produit_id, 'nom', v_l.produit_nom, 'unite', v_l.unite);
    END IF;
  END LOOP;
  IF jsonb_array_length(v_recompter) > 0 OR jsonb_array_length(v_motif_requis) > 0 THEN
    -- Rien n'est révélé des quantités attendues : on recompte, puis on explique
    RETURN jsonb_build_object('statut', CASE WHEN jsonb_array_length(v_recompter) > 0 THEN 'a_recompter' ELSE 'motif_requis' END,
      'a_recompter', v_recompter, 'motif_requis', v_motif_requis);
  END IF;

  FOR v_l IN SELECT * FROM inventaire_lignes WHERE inventaire_id = p_inventaire_id
              AND quantite_comptee <> quantite_theorique ORDER BY produit_id LOOP
    v_motif := trim(p_motifs ->> v_l.produit_id::text);
    -- L'écart s'applique au stock actuel : ventes et mouvements faits depuis le comptage restent comptés
    PERFORM public.stock_lieu_modifier(v_i.lieu, v_l.produit_id, v_l.quantite_comptee - v_l.quantite_theorique);
    PERFORM journal_ecrire_cle(v_i.lieu, v_l.produit_id, v_l.produit_nom, v_l.quantite_comptee - v_l.quantite_theorique, 'inventaire',
      'Inventaire n°' || v_i.id || ' : ' || v_motif, NULL);
    UPDATE inventaire_lignes SET ecart = quantite_comptee - quantite_theorique, motif = v_motif WHERE id = v_l.id;
    v_nb := v_nb + 1;
    v_valeur := v_valeur + (v_l.quantite_comptee - v_l.quantite_theorique) * coalesce(v_l.prix_unitaire, 0);
    v_ecarts := v_ecarts || jsonb_build_object('produit_id', v_l.produit_id, 'nom', v_l.produit_nom, 'unite', v_l.unite,
      'attendu', v_l.quantite_theorique, 'compte', v_l.quantite_comptee, 'ecart', v_l.quantite_comptee - v_l.quantite_theorique,
      'valeur', round((v_l.quantite_comptee - v_l.quantite_theorique) * coalesce(v_l.prix_unitaire, 0)), 'motif', v_motif);
  END LOOP;
  UPDATE inventaire_lignes SET ecart = 0 WHERE inventaire_id = p_inventaire_id AND ecart IS NULL;
  UPDATE inventaires SET statut = 'termine', cloture_par = v_uid, cloture_le = now(), nb_ecarts = v_nb, valeur_ecarts = round(v_valeur)
   WHERE id = p_inventaire_id;

  IF v_nb > 0 THEN
    PERFORM notify_all_admins('alerte_generale',
      'Inventaire ' || CASE v_i.lieu WHEN 'principal' THEN 'du stock principal' WHEN 'atelier' THEN 'de l''atelier' ELSE 'de la boutique' END
        || ' : ' || v_nb || ' écart(s), ' || round(v_valeur) || ' F',
      'Compté par ' || coalesce(recap_nom(v_uid), '?') || ' : '
        || (SELECT string_agg((e->>'nom') || ' ' || CASE WHEN (e->>'ecart')::numeric > 0 THEN '+' ELSE '' END || (e->>'ecart')
                               || ' (« ' || (e->>'motif') || ' »)', ', ') FROM jsonb_array_elements(v_ecarts) e),
      '/inventaires');
  END IF;

  RETURN jsonb_build_object('statut', 'termine', 'inventaire_id', p_inventaire_id, 'nb_produits', v_i.nb_produits,
    'nb_ecarts', v_nb, 'valeur_ecarts', round(v_valeur), 'ecarts', v_ecarts);
END;
$function$;

-- Annule un inventaire en cours (propriétaire et gérants), avec un motif ; rien n'est changé dans le stock
CREATE OR REPLACE FUNCTION public.inventaire_annuler(p_inventaire_id bigint, p_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.role_courant() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls le propriétaire et les gérants peuvent annuler un inventaire' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de l''annulation' USING ERRCODE = '22023';
  END IF;
  UPDATE inventaires SET statut = 'annule', annule_par = auth.uid(), motif_annulation = trim(p_motif), cloture_le = now()
   WHERE id = p_inventaire_id AND statut = 'en_cours';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun inventaire en cours avec ce numéro' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('inventaire_id', p_inventaire_id, 'statut', 'annule');
END;
$function$;

-- Réglage du rythme (propriétaire)
CREATE OR REPLACE FUNCTION public.regler_inventaires(p_lieu text, p_mode text, p_nombre integer, p_frequence text, p_jour integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.est_super_admin() THEN
    RAISE EXCEPTION 'Seul le propriétaire règle les inventaires' USING ERRCODE = '42501';
  END IF;
  UPDATE inventaires_reglages
     SET mode = p_mode, nombre = coalesce(p_nombre, nombre), frequence = p_frequence, jour = coalesce(p_jour, jour),
         modifie_par = auth.uid(), modifie_le = now()
   WHERE lieu = p_lieu;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu inconnu' USING ERRCODE = '22023';
  END IF;
  RETURN (SELECT to_jsonb(r) FROM inventaires_reglages r WHERE lieu = p_lieu);
END;
$function$;

-- Inventaires attendus (état actuel). p_tous : tous les lieux (récapitulatif), sinon ceux de la personne connectée.
-- « attendu » : à faire pour la période en cours (aujourd'hui, ou depuis le jour prévu de la semaine).
-- « en_retard » : une échéance passée a été manquée (hier pour le soir, le jour prévu pour la semaine),
-- en ne comptant que les échéances postérieures au dernier réglage.
CREATE OR REPLACE FUNCTION public.inventaires_a_faire(p_tous boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_auj date := (now() AT TIME ZONE 'Africa/Ouagadougou')::date;
BEGIN
  IF public.role_courant() IS NULL AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Compte inactif ou non connecté' USING ERRCODE = '42501';
  END IF;
  IF p_tous AND NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé au propriétaire' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('lieu', x.lieu, 'mode', x.mode, 'nombre', x.nombre, 'frequence', x.frequence,
             'depuis', x.depuis, 'dernier', x.dernier, 'en_cours_id', x.en_cours, 'attendu', x.attendu,
             'en_retard', x.attendu AND x.echeance_manquee IS NOT NULL AND x.echeance_manquee >= x.regle_le
               AND NOT EXISTS (SELECT 1 FROM inventaires i WHERE i.lieu = x.lieu AND i.statut = 'termine'
                                  AND i.cloture_le >= (x.echeance_manquee::timestamp AT TIME ZONE 'Africa/Ouagadougou'))) ORDER BY x.lieu), '[]'::jsonb)
      FROM (SELECT r.lieu, r.mode, r.nombre, r.frequence, d.depuis,
                   (r.modifie_le AT TIME ZONE 'Africa/Ouagadougou')::date AS regle_le,
                   CASE WHEN r.frequence = 'quotidienne' THEN v_auj - 1
                        WHEN r.frequence = 'hebdomadaire' AND v_auj > d.depuis THEN d.depuis END AS echeance_manquee,
                   (SELECT max(i.cloture_le) FROM inventaires i WHERE i.lieu = r.lieu AND i.statut = 'termine') AS dernier,
                   (SELECT i.id FROM inventaires i WHERE i.lieu = r.lieu AND i.statut = 'en_cours') AS en_cours,
                   r.frequence <> 'aucune' AND NOT EXISTS (
                     SELECT 1 FROM inventaires i WHERE i.lieu = r.lieu AND i.statut = 'termine'
                        AND i.cloture_le >= (d.depuis::timestamp AT TIME ZONE 'Africa/Ouagadougou')) AS attendu
              FROM inventaires_reglages r
              CROSS JOIN LATERAL (SELECT CASE WHEN r.frequence = 'hebdomadaire'
                                              THEN v_auj - ((extract(isodow FROM v_auj)::int - r.jour + 7) % 7)
                                              ELSE v_auj END AS depuis) d
             WHERE p_tous OR public.peut_compter(r.lieu)) x
     WHERE x.attendu OR x.en_cours IS NOT NULL);
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. Pertes : déclarées sur place, décidées par le propriétaire
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.declarer_perte(p_lieu text, p_produit_id integer, p_quantite numeric, p_motif text, p_cle uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p record;
  v_id bigint;
BEGIN
  IF NOT public.peut_compter(p_lieu) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas déclarer de perte pour ce lieu' USING ERRCODE = '42501';
  END IF;
  IF p_cle IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_cle::text, 0));
    SELECT id INTO v_id FROM pertes WHERE cle = p_cle;
    IF FOUND THEN
      RETURN jsonb_build_object('perte_id', v_id, 'deja_enregistre', true);
    END IF;
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide' USING ERRCODE = '22023';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de la perte' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_p FROM produits_du_lieu(p_lieu) x WHERE x.produit_id = p_produit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit sans stock dans ce lieu' USING ERRCODE = 'P0002';
  END IF;
  IF p_quantite > v_p.stock THEN
    RAISE EXCEPTION 'Perte supérieure au stock enregistré (%)', v_p.stock USING ERRCODE = '23514';
  END IF;
  INSERT INTO pertes (lieu, produit_id, produit_nom, unite, quantite, motif, prix_unitaire, declare_par, cle)
  VALUES (p_lieu, p_produit_id, v_p.nom, v_p.unite, p_quantite, trim(p_motif), v_p.prix_unitaire, auth.uid(), p_cle)
  RETURNING id INTO v_id;
  PERFORM notify_all_admins('alerte_generale',
    'Perte déclarée : ' || v_p.nom || ' ' || p_quantite || coalesce(' ' || v_p.unite, '') || ' (' || round(p_quantite * coalesce(v_p.prix_unitaire, 0)) || ' F)',
    'Par ' || coalesce(recap_nom(auth.uid()), '?') || ' : « ' || trim(p_motif) || ' ». À valider par le propriétaire.',
    '/a-faire');
  RETURN jsonb_build_object('perte_id', v_id, 'deja_enregistre', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decider_perte(p_perte_id bigint, p_accepter boolean, p_motif text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_p record;
  v_stock numeric;
BEGIN
  IF NOT public.est_super_admin() THEN
    RAISE EXCEPTION 'Seul le propriétaire valide les pertes' USING ERRCODE = '42501';
  END IF;
  IF p_accepter IS NULL THEN
    RAISE EXCEPTION 'Indiquez si la perte est acceptée' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_p FROM pertes WHERE id = p_perte_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perte introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_p.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('perte_id', p_perte_id, 'statut', v_p.statut, 'deja_decidee', true);
  END IF;
  IF NOT p_accepter AND (p_motif IS NULL OR length(trim(p_motif)) < 3) THEN
    RAISE EXCEPTION 'Indiquez pourquoi la perte est refusée' USING ERRCODE = '22023';
  END IF;

  IF p_accepter THEN
    v_stock := public.stock_lieu(v_p.lieu, v_p.produit_id);
    IF v_stock < v_p.quantite THEN
      RAISE EXCEPTION 'Stock enregistré insuffisant (% restant) : refusez la perte ou faites un inventaire', v_stock USING ERRCODE = '23514';
    END IF;
    PERFORM public.stock_lieu_modifier(v_p.lieu, v_p.produit_id, -v_p.quantite);
    PERFORM journal_ecrire_cle(v_p.lieu, v_p.produit_id, v_p.produit_nom, -v_p.quantite, 'perte',
      'Perte n°' || v_p.id || ' déclarée par ' || coalesce(recap_nom(v_p.declare_par), '?') || ' : ' || v_p.motif, NULL);
    UPDATE pertes SET statut = 'acceptee', decide_par = v_uid, decide_le = now() WHERE id = p_perte_id;
  ELSE
    UPDATE pertes SET statut = 'refusee', decide_par = v_uid, decide_le = now(), motif_refus = trim(p_motif) WHERE id = p_perte_id;
  END IF;
  PERFORM send_notification(v_p.declare_par, 'alerte_generale',
    'Perte ' || CASE WHEN p_accepter THEN 'acceptée' ELSE 'refusée' END || ' : ' || v_p.produit_nom || ' ' || v_p.quantite,
    CASE WHEN p_accepter THEN 'Le stock a été mis à jour.' ELSE 'Motif : ' || trim(p_motif) END, '/inventaires', 'normale');
  RETURN jsonb_build_object('perte_id', p_perte_id, 'statut', CASE WHEN p_accepter THEN 'acceptee' ELSE 'refusee' END, 'deja_decidee', false);
END;
$function$;

-- Produits proposés dans le formulaire de perte : noms et unités seulement. Les quantités enregistrées restent
-- invisibles ici, pour ne pas aider celui qui fait un inventaire.
CREATE OR REPLACE FUNCTION public.produits_pour_perte(p_lieu text)
RETURNS TABLE (produit_id integer, nom text, unite text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.peut_compter(p_lieu) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas déclarer de perte pour ce lieu' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT x.produit_id, x.nom, x.unite FROM public.produits_du_lieu(p_lieu) x WHERE x.stock > 0 ORDER BY x.nom;
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. Pour le propriétaire : pertes à décider, et récapitulatif d'une période
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pertes_a_valider()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.est_super_admin() AND coalesce(auth.role(), 'directe') NOT IN ('service_role', 'directe') THEN
    RAISE EXCEPTION 'Réservé au propriétaire' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('perte_id', p.id, 'lieu', p.lieu, 'produit', p.produit_nom, 'unite', p.unite,
            'quantite', p.quantite, 'valeur', round(p.quantite * coalesce(p.prix_unitaire, 0)), 'motif', p.motif,
            'par', recap_nom(p.declare_par), 'le', p.declare_le, 'stock', public.stock_lieu(p.lieu, p.produit_id)) ORDER BY p.declare_le), '[]'::jsonb)
            FROM pertes p WHERE p.statut = 'en_attente');
END;
$function$;

CREATE OR REPLACE FUNCTION public.recap_inventaires(p_du date, p_au date)
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
    'inventaires', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'lieu', i.lieu, 'mode', i.mode, 'statut', i.statut,
        'ouvert_le', i.ouvert_le, 'cloture_le', i.cloture_le, 'par', recap_nom(coalesce(i.cloture_par, i.ouvert_par)),
        'nb_produits', i.nb_produits, 'nb_ecarts', i.nb_ecarts, 'valeur_ecarts', i.valeur_ecarts, 'motif_annulation', i.motif_annulation,
        'ecarts', (SELECT coalesce(jsonb_agg(jsonb_build_object('produit', l.produit_nom, 'unite', l.unite, 'attendu', l.quantite_theorique,
                     'compte', l.quantite_comptee, 'ecart', l.ecart, 'valeur', round(l.ecart * coalesce(l.prix_unitaire, 0)),
                     'comptages', jsonb_array_length(l.comptages), 'premier', (l.comptages -> 0 ->> 'quantite')::numeric,
                     'par', recap_nom(l.compte_par), 'motif', l.motif) ORDER BY l.produit_nom), '[]'::jsonb)
                     FROM inventaire_lignes l WHERE l.inventaire_id = i.id AND l.ecart <> 0))
        ORDER BY i.ouvert_le), '[]'::jsonb)
      FROM inventaires i
     WHERE (i.ouvert_le >= v_debut AND i.ouvert_le < v_fin) OR (i.cloture_le >= v_debut AND i.cloture_le < v_fin)),
    'pertes', (SELECT coalesce(jsonb_agg(jsonb_build_object('perte_id', p.id, 'lieu', p.lieu, 'produit', p.produit_nom, 'unite', p.unite,
        'quantite', p.quantite, 'valeur', round(p.quantite * coalesce(p.prix_unitaire, 0)), 'motif', p.motif, 'statut', p.statut,
        'par', recap_nom(p.declare_par), 'le', p.declare_le, 'decide_par', recap_nom(p.decide_par), 'motif_refus', p.motif_refus)
        ORDER BY p.declare_le), '[]'::jsonb)
      FROM pertes p
     WHERE (p.declare_le >= v_debut AND p.declare_le < v_fin) OR (p.decide_le >= v_debut AND p.decide_le < v_fin)),
    'en_retard', public.inventaires_a_faire(true),
    'pertes_en_attente', (SELECT count(*) FROM pertes WHERE statut = 'en_attente'));
END;
$function$;

-- ---------------------------------------------------------------------
-- 7. Droits
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.peut_compter(text), public.stock_lieu(text, integer), public.stock_lieu_modifier(text, integer, numeric),
  public.produits_du_lieu(text), public.inventaire_ouvrir(text, text), public.inventaire_compter(bigint, jsonb),
  public.inventaire_cloturer(bigint, jsonb), public.inventaire_annuler(bigint, text),
  public.regler_inventaires(text, text, integer, text, integer), public.inventaires_a_faire(boolean),
  public.declarer_perte(text, integer, numeric, text, uuid), public.decider_perte(bigint, boolean, text),
  public.pertes_a_valider(), public.recap_inventaires(date, date), public.produits_pour_perte(text) FROM PUBLIC, anon;
-- Outils internes (quantités enregistrées, écriture du stock) : pas d'appel direct depuis l'application
REVOKE ALL ON FUNCTION public.stock_lieu(text, integer), public.stock_lieu_modifier(text, integer, numeric),
  public.produits_du_lieu(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.peut_compter(text), public.produits_pour_perte(text), public.inventaire_ouvrir(text, text), public.inventaire_compter(bigint, jsonb), public.inventaire_cloturer(bigint, jsonb),
  public.inventaire_annuler(bigint, text), public.regler_inventaires(text, text, integer, text, integer),
  public.inventaires_a_faire(boolean), public.declarer_perte(text, integer, numeric, text, uuid),
  public.decider_perte(bigint, boolean, text), public.pertes_a_valider(), public.recap_inventaires(date, date)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
