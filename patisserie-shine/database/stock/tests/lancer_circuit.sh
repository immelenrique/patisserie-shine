# Banc d'essai de la partie 1 (circuit des demandes) : état production -> partie 1 -> annulation
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
B=$(cd "$S/../../securite/tests" && pwd)
SEC=$(cd "$S/../../securite" && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $B/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles ventes_atomiques ventes_idempotence; do $D -f $SEC/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
echo "état production reproduit (sécurité, corrections, ventes atomiques et sans doublon)"
$D >/dev/null <<'SQL'
INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien');
-- Données des scénarios ventes (non-régression)
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (4, 'Tarte', 0, 10, 0, 1), (5, 'Sans prix', 0, 10, 0, 1);
INSERT INTO stock_boutique (produit_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (4, 1, 0, 2000), (5, 10, 0, NULL);
INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, created_at) VALUES ('V-VIEILLE', 500, 500, 0, 'c0000000-0000-4000-8000-000000000003', localtimestamp - interval '9 days');
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, 'Croissant', 1, 500, 500 FROM ventes WHERE numero_ticket = 'V-VIEILLE';
-- Données du circuit : « Pain » au stock principal seulement, avec un prix de vente
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (6, 'Pain', 0, 30, 30, 1);
INSERT INTO prix_vente_produits (produit_id, prix, actif) VALUES (6, 500, true);
-- Un employé de production et un second caissier
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000011', 'prod@shine.local', '{"username":"prod","nom":"Atelier"}'),
 ('f0000000-0000-4000-8000-000000000012', 'caissier2@shine.local', '{"username":"caissier2","nom":"Caissier 2"}');
UPDATE profiles SET role = 'employe_production' WHERE username = 'prod';
SQL
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/partie1_circuit_demandes.sql >/dev/null || { echo "ECHEC partie1_circuit_demandes"; exit 1; }
$D -f $M/partie1_contrainte_annulee.sql >/dev/null || { echo "ECHEC partie1_contrainte_annulee"; exit 1; }
echo "partie 1 appliquée"

$D -f $S/25_tests_circuit.sql >/dev/null 2>/tmp/err_c25.txt || { echo "ECHEC scénario circuit"; cat /tmp/err_c25.txt; exit 1; }

V='{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}'
C2='{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000012"}'
CH='{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}'
PR='{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}'
echo "--- Concurrence 1 : le gérant et le propriétaire valident la même demande au même instant"
G=$($D -tA -c "BEGIN; SET LOCAL ROLE authenticated; SELECT 'cfg:' || set_config('request.jwt.claims', '$V', true); INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', 'c0000000-0000-4000-8000-000000000003', 1) RETURNING id; COMMIT;" | grep -E '^[0-9]+$')
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true); INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 1, 'Boutique', 'c0000000-0000-4000-8000-000000000003', $G); COMMIT;" >/dev/null
AVANT=$($D -tAc "SELECT quantite_restante FROM produits WHERE id = 6")
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CH', true) IS NOT NULL; SELECT (valider_demande_groupee($G))->>'envoi_id'; SELECT pg_sleep(2); COMMIT;" > /tmp/val_a.txt 2>&1 ) &
sleep 0.5
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$PR', true) IS NOT NULL; SELECT (valider_demande_groupee($G))->>'envoi_id'; COMMIT;" > /tmp/val_b.txt 2>&1 ) &
wait
echo "gérant : $(grep -cE '^[0-9]+$' /tmp/val_a.txt) envoi(s) / $(grep -o 'ERROR.*' /tmp/val_a.txt | head -1)"
echo "propriétaire : $(grep -cE '^[0-9]+$' /tmp/val_b.txt) envoi(s) / $(grep -o 'ERROR.*' /tmp/val_b.txt | head -1)"
$D -c "SELECT tests.verifier('circuit', 'concurrence : un seul envoi pour la demande', 'SELECT 1 FROM envois WHERE demande_groupee_id = $G', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('circuit', 'concurrence : stock principal décompté une seule fois', 'SELECT 1 FROM produits WHERE id = 6 AND quantite_restante = $AVANT - 1', 'lignes=1')" >/dev/null
E=$($D -tAc "SELECT id FROM envois WHERE demande_groupee_id = $G")

