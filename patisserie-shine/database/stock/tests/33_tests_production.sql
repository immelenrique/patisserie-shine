-- Scénario de la partie 9 (phase = production). Données : celles de lancer_production.sh (parties 1 à 9).
-- Atelier : Farine 1 (20 kg, 500 F le kg) ; Sucre 3 absent de l'atelier.
\set ON_ERROR_STOP on
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set uid_prod 'f0000000-0000-4000-8000-000000000011'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'

-- Une ancienne recette, sans rendement (comme celles de la production actuelle), et un prix de vente de recette
INSERT INTO recettes (nom_produit, produit_ingredient_id, quantite_necessaire) VALUES ('Vieux gâteau', 1, 1);
INSERT INTO prix_vente_recettes (nom_produit, prix_vente, actif) VALUES ('Pain test', 150, true);

-- ============ A. Recettes protégées ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('production', 'boutique : ajout direct d''un ingrédient refusé', 'INSERT INTO recettes (nom_produit, produit_ingredient_id, quantite_necessaire) VALUES (''Vieux gâteau'', 3, 1)', 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('production', 'production : modification directe d''une quantité refusée', 'UPDATE recettes SET quantite_necessaire = 0.1', 'erreur');
SELECT tests.verifier('production', 'production : suppression directe refusée', 'DELETE FROM recettes', 'erreur');
SELECT tests.verifier('production', 'production : enregistrement d''une recette refusé',
  'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":1,"quantite":1}]'', 50, 3, 2, ''Pain maison'')', 'erreur');
SELECT tests.verifier('production', 'production : ancienne recette sans rendement refusée',
  'SELECT declarer_production(''Vieux gâteau'', 1, 10)', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('production', 'rendement nul refusé', 'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":1,"quantite":2}]'', 0, 0, 0, ''Pain maison'')', 'erreur');
SELECT tests.verifier('production', 'marge plus grande que le rendement refusée', 'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":1,"quantite":2}]'', 5, 5, 0, ''Pain maison'')', 'erreur');
SELECT tests.verifier('production', 'recette sans ingrédient refusée', 'SELECT recette_enregistrer(''Pain test'', ''[]'', 50, 3, 2, ''Pain maison'')', 'erreur');
SELECT tests.verifier('production', 'ingrédient inconnu refusé', 'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":999,"quantite":2}]'', 50, 3, 2, ''Pain maison'')', 'erreur');
SELECT tests.verifier('production', 'gérant : enregistre la recette (2 kg de farine, 0,5 kg de sucre, 50 pains à -3/+2)',
  'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":1,"quantite":2},{"produit_id":3,"quantite":0.5}]'', 50, 3, 2, ''Pain maison'')', 'lignes=1');
SELECT tests.verifier('production', 'gérant : corrige la farine (2,2 kg)',
  'SELECT recette_enregistrer(''Pain test'', ''[{"produit_id":1,"quantite":2.2},{"produit_id":3,"quantite":0.5}]'', 50, 3, 2, ''Pain maison'')', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('production', 'recette : 2 ingrédients, fiche 50 (-3/+2) « Pain maison »',
  'SELECT 1 FROM recettes_fiches f WHERE f.nom_produit = ''Pain test'' AND f.rendement = 50 AND f.marge_moins = 3 AND f.marge_plus = 2 AND f.produit_fini = ''Pain maison'' AND (SELECT count(*) FROM recettes WHERE nom_produit = ''Pain test'') = 2', 'lignes=1');
SELECT tests.verifier('production', 'historique : création puis correction, l''ancienne quantité gardée',
  'SELECT 1 FROM journal_recettes a, journal_recettes b WHERE a.nom_produit = ''Pain test'' AND b.nom_produit = ''Pain test'' AND a.id < b.id AND a.avant IS NULL AND b.avant -> ''lignes'' @> ''[{"produit_id":1,"quantite":2}]'' AND b.apres -> ''lignes'' @> ''[{"produit_id":1,"quantite":2.2}]'' AND (SELECT count(*) FROM journal_recettes) = 2', 'lignes=1');

-- ============ B. Production dans la marge ; matière manquante acceptée ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('production', 'quantité nulle refusée', 'SELECT declarer_production(''Pain test'', 2, 0)', 'erreur');
SELECT declarer_production('Pain test', 2, 99, false, '99999999-ffff-4fff-8fff-000000000001') AS p1 \gset
SELECT declarer_production('Pain test', 2, 99, false, '99999999-ffff-4fff-8fff-000000000001') AS p1bis \gset
SELECT tests.verifier('production', 'production : lit les fiches de recette', 'SELECT 1 FROM recettes_fiches WHERE nom_produit = ''Pain test''', 'lignes=1');
SELECT tests.verifier('production', 'production : n''écrit pas de production en direct',
  format('INSERT INTO productions (produit, quantite, destination, statut, producteur_id) VALUES (''Croissant'', 5, ''Boutique'', ''termine'', %L)', :'uid_prod'), 'erreur');
SELECT tests.verifier('production', 'production : ne lit pas l''historique des recettes', 'SELECT 1 FROM journal_recettes', 'lignes=0');
RESET ROLE;
SELECT (:'p1'::jsonb ->> 'produit_id')::integer AS pain \gset
SELECT tests.verifier('production', '2 fournées, 99 pains : dans la marge (94 à 104), pas d''alerte',
  format('SELECT 1 WHERE NOT (%L::jsonb ->> ''hors_marge'')::boolean AND (%L::jsonb ->> ''min'')::numeric = 94 AND (%L::jsonb ->> ''max'')::numeric = 104 AND NOT EXISTS (SELECT 1 FROM notifications WHERE message LIKE ''Rendement hors marge%%'')', :'p1', :'p1', :'p1'), 'lignes=1');
SELECT tests.verifier('production', 'farine retirée : 20 - 4,4 = 15,6 kg',
  'SELECT 1 FROM stock_atelier WHERE produit_id = 1 AND quantite_disponible = 15.6', 'lignes=1');
SELECT tests.verifier('production', 'sucre absent de l''atelier : production acceptée, manque de 1 kg noté',
  format('SELECT 1 FROM productions p, jsonb_array_elements(p.matieres) m WHERE p.id = %s AND (m->>''produit_id'')::int = 3 AND (m->>''besoin'')::numeric = 1 AND (m->>''retire'')::numeric = 0 AND (m->>''manque'')::numeric = 1', (:'p1'::jsonb ->> 'production_id')), 'lignes=1');
SELECT tests.verifier('production', 'produit fini « Pain maison » créé, 99 au stock atelier, coût 2 200 F',
  format('SELECT 1 FROM produits p, stock_atelier s, productions pr WHERE p.id = %s AND p.nom = ''Pain maison'' AND s.produit_id = p.id AND s.quantite_disponible = 99 AND pr.id = %s AND pr.cout_ingredients = 2200 AND pr.destination = ''Atelier''', :pain, (:'p1'::jsonb ->> 'production_id')), 'lignes=1');
SELECT tests.verifier('production', 'prix de vente de la recette repris pour le produit fini (150 F)',
  format('SELECT 1 FROM prix_vente_produits WHERE produit_id = %s AND prix = 150 AND actif', :pain), 'lignes=1');
SELECT tests.verifier('production', 'journal : farine -4,4 et pain +99, signés par la production',
  format('SELECT 1 FROM journal_stock WHERE nature = ''production'' AND lieu = ''atelier'' AND auteur_id = %L AND ((produit_id = 1 AND quantite = -4.4) OR (produit_id = %s AND quantite = 99)) HAVING count(*) = 2', :'uid_prod', :pain), 'lignes=1');
SELECT tests.verifier('production', 'même clé : même production, rien de plus',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_enregistre'')::boolean AND (SELECT count(*) FROM productions WHERE recette = ''Pain test'') = 1', :'p1bis'), 'lignes=1');
SELECT tests.verifier('production', 'rien n''est arrivé directement en boutique', format('SELECT 1 FROM stock_boutique WHERE produit_id = %s', :pain), 'lignes=0');

-- ============ C. Produire et envoyer, hors marge ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT declarer_production('Pain test', 1, 40, true) AS p2 \gset
RESET ROLE;
SELECT tests.verifier('production', '1 fournée, 40 pains : hors marge (47 à 52), propriétaire et gérants prévenus',
  format('SELECT 1 WHERE (%L::jsonb ->> ''hors_marge'')::boolean AND EXISTS (SELECT 1 FROM notifications WHERE destinataire_id = %L AND message = ''Rendement hors marge : Pain maison 40 obtenus pour 47 à 52 attendus'')', :'p2', :'uid_chef'), 'lignes=1');
SELECT tests.verifier('production', 'envoi vers la boutique créé, en transit, 40 pains ; atelier reste à 99',
  format('SELECT 1 FROM envois e JOIN envoi_lignes l ON l.envoi_id = e.id, stock_atelier s WHERE e.id = (%L::jsonb ->> ''envoi_id'')::bigint AND e.origine = ''atelier'' AND e.destination = ''boutique'' AND e.statut = ''en_transit'' AND l.quantite_envoyee = 40 AND s.produit_id = %s AND s.quantite_disponible = 99', :'p2', :pain), 'lignes=1');
SELECT tests.verifier('production', 'la destination reste « Atelier » : pas d''ajout direct en boutique',
  format('SELECT 1 FROM productions WHERE id = %s AND destination = ''Atelier'' AND envoi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM stock_boutique WHERE produit_id = %s)', (:'p2'::jsonb ->> 'production_id'), :pain), 'lignes=1');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('production', 'boutique : pas de déclaration de production', 'SELECT declarer_production(''Pain test'', 1, 50)', 'erreur');
SELECT receptionner_envoi((:'p2'::jsonb ->> 'envoi_id')::bigint, format('[{"produit_id":%s,"quantite_recue":40}]', :pain)::jsonb) IS NOT NULL AS ok \gset
RESET ROLE;
SELECT tests.verifier('production', 'boutique : 40 pains reçus après comptage, au prix de la recette (150 F)',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = %s AND quantite_disponible = 40 AND prix_vente = 150', :pain), 'lignes=1');
SELECT tests.verifier('production', 'farine : 15,6 - 2,2 = 13,4 kg', 'SELECT 1 FROM stock_atelier WHERE produit_id = 1 AND quantite_disponible = 13.4', 'lignes=1');

-- ============ D. Suppression d'une recette ; rien ne s'efface ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('production', 'suppression sans motif refusée', 'SELECT recette_supprimer(''Pain test'', '''')', 'erreur');
SELECT tests.verifier('production', 'gérant : supprime la recette', 'SELECT recette_supprimer(''Pain test'', ''remplacée par la nouvelle'')', 'lignes=1');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('production', 'recette supprimée : plus de production', 'SELECT declarer_production(''Pain test'', 1, 50)', 'erreur');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT recap_productions(current_date, current_date) AS r \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('production', 'boutique : pas de récapitulatif des productions', 'SELECT recap_productions(current_date, current_date)', 'erreur');
RESET ROLE;
SELECT tests.verifier('production', 'récap : 2 productions dont 1 hors marge, le manque de sucre, 3 changements de recette, l''ancienne recette sans rendement',
  format('SELECT 1 WHERE jsonb_array_length(%L::jsonb -> ''productions'') = 2 AND (SELECT count(*) FROM jsonb_array_elements(%L::jsonb -> ''productions'') x WHERE (x->>''hors_marge'')::boolean) = 1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''productions'') x, jsonb_array_elements(x -> ''manques'') m WHERE m->>''produit'' = ''Sucre'') AND jsonb_array_length(%L::jsonb -> ''recettes_modifiees'') = 3 AND %L::jsonb -> ''recettes_sans_rendement'' = ''["Vieux gâteau"]''::jsonb',
    :'r', :'r', :'r', :'r', :'r'), 'lignes=1');
SELECT tests.verifier('production', 'une production ne se supprime pas', 'DELETE FROM productions', 'erreur');
SELECT tests.verifier('production', 'l''historique des recettes ne se modifie pas', 'UPDATE journal_recettes SET motif = ''x''', 'erreur');
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('production', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
