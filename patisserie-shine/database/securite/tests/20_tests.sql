-- Scénario de test, exécuté trois fois : phase = avant | apres | annule
-- Variables psql : phase, victime, victime_admin (uuid de comptes jetables, un par phase)
\set ON_ERROR_STOP on
SELECT now() AS debut, CASE WHEN :'phase' = 'apres' THEN 'erreur' ELSE 'lignes>0' END AS ferme \gset

-- ===================== 1. Visiteur non connecté (clé publique anon) =====================
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tests.verifier(:'phase', 'anon lit les profils',            'SELECT * FROM profiles', :'ferme');
SELECT tests.verifier(:'phase', 'anon lit les ventes',             'SELECT * FROM ventes', :'ferme');
SELECT tests.verifier(:'phase', 'anon se met admin',               'UPDATE profiles SET role = ''admin'' WHERE username = ''vendeuse''', :'ferme');
SELECT tests.verifier(:'phase', 'anon crée une vente',             format('INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue) VALUES (%L, 1, 1, 0)', 'V-ANON-' || :'phase'), :'ferme');
SELECT tests.verifier(:'phase', 'anon vide le stock boutique',     'UPDATE stock_boutique SET quantite_disponible = 0 WHERE id = 1', :'ferme');
SELECT tests.verifier(:'phase', 'anon lit admin_security_view',    'SELECT * FROM admin_security_view', :'ferme');
SELECT tests.verifier(:'phase', 'anon utilise une séquence',       'SELECT nextval(''ventes_id_seq'')', :'ferme');
SELECT tests.verifier(:'phase', 'anon appelle create_user_with_profile', 'SELECT create_user_with_profile(''x'',''x'',''x'',''x'',''x'',''admin'')', :'ferme');
SELECT tests.verifier(:'phase', 'anon supprime un compte (safe_delete_user)', format('SELECT safe_delete_user(%L)', :'victime'), :'ferme');
RESET ROLE;
-- Réparer ce que l'attaque anonyme a pu casser, pour que la suite teste un état sain
UPDATE profiles SET role = 'employe_boutique' WHERE username = 'vendeuse';
UPDATE stock_boutique SET quantite_disponible = 50 WHERE id = 1;

SELECT tests.verifier(:'phase', 'compte victime toujours présent',
  format('SELECT 1 FROM auth.users WHERE id = %L', :'victime'),
  CASE WHEN :'phase' = 'apres' THEN 'lignes=1' ELSE 'lignes=0' END);