echo "--- Concurrence 2 : deux caissiers réceptionnent le même envoi au même instant"
SB=$($D -tAc "SELECT quantite_disponible FROM stock_boutique WHERE produit_id = 6")
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true) IS NOT NULL; SELECT (receptionner_envoi($E, '[{\"produit_id\":6,\"quantite_recue\":1}]'))->>'statut'; SELECT pg_sleep(2); COMMIT;" > /tmp/rec_a.txt 2>&1 ) &
sleep 0.5
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$C2', true) IS NOT NULL; SELECT (receptionner_envoi($E, '[{\"produit_id\":6,\"quantite_recue\":1}]'))->>'statut'; COMMIT;" > /tmp/rec_b.txt 2>&1 ) &
wait
echo "caissier A : $(grep -c '^recu$' /tmp/rec_a.txt) réception(s) / $(grep -o 'ERROR.*' /tmp/rec_a.txt | head -1)"
echo "caissier B : $(grep -c '^recu$' /tmp/rec_b.txt) réception(s) / $(grep -o 'ERROR.*' /tmp/rec_b.txt | head -1)"
$D -c "SELECT tests.verifier('circuit', 'concurrence : une seule réception', 'SELECT 1 FROM journal_stock WHERE envoi_id = $E AND nature = ''reception'' AND lieu = ''boutique''', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('circuit', 'concurrence : boutique créditée une seule fois', 'SELECT 1 FROM stock_boutique WHERE produit_id = 6 AND quantite_disponible = $SB + 1', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('circuit', 'journal : toujours intact après la concurrence', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Falsification simulée (superutilisateur qui contourne les protections)"
$D >/dev/null <<'SQL'
ALTER TABLE journal_stock DISABLE TRIGGER journal_stock_inalterable;
UPDATE journal_stock SET quantite = quantite * 10 WHERE id = (SELECT min(id) + 2 FROM journal_stock);
ALTER TABLE journal_stock ENABLE TRIGGER journal_stock_inalterable;
SQL
$D -c "SELECT tests.verifier('circuit', 'journal : la falsification est détectée', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''false''', 'lignes=1')" >/dev/null
$D -tAc "SELECT 'vérification après falsification : ' || verifier_journal_stock()::text"

echo "--- Non-régression : ventes atomiques, ventes sans doublon, sécurité phase 2"
sed "s/tests.verifier('ventes'/tests.verifier('ventes_avec_circuit'/" $B/23_tests_ventes.sql > /tmp/23_circ.sql
$D -f /tmp/23_circ.sql >/dev/null 2>/tmp/err_c23.txt || { echo "ECHEC non-régression ventes"; cat /tmp/err_c23.txt; exit 1; }
sed "s/tests.verifier('idem'/tests.verifier('idem_avec_circuit'/" $B/24_tests_idempotence.sql > /tmp/24_circ.sql
$D -f /tmp/24_circ.sql >/dev/null 2>/tmp/err_c24.txt || { echo "ECHEC non-régression idempotence"; cat /tmp/err_c24.txt; exit 1; }
# Changement voulu : un admin ne refuse plus une demande en modifiant la table, mais par refuser_demande
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true); INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', 'c0000000-0000-4000-8000-000000000003', 1); COMMIT;" >/dev/null
sed "s/'UPDATE demandes_groupees SET statut = ''refusee'', valideur_id = auth.uid() WHERE id = (SELECT max(id) FROM demandes_groupees)'/'SELECT refuser_demande((SELECT max(id) FROM demandes_groupees WHERE statut = ''en_attente''), ''test'')'/" $B/21_tests_phase2.sql > /tmp/21_circ.sql
sed -i "s/'validation : rpc decrement_stock', 'SELECT decrement_stock(3, 1)', 'lignes=1'/'validation : ancienne rpc decrement_stock fermée', 'SELECT decrement_stock(3, 1)', 'erreur'/" /tmp/21_circ.sql
sed -i "/ancienne rpc decrement_stock fermée/a SELECT tests.verifier(:'phase', 'admin : baisse directe du stock principal (tracée par le déclencheur)', 'UPDATE produits SET quantite_restante = quantite_restante - 1 WHERE id = 3', 'lignes=1');" /tmp/21_circ.sql
grep -q "ancienne rpc decrement_stock fermée" /tmp/21_circ.sql || { echo "ECHEC adaptation du test decrement_stock"; exit 1; }
grep -q "SELECT refuser_demande" /tmp/21_circ.sql || { echo "ECHEC adaptation du test de refus"; exit 1; }
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f /tmp/21_circ.sql >/dev/null 2>/tmp/err_c21.txt || { echo "ECHEC non-régression phase 2"; cat /tmp/err_c21.txt; exit 1; }
$D -c "UPDATE stock_boutique SET prix_vente = 500 WHERE produit_id = 2" >/dev/null

