-- Scénario de la partie 7 (phase = reserve). Données : celles de lancer_achats_reserves.sh (parties 1 à 7,
-- comptes prod (atelier), magasinier, chef (gérant), proprietaire, vendeuse).
\set ON_ERROR_STOP on
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set MAG '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('reserve', 'production : création d''un produit refusée', 'SELECT creer_produit(''Levure'', current_date, 2, 3000, 2)', 'erreur');
SELECT tests.verifier('reserve', 'production : réapprovisionnement refusé', 'SELECT reapprovisionner_produit(1, 5, 3000)', 'erreur');
SELECT tests.verifier('reserve', 'production : écriture directe d''une quantité toujours refusée', 'UPDATE produits SET quantite_restante = 999 WHERE id = 1', 'erreur');
SELECT tests.verifier('reserve', 'production : envoi atelier vers boutique toujours possible',
  'SELECT envoyer_atelier_vers_boutique(''[{"produit_id":1,"quantite":1}]'', ''99999999-dddd-4ddd-8ddd-000000000001'')', 'lignes=1');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('reserve', 'boutique : réapprovisionnement refusé', 'SELECT reapprovisionner_produit(1, 5, 3000)', 'erreur');
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('reserve', 'magasinier : création', 'SELECT creer_produit(''Levure'', current_date, 2, 3000, 2, NULL, ''99999999-dddd-4ddd-8ddd-000000000002'')', 'lignes=1');
SELECT tests.verifier('reserve', 'magasinier : réapprovisionnement', 'SELECT reapprovisionner_produit(1, 5, 3000, current_date, ''99999999-dddd-4ddd-8ddd-000000000003'')', 'lignes=1');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('reserve', 'gérant : réapprovisionnement (dépannage)', 'SELECT reapprovisionner_produit(3, 5, 1500, current_date, ''99999999-dddd-4ddd-8ddd-000000000004'')', 'lignes=1');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('reserve', 'propriétaire : réapprovisionnement', 'SELECT reapprovisionner_produit(6, 5, 2500, current_date, ''99999999-dddd-4ddd-8ddd-000000000005'')', 'lignes=1');
SELECT tests.verifier('reserve', 'les achats du gérant et du propriétaire sont aussi à confirmer',
  'SELECT 1 WHERE (achats_a_confirmer() ->> ''nombre'')::int = 4', 'lignes=1');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('reserve', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
