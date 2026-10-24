-- Section J du scénario 26 rejouée avec la partie 9 : la production directe en boutique est refusée.
-- @PHASE@ est remplacé par lancer_production.sh.
-- ============ J. Production directe en boutique : refusée depuis la partie 9 ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('@PHASE@', 'production directe en boutique refusée (declarer_production)', format('INSERT INTO productions (produit, quantite, destination, statut, producteur_id) VALUES (''Croissant'', 5, ''Boutique'', ''termine'', %L)', :'uid_prod'), 'erreur');
RESET ROLE;
SELECT tests.verifier('@PHASE@', 'aucune production au journal', 'SELECT 1 FROM journal_stock WHERE nature = ''production''', 'lignes=0');

