-- Scénario de la partie 4 (phase = achats). Données : celles de lancer_achats.sh (parties 1 à 3 appliquées,
-- Farine 1 en kg, Sucre 3, Pain 6 ; comptes chef (gérant), proprietaire (super admin), vendeuse, prod).
\set ON_ERROR_STOP on
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set uid_chef 'a0000000-0000-4000-8000-000000000001'
\set uid_prod 'f0000000-0000-4000-8000-000000000011'
\set uid_vend 'c0000000-0000-4000-8000-000000000003'

-- ============ A. Un achat crée sa dépense, dans la même opération ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT reapprovisionner_produit(1, 10, 6000, current_date, '66666666-aaaa-4aaa-8aaa-000000000001') AS r1 \gset
SELECT reapprovisionner_produit(1, 10, 6000, current_date, '66666666-aaaa-4aaa-8aaa-000000000001') AS r1bis \gset
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT creer_produit('Levure', current_date, 2, 3000, 2, NULL, '66666666-aaaa-4aaa-8aaa-000000000002') AS c1 \gset
RESET ROLE;
SELECT (:'r1'::jsonb ->> 'depense_id')::integer AS dep_reappro, (:'c1'::jsonb ->> 'depense_id')::integer AS dep_creation \gset

SELECT tests.verifier('achats', 'réappro : dépense de 6 000 F, type réapprovisionnement, signée par le gérant',
  format('SELECT 1 FROM depenses_comptables WHERE id = %s AND montant = 6000 AND type_depense = ''reapprovisionnement_stock'' AND reference_produit_id = 1 AND utilisateur_id = %L AND date_depense = current_date AND pieces_jointes = ''[]''', :dep_reappro, :'uid_chef'), 'lignes=1');
SELECT tests.verifier('achats', 'réappro : dépense reliée à sa ligne « achat » du journal',
  format('SELECT 1 FROM depenses_comptables d JOIN journal_stock j ON j.id = d.achat_journal_id WHERE d.id = %s AND j.nature = ''achat'' AND j.quantite = 10 AND j.cle = ''66666666-aaaa-4aaa-8aaa-000000000001''', :dep_reappro), 'lignes=1');
SELECT tests.verifier('achats', 'réappro : même clé = même dépense, pas de seconde',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_enregistre'')::boolean AND (%L::jsonb ->> ''depense_id'')::integer = %s AND (SELECT count(*) FROM depenses_comptables WHERE reference_produit_id = 1 AND achat_journal_id IS NOT NULL) = 1', :'r1bis', :'r1bis', :dep_reappro), 'lignes=1');
SELECT tests.verifier('achats', 'création : dépense de 3 000 F, type achat, signée par la production',
  format('SELECT 1 FROM depenses_comptables WHERE id = %s AND montant = 3000 AND type_depense = ''achat_stock'' AND utilisateur_id = %L AND (details->>''quantite'')::numeric = 2 AND details->>''unite'' = ''Kilogramme''', :dep_creation, :'uid_prod'), 'lignes=1');
SELECT tests.verifier('achats', 'journal des dépenses : création notée pour les deux achats',
  format('SELECT 1 FROM journal_depenses WHERE action = ''creation'' AND depense_id IN (%s, %s) HAVING count(*) = 2', :dep_reappro, :dep_creation), 'lignes=1');

-- ============ B. La dépense d'un achat ne se modifie ni ne se supprime ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('achats', 'gérant : montant d''un achat non modifiable', format('UPDATE depenses_comptables SET montant = 1 WHERE id = %s', :dep_reappro), 'erreur');
SELECT tests.verifier('achats', 'gérant : date d''un achat non modifiable', format('UPDATE depenses_comptables SET date_depense = current_date - 40 WHERE id = %s', :dep_reappro), 'erreur');
SELECT tests.verifier('achats', 'gérant : dépense d''achat non supprimable', format('DELETE FROM depenses_comptables WHERE id = %s', :dep_reappro), 'erreur');
SELECT tests.verifier('achats', 'gérant : reçus d''un achat non modifiables directement', format('UPDATE depenses_comptables SET pieces_jointes = ''[{"chemin":"x"}]'' WHERE id = %s', :dep_reappro), 'erreur');
SELECT tests.verifier('achats', 'gérant : fausse dépense d''achat refusée',
  format('INSERT INTO depenses_comptables (type_depense, description, montant, utilisateur_id, achat_journal_id) VALUES (''achat_stock'', ''faux'', 1, auth.uid(), (SELECT max(id) FROM journal_stock))'), 'erreur');
