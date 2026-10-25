-- Scénario de la partie 10 (phase = cuisine). Données : celles de lancer_cuisine.sh (parties 1 à 10 appliquées ;
-- cuisine : Riz sauce (1) 10 en stock au prix du produit 1 500 F, Jus (2) 20 en stock à 600 F (prix du stock),
-- Sans stock (3) sans ligne de stock, Ancien plat (4) inactif ; comptes cuisine (employe_cuisine), vendeuse
-- (boutique), chef (gérant), prod, proprietaire).
\set ON_ERROR_STOP on
\set CUIS '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000015"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set uid_cuis 'f0000000-0000-4000-8000-000000000015'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'

-- ============ A. Rien ne s'écrit directement ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT tests.verifier('cuisine', 'cuisine : vente écrite directement refusée',
  format('INSERT INTO ventes_cuisine (numero_ticket, vendeur_id, total, montant_donne) VALUES (''C-FAUX'', %L, 1, 1)', :'uid_cuis'), 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : ligne de vente écrite directement refusée',
  'INSERT INTO lignes_vente_cuisine (vente_cuisine_id, produit_cuisine_id, nom_produit, quantite, prix_unitaire, sous_total) VALUES (1, 1, ''x'', 1, 1, 1)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : stock modifié directement refusé', 'UPDATE stock_cuisine SET quantite_disponible = 99 WHERE produit_cuisine_id = 1', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : mouvement écrit directement refusé',
  'INSERT INTO mouvements_stock_cuisine (produit_cuisine_id, type_mouvement, quantite) VALUES (1, ''entree'', 5)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : lecture du stock', 'SELECT 1 FROM stock_cuisine', 'lignes=3');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('cuisine', 'gérant : stock modifié directement refusé', 'UPDATE stock_cuisine SET quantite_disponible = 99 WHERE produit_cuisine_id = 1', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : suppression d''une vente refusée', 'DELETE FROM ventes_cuisine', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : effacement de l''historique refusé', 'DELETE FROM mouvements_stock_cuisine', 'erreur');
RESET ROLE;

-- ============ B. Vente : prix et stock de la base, une seule fois ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT ouvrir_caisse(2000) AS o1 \gset
SELECT tests.verifier('cuisine', 'cuisine : panier vide refusé', 'SELECT enregistrer_vente_cuisine(''[]'', 1000)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : quantité négative refusée', 'SELECT enregistrer_vente_cuisine(''[{"id":1,"quantite":-1}]'', 1000)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : produit sans stock refusé', 'SELECT enregistrer_vente_cuisine(''[{"id":3,"quantite":1}]'', 5000)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : produit inactif refusé', 'SELECT enregistrer_vente_cuisine(''[{"id":4,"quantite":1}]'', 5000)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : stock insuffisant refusé (rien d''enregistré)',
  'SELECT enregistrer_vente_cuisine(''[{"id":2,"quantite":1},{"id":1,"quantite":11}]'', 99999)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : montant donné insuffisant refusé', 'SELECT enregistrer_vente_cuisine(''[{"id":1,"quantite":1}]'', 1000)', 'erreur');