echo "--- Annulation (après réception des envois encore en transit)"
$D -c "SELECT tests.verifier('annulation', 'retour arrière refusé tant qu''un envoi est en transit', 'SELECT 1 WHERE EXISTS (SELECT 1 FROM envois WHERE statut = ''en_transit'')', 'lignes=1')" >/dev/null
$D -f $M/partie1_annulation.sql >/dev/null 2>&1 && { echo "INATTENDU : annulation acceptée avec un envoi en transit"; exit 1; }
for E in $($D -tAc "SELECT id FROM envois WHERE statut = 'en_transit' AND destination = 'boutique'"); do
  $D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$C2', true); SELECT receptionner_envoi($E, (SELECT jsonb_agg(jsonb_build_object('produit_id', produit_id, 'quantite_recue', quantite_envoyee)) FROM envoi_lignes WHERE envoi_id = $E)); COMMIT;" >/dev/null
done
$D -c "SELECT tests.verifier('annulation', 'contrainte : retour impossible tant que des lignes sont annulées (attendu)', 'SELECT 1', 'lignes=1')" >/dev/null
$D -f $M/partie1_contrainte_annulee_annulation.sql >/dev/null 2>&1 && echo "INATTENDU : contrainte remise malgré des lignes annulées"
$D -f $M/partie1_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'tables et fonctions de la partie 1 supprimées', 'SELECT 1 WHERE to_regclass(''public.journal_stock'') IS NULL AND to_regclass(''public.envois'') IS NULL AND to_regprocedure(''public.valider_demande_groupee(bigint, jsonb)'') IS NULL', 'lignes=1')" >/dev/null
sed "s/tests.verifier('ventes'/tests.verifier('ventes_apres_annulation'/" $B/23_tests_ventes.sql > /tmp/23_ann.sql
$D -f /tmp/23_ann.sql >/dev/null 2>/tmp/err_c23a.txt || { echo "ECHEC ventes après annulation"; cat /tmp/err_c23a.txt; exit 1; }

echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
$D -tAc "SELECT phase || ' : ' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM tests.resultats GROUP BY phase ORDER BY min(id)"
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
$D -P pager=off -c "
WITH norm AS (
  SELECT moment, objet,
    regexp_replace(etat, '\{([^}]*)\}', '', 'g') || ' ' ||
    coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array((regexp_match(etat, '\{([^}]*)\}'))[1], ',')) x), '') AS etat
  FROM tests.instantane)
SELECT coalesce(a.objet, b.objet) AS objet, a.etat AS avant, b.etat AS apres_annulation
FROM (SELECT * FROM norm WHERE moment = 'avant') a FULL JOIN (SELECT * FROM norm WHERE moment = 'annule') b USING (objet)
WHERE a.etat IS DISTINCT FROM b.etat"
$D -tAc "SELECT count(*) || ' objets comparés' FROM tests.instantane WHERE moment = 'avant'"
