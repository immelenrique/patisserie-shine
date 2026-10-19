-- Scénario du circuit des demandes (phase = circuit). Données posées par lancer_circuit.sh :
-- produit 6 « Pain » (30 au stock principal, prix boutique 500, pas encore en boutique), Farine (1) et
-- Sucre (3) au stock principal, Farine 20 à l'atelier ; comptes prod (production) et caissier2 (boutique).
\set ON_ERROR_STOP on
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CAIS2 '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000012"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set ANCIEN '\'{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}\''
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'

-- ============ A. Création d'une demande par la vendeuse ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits, statut, valideur_id)
VALUES ('Boutique', :'uid_vend', 1, 'validee', :'uid_vend') RETURNING id AS g1 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id, statut)
VALUES (6, 10, 'Boutique', :'uid_chef', :g1, 'validee');
RESET ROLE;
SELECT tests.verifier('circuit', 'création : statut forcé en attente, sans valideur (groupe et ligne)',
  format('SELECT 1 FROM demandes_groupees g JOIN demandes d ON d.demande_groupee_id = g.id WHERE g.id = %s AND g.statut = ''en_attente'' AND g.valideur_id IS NULL AND d.statut = ''en_attente'' AND d.demandeur_id = %L', :g1, :'uid_vend'), 'lignes=1');

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CAIS2, false);
SELECT tests.verifier('circuit', 'création : ajout d''une ligne dans la demande d''un autre refusé',
  format('INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (1, 1, ''Boutique'', %L, %s)', 'f0000000-0000-4000-8000-000000000012', :g1), 'erreur');

-- ============ B. Ce qu'un caissier ne peut pas faire ============
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'caissier : validation refusée', format('SELECT valider_demande_groupee(%s)', :g1), 'erreur');
SELECT tests.verifier('circuit', 'caissier : changement direct de statut sans effet', format('UPDATE demandes_groupees SET statut = ''validee'' WHERE id = %s', :g1), 'lignes=0');
SELECT tests.verifier('circuit', 'caissier : la demande est toujours en attente', format('SELECT 1 FROM demandes_groupees WHERE id = %s AND statut = ''en_attente''', :g1), 'lignes=1');
SELECT tests.verifier('circuit', 'caissier : modification directe d''une ligne refusée', format('UPDATE demandes SET quantite = 99 WHERE demande_groupee_id = %s', :g1), 'erreur');
SELECT tests.verifier('circuit', 'caissier : suppression d''une demande refusée', format('DELETE FROM demandes WHERE demande_groupee_id = %s', :g1), 'erreur');
SELECT tests.verifier('circuit', 'caissier : hausse directe du stock boutique refusée', 'UPDATE stock_boutique SET quantite_disponible = quantite_disponible + 100 WHERE produit_id = 2', 'erreur');
SELECT tests.verifier('circuit', 'caissier : création directe d''une ligne de stock boutique refusée', 'INSERT INTO stock_boutique (produit_id, quantite_disponible, prix_vente) VALUES (3, 50, 100)', 'erreur');
SELECT tests.verifier('circuit', 'caissier : suppression d''une ligne de stock boutique refusée', 'DELETE FROM stock_boutique WHERE produit_id = 2', 'erreur');
SELECT tests.verifier('circuit', 'caissier : stock atelier non modifiable', 'UPDATE stock_atelier SET quantite_disponible = 0 WHERE produit_id = 1', 'erreur');
SELECT tests.verifier('circuit', 'caissier : changement de prix toujours possible (hors quantité)', 'UPDATE stock_boutique SET statut_stock = statut_stock WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier('circuit', 'caissier : écriture directe dans le journal refusée',
  'INSERT INTO journal_stock (lieu, produit_id, quantite, nature, empreinte_precedente, empreinte) VALUES (''boutique'', 2, 5, ''reception'', ''x'', ''y'')', 'erreur');
SELECT tests.verifier('circuit', 'caissier : création directe d''un envoi refusée',
  'INSERT INTO envois (origine, destination, valideur_id, auto_validation) VALUES (''principal'', ''boutique'', auth.uid(), false)', 'erreur');
SELECT tests.verifier('circuit', 'caissier : journal non lisible', 'SELECT 1 FROM journal_stock', 'lignes=0');
SELECT set_config('request.jwt.claims', :ANCIEN, false);
SELECT tests.verifier('circuit', 'compte désactivé (admin) : validation refusée', format('SELECT valider_demande_groupee(%s)', :g1), 'erreur');
RESET ROLE;