SELECT tests.verifier('achats', 'gérant : description d''un achat modifiable (et tracée)', format('UPDATE depenses_comptables SET description = ''Farine du marché central'' WHERE id = %s', :dep_reappro), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('achats', 'journal des dépenses : modification de la description notée, avec l''avant',
  format('SELECT 1 FROM journal_depenses WHERE action = ''modification'' AND depense_id = %s AND champs = ARRAY[''description''] AND auteur_id = %L AND avant->>''description'' LIKE ''Achat Farine%%'' AND NOT recu_ajoute_seulement', :dep_reappro, :'uid_chef'), 'lignes=1');

-- ============ C. Ajouter un reçu ============
-- Fichiers déposés dans l'espace de stockage par leurs auteurs (ce que fait l'application avant joindre_recu)
INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES
 ('depenses-pieces-jointes', :'uid_chef' || '/achats/recu-farine.jpg', :'uid_chef', :'uid_chef'),
 ('depenses-pieces-jointes', :'uid_prod' || '/achats/recu-levure.jpg', :'uid_prod', :'uid_prod'),
 ('depenses-pieces-jointes', :'uid_vend' || '/achats/autre.jpg', :'uid_vend', :'uid_vend');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('achats', 'reçu : refusé à une caissière sur l''achat d''un autre',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L))', :dep_reappro, :'uid_vend' || '/achats/autre.jpg'), 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('achats', 'reçu : refusé à la production sur l''achat du gérant',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L))', :dep_reappro, :'uid_prod' || '/achats/recu-levure.jpg'), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('achats', 'reçu : le fichier d''un autre utilisateur refusé',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L))', :dep_reappro, :'uid_prod' || '/achats/recu-levure.jpg'), 'erreur');
