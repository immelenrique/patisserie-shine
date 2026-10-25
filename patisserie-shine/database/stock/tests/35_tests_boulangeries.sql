-- Scénario de la partie 12 (phase = boulangeries). Données : celles de lancer_boulangeries.sh (parties 1 à 12 ;
-- tout l'existant est à Ouagadougou ; proprietaire super administrateur, affichage sur Ouagadougou).
-- Comptes d'Abidjan créés ici : admin_abj (gérant), vend_abj (boutique), mag_abj (magasinier).
\set ON_ERROR_STOP on
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set MAG '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set ADMA '\'{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000001"}\''
\set VENDA '\'{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000002"}\''
\set MAGA '\'{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000003"}\''

-- Comptes d'Abidjan, créés comme par la route de création (boulangerie transmise au déclencheur)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('a2000000-0000-4000-8000-000000000001', 'admin_abj@shine.local', '{"username":"admin_abj","nom":"Koffi","boulangerie_id":"2"}'),
 ('a2000000-0000-4000-8000-000000000002', 'vend_abj@shine.local', '{"username":"vend_abj","nom":"Aya","boulangerie_id":"2"}'),
 ('a2000000-0000-4000-8000-000000000003', 'mag_abj@shine.local', '{"username":"mag_abj","nom":"Yao","boulangerie_id":"2"}');
UPDATE profiles SET role = 'admin', force_password_change = false WHERE username = 'admin_abj';
UPDATE profiles SET role = 'employe_boutique', force_password_change = false WHERE username = 'vend_abj';
UPDATE profiles SET role = 'magasinier', force_password_change = false WHERE username = 'mag_abj';

-- ============ A. Affectation ============
SELECT tests.verifier('boulangeries', 'comptes d''Abidjan affectés à Abidjan à la création', 'SELECT 1 FROM profiles WHERE username IN (''admin_abj'', ''vend_abj'', ''mag_abj'') AND boulangerie_id = 2', 'lignes=3');
SELECT tests.verifier('boulangeries', 'l''existant reste à Ouagadougou', 'SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM ventes WHERE boulangerie_id <> 1) AND NOT EXISTS (SELECT 1 FROM produits WHERE boulangerie_id <> 1) AND (SELECT count(*) FROM profiles WHERE boulangerie_id = 1) > 5', 'lignes=1');
SELECT tests.verifier('boulangeries', 'un compte non super administrateur doit avoir une boulangerie', 'UPDATE profiles SET boulangerie_id = NULL WHERE username = ''vend_abj''', 'erreur');

-- ============ B. Abidjan achète sa farine (même nom qu'à Ouagadougou) ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAGA, false);
SELECT tests.verifier('boulangeries', 'magasinier d''Abidjan : achat de « Farine » (même nom qu''à Ouaga)', 'SELECT creer_produit(''Farine'', current_date, 25, 20000, 1, NULL, NULL)', 'lignes=1');
SELECT tests.verifier('boulangeries', 'magasinier d''Abidjan : ne voit que sa farine', 'SELECT 1 FROM produits', 'lignes=1');
RESET ROLE;
SELECT id AS pabj FROM produits WHERE boulangerie_id = 2 \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :ADMA, false);
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : aucune vente, aucun stock boutique, aucune demande d''Ouaga', 'SELECT 1 FROM ventes UNION ALL SELECT 1 FROM stock_boutique UNION ALL SELECT 1 FROM demandes_groupees UNION ALL SELECT 1 FROM lignes_vente', 'lignes=0');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : voit ses 3 comptes et les super administrateurs, pas l''équipe d''Ouaga', 'SELECT 1 FROM profiles WHERE username IN (''vendeuse'', ''chef'', ''magasin'')', 'lignes=0');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : la propriétaire reste visible', 'SELECT 1 FROM profiles WHERE username = ''proprietaire''', 'lignes=1');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : ses réglages d''inventaire (3 lieux)', 'SELECT 1 FROM inventaires_reglages', 'lignes=3');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : correction de la farine d''Ouaga refusée', 'SELECT ajuster_stock_principal(1, 0, ''tentative depuis Abidjan'')', 'erreur');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : archivage d''un produit d''Ouaga refusé', 'SELECT archiver_produit(3, ''tentative depuis Abidjan'')', 'erreur');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : écriture directe dans Ouaga refusée', 'INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits, boulangerie_id) VALUES (''Boutique'', auth.uid(), 1, 1)', 'erreur');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : recette « Pain » à son nom', 'SELECT recette_enregistrer(''Pain'', (''[{"produit_id":'' || (SELECT id FROM produits WHERE nom = ''Farine'') || '',"quantite":1}]'')::jsonb, 10, 1, 1, ''Pain'')', 'lignes=1');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : ne peut pas choisir une autre boulangerie', 'SELECT choisir_boulangerie(1)', 'erreur');
SELECT tests.verifier('boulangeries', 'gérant d''Abidjan : ne peut pas changer de boulangerie', 'UPDATE profiles SET boulangerie_id = 1 WHERE id = auth.uid()', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('boulangeries', 'gérant d''Ouaga : recette « Pain » aussi (même nom, autre boulangerie)', 'SELECT recette_enregistrer(''Pain'', ''[{"produit_id":1,"quantite":2}]'', 20, 2, 2, ''Pain'')', 'lignes=1');
SELECT tests.verifier('boulangeries', 'gérant d''Ouaga : ne voit pas la farine d''Abidjan', 'SELECT 1 FROM produits WHERE boulangerie_id = 2', 'lignes=0');
SELECT tests.verifier('boulangeries', 'gérant d''Ouaga : correction du produit d''Abidjan refusée', format('SELECT ajuster_stock_principal(%s, 0, ''tentative'')', :pabj), 'erreur');
RESET ROLE;
SELECT tests.verifier('boulangeries', 'la farine d''Abidjan est intacte (25)', 'SELECT 1 FROM produits WHERE nom = ''Farine'' AND boulangerie_id = 2 AND quantite_restante = 25', 'lignes=1');
SELECT tests.verifier('boulangeries', 'deux fiches « Pain », une par boulangerie', 'SELECT 1 FROM recettes_fiches WHERE nom_produit = ''Pain''', 'lignes=2');