-- ===================== 2. Vendeuse active (employe_boutique) =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
SELECT tests.verifier(:'phase', 'lit les produits',            'SELECT * FROM produits', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit le stock boutique',       'SELECT * FROM stock_boutique', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit les profils',             'SELECT * FROM profiles', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit la vue stock',            'SELECT * FROM vue_stock_boutique', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit les lignes de vente',     'SELECT * FROM lignes_vente', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit annulations (règle admin existante)', 'SELECT * FROM annulations_ventes', 'lignes=0');
SELECT tests.verifier(:'phase', 'caisse : crée la vente',      format('INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id) VALUES (%L, 500, 1000, 500, auth.uid())', 'V-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : ligne de vente',     format('INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, ''Croissant'', 1, 500, 500 FROM ventes WHERE numero_ticket = %L', 'V-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : sortie boutique',    format('INSERT INTO sorties_boutique (vente_id, produit_id, quantite, prix_unitaire, total) SELECT id, 2, 1, 500, 500 FROM ventes WHERE numero_ticket = %L', 'V-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : décompte du stock',  'UPDATE stock_boutique SET quantite_vendue = quantite_vendue + 1 WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier(:'phase', 'change un prix (déclenche 2 audits)', 'UPDATE stock_boutique SET prix_vente = prix_vente + 1 WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier(:'phase', 'utilisation boutique (déclencheur sur stock)', 'INSERT INTO utilisations_boutique (stock_boutique_id, quantite_utilisee, utilisateur_id) VALUES (1, 1, auth.uid())', 'lignes=1');
SELECT tests.verifier(:'phase', 'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1');
SELECT tests.verifier(:'phase', 'nouvelle demande groupée (notifie les admins)', 'INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES (''Boutique'', auth.uid(), 1)', 'lignes=1');
SELECT tests.verifier(:'phase', 'ligne de demande',            'INSERT INTO demandes (produit_id, quantite, demandeur_id, demande_groupee_id) VALUES (1, 2, auth.uid(), 1)', 'lignes=1');
-- Bug existant (indépendant de RLS) : le déclencheur log_mouvement_stock écrit dans mouvements_stock,
-- réservé aux admins/production. L'application n'appelle decrement_stock qu'à la validation par un admin.
SELECT tests.verifier(:'phase', 'rpc decrement_stock (bug existant)', 'SELECT decrement_stock(3, 1)', 'erreur');
RESET ROLE;

-- ===================== 3. Admin actif =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT tests.verifier(:'phase', 'production vers boutique',    'INSERT INTO productions (produit, quantite, destination, producteur_id) VALUES (''Croissant'', 5, ''Boutique'', auth.uid())', 'lignes=1');
SELECT tests.verifier(:'phase', 'modifie un employé',          'UPDATE profiles SET nom = ''Awa B.'' WHERE username = ''vendeuse''', 'lignes=1');
SELECT tests.verifier(:'phase', 'annule une vente (jeton utilisateur)', format('UPDATE ventes SET statut = ''annulee'' WHERE numero_ticket = %L', 'V-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'refuse une demande (notifie la vendeuse)', 'UPDATE demandes_groupees SET statut = ''refusee'', valideur_id = auth.uid() WHERE id = (SELECT max(id) FROM demandes_groupees)', 'lignes=1');
SELECT tests.verifier(:'phase', 'lit admin_security_view',     'SELECT * FROM admin_security_view', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit les annulations',         'SELECT * FROM annulations_ventes', 'lignes>0');
SELECT tests.verifier(:'phase', 'validation : rpc decrement_stock', 'SELECT decrement_stock(3, 1)', 'lignes=1');
SELECT tests.verifier(:'phase', 'rpc safe_delete_user',        format('SELECT safe_delete_user(%L)', :'victime_admin'), 'lignes=1');
RESET ROLE;

-- ===================== 4. Compte désactivé (session encore ouverte) =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}', false);
SELECT tests.verifier(:'phase', 'inactif lit son profil (écran de connexion)', 'SELECT * FROM profiles WHERE id = auth.uid()', 'lignes=1');
SELECT tests.verifier(:'phase', 'inactif lit les ventes',      'SELECT * FROM ventes', CASE WHEN :'phase' = 'apres' THEN 'lignes=0' ELSE 'lignes>0' END);
SELECT tests.verifier(:'phase', 'inactif crée une vente',      format('INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue) VALUES (%L, 1, 1, 0)', 'V-INACTIF-' || :'phase'), CASE WHEN :'phase' = 'apres' THEN 'erreur' ELSE 'lignes=1' END);
SELECT tests.verifier(:'phase', 'inactif modifie le stock',    'UPDATE stock_boutique SET quantite_disponible = quantite_disponible WHERE id = 1', CASE WHEN :'phase' = 'apres' THEN 'lignes=0' ELSE 'lignes=1' END);
SELECT tests.verifier(:'phase', 'inactif se réactive',         'UPDATE profiles SET actif = true WHERE id = auth.uid()', CASE WHEN :'phase' = 'apres' THEN 'lignes=0' ELSE 'lignes=1' END);
RESET ROLE;
UPDATE profiles SET actif = false WHERE username = 'ancien';

-- ===================== 5. Serveur (service_role, routes API) =====================
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT tests.verifier(:'phase', 'service lit les profils',     'SELECT * FROM profiles', 'lignes>0');
SELECT tests.verifier(:'phase', 'service met à jour une vente', 'UPDATE ventes SET statut = statut WHERE id = 1', 'lignes=1');
SELECT tests.verifier(:'phase', 'service écrit un mouvement',  'INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite) VALUES (2, ''restauration_annulation'', 1)', 'lignes=1');
RESET ROLE;

-- ===================== 6. Inscription piégée et création par l'admin =====================
-- Simulées comme Supabase Auth : insertion dans auth.users, le déclencheur crée le profil
INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('pirate_' || :'phase' || '@shine.local', json_build_object('username', 'pirate_' || :'phase', 'role', 'admin'));
SELECT tests.verifier(:'phase', 'inscription piégée obtient admin',
  format('SELECT 1 FROM profiles WHERE username = %L AND role = ''admin''', 'pirate_' || :'phase'),
  CASE WHEN :'phase' = 'apres' THEN 'lignes=0' ELSE 'lignes=1' END);
SELECT tests.verifier(:'phase', 'inscription piégée a quand même un profil',
  format('SELECT 1 FROM profiles WHERE username = %L', 'pirate_' || :'phase'), 'lignes=1');
-- Route create-user : createUser (métadonnées) puis fixation du rôle avec service_role
INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('nouveau_' || :'phase' || '@shine.local', json_build_object('username', 'nouveau_' || :'phase', 'role', 'admin'));
SET ROLE service_role;
SELECT tests.verifier(:'phase', 'create-user fixe le rôle choisi',
  format('UPDATE profiles SET role = ''admin'' WHERE username = %L', 'nouveau_' || :'phase'), 'lignes=1');
RESET ROLE;

-- ===================== 7. Effets réels des déclencheurs PENDANT cette phase =====================
SELECT tests.verifier(:'phase', 'déclencheur : audit prix simple écrit',  format('SELECT 1 FROM audit_prix_simple WHERE changed_at >= %L::timestamptz::timestamp', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : audit prix détaillé écrit', format('SELECT 1 FROM audit_prix_changes WHERE changed_at >= %L::timestamptz::timestamp', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : utilisation reportée sur le stock', format('SELECT 1 FROM stock_boutique WHERE id = 1 AND updated_at >= %L::timestamptz::timestamp AND quantite_utilisee > 0', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : production entrée en boutique', format('SELECT 1 FROM entrees_boutique WHERE source = ''Production'' AND created_at >= %L', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : notification aux admins',   format('SELECT 1 FROM notifications WHERE type = ''demande_nouvelle'' AND created_at >= %L', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : notification à la vendeuse', format('SELECT 1 FROM notifications WHERE type = ''demande_refusee'' AND created_at >= %L', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : mouvement de stock tracé',  format('SELECT 1 FROM mouvements_stock WHERE produit_id = 3 AND created_at >= %L', :'debut'), 'lignes=1');
