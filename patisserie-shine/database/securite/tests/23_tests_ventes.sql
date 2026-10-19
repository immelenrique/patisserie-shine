-- Scénario ventes atomiques (phase = ventes). Données de départ posées par lancer_ventes.sh.
\set ON_ERROR_STOP on
\set V '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
SELECT (SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2) AS vendu_avant,
       (SELECT count(*) FROM ventes) AS nb_ventes_avant \gset

-- 1. Vente normale par la vendeuse : le prix envoyé par le navigateur (1 FCFA) doit être ignoré
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT tests.verifier('ventes', 'vente normale (2 + 1 croissants, prix navigateur ignoré)',
  'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":2,"prix":1},{"id":2,"quantite":1,"prix":1}]'', 2000)', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('ventes', 'vente : total calculé par la base (3 x 500 = 1500, monnaie 500)',
  'SELECT 1 FROM ventes WHERE total = 1500 AND monnaie_rendue = 500 AND vendeur_id = ''c0000000-0000-4000-8000-000000000003'' AND numero_ticket LIKE ''V-%'' ORDER BY id DESC LIMIT 1', 'lignes=1');
SELECT tests.verifier('ventes', 'vente : une seule ligne regroupée, au prix de la base',
  'SELECT 1 FROM lignes_vente WHERE vente_id = (SELECT max(id) FROM ventes) AND quantite = 3 AND prix_unitaire = 500 AND total = 1500', 'lignes=1');
SELECT tests.verifier('ventes', 'vente : sortie boutique écrite',
  'SELECT 1 FROM sorties_boutique WHERE vente_id = (SELECT max(id) FROM ventes) AND quantite = 3', 'lignes=1');
SELECT tests.verifier('ventes', 'vente : stock décompté de 3',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = %s + 3', :'vendu_avant'), 'lignes=1');

-- 2. Refus : rien ne doit être écrit
SELECT count(*) AS nb_ventes_ok, (SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2) AS vendu_ok FROM ventes \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT tests.verifier('ventes', 'refus : stock insuffisant',   'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1},{"id":4,"quantite":5}]'', 100000)', 'erreur');
SELECT tests.verifier('ventes', 'refus : montant insuffisant', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 100)', 'erreur');
SELECT tests.verifier('ventes', 'refus : produit inconnu',     'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1},{"id":999,"quantite":1}]'', 100000)', 'erreur');
SELECT tests.verifier('ventes', 'refus : panier vide',         'SELECT enregistrer_vente_boutique(''[]'', 100)', 'erreur');
SELECT tests.verifier('ventes', 'refus : quantité négative',   'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":-3}]'', 100)', 'erreur');
SELECT tests.verifier('ventes', 'refus : produit sans prix',   'SELECT enregistrer_vente_boutique(''[{"id":5,"quantite":1}]'', 100000)', 'erreur');
RESET ROLE;
SELECT tests.verifier('ventes', 'refus : aucune vente partielle écrite',
  format('SELECT 1 FROM ventes HAVING count(*) = %s', :'nb_ventes_ok'), 'lignes=1');
SELECT tests.verifier('ventes', 'refus : stock inchangé (même le croissant du panier refusé)',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = %s', :'vendu_ok'), 'lignes=1');

-- 3. Droits
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tests.verifier('ventes', 'visiteur : vente refusée',    'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 1000)', 'erreur');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}', false);
SELECT tests.verifier('ventes', 'compte désactivé : vente refusée', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 1000)', 'erreur');
SELECT set_config('request.jwt.claims', :V, false);
SELECT tests.verifier('ventes', 'employé : annulation directe refusée', 'SELECT annuler_vente_boutique((SELECT max(id) FROM ventes), ''motif suffisamment long'', auth.uid())', 'erreur');
RESET ROLE;

-- 4. Annulation par le serveur (route cancel-sale)
SELECT max(id) AS vente_a_annuler, (SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2) AS vendu_avant_annul FROM ventes \gset
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT tests.verifier('ventes', 'annulation : motif trop court refusé', format('SELECT annuler_vente_boutique(%s, ''court'', ''a0000000-0000-4000-8000-000000000001'')', :'vente_a_annuler'), 'erreur');
SELECT tests.verifier('ventes', 'annulation : acceptée',       format('SELECT annuler_vente_boutique(%s, ''Erreur de saisie client'', ''a0000000-0000-4000-8000-000000000001'')', :'vente_a_annuler'), 'lignes=1');
SELECT tests.verifier('ventes', 'annulation : seconde tentative refusée', format('SELECT annuler_vente_boutique(%s, ''Erreur de saisie client'', ''a0000000-0000-4000-8000-000000000001'')', :'vente_a_annuler'), 'erreur');
SELECT tests.verifier('ventes', 'annulation : vente introuvable', 'SELECT annuler_vente_boutique(999999, ''Erreur de saisie client'', ''a0000000-0000-4000-8000-000000000001'')', 'erreur');
SELECT tests.verifier('ventes', 'annulation : vente de plus de 7 jours refusée', 'SELECT annuler_vente_boutique((SELECT id FROM ventes WHERE numero_ticket = ''V-VIEILLE''), ''Erreur de saisie client'', ''a0000000-0000-4000-8000-000000000001'')', 'erreur');
RESET ROLE;
SELECT tests.verifier('ventes', 'annulation : stock rendu une seule fois (-3)',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = %s - 3', :'vendu_avant_annul'), 'lignes=1');
SELECT tests.verifier('ventes', 'annulation : vente marquée annulée', format('SELECT 1 FROM ventes WHERE id = %s AND statut = ''annulee''', :'vente_a_annuler'), 'lignes=1');
SELECT tests.verifier('ventes', 'annulation : une seule trace d''annulation', format('SELECT 1 FROM annulations_ventes WHERE vente_id = %s', :'vente_a_annuler'), 'lignes=1');
SELECT tests.verifier('ventes', 'annulation : mouvement de stock tracé', format('SELECT 1 FROM mouvements_stock WHERE reference_id = %s AND type_mouvement = ''restauration_annulation'' AND quantite = 3', :'vente_a_annuler'), 'lignes=1');
SELECT tests.verifier('ventes', 'vente de plus de 7 jours toujours validée', 'SELECT 1 FROM ventes WHERE numero_ticket = ''V-VIEILLE'' AND statut = ''validee''', 'lignes=1');
