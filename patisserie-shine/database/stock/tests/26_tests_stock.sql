-- Scénario de la partie 2 (phase = stock). Données : celles de lancer_stock.sh (Farine 1, Croissant 2,
-- Sucre 3, Pain 6 ; Farine 20 à l'atelier ; Croissant 50 en boutique ; article « Sans prix » 5 en boutique).
\set ON_ERROR_STOP on
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set ANCIEN '\'{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}\''
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'
\set uid_prod 'f0000000-0000-4000-8000-000000000011'

-- ============ A. Plus aucune écriture directe ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('stock', 'caissier : création directe d''un produit refusée', 'INSERT INTO produits (nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (''Faux'', 1, 100, 100, 1)', 'erreur');
SELECT tests.verifier('stock', 'caissier : modification d''un produit refusée', 'UPDATE produits SET nom = ''Farine bis'' WHERE id = 1', 'erreur');
SELECT tests.verifier('stock', 'caissier : prix de vente non modifiable', 'UPDATE stock_boutique SET prix_vente = 1 WHERE produit_id = 2', 'erreur');
SELECT tests.verifier('stock', 'caissier : faux mouvement d''historique refusé', 'INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite) VALUES (1, ''entree'', 5)', 'erreur');
SELECT tests.verifier('stock', 'caissier : fausse entrée boutique refusée', 'INSERT INTO entrees_boutique (produit_id, quantite) VALUES (2, 50)', 'erreur');
SELECT tests.verifier('stock', 'caissier : fausse utilisation refusée', 'INSERT INTO utilisations_boutique (stock_boutique_id, quantite_utilisee, utilisateur_id) VALUES (1, 1, auth.uid())', 'erreur');
SELECT tests.verifier('stock', 'caissier : ajouter_stock_boutique fermée', 'SELECT ajouter_stock_boutique(2, 100, ''Production'', NULL, auth.uid())', 'erreur');
SELECT tests.verifier('stock', 'caissier : quantité vendue non modifiable (cacher une vente)', 'UPDATE stock_boutique SET quantite_vendue = coalesce(quantite_vendue, 0) + 1 WHERE produit_id = 2', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'gérant : quantité du stock principal non modifiable directement', 'UPDATE produits SET quantite_restante = 999 WHERE id = 1', 'erreur');
SELECT tests.verifier('stock', 'gérant : unité non modifiable directement', 'UPDATE produits SET unite_id = 2 WHERE id = 6', 'erreur');
SELECT tests.verifier('stock', 'gérant : suppression d''un produit refusée', 'DELETE FROM produits WHERE id = 6', 'erreur');
SELECT tests.verifier('stock', 'gérant : quantité boutique non modifiable directement', 'UPDATE stock_boutique SET quantite_disponible = 999 WHERE produit_id = 2', 'erreur');
SELECT tests.verifier('stock', 'gérant : quantité atelier non modifiable directement', 'UPDATE stock_atelier SET quantite_disponible = 0 WHERE produit_id = 1', 'erreur');
SELECT tests.verifier('stock', 'gérant : création directe de stock atelier refusée', 'INSERT INTO stock_atelier (produit_id, quantite_disponible) VALUES (3, 10)', 'erreur');
SELECT tests.verifier('stock', 'gérant : suppression d''une ligne de stock boutique refusée', 'DELETE FROM stock_boutique WHERE produit_id = 2', 'erreur');
SELECT tests.verifier('stock', 'gérant : faux mouvement d''historique refusé', 'INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite) VALUES (1, ''entree'', 5)', 'erreur');
SELECT tests.verifier('stock', 'gérant : changement de prix de vente autorisé', 'UPDATE stock_boutique SET prix_vente = 500 WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier('stock', 'gérant : nom d''un produit modifiable directement (hors quantités)', 'UPDATE produits SET nom = nom WHERE id = 1', 'lignes=1');
RESET ROLE;

-- ============ B. Création d'un produit ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('stock', 'création : refusée à un caissier', 'SELECT creer_produit(''Beurre'', current_date, 10, 5000, 2)', 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT creer_produit('Beurre', current_date, 10, 5000, 2, 800, '44444444-dddd-4ddd-8ddd-000000000001') AS c1 \gset
SELECT creer_produit('Beurre', current_date, 10, 5000, 2, 800, '44444444-dddd-4ddd-8ddd-000000000001') AS c1bis \gset
RESET ROLE;
SELECT (:'c1'::jsonb ->> 'produit_id')::integer AS beurre \gset
SELECT tests.verifier('stock', 'création : produit à 10, prix unitaire 500, créé par la production',
  format('SELECT 1 FROM produits WHERE id = %s AND quantite = 10 AND quantite_restante = 10 AND prix_achat = 500 AND created_by = %L AND actif', :beurre, :'uid_prod'), 'lignes=1');
SELECT tests.verifier('stock', 'création : prix de vente enregistré', format('SELECT 1 FROM prix_vente_produits WHERE produit_id = %s AND prix = 800 AND actif', :beurre), 'lignes=1');
SELECT tests.verifier('stock', 'création : journal achat +10 signé par la production',
  format('SELECT 1 FROM journal_stock WHERE produit_id = %s AND lieu = ''principal'' AND nature = ''achat'' AND quantite = 10 AND auteur_id = %L', :beurre, :'uid_prod'), 'lignes=1');
SELECT tests.verifier('stock', 'création : même clé = pas de second produit',
  format('SELECT 1 WHERE (%L::jsonb)->>''deja_enregistre'' = ''true'' AND (SELECT count(*) FROM produits WHERE nom = ''Beurre'') = 1', :'c1bis'), 'lignes=1');

-- ============ C. Réapprovisionnement ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'réappro : +50 farine pour 30 000 F', 'SELECT reapprovisionner_produit(1, 50, 30000, current_date, ''44444444-dddd-4ddd-8ddd-000000000002'')', 'lignes=1');
SELECT tests.verifier('stock', 'réappro : même clé ignorée (double clic)', 'SELECT 1 WHERE (reapprovisionner_produit(1, 50, 30000, current_date, ''44444444-dddd-4ddd-8ddd-000000000002''))->>''deja_enregistre'' = ''true''', 'lignes=1');
SELECT tests.verifier('stock', 'réappro : quantité négative refusée', 'SELECT reapprovisionner_produit(1, -5, 100)', 'erreur');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('stock', 'réappro : refusé à un caissier', 'SELECT reapprovisionner_produit(1, 5, 100)', 'erreur');
RESET ROLE;
SELECT tests.verifier('stock', 'réappro : 100 -> 150, prix moyen pondéré (100 x 500 + 30 000) / 150',
  'SELECT 1 FROM produits WHERE id = 1 AND quantite = 150 AND quantite_restante = 150 AND round(prix_achat, 2) = 533.33', 'lignes=1');
SELECT tests.verifier('stock', 'réappro : une seule ligne au journal (+50) et un seul mouvement tracé',
  format('SELECT 1 WHERE (SELECT count(*) FROM journal_stock WHERE produit_id = 1 AND nature = ''achat'') = 1 AND (SELECT count(*) FROM mouvements_stock WHERE produit_id = 1 AND type_mouvement = ''entree'' AND quantite = 50 AND utilisateur_id = %L) = 1', :'uid_chef'), 'lignes=1');

-- ============ D. Modification des informations ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'modification : renommer le sucre', 'SELECT modifier_produit(3, ''Sucre fin'', NULL, 300, 2)', 'lignes=1');
SELECT tests.verifier('stock', 'modification : unité refusée tant qu''il y a du stock', 'SELECT modifier_produit(3, ''Sucre fin'', NULL, 300, 1)', 'erreur');
RESET ROLE;
SELECT tests.verifier('stock', 'modification : nom changé, unité et quantités inchangées', 'SELECT 1 FROM produits WHERE id = 3 AND nom = ''Sucre fin'' AND unite_id = 2 AND quantite_restante = 40', 'lignes=1');