-- ============ C. Vente et caisse à Abidjan ============
INSERT INTO stock_boutique (produit_id, nom_produit, quantite_disponible, quantite_vendue, prix_vente, boulangerie_id)
SELECT id, 'Farine', 10, 0, 1500, 2 FROM produits WHERE boulangerie_id = 2;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('boulangeries', 'vendeuse d''Ouaga : vente d''un article d''Abidjan refusée', format('SELECT enregistrer_vente_boutique(''[{"id":%s,"quantite":1}]'', 5000)', :pabj), 'erreur');
SELECT set_config('request.jwt.claims', :VENDA, false);
SELECT ouvrir_caisse(1000) IS NOT NULL;
SELECT tests.verifier('boulangeries', 'vendeuse d''Abidjan : vente de 2 articles à 1 500 F', format('SELECT enregistrer_vente_boutique(''[{"id":%s,"quantite":2}]'', 3000)', :pabj), 'lignes=1');
SELECT tests.verifier('boulangeries', 'vendeuse d''Abidjan : ne voit que sa vente', 'SELECT 1 FROM ventes', 'lignes=1');
SELECT cloturer_caisse(3500) AS c1 \gset
SELECT cloturer_caisse(3500, true, 'billet manquant') AS c2 \gset
RESET ROLE;
SELECT tests.verifier('boulangeries', 'caisse d''Abidjan : attendu 4 000 F (fond + sa vente seulement)', format('SELECT 1 WHERE (%L::jsonb ->> ''attendu'')::numeric = 4000', :'c2'), 'lignes=1');
SELECT tests.verifier('boulangeries', 'vente, lignes, journal et caisse inscrits à Abidjan', 'SELECT 1 WHERE (SELECT boulangerie_id FROM ventes ORDER BY id DESC LIMIT 1) = 2 AND (SELECT bool_and(boulangerie_id = 2) FROM lignes_vente WHERE vente_id = (SELECT max(id) FROM ventes)) AND (SELECT boulangerie_id FROM caisses_actives ORDER BY id DESC LIMIT 1) = 2', 'lignes=1');
SELECT tests.verifier('boulangeries', 'écart d''Abidjan : la propriétaire et le gérant d''Abidjan prévenus, pas le gérant d''Ouaga',
  'SELECT 1 WHERE EXISTS (SELECT 1 FROM notifications n JOIN profiles p ON p.id = n.destinataire_id WHERE n.message LIKE ''Écart de caisse : Aya%'' AND p.username = ''proprietaire'') AND EXISTS (SELECT 1 FROM notifications n JOIN profiles p ON p.id = n.destinataire_id WHERE n.message LIKE ''Écart de caisse : Aya%'' AND p.username = ''admin_abj'') AND NOT EXISTS (SELECT 1 FROM notifications n JOIN profiles p ON p.id = n.destinataire_id WHERE n.message LIKE ''Écart de caisse : Aya%'' AND p.username = ''chef'')', 'lignes=1');