-- ============ C. Validation par le gérant : stock principal décompté, marchandise en transit ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT valider_demande_groupee(:g1) AS v1 \gset
SELECT tests.verifier('circuit', 'validation : seconde validation refusée', format('SELECT valider_demande_groupee(%s)', :g1), 'erreur');
RESET ROLE;
SELECT (:'v1'::jsonb ->> 'envoi_id')::bigint AS e1 \gset
SELECT tests.verifier('circuit', 'validation : envoi en transit, non auto-validé',
  format('SELECT 1 FROM envois WHERE id = %s AND statut = ''en_transit'' AND origine = ''principal'' AND destination = ''boutique'' AND NOT auto_validation AND valideur_id = %L AND demandeur_id = %L', :e1, :'uid_chef', :'uid_vend'), 'lignes=1');
SELECT tests.verifier('circuit', 'validation : stock principal décompté (30 -> 20)', 'SELECT 1 FROM produits WHERE id = 6 AND quantite_restante = 20', 'lignes=1');
SELECT tests.verifier('circuit', 'validation : rien en boutique avant la réception', 'SELECT 1 FROM stock_boutique WHERE produit_id = 6', 'lignes=0');
SELECT tests.verifier('circuit', 'validation : demande et ligne validées par le gérant',
  format('SELECT 1 FROM demandes_groupees g JOIN demandes d ON d.demande_groupee_id = g.id WHERE g.id = %s AND g.statut = ''validee'' AND d.statut = ''validee'' AND g.valideur_id = %L AND (g.details_validation->>''envoi_id'')::bigint = %s', :g1, :'uid_chef', :e1), 'lignes=1');
SELECT tests.verifier('circuit', 'validation : journal principal -10 et transit +10, auteur le gérant',
  format('SELECT 1 FROM journal_stock WHERE envoi_id = %s AND nature = ''envoi'' AND auteur_id = %L HAVING count(*) = 2 AND sum(quantite) FILTER (WHERE lieu = ''principal'') = -10 AND sum(quantite) FILTER (WHERE lieu = ''transit'') = 10', :e1, :'uid_chef'), 'lignes=1');
SELECT tests.verifier('circuit', 'validation : mouvement du stock principal avec son auteur (plus anonyme)',
  format('SELECT 1 FROM mouvements_stock WHERE produit_id = 6 AND type_mouvement = ''sortie'' AND quantite = 10 AND utilisateur_id = %L', :'uid_chef'), 'lignes=1');
SELECT tests.verifier('circuit', 'validation : le demandeur est notifié',
  format('SELECT 1 FROM notifications WHERE destinataire_id = %L AND type = ''demande_validee''', :'uid_vend'), 'lignes>0');

-- ============ D. Réception comptée par la vendeuse, avec écart ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'réception : vendeuse voit l''envoi vers la boutique', format('SELECT 1 FROM envois WHERE id = %s', :e1), 'lignes=1');
SELECT receptionner_envoi(:e1, '[{"produit_id":6,"quantite_recue":9}]') AS r1 \gset
RESET ROLE;
SELECT tests.verifier('circuit', 'réception : écart signalé au premier comptage, rien écrit',
  format('SELECT 1 WHERE (%L::jsonb)->>''statut'' = ''ecarts'' AND ((%L::jsonb)->''ecarts''->0->>''quantite_envoyee'')::numeric = 10 AND NOT EXISTS (SELECT 1 FROM stock_boutique WHERE produit_id = 6) AND EXISTS (SELECT 1 FROM envois WHERE id = %s AND statut = ''en_transit'')', :'r1', :'r1', :e1), 'lignes=1');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'réception : écart confirmé sans motif refusé', format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":9}]'', true)', :e1), 'erreur');