-- ============ E. Correction motivée du stock principal ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('stock', 'correction : refusée à la production', 'SELECT ajuster_stock_principal(3, 35, ''casse'')', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'correction : motif obligatoire', 'SELECT ajuster_stock_principal(3, 35, '' '')', 'erreur');
SELECT tests.verifier('stock', 'correction : 40 -> 35 (casse)', 'SELECT ajuster_stock_principal(3, 35, ''Sac de sucre déchiré'')', 'lignes=1');
SELECT tests.verifier('stock', 'correction : 35 -> 45, au-delà des achats', 'SELECT ajuster_stock_principal(3, 45, ''Recomptage : sac oublié'')', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('stock', 'correction : journal -5 puis +10, motivés et signés par le gérant',
  format('SELECT 1 FROM journal_stock WHERE produit_id = 3 AND nature = ''ajustement'' AND auteur_id = %L HAVING count(*) = 2 AND sum(quantite) = 5 AND min(quantite) = -5', :'uid_chef'), 'lignes=1');
SELECT tests.verifier('stock', 'correction : restant 45 et cumul des achats relevé à 45', 'SELECT 1 FROM produits WHERE id = 3 AND quantite_restante = 45 AND quantite = 45', 'lignes=1');

-- ============ F. Archivage au lieu de suppression ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'archivage : refusé tant qu''il reste du stock', 'SELECT archiver_produit(3, ''Plus vendu'')', 'erreur');
SELECT tests.verifier('stock', 'archivage : mise à zéro motivée', 'SELECT ajuster_stock_principal(3, 0, ''Inventaire de fin de produit'')', 'lignes=1');
SELECT tests.verifier('stock', 'archivage : accepté sans stock', 'SELECT archiver_produit(3, ''Plus vendu'')', 'lignes=1');
SELECT tests.verifier('stock', 'archivage : seconde fois refusée', 'SELECT archiver_produit(3, ''Plus vendu'')', 'erreur');
SELECT tests.verifier('stock', 'archivage : plus de réapprovisionnement', 'SELECT reapprovisionner_produit(3, 5, 100)', 'erreur');
SELECT tests.verifier('stock', 'unité : refusée pour un produit en stock (pain)', 'SELECT modifier_produit(6, NULL, NULL, NULL, 2)', 'erreur');
SELECT tests.verifier('stock', 'unité : acceptée pour un produit sans stock (sucre)', 'SELECT modifier_produit(3, NULL, NULL, NULL, 1)', 'lignes=1');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('stock', 'archivage : refusé à un caissier', 'SELECT archiver_produit(6, ''test'')', 'erreur');
RESET ROLE;
SELECT tests.verifier('stock', 'archivage : produit inactif, historique conservé',
  format('SELECT 1 FROM produits WHERE id = 3 AND NOT actif AND archive_par = %L AND motif_archivage = ''Plus vendu'' AND (SELECT count(*) FROM mouvements_stock WHERE produit_id = 3) > 0', :'uid_chef'), 'lignes=1');