-- Riz sauce 2 + 1 (regroupés) à 1 500 F, Jus 1 à 600 F (prix du stock) = 5 100 F
SELECT enregistrer_vente_cuisine('[{"id":1,"quantite":2},{"id":2,"quantite":1},{"id":1,"quantite":1}]', 6000, '99999999-cccc-4ccc-8ccc-000000000001') AS v1 \gset
SELECT enregistrer_vente_cuisine('[{"id":1,"quantite":2},{"id":2,"quantite":1},{"id":1,"quantite":1}]', 6000, '99999999-cccc-4ccc-8ccc-000000000001') AS v1bis \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('cuisine', 'boutique : pas de vente en cuisine', 'SELECT enregistrer_vente_cuisine(''[{"id":2,"quantite":1}]'', 1000)', 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('cuisine', 'production : pas de vente en cuisine', 'SELECT enregistrer_vente_cuisine(''[{"id":2,"quantite":1}]'', 1000)', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('cuisine', 'clé d''une autre personne refusée',
  'SELECT enregistrer_vente_cuisine(''[{"id":2,"quantite":1}]'', 1000, ''99999999-cccc-4ccc-8ccc-000000000001'')', 'erreur');
RESET ROLE;
SELECT tests.verifier('cuisine', 'vente : total 5 100 F calculé par la base, monnaie 900 F',
  format('SELECT 1 FROM ventes_cuisine WHERE id = %s AND total = 5100 AND monnaie_rendue = 900 AND vendeur_id = %L AND numero_ticket LIKE ''C-%%''', :'v1'::jsonb ->> 'id', :'uid_cuis'), 'lignes=1');
SELECT tests.verifier('cuisine', 'vente : deux lignes (Riz sauce regroupé)',
  format('SELECT 1 FROM lignes_vente_cuisine WHERE vente_cuisine_id = %s AND ((produit_cuisine_id = 1 AND quantite = 3 AND prix_unitaire = 1500) OR (produit_cuisine_id = 2 AND quantite = 1 AND prix_unitaire = 600))', :'v1'::jsonb ->> 'id'), 'lignes=2');
SELECT tests.verifier('cuisine', 'vente : stock Riz 10 → 7 (vendu 3), Jus 20 → 19',
  'SELECT 1 WHERE (SELECT quantite_disponible || ''/'' || quantite_vendue FROM stock_cuisine WHERE produit_cuisine_id = 1) = ''7.00/3.00'' AND (SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 2) = 19', 'lignes=1');
SELECT tests.verifier('cuisine', 'vente : deux mouvements « vente » avec avant et après',
  format('SELECT 1 FROM mouvements_stock_cuisine WHERE reference_id = %s AND type_mouvement = ''vente'' AND ((produit_cuisine_id = 1 AND quantite_avant = 10 AND quantite_apres = 7) OR (produit_cuisine_id = 2 AND quantite_avant = 20 AND quantite_apres = 19))', :'v1'::jsonb ->> 'id'), 'lignes=2');
SELECT tests.verifier('cuisine', 'double envoi : la même vente renvoyée, enregistrée une seule fois',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_enregistree'')::boolean AND (%L::jsonb ->> ''id'') = (%L::jsonb ->> ''id'') AND (SELECT count(*) FROM ventes_cuisine) = 1 AND (SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 1) = 7',
    :'v1bis', :'v1bis', :'v1'), 'lignes=1');
SELECT tests.verifier('cuisine', 'refus : aucun reste d''une vente refusée', 'SELECT 1 WHERE (SELECT count(*) FROM lignes_vente_cuisine) = 2 AND (SELECT count(*) FROM mouvements_stock_cuisine) = 2', 'lignes=1');

