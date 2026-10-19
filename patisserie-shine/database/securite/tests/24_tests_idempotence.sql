-- Scénario ventes sans doublon (phase = idem). Données de départ posées par lancer_idempotence.sh.
\set ON_ERROR_STOP on
\set V '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set A '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set K1 '\'11111111-aaaa-4aaa-8aaa-000000000001\''
\set K2 '\'11111111-aaaa-4aaa-8aaa-000000000002\''
SELECT (SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2) AS vendu_avant, (SELECT count(*) FROM ventes) AS nb_avant \gset

-- 1. Premier envoi avec une clé : vente normale
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":2}]', 1000, :K1) AS r1 \gset
RESET ROLE;
SELECT tests.verifier('idem', 'premier envoi : vente créée, deja_enregistree = false',
  format('SELECT 1 WHERE (%L::jsonb)->>''deja_enregistree'' = ''false'' AND ((%L::jsonb)->>''total'')::numeric = 1000', :'r1', :'r1'), 'lignes=1');
SELECT tests.verifier('idem', 'premier envoi : clé enregistrée sur la vente',
  format('SELECT 1 FROM ventes WHERE id = %s AND cle_idempotence = %L', (:'r1'::jsonb)->>'id', :K1), 'lignes=1');
SELECT tests.verifier('idem', 'premier envoi : stock décompté de 2',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = %s + 2', :'vendu_avant'), 'lignes=1');

-- 2. Nouvel essai du même panier (réponse perdue) : la vente existante est rendue, rien n'est écrit
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":2}]', 1000, :K1) AS r2 \gset
RESET ROLE;
SELECT tests.verifier('idem', 'nouvel essai : même vente rendue (même id, même ticket)',
  format('SELECT 1 WHERE (%L::jsonb)->>''id'' = (%L::jsonb)->>''id'' AND (%L::jsonb)->>''numero_ticket'' = (%L::jsonb)->>''numero_ticket''', :'r1', :'r2', :'r1', :'r2'), 'lignes=1');
SELECT tests.verifier('idem', 'nouvel essai : deja_enregistree = true',
  format('SELECT 1 WHERE (%L::jsonb)->>''deja_enregistree'' = ''true''', :'r2'), 'lignes=1');
SELECT tests.verifier('idem', 'nouvel essai : reçu identique (articles, total, monnaie)',
  format('SELECT 1 WHERE (%L::jsonb)->''items'' = (%L::jsonb)->''items'' AND (%L::jsonb)->>''total'' = (%L::jsonb)->>''total'' AND (%L::jsonb)->>''monnaie_rendue'' = (%L::jsonb)->>''monnaie_rendue''',
         :'r1', :'r2', :'r1', :'r2', :'r1', :'r2'), 'lignes=1');
SELECT tests.verifier('idem', 'nouvel essai : aucune vente en plus',
  format('SELECT 1 FROM ventes HAVING count(*) = %s + 1', :'nb_avant'), 'lignes=1');
SELECT tests.verifier('idem', 'nouvel essai : une seule ligne et une seule sortie',
  format('SELECT 1 WHERE (SELECT count(*) FROM lignes_vente WHERE vente_id = %1$s) = 1 AND (SELECT count(*) FROM sorties_boutique WHERE vente_id = %1$s) = 1', (:'r1'::jsonb)->>'id'), 'lignes=1');
SELECT tests.verifier('idem', 'nouvel essai : stock décompté une seule fois',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = %s + 2', :'vendu_avant'), 'lignes=1');

-- 3. La clé d'un vendeur ne donne pas accès à sa vente pour un autre
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :A, false);
SELECT tests.verifier('idem', 'autre vendeur, même clé : refusé', format('SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":2}]'', 1000, %L)', :K1), 'erreur');
RESET ROLE;

-- 4. Un refus ne « consomme » pas la clé : le panier corrigé passe avec la même clé
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT tests.verifier('idem', 'refus avec clé (stock insuffisant)', format('SELECT enregistrer_vente_boutique(''[{"id":4,"quantite":5}]'', 100000, %L)', :K2), 'erreur');
SELECT tests.verifier('idem', 'même clé après refus : vente créée', format('SELECT 1 WHERE (enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 500, %L))->>''deja_enregistree'' = ''false''', :K2), 'lignes=1');
RESET ROLE;

-- 5. Sans clé (NULL) : comportement d'avant, deux envois = deux ventes
SELECT count(*) AS nb_sans_cle FROM ventes \gset
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :V, false);
SELECT tests.verifier('idem', 'sans clé : premier envoi', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 500, NULL)', 'lignes=1');
SELECT tests.verifier('idem', 'sans clé : second envoi', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 500, NULL)', 'lignes=1');
SELECT tests.verifier('idem', 'ancienne version (2 paramètres) toujours utilisable', 'SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 500)', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('idem', 'sans clé : trois ventes distinctes, clé vide',
  format('SELECT 1 FROM ventes WHERE id > (SELECT max(id) FROM ventes) - 3 AND cle_idempotence IS NULL HAVING count(*) = 3 AND (SELECT count(*) FROM ventes) = %s + 3', :'nb_sans_cle'), 'lignes=1');

-- 6. Droits
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tests.verifier('idem', 'visiteur : vente avec clé refusée', format('SELECT enregistrer_vente_boutique(''[{"id":2,"quantite":1}]'', 1000, %L)', :K1), 'erreur');
RESET ROLE;
SELECT tests.verifier('idem', 'droits : PUBLIC et anon sans EXECUTE sur la version 3 paramètres',
  'SELECT 1 WHERE NOT has_function_privilege(''anon'', ''public.enregistrer_vente_boutique(jsonb, numeric, uuid)'', ''EXECUTE'') AND has_function_privilege(''authenticated'', ''public.enregistrer_vente_boutique(jsonb, numeric, uuid)'', ''EXECUTE'')', 'lignes=1');
SELECT tests.verifier('idem', 'base : deux ventes ne peuvent pas porter la même clé',
  format('INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, cle_idempotence) VALUES (''V-DOUBLE'', 1, 1, 0, ''c0000000-0000-4000-8000-000000000003'', %L)', :K1), 'erreur');