-- ============ D. Journal : une chaîne par boulangerie ============
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('boulangeries', 'le gérant d''Abidjan est toujours à Abidjan', 'SELECT 1 FROM profiles WHERE username = ''admin_abj'' AND boulangerie_id = 2', 'lignes=1');
SELECT tests.verifier('boulangeries', 'journal d''Abidjan : commence à « origine »', 'SELECT 1 FROM journal_stock WHERE boulangerie_id = 2 AND id = (SELECT min(id) FROM journal_stock WHERE boulangerie_id = 2) AND empreinte_precedente = ''origine''', 'lignes=1');
SELECT tests.verifier('boulangeries', 'journal : les deux chaînes intactes', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');

-- ============ E. La propriétaire choisit ce qu'elle regarde ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('boulangeries', 'propriétaire sur Ouaga : pas la vente d''Abidjan', 'SELECT 1 FROM ventes WHERE boulangerie_id = 2', 'lignes=0');
SELECT tests.verifier('boulangeries', 'propriétaire sur Ouaga : récapitulatif sans Abidjan', 'SELECT 1 WHERE NOT ((recap_periode(current_date, current_date))->''ventes''->''par_vendeur'' @> ''[{"vendeur":"Aya (vend_abj)"}]'')', 'lignes=1');
SELECT choisir_boulangerie(2) IS NOT NULL;
SELECT tests.verifier('boulangeries', 'propriétaire sur Abidjan : sa vente et son récapitulatif', 'SELECT 1 WHERE (SELECT count(*) FROM ventes) = 1 AND (recap_periode(current_date, current_date))->''ventes''->''par_vendeur'' @> ''[{"vendeur":"Aya (vend_abj)"}]''', 'lignes=1');
SELECT tests.verifier('boulangeries', 'propriétaire sur Abidjan : ma_boulangerie', 'SELECT 1 WHERE (ma_boulangerie())->''courante''->>''nom'' = ''Abidjan'' AND jsonb_array_length((ma_boulangerie())->''liste'') = 2', 'lignes=1');
SELECT choisir_boulangerie(NULL) IS NOT NULL;
SELECT tests.verifier('boulangeries', 'propriétaire sur « toutes » : les ventes des deux boulangeries', 'SELECT 1 WHERE (SELECT count(DISTINCT boulangerie_id) FROM ventes) = 2', 'lignes=1');
SELECT tests.verifier('boulangeries', 'propriétaire sur « toutes » : saisie refusée (choisir d''abord)', 'SELECT creer_produit(''Beurre'', current_date, 1, 100, 1, NULL, NULL)', 'erreur');
SELECT tests.verifier('boulangeries', 'propriétaire : coordonnées d''Abidjan', 'SELECT modifier_boulangerie(2, ''Cocody, Abidjan'', ''07 00 00 00 00'')', 'lignes=1');
SELECT choisir_boulangerie(1) IS NOT NULL;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('boulangeries', 'gérant : ne modifie pas les coordonnées', 'SELECT modifier_boulangerie(1, ''x'', ''y'')', 'erreur');
SELECT tests.verifier('boulangeries', 'gérant d''Ouaga : sa boulangerie, sans liste', 'SELECT 1 WHERE (ma_boulangerie())->''courante''->>''nom'' = ''Ouagadougou'' AND (ma_boulangerie())->''liste'' = ''null''::jsonb', 'lignes=1');
RESET ROLE;

-- Annulation par la route serveur (service, sans utilisateur connecté) : seulement dans la boulangerie de l'admin
SELECT id AS vabj FROM ventes WHERE boulangerie_id = 2 \gset
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('boulangeries', 'route d''annulation : le gérant d''Ouaga ne peut pas annuler une vente d''Abidjan', format('SELECT annuler_vente_boutique(%s, ''erreur de saisie client'', %L)', :vabj, 'a0000000-0000-4000-8000-000000000001'), 'erreur');
SELECT set_config('shine.auteur', '', false);
SELECT tests.verifier('boulangeries', 'route d''annulation : le gérant d''Abidjan annule sa vente', format('SELECT annuler_vente_boutique(%s, ''erreur de saisie client'', %L)', :vabj, 'a2000000-0000-4000-8000-000000000001'), 'lignes=1');
SELECT set_config('shine.auteur', '', false);
SELECT tests.verifier('boulangeries', 'annulation d''Abidjan inscrite à Abidjan', format('SELECT 1 FROM annulations_ventes WHERE vente_id = %s AND boulangerie_id = 2', :vabj), 'lignes=1');

-- ============ F. Contrôle : chaque fonction est soumise à l'étanchéité ============
SELECT tests.verifier('boulangeries', 'fonctions hors du rôle soumis aux règles : seulement la liste prévue',
  'SELECT p.proname FROM pg_proc p WHERE p.pronamespace = ''public''::regnamespace AND p.prosecdef AND p.proowner <> ''shine_fonctions''::regrole AND p.proname NOT IN (''boulangerie_courante'', ''boulangerie_saisie'', ''role_courant'', ''est_super_admin'', ''est_admin'', ''est_utilisateur_actif'', ''safe_delete_user'', ''handle_new_user'', ''recu_present'', ''recu_du_compte'', ''proteger_affectation'', ''peut_compter'')', 'lignes=0');
SELECT tests.verifier('boulangeries', 'chaque table de données a sa règle d''étanchéité',
  'SELECT c.relname FROM pg_class c WHERE c.relnamespace = ''public''::regnamespace AND c.relkind = ''r'' AND EXISTS (SELECT 1 FROM information_schema.columns k WHERE k.table_schema = ''public'' AND k.table_name = c.relname AND k.column_name = ''boulangerie_id'') AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname AND p.policyname = ''boulangerie_etanche'')', 'lignes=0');