SELECT tests.verifier('achats', 'reçu : fichier absent du stockage refusé',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L))', :dep_reappro, :'uid_chef' || '/achats/inexistant.jpg'), 'erreur');
SELECT tests.verifier('achats', 'reçu : accepté pour le gérant',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L, ''nom'', ''recu-farine.jpg'', ''type'', ''image/jpeg'', ''taille'', 120000))', :dep_reappro, :'uid_chef' || '/achats/recu-farine.jpg'), 'lignes=1');
SELECT tests.verifier('achats', 'reçu : même fichier envoyé deux fois, ajouté une fois',
  format('SELECT 1 WHERE jsonb_array_length(joindre_recu(%s, jsonb_build_object(''chemin'', %L))) = 1', :dep_reappro, :'uid_chef' || '/achats/recu-farine.jpg'), 'lignes=1');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('achats', 'reçu : la production l''ajoute à son propre achat',
  format('SELECT joindre_recu(%s, jsonb_build_object(''chemin'', %L, ''nom'', ''recu-levure.jpg''))', :dep_creation, :'uid_prod' || '/achats/recu-levure.jpg'), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('achats', 'reçu : enregistré avec son auteur et son nom',
  format('SELECT 1 FROM depenses_comptables WHERE id = %s AND jsonb_array_length(pieces_jointes) = 1 AND pieces_jointes->0->>''ajoute_par'' = %L AND pieces_jointes->0->>''nom'' = ''recu-farine.jpg''', :dep_reappro, :'uid_chef'), 'lignes=1');
SELECT tests.verifier('achats', 'journal des dépenses : l''ajout d''un reçu est noté comme tel',
  format('SELECT 1 FROM journal_depenses WHERE depense_id = %s AND action = ''modification'' AND recu_ajoute_seulement AND champs = ARRAY[''pieces_jointes'']', :dep_reappro), 'lignes=1');

-- ============ D. Dépenses ordinaires : modifiables, mais tout est tracé ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
INSERT INTO depenses_comptables (type_depense, description, montant, utilisateur_id, date_depense)
VALUES ('transport', 'Taxi livraison', 2000, auth.uid(), current_date) RETURNING id AS dep_taxi \gset
SELECT tests.verifier('achats', 'dépense ordinaire : montant modifiable', format('UPDATE depenses_comptables SET montant = 2500 WHERE id = %s', :dep_taxi), 'lignes=1');
SELECT tests.verifier('achats', 'dépense ordinaire : supprimable par un gérant', format('DELETE FROM depenses_comptables WHERE id = %s', :dep_taxi), 'lignes=1');
SELECT tests.verifier('achats', 'journal des dépenses : non modifiable', 'UPDATE journal_depenses SET action = ''creation''', 'erreur');
SELECT tests.verifier('achats', 'journal des dépenses : lisible par un gérant', 'SELECT 1 FROM journal_depenses', 'lignes>0');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('achats', 'journal des dépenses : illisible pour une caissière', 'SELECT 1 FROM journal_depenses', 'lignes=0');
SELECT tests.verifier('achats', 'journal des dépenses : écriture directe refusée', format('INSERT INTO journal_depenses (action, depense_id) VALUES (''creation'', %s)', :dep_taxi), 'erreur');
RESET ROLE;
SELECT tests.verifier('achats', 'journal des dépenses : montant changé puis suppression, avec l''état d''avant',
  format('SELECT 1 FROM journal_depenses WHERE depense_id = %s HAVING count(*) FILTER (WHERE action = ''modification'' AND champs = ARRAY[''montant''] AND (avant->>''montant'')::numeric = 2000) = 1 AND count(*) FILTER (WHERE action = ''suppression'' AND (avant->>''montant'')::numeric = 2500) = 1', :dep_taxi), 'lignes=1');

-- ============ E. Un achat sans reçu, un reçu supprimé du stockage ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT (reapprovisionner_produit(3, 5, 1500) ->> 'depense_id')::integer AS dep_sucre \gset
RESET ROLE;
DELETE FROM storage.objects WHERE name = :'uid_prod' || '/achats/recu-levure.jpg';

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT recap_periode(current_date, current_date) AS r \gset
RESET ROLE;
CREATE TEMP TABLE recap4 AS SELECT :'r'::jsonb AS r;
GRANT SELECT ON recap4 TO PUBLIC;
SELECT tests.verifier('achats', 'récap : les 3 achats du jour, 10 500 F',
  'SELECT 1 FROM recap4 WHERE jsonb_array_length(r->''achats'') = 3 AND (r->''chiffres''->>''achats'')::numeric = 10500', 'lignes=1');
SELECT tests.verifier('achats', 'récap : l''achat de sucre signalé sans reçu',
  format('SELECT 1 FROM recap4 WHERE jsonb_array_length(r->''alertes''->''achats_sans_recu'') = 1 AND (r->''alertes''->''achats_sans_recu''->0->>''depense_id'')::integer = %s AND (r->''chiffres''->>''achats_sans_recu'')::int = 1', :dep_sucre), 'lignes=1');
SELECT tests.verifier('achats', 'récap : le reçu supprimé du stockage est signalé',
  format('SELECT 1 FROM recap4 WHERE jsonb_array_length(r->''alertes''->''recus_disparus'') = 1 AND (r->''alertes''->''recus_disparus''->0->>''depense_id'')::integer = %s', :dep_creation), 'lignes=1');
SELECT tests.verifier('achats', 'récap : reçu présent pour la farine, absent pour la levure',
  format('SELECT 1 FROM recap4, jsonb_array_elements(r->''achats'') a WHERE ((a->>''depense_id'')::integer = %s AND (a->''recus''->0->>''present'')::boolean) OR ((a->>''depense_id'')::integer = %s AND NOT (a->''recus''->0->>''present'')::boolean) HAVING count(*) = 2', :dep_reappro, :dep_creation), 'lignes=1');
SELECT tests.verifier('achats', 'récap : description changée, montant changé et suppression signalés (pas les reçus)',
  format('SELECT 1 FROM recap4 WHERE (r->''chiffres''->>''depenses_modifiees'')::int = 3 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->''alertes''->''depenses_modifiees'') x WHERE x->''champs'' = ''["pieces_jointes"]'') AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->''alertes''->''depenses_modifiees'') x WHERE x->>''action'' = ''suppression'' AND (x->>''montant_avant'')::numeric = 2500 AND (x->>''depense_id'')::integer = %s)', :dep_taxi), 'lignes=1');
SELECT tests.verifier('achats', 'récap : total des dépenses = achats (la dépense supprimée ne compte plus)',
  'SELECT 1 FROM recap4 WHERE (r->''depenses''->>''total'')::numeric = 10500', 'lignes=1');