SELECT tests.verifier('circuit', 'réception : produit manquant dans la saisie refusé', format('SELECT receptionner_envoi(%s, ''[]'', true)', :e1), 'erreur');
SELECT tests.verifier('circuit', 'réception : produit étranger à l''envoi refusé', format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":10},{"produit_id":1,"quantite_recue":1}]'', true)', :e1), 'erreur');
SELECT tests.verifier('circuit', 'réception : quantité négative refusée', format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":-1}]'', true)', :e1), 'erreur');
SELECT receptionner_envoi(:e1, '[{"produit_id":6,"quantite_recue":9,"motif":"1 pain écrasé pendant le transport"}]', true) AS r1b \gset
SELECT tests.verifier('circuit', 'réception : seconde réception refusée', format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":9,"motif":"bis"}]'', true)', :e1), 'erreur');
RESET ROLE;
SELECT tests.verifier('circuit', 'réception : envoi reçu, avec écart, par la vendeuse',
  format('SELECT 1 FROM envois WHERE id = %s AND statut = ''recu'' AND avec_ecart AND receptionnaire_id = %L AND recu_le IS NOT NULL', :e1, :'uid_vend'), 'lignes=1');
SELECT tests.verifier('circuit', 'réception : boutique créditée de la quantité comptée (9), au prix de la base',
  'SELECT 1 FROM stock_boutique WHERE produit_id = 6 AND quantite_disponible = 9 AND prix_vente = 500 AND type_produit = ''vendable''', 'lignes=1');
SELECT tests.verifier('circuit', 'réception : entrée boutique reliée à l''envoi',
  format('SELECT 1 FROM entrees_boutique WHERE produit_id = 6 AND quantite = 9 AND source_id = %s AND type_entree = ''Reception'' AND ajoute_par = %L', :e1, :'uid_vend'), 'lignes=1');
SELECT tests.verifier('circuit', 'réception : journal transit -10, boutique +9, écart 1 motivé',
  format('SELECT 1 FROM journal_stock WHERE envoi_id = %s AND nature IN (''reception'', ''ecart_reception'') HAVING sum(quantite) FILTER (WHERE lieu = ''transit'') = -10 AND sum(quantite) FILTER (WHERE lieu = ''boutique'') = 9 AND sum(quantite) FILTER (WHERE lieu = ''ecart'' AND motif LIKE ''1 pain%%'') = 1', :e1), 'lignes=1');
SELECT tests.verifier('circuit', 'réception : écart noté sur la ligne', format('SELECT 1 FROM envoi_lignes WHERE envoi_id = %s AND quantite_recue = 9 AND motif_ecart IS NOT NULL', :e1), 'lignes=1');
SELECT tests.verifier('circuit', 'réception : admins prévenus de l''écart', 'SELECT 1 FROM notifications WHERE type = ''alerte_generale'' AND message LIKE ''Écart à la réception%%'' AND destinataire_id = ''a0000000-0000-4000-8000-000000000001''', 'lignes>0');

-- ============ E. Règle : demande validée par son auteur => réception par une autre personne ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_chef', 1) RETURNING id AS g2 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 5, 'Boutique', :'uid_chef', :g2);
SELECT (valider_demande_groupee(:g2)) ->> 'envoi_id' AS e2 \gset
SELECT tests.verifier('circuit', 'auto-validation : le gérant ne peut pas réceptionner sa propre demande',
  format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":5}]'', true)', :e2), 'erreur');
SELECT set_config('request.jwt.claims', :CAIS2, false);
SELECT tests.verifier('circuit', 'auto-validation : un autre caissier réceptionne',
  format('SELECT 1 WHERE (receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":5}]''))->>''statut'' = ''recu''', :e2), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('circuit', 'auto-validation : envoi marqué auto-validé', format('SELECT 1 FROM envois WHERE id = %s AND auto_validation AND NOT avec_ecart', :e2), 'lignes=1');
SELECT tests.verifier('circuit', 'auto-validation : boutique à 14 (9 + 5)', 'SELECT 1 FROM stock_boutique WHERE produit_id = 6 AND quantite_disponible = 14', 'lignes=1');

-- ============ F. Destination atelier ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Production', :'uid_chef', 1) RETURNING id AS g3 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (3, 4, 'Production', :'uid_chef', :g3);
SELECT (valider_demande_groupee(:g3)) ->> 'envoi_id' AS e3 \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'atelier : la vendeuse ne voit pas l''envoi vers l''atelier', format('SELECT 1 FROM envois WHERE id = %s', :e3), 'lignes=0');
SELECT tests.verifier('circuit', 'atelier : la vendeuse ne peut pas le réceptionner', format('SELECT receptionner_envoi(%s, ''[{"produit_id":3,"quantite_recue":4}]'', true)', :e3), 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('circuit', 'atelier : la production réceptionne',
  format('SELECT 1 WHERE (receptionner_envoi(%s, ''[{"produit_id":3,"quantite_recue":4}]''))->>''statut'' = ''recu''', :e3), 'lignes=1');
SELECT tests.verifier('circuit', 'atelier : la production ne peut pas valider', format('SELECT valider_demande_groupee(%s)', :g1), 'erreur');
RESET ROLE;
SELECT tests.verifier('circuit', 'atelier : stock atelier Sucre créé à 4, principal 40 -> 36',
  'SELECT 1 FROM stock_atelier sa JOIN produits p ON p.id = sa.produit_id WHERE sa.produit_id = 3 AND sa.quantite_disponible = 4 AND p.quantite_restante = 36', 'lignes=1');

-- ============ G. Refus ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g4 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (1, 5, 'Boutique', :'uid_vend', :g4);
SELECT tests.verifier('circuit', 'refus : refusé à un caissier', format('SELECT refuser_demande(%s, ''non'')', :g4), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('circuit', 'refus : accepté pour le gérant', format('SELECT refuser_demande(%s, ''Pas de farine en boutique'')', :g4), 'lignes=1');
SELECT tests.verifier('circuit', 'refus : validation après refus impossible', format('SELECT valider_demande_groupee(%s)', :g4), 'erreur');
RESET ROLE;
SELECT tests.verifier('circuit', 'refus : demande et ligne refusées avec la raison, stock inchangé (100)',
  format('SELECT 1 FROM demandes_groupees g JOIN demandes d ON d.demande_groupee_id = g.id JOIN produits p ON p.id = 1 WHERE g.id = %s AND g.statut = ''refusee'' AND d.statut = ''refusee'' AND g.details_validation->''refus''->>''raison'' = ''Pas de farine en boutique'' AND p.quantite_restante = 100', :g4), 'lignes=1');

-- ============ H. Validation partielle et contrôles des quantités ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 2) RETURNING id AS g5 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 6, 'Boutique', :'uid_vend', :g5), (1, 3, 'Boutique', :'uid_vend', :g5);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('circuit', 'partielle : plus que demandé refusé', format('SELECT valider_demande_groupee(%s, ''{"6": 99}'')', :g5), 'erreur');
SELECT tests.verifier('circuit', 'partielle : tout à zéro refusé (utiliser Refuser)', format('SELECT valider_demande_groupee(%s, ''{"6": 0, "1": 0}'')', :g5), 'erreur');
SELECT tests.verifier('circuit', 'partielle : 2 pains sur 6, farine exclue', format('SELECT valider_demande_groupee(%s, ''{"6": 2, "1": 0}'')', :g5), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('circuit', 'partielle : envoi d''une seule ligne (2 pains, 6 demandés)',
  format('SELECT 1 FROM envoi_lignes el JOIN envois e ON e.id = el.envoi_id WHERE e.demande_groupee_id = %s HAVING count(*) = 1 AND max(el.quantite_envoyee) = 2 AND max(el.quantite_demandee) = 6', :g5), 'lignes=1');
SELECT tests.verifier('circuit', 'partielle : ligne farine refusée, ligne pain validée',
  format('SELECT 1 FROM demandes WHERE demande_groupee_id = %s AND ((produit_id = 1 AND statut = ''refusee'') OR (produit_id = 6 AND statut = ''validee'')) HAVING count(*) = 2', :g5), 'lignes=1');
SELECT tests.verifier('circuit', 'partielle : stock principal pain 15 -> 13, farine inchangée', 'SELECT 1 FROM produits WHERE (id = 6 AND quantite_restante = 13) OR (id = 1 AND quantite_restante = 100) HAVING count(*) = 2', 'lignes=1');

-- Stock insuffisant : rien n'est écrit
SELECT count(*) AS nb_envois_avant FROM envois \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 2) RETURNING id AS g6 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (1, 1, 'Boutique', :'uid_vend', :g6), (6, 500, 'Boutique', :'uid_vend', :g6);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('circuit', 'insuffisant : validation refusée (500 pains)', format('SELECT valider_demande_groupee(%s)', :g6), 'erreur');
RESET ROLE;
SELECT tests.verifier('circuit', 'insuffisant : aucun envoi, aucun décompte, demande toujours en attente',
  format('SELECT 1 FROM demandes_groupees g, produits p1, produits p4 WHERE g.id = %s AND g.statut = ''en_attente'' AND p1.id = 1 AND p1.quantite_restante = 100 AND p4.id = 6 AND p4.quantite_restante = 13 AND (SELECT count(*) FROM envois) = %s', :g6, :nb_envois_avant), 'lignes=1');

-- ============ I. Annulation d'un envoi non reçu ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g7 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (3, 3, 'Boutique', :'uid_vend', :g7);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT (valider_demande_groupee(:g7)) ->> 'envoi_id' AS e7 \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'annulation : refusée à un caissier', format('SELECT annuler_envoi(%s, ''erreur de saisie'')', :e7), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('circuit', 'annulation : motif obligatoire', format('SELECT annuler_envoi(%s, '' '')', :e7), 'erreur');
SELECT tests.verifier('circuit', 'annulation : acceptée', format('SELECT annuler_envoi(%s, ''Erreur de saisie de la vendeuse'')', :e7), 'lignes=1');
SELECT tests.verifier('circuit', 'annulation : seconde annulation refusée', format('SELECT annuler_envoi(%s, ''Erreur de saisie'')', :e7), 'erreur');
SELECT tests.verifier('circuit', 'annulation : envoi reçu non annulable', format('SELECT annuler_envoi(%s, ''trop tard'')', :e1), 'erreur');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'annulation : réception d''un envoi annulé refusée', format('SELECT receptionner_envoi(%s, ''[{"produit_id":3,"quantite_recue":3}]'', true)', :e7), 'erreur');
RESET ROLE;
SELECT tests.verifier('circuit', 'annulation : sucre rendu exactement (36 -> 33 -> 36)', 'SELECT 1 FROM produits WHERE id = 3 AND quantite_restante = 36', 'lignes=1');
SELECT tests.verifier('circuit', 'annulation : envoi, demande et ligne annulés avec le motif',
  format('SELECT 1 FROM envois e JOIN demandes_groupees g ON g.id = e.demande_groupee_id JOIN demandes d ON d.demande_groupee_id = g.id WHERE e.id = %s AND e.statut = ''annule'' AND e.motif_annulation LIKE ''Erreur%%'' AND g.statut = ''annulee'' AND d.statut = ''annulee''', :e7), 'lignes=1');
SELECT tests.verifier('circuit', 'annulation : journal transit -3 et principal +3',
  format('SELECT 1 FROM journal_stock WHERE envoi_id = %s AND nature = ''annulation_envoi'' HAVING sum(quantite) FILTER (WHERE lieu = ''transit'') = -3 AND sum(quantite) FILTER (WHERE lieu = ''principal'') = 3', :e7), 'lignes=1');

-- ============ J. Envoi atelier -> boutique (sans validation : l'expéditeur ne réceptionne pas) ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT envoyer_atelier_vers_boutique('[{"produit_id":1,"quantite":5}]', '33333333-cccc-4ccc-8ccc-000000000001') AS a1 \gset
SELECT envoyer_atelier_vers_boutique('[{"produit_id":1,"quantite":5}]', '33333333-cccc-4ccc-8ccc-000000000001') AS a1bis \gset
SELECT tests.verifier('circuit', 'atelier->boutique : stock atelier insuffisant refusé', 'SELECT envoyer_atelier_vers_boutique(''[{"produit_id":1,"quantite":500}]'')', 'erreur');
SELECT tests.verifier('circuit', 'atelier->boutique : produit absent de l''atelier refusé', 'SELECT envoyer_atelier_vers_boutique(''[{"produit_id":6,"quantite":1}]'')', 'erreur');
SELECT tests.verifier('circuit', 'atelier->boutique : l''expéditeur ne peut pas réceptionner',
  format('SELECT receptionner_envoi(%s, ''[{"produit_id":1,"quantite_recue":5}]'', true)', (:'a1'::jsonb)->>'envoi_id'), 'erreur');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'atelier->boutique : un caissier ne peut pas envoyer depuis l''atelier', 'SELECT envoyer_atelier_vers_boutique(''[{"produit_id":1,"quantite":1}]'')', 'erreur');
SELECT tests.verifier('circuit', 'atelier->boutique : la vendeuse réceptionne',
  format('SELECT 1 WHERE (receptionner_envoi(%s, ''[{"produit_id":1,"quantite_recue":5}]''))->>''statut'' = ''recu''', (:'a1'::jsonb)->>'envoi_id'), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('circuit', 'atelier->boutique : même clé = même envoi (pas de double envoi)',
  format('SELECT 1 WHERE (%L::jsonb)->>''envoi_id'' = (%L::jsonb)->>''envoi_id'' AND (%L::jsonb)->>''deja_enregistre'' = ''true''', :'a1', :'a1bis', :'a1bis'), 'lignes=1');
SELECT tests.verifier('circuit', 'atelier->boutique : atelier 20 -> 15 (une seule fois), boutique farine 5',
  'SELECT 1 FROM stock_atelier sa JOIN stock_boutique sb ON sb.produit_id = sa.produit_id WHERE sa.produit_id = 1 AND sa.quantite_disponible = 15 AND sb.quantite_disponible = 5', 'lignes=1');

-- ============ K. Les ventes fonctionnent sur la marchandise réceptionnée ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'vente : 2 pains réceptionnés vendus', 'SELECT enregistrer_vente_boutique(''[{"id":6,"quantite":2}]'', 1000, NULL)', 'lignes=1');
SELECT tests.verifier('circuit', 'vente : impossible au-delà du stock réceptionné (14 - 2 = 12)', 'SELECT enregistrer_vente_boutique(''[{"id":6,"quantite":13}]'', 100000, NULL)', 'erreur');
RESET ROLE;

-- ============ L. Visibilité et journal ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('circuit', 'visibilité : la vendeuse ne voit aucun envoi vers l''atelier', 'SELECT 1 FROM envois WHERE destination = ''atelier''', 'lignes=0');
SELECT tests.verifier('circuit', 'journal : vérification refusée à un caissier', 'SELECT verifier_journal_stock()', 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('circuit', 'visibilité : la production voit ses envois atelier', 'SELECT 1 FROM envois WHERE destination = ''atelier'' OR origine = ''atelier''', 'lignes>0');
SELECT tests.verifier('circuit', 'visibilité : la production ne voit pas les envois principal -> boutique', 'SELECT 1 FROM envois WHERE origine = ''principal'' AND destination = ''boutique''', 'lignes=0');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('circuit', 'journal : intact selon la vérification',
  'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
SELECT tests.verifier('circuit', 'journal : lisible par le gérant', 'SELECT 1 FROM journal_stock', 'lignes>0');
RESET ROLE;
SELECT tests.verifier('circuit', 'journal : chaque envoi s''équilibre (somme nulle tous lieux confondus)',
  'SELECT envoi_id FROM journal_stock GROUP BY envoi_id HAVING sum(quantite) <> 0', 'lignes=0');
SELECT tests.verifier('circuit', 'journal : le stock principal du pain suit le journal (30 + somme = 13)',
  'SELECT 1 FROM produits p WHERE p.id = 6 AND 30 + (SELECT sum(quantite) FROM journal_stock WHERE lieu = ''principal'' AND produit_id = 6) = p.quantite_restante', 'lignes=1');
SELECT tests.verifier('circuit', 'journal : le transit égale les envois non reçus',
  'SELECT 1 WHERE coalesce((SELECT sum(quantite) FROM journal_stock WHERE lieu = ''transit''), 0) = coalesce((SELECT sum(el.quantite_envoyee) FROM envoi_lignes el JOIN envois e ON e.id = el.envoi_id WHERE e.statut = ''en_transit''), 0)', 'lignes=1');
SELECT tests.verifier('circuit', 'journal : modification impossible, même pour le serveur', 'UPDATE journal_stock SET quantite = 1000 WHERE id = (SELECT min(id) FROM journal_stock)', 'erreur');
SELECT tests.verifier('circuit', 'journal : suppression impossible, même pour le serveur', 'DELETE FROM journal_stock', 'erreur');
SELECT tests.verifier('circuit', 'journal : vidage impossible', 'TRUNCATE journal_stock', 'erreur');
SELECT tests.verifier('circuit', 'envois : suppression impossible', 'DELETE FROM envois', 'erreur');
SELECT tests.verifier('circuit', 'journal : heure et auteur imposés par la base (falsification ignorée)',
  'SELECT 1 FROM journal_stock WHERE auteur_id IS NULL AND nature = ''envoi'' AND cree_le < now() - interval ''1 hour''', 'lignes=0');