-- ============ G. Atelier ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'atelier : correction 20 -> 18 motivée', 'SELECT ajuster_stock_atelier(1, 18, ''2 kg utilisés pour les essais'')', 'lignes=1');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('stock', 'atelier : vidage refusé à la production', 'SELECT vider_stock_atelier(''fin de semaine'')', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('stock', 'atelier : vidage sans motif refusé', 'SELECT vider_stock_atelier('''')', 'erreur');
SELECT tests.verifier('stock', 'atelier : vidage motivé', 'SELECT vider_stock_atelier(''Consommé en production de la semaine'')', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('stock', 'atelier : tout à zéro, journal -2 puis -18 motivés',
  'SELECT 1 FROM journal_stock WHERE lieu = ''atelier'' AND produit_id = 1 AND nature = ''ajustement'' HAVING sum(quantite) = -20 AND count(*) = 2 AND NOT EXISTS (SELECT 1 FROM stock_atelier WHERE quantite_disponible <> 0)', 'lignes=1');

-- ============ H. Utilisation en boutique (une seule fois) ============
SELECT id AS stock_fourniture FROM stock_boutique WHERE produit_id = 5 \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('stock', 'utilisation : refusée à la production', format('SELECT utiliser_stock_boutique(%s, 1)', :stock_fourniture), 'erreur');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('stock', 'utilisation : 3 articles', format('SELECT utiliser_stock_boutique(%s, 3, ''Emballages du jour'')', :stock_fourniture), 'lignes=1');
SELECT tests.verifier('stock', 'utilisation : au-delà du stock refusée', format('SELECT utiliser_stock_boutique(%s, 50)', :stock_fourniture), 'erreur');
RESET ROLE;
SELECT tests.verifier('stock', 'utilisation : comptée une seule fois (3, et non 6), journal -3',
  format('SELECT 1 FROM stock_boutique WHERE id = %s AND quantite_utilisee = 3 AND (SELECT count(*) FROM utilisations_boutique WHERE stock_boutique_id = %s) = 1 AND (SELECT sum(quantite) FROM journal_stock WHERE nature = ''utilisation'' AND produit_id = 5) = -3', :stock_fourniture, :stock_fourniture), 'lignes=1');

-- ============ I. Ventes et annulations inscrites au journal ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":2}]', 1000, NULL) AS v1 \gset
SELECT set_config('request.jwt.claims', :ANCIEN, false);
SELECT tests.verifier('stock', 'vente : compte désactivé refusé', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 1000, NULL)', 'erreur');
RESET ROLE;
SELECT tests.verifier('stock', 'vente : journal -2 signé par la vendeuse avec le ticket',
  format('SELECT 1 FROM journal_stock WHERE nature = ''vente'' AND produit_id = 2 AND quantite = -2 AND auteur_id = %L AND motif = ''Ticket '' || %L', :'uid_vend', (:'v1'::jsonb)->>'numero_ticket'), 'lignes=1');
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT tests.verifier('stock', 'annulation de vente (serveur)', format('SELECT annuler_vente_boutique(%s, ''Erreur de saisie client'', %L)', (:'v1'::jsonb)->>'id', :'uid_chef'), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('stock', 'annulation de vente : journal +2 signé par l''admin vérifié',
  format('SELECT 1 FROM journal_stock WHERE nature = ''annulation_vente'' AND produit_id = 2 AND quantite = 2 AND auteur_id = %L', :'uid_chef'), 'lignes=1');

-- ============ J. Production envoyée en boutique (déclencheur) ============
SELECT quantite_disponible AS croissant_avant FROM stock_boutique WHERE produit_id = 2 \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
INSERT INTO productions (produit, quantite, destination, statut, producteur_id) VALUES ('Croissant', 5, 'Boutique', 'termine', :'uid_prod');
INSERT INTO productions (produit, quantite, destination, statut, producteur_id) VALUES ('Brioche', 4, 'Boutique', 'termine', :'uid_prod');
RESET ROLE;
SELECT tests.verifier('stock', 'production : croissants ajoutés en boutique, prix existant conservé (500, pas 1000)',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_disponible = %s + 5 AND prix_vente = 500', :'croissant_avant'), 'lignes=1');
SELECT tests.verifier('stock', 'production : nouveau produit créé, prix par défaut', 'SELECT 1 FROM stock_boutique sb JOIN produits p ON p.id = sb.produit_id WHERE p.nom = ''Brioche'' AND sb.quantite_disponible = 4 AND sb.prix_vente = 1000', 'lignes=1');
SELECT tests.verifier('stock', 'production : inscrite au journal', 'SELECT 1 FROM journal_stock WHERE nature = ''production'' HAVING count(*) = 2 AND sum(quantite) = 9', 'lignes=1');

-- ============ K. Intégrité ============
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('stock', 'journal : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
SELECT tests.verifier('stock', 'journal : chaque envoi s''équilibre', 'SELECT envoi_id FROM journal_stock WHERE envoi_id IS NOT NULL GROUP BY envoi_id HAVING sum(quantite) <> 0', 'lignes=0');
SELECT tests.verifier('stock', 'journal : modification toujours impossible', 'UPDATE journal_stock SET quantite = 1 WHERE id = (SELECT max(id) FROM journal_stock)', 'erreur');