-- ============ C. Entrées et corrections du stock (gérants) ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT tests.verifier('cuisine', 'cuisine : entrée de stock refusée', 'SELECT entree_stock_cuisine(1, 5)', 'erreur');
SELECT tests.verifier('cuisine', 'cuisine : correction de stock refusée', 'SELECT ajuster_stock_cuisine(1, 50, ''recompté'')', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('cuisine', 'gérant : quantité nulle refusée', 'SELECT entree_stock_cuisine(1, 0)', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : produit inactif refusé', 'SELECT entree_stock_cuisine(4, 5)', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : entrée de 5 Riz sauce, prix 1 600 F', 'SELECT entree_stock_cuisine(1, 5, 1600, ''Cuisson du midi'', ''99999999-cccc-4ccc-8ccc-000000000002'')', 'lignes=1');
SELECT tests.verifier('cuisine', 'gérant : même entrée renvoyée (même clé)', 'SELECT entree_stock_cuisine(1, 5, 1600, ''Cuisson du midi'', ''99999999-cccc-4ccc-8ccc-000000000002'')', 'lignes=1');
SELECT tests.verifier('cuisine', 'gérant : nouveau produit mis en stock', 'SELECT entree_stock_cuisine(3, 4)', 'lignes=1');
SELECT tests.verifier('cuisine', 'gérant : correction sans motif refusée', 'SELECT ajuster_stock_cuisine(2, 18, '''')', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : correction négative refusée', 'SELECT ajuster_stock_cuisine(2, -1, ''erreur'')', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : correction Jus 19 → 18 (une bouteille cassée)', 'SELECT ajuster_stock_cuisine(2, 18, ''bouteille cassée'')', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('cuisine', 'entrée : Riz 7 → 12 une seule fois, prix 1 600 F',
  'SELECT 1 FROM stock_cuisine WHERE produit_cuisine_id = 1 AND quantite_disponible = 12 AND prix_vente = 1600 AND (SELECT count(*) FROM mouvements_stock_cuisine WHERE produit_cuisine_id = 1 AND type_mouvement = ''entree'') = 1', 'lignes=1');
SELECT tests.verifier('cuisine', 'entrée : ligne de stock créée pour « Sans stock »', 'SELECT 1 FROM stock_cuisine WHERE produit_cuisine_id = 3 AND quantite_disponible = 4', 'lignes=1');
SELECT tests.verifier('cuisine', 'correction : tracée avec le motif, par le gérant',
  format('SELECT 1 FROM mouvements_stock_cuisine WHERE produit_cuisine_id = 2 AND type_mouvement = ''ajustement'' AND quantite = 1 AND quantite_avant = 19 AND quantite_apres = 18 AND raison = ''bouteille cassée'' AND utilisateur_id = %L', :'uid_chef'), 'lignes=1');

-- ============ D. Annulation (gérants, motif, 7 jours) ============
INSERT INTO ventes_cuisine (numero_ticket, vendeur_id, total, montant_donne, created_at) VALUES ('C-VIEILLE', :'uid_cuis', 600, 600, now() - interval '9 days');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT tests.verifier('cuisine', 'cuisine : annulation refusée', format('SELECT annuler_vente_cuisine(%s, ''le client a changé d''''avis'')', :'v1'::jsonb ->> 'id'), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('cuisine', 'gérant : motif trop court refusé', format('SELECT annuler_vente_cuisine(%s, ''erreur'')', :'v1'::jsonb ->> 'id'), 'erreur');
SELECT tests.verifier('cuisine', 'gérant : vente de plus de 7 jours non annulable', 'SELECT annuler_vente_cuisine((SELECT id FROM ventes_cuisine WHERE numero_ticket = ''C-VIEILLE''), ''le client a rendu le plat'')', 'erreur');
SELECT tests.verifier('cuisine', 'gérant : annulation de la vente de 5 100 F', format('SELECT annuler_vente_cuisine(%s, ''le client a rendu le plat'')', :'v1'::jsonb ->> 'id'), 'lignes=1');
SELECT tests.verifier('cuisine', 'gérant : seconde annulation refusée', format('SELECT annuler_vente_cuisine(%s, ''le client a rendu le plat'')', :'v1'::jsonb ->> 'id'), 'erreur');
RESET ROLE;
SELECT tests.verifier('cuisine', 'annulation : vente annulée, stock remis (Riz 15, vendu 0 ; Jus 19)',
  format('SELECT 1 WHERE (SELECT statut FROM ventes_cuisine WHERE id = %s) = ''annulee'' AND (SELECT quantite_disponible || ''/'' || quantite_vendue FROM stock_cuisine WHERE produit_cuisine_id = 1) = ''15.00/0.00'' AND (SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 2) = 19', :'v1'::jsonb ->> 'id'), 'lignes=1');
SELECT tests.verifier('cuisine', 'annulation : gardée avec motif, montant et auteur',
  format('SELECT 1 FROM annulations_ventes_cuisine WHERE vente_cuisine_id = %s AND montant = 5100 AND motif = ''le client a rendu le plat'' AND annule_par = %L', :'v1'::jsonb ->> 'id', :'uid_chef'), 'lignes=1');
SELECT tests.verifier('cuisine', 'annulation : effacement refusé', 'DELETE FROM annulations_ventes_cuisine', 'erreur');
SELECT tests.verifier('cuisine', 'historique : modification refusée (même en direct)', 'UPDATE mouvements_stock_cuisine SET quantite = 0', 'erreur');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT tests.verifier('cuisine', 'cuisine : lecture des annulations', 'SELECT 1 FROM annulations_ventes_cuisine', 'lignes=1');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('cuisine', 'boutique : pas de lecture des annulations cuisine', 'SELECT 1 FROM annulations_ventes_cuisine', 'lignes=0');
RESET ROLE;

-- ============ E. Caisse de la cuisine : clôture à l'aveugle ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CUIS, false);
-- 2 Jus à 600 F ; la vente annulée ne compte pas : attendu = 2 000 + 1 200
SELECT enregistrer_vente_cuisine('[{"id":2,"quantite":2}]', 1200) IS NOT NULL;
SELECT cloturer_caisse(3000) AS c1 \gset
SELECT cloturer_caisse(3200) AS c2 \gset
SELECT set_config('request.jwt.claims', :CHEF, false);
-- Vente du gérant sans caisse ouverte
SELECT enregistrer_vente_cuisine('[{"id":2,"quantite":1}]', 1000) IS NOT NULL;
RESET ROLE;
SELECT tests.verifier('cuisine', 'caisse cuisine : écart annoncé sans révéler l''attendu', format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''ecart'' AND NOT (%L::jsonb ? ''attendu'')', :'c1', :'c1'), 'lignes=1');
SELECT tests.verifier('cuisine', 'caisse cuisine : clôturée juste (fond 2 000 + ventes cuisine 1 200)',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''cloturee'' AND (%L::jsonb ->> ''attendu'')::numeric = 3200 AND (%L::jsonb ->> ''nombre_ventes'')::int = 1 AND (%L::jsonb ->> ''ecart'')::numeric = 0', :'c2', :'c2', :'c2', :'c2'), 'lignes=1');

-- ============ F. Récapitulatif (propriétaire) ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT recap_cuisine(current_date, current_date) AS r \gset
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('cuisine', 'gérant : pas de récapitulatif cuisine', 'SELECT recap_cuisine(current_date, current_date)', 'erreur');
SELECT set_config('request.jwt.claims', :CUIS, false);
SELECT tests.verifier('cuisine', 'cuisine : pas de récapitulatif', 'SELECT recap_cuisine(current_date, current_date)', 'erreur');
RESET ROLE;
SELECT tests.verifier('cuisine', 'récap : 2 ventes valides pour 1 800 F (la vente annulée exclue)',
  format('SELECT 1 WHERE (%L::jsonb -> ''ventes'' ->> ''nombre'')::int = 2 AND (%L::jsonb -> ''ventes'' ->> ''total'')::numeric = 1800', :'r', :'r'), 'lignes=1');
SELECT tests.verifier('cuisine', 'récap : l''annulation avec son motif et son auteur',
  format('SELECT 1 WHERE %L::jsonb -> ''annulations'' @> ''[{"montant":5100,"motif":"le client a rendu le plat","annule_par":"Chef Admin (chef)"}]''', :'r'), 'lignes=1');
SELECT tests.verifier('cuisine', 'récap : la correction de stock avec son motif',
  format('SELECT 1 WHERE %L::jsonb -> ''mouvements'' @> ''[{"type":"ajustement","produit":"Jus","motif":"bouteille cassée","par":"Chef Admin (chef)"}]''', :'r'), 'lignes=1');
SELECT tests.verifier('cuisine', 'récap : la vente du gérant faite sans caisse ouverte',
  format('SELECT 1 WHERE %L::jsonb -> ''hors_caisse'' = ''[{"vendeur":"Chef Admin (chef)","nombre":1,"total":600.00}]''', :'r'), 'lignes=1');

-- ============ G. Cohérence ============
SELECT tests.verifier('cuisine', 'cohérence : chaque stock égale le dernier « après » de son historique',
  'SELECT 1 FROM stock_cuisine s WHERE s.quantite_disponible IS DISTINCT FROM (SELECT m.quantite_apres FROM mouvements_stock_cuisine m WHERE m.produit_cuisine_id = s.produit_cuisine_id ORDER BY m.id DESC LIMIT 1) AND EXISTS (SELECT 1 FROM mouvements_stock_cuisine m WHERE m.produit_cuisine_id = s.produit_cuisine_id)', 'lignes=0');
