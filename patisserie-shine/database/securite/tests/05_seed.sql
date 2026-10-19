-- Données de test fictives (aucune donnée réelle)
-- Comptes créés comme le fait Supabase Auth : INSERT dans auth.users -> handle_new_user crée le profil.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('a0000000-0000-4000-8000-000000000001', 'chef@shine.local',      '{"username":"chef","nom":"Chef Admin"}'),
 ('b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local', '{"username":"proprietaire","nom":"Proprio"}'),
 ('c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local',  '{"username":"vendeuse","nom":"Awa"}'),
 ('d0000000-0000-4000-8000-000000000004', 'ancien@shine.local',    '{"username":"ancien","nom":"Ancien admin"}'),
 ('e0000000-0000-4000-8000-000000000005', 'victime_avant@shine.local', '{"username":"victime_avant"}'),
 ('e0000000-0000-4000-8000-000000000006', 'victime_apres@shine.local', '{"username":"victime_apres"}'),
 ('e0000000-0000-4000-8000-000000000007', 'victime_admin@shine.local', '{"username":"victime_admin"}'),
 ('e0000000-0000-4000-8000-000000000008', 'victime_annul@shine.local', '{"username":"victime_annul"}'),
 ('e0000000-0000-4000-8000-000000000009', 'victime_admin2@shine.local', '{"username":"victime_admin2"}'),
 ('e0000000-0000-4000-8000-000000000010', 'victime_admin3@shine.local', '{"username":"victime_admin3"}');

UPDATE profiles SET role = 'admin' WHERE username IN ('chef', 'proprietaire', 'ancien');
UPDATE profiles SET is_super_admin = true WHERE username = 'proprietaire';
UPDATE profiles SET actif = false WHERE username = 'ancien';

INSERT INTO unites (id, value, label) VALUES (1, 'pcs', 'Pièces'), (2, 'kg', 'Kilogramme');
SELECT setval('unites_id_seq', 10);
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES
 (1, 'Farine', 500, 100, 100, 2), (2, 'Croissant', 0, 50, 0, 1), (3, 'Sucre', 300, 40, 40, 2);
SELECT setval('produits_id_seq', 10);
INSERT INTO stock_boutique (id, produit_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (1, 2, 50, 0, 500);
SELECT setval('stock_boutique_id_seq', 10);
INSERT INTO stock_atelier (produit_id, quantite_disponible) VALUES (1, 20);
INSERT INTO ventes (id, numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id) VALUES (1, 'V-SEED-1', 1000, 1000, 0, 'c0000000-0000-4000-8000-000000000003');
SELECT setval('ventes_id_seq', 10);
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) VALUES (1, 2, 'Croissant', 2, 500, 1000);
INSERT INTO demandes_groupees (id, destination, demandeur_id, nombre_produits) VALUES (1, 'Boutique', 'c0000000-0000-4000-8000-000000000003', 1);
SELECT setval('demandes_groupees_id_seq', 10);
INSERT INTO annulations_ventes (vente_id, numero_ticket, montant_annule, motif, annule_par) VALUES (1, 'V-SEED-1', 0, 'test', 'a0000000-0000-4000-8000-000000000001');

-- Volume réaliste pour mesurer le coût de la règle « compte actif » (la vraie table a 42 623 lignes)
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total)
SELECT 1, 2, 'Croissant', 1, 500, 500 FROM generate_series(1, 45000);
ANALYZE;

-- Banc d'essai (schéma séparé, non touché par la phase 1)
CREATE SCHEMA tests;
CREATE TABLE tests.resultats (id serial PRIMARY KEY, phase text, acteur text, test text, attendu text, obtenu text, ok boolean);
CREATE TABLE tests.instantane (moment text, objet text, etat text);
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA tests TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA tests TO anon, authenticated, service_role;

-- Nom de l'utilisateur simulé, lu avec les droits du banc d'essai (indépendant des règles testées)
CREATE FUNCTION tests.qui() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT username FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION tests.qui() TO anon, authenticated, service_role;

-- Exécute une requête avec le rôle courant et compare le résultat à l'attendu :
--   'erreur'      -> la requête doit être refusée
--   'lignes=N'    -> exactement N lignes lues ou modifiées
--   'lignes>0'    -> au moins une ligne
CREATE FUNCTION tests.verifier(p_phase text, p_test text, p_sql text, p_attendu text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
  v_obtenu text;
  v_ok boolean;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    v_obtenu := 'lignes=' || n;
  EXCEPTION WHEN OTHERS THEN
    v_obtenu := 'erreur (' || SQLSTATE || ' ' || left(SQLERRM, 60) || ')';
  END;
  v_ok := CASE
    WHEN p_attendu = 'erreur' THEN v_obtenu LIKE 'erreur%'
    WHEN p_attendu = 'lignes>0' THEN v_obtenu LIKE 'lignes=%' AND n > 0
    ELSE v_obtenu = p_attendu
  END;
  INSERT INTO tests.resultats (phase, acteur, test, attendu, obtenu, ok)
  VALUES (p_phase, current_user || coalesce(' ' || tests.qui(), ''), p_test, p_attendu, v_obtenu, v_ok);
END $$;
GRANT EXECUTE ON FUNCTION tests.verifier(text, text, text, text) TO anon, authenticated, service_role;

-- Photographie des droits et règles, pour vérifier que l'annulation remet tout à l'identique
CREATE FUNCTION tests.photographier(p_moment text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO tests.instantane
  SELECT p_moment, 'table ' || c.relname, c.relrowsecurity::text || ' ' || coalesce(c.relacl::text, '')
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','v','S')
  UNION ALL
  SELECT p_moment, 'fonction ' || p.proname, coalesce(p.proacl::text, 'defaut') || ' ' || md5(pg_get_functiondef(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  UNION ALL
  SELECT p_moment, 'regle ' || tablename || ' ' || policyname, cmd || ' ' || permissive || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
    FROM pg_policies WHERE schemaname = 'public'
  UNION ALL
  SELECT p_moment, 'defaut ' || defaclobjtype::text, defaclacl::text FROM pg_default_acl;
$$;
