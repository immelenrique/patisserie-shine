# Banc d'essai des ventes atomiques : état production (phases 1-2, corrections) -> ventes_atomiques
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $S/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles; do $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
echo "état production reproduit (phases 1-2, corrections 1-2)"
$D -c "INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien')" >/dev/null
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/ventes_atomiques.sql >/dev/null || { echo "ECHEC ventes_atomiques"; exit 1; }; echo "ventes_atomiques appliqué"
# Données : un produit avec 1 seul article en boutique (produit 4), un produit sans prix (5), une vente de 9 jours
$D >/dev/null <<'SQL'
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (4, 'Tarte', 0, 10, 0, 1), (5, 'Sans prix', 0, 10, 0, 1);
INSERT INTO stock_boutique (produit_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (4, 1, 0, 2000), (5, 10, 0, NULL);
INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, created_at) VALUES ('V-VIEILLE', 500, 500, 0, 'c0000000-0000-4000-8000-000000000003', localtimestamp - interval '9 days');
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, 'Croissant', 1, 500, 500 FROM ventes WHERE numero_ticket = 'V-VIEILLE';
SQL
$D -f $S/23_tests_ventes.sql >/dev/null 2>/tmp/rls_err_v.txt || { echo "ECHEC scénario ventes"; cat /tmp/rls_err_v.txt; exit 1; }

echo "--- Concurrence 1 : deux caisses vendent la dernière tarte au même instant"
J='{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}'
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$J', true); SELECT enregistrer_vente_boutique('[{\"id\":4,\"quantite\":1}]', 2000) IS NOT NULL; SELECT pg_sleep(2); COMMIT;" > /tmp/caisse_a.txt 2>&1 ) &
sleep 0.5
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$J', true); SELECT enregistrer_vente_boutique('[{\"id\":4,\"quantite\":1}]', 2000) IS NOT NULL; COMMIT;" > /tmp/caisse_b.txt 2>&1 ) &
wait
echo "caisse A : $(grep -c '^t$' /tmp/caisse_a.txt) vente(s) / $(grep -o 'ERROR.*' /tmp/caisse_a.txt | head -1)"
echo "caisse B : $(grep -c '^t$' /tmp/caisse_b.txt) vente(s) / $(grep -o 'ERROR.*' /tmp/caisse_b.txt | head -1)"
$D -c "SELECT tests.verifier('ventes', 'concurrence : une seule vente de la dernière tarte', 'SELECT 1 FROM lignes_vente WHERE produit_id = 4', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('ventes', 'concurrence : stock jamais négatif', 'SELECT 1 FROM stock_boutique WHERE produit_id = 4 AND quantite_disponible - quantite_vendue = 0', 'lignes=1')" >/dev/null

echo "--- Concurrence 2 : deux annulations simultanées de la même vente"
VID=$($P -d shine_test -tA -c "BEGIN; SET LOCAL ROLE authenticated; SELECT 'cfg:' || set_config('request.jwt.claims', '$J', true); SELECT (enregistrer_vente_boutique('[{\"id\":2,\"quantite\":4}]', 5000))->>'id'; COMMIT;" | grep -E '^[0-9]+$')
echo "vente créée pour le test : $VID"
VENDU=$($D -tAc "SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2")
for c in a b; do
  ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE service_role; SELECT annuler_vente_boutique($VID, 'Double clic sur annuler', 'a0000000-0000-4000-8000-000000000001') IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > /tmp/annul_$c.txt 2>&1 ) &
done
wait
echo "annulation A : $(grep -c '^t$' /tmp/annul_a.txt) réussie(s) / $(grep -o 'ERROR.*' /tmp/annul_a.txt | head -1)"
echo "annulation B : $(grep -c '^t$' /tmp/annul_b.txt) réussie(s) / $(grep -o 'ERROR.*' /tmp/annul_b.txt | head -1)"
$D -c "SELECT tests.verifier('ventes', 'concurrence : stock rendu une seule fois', 'SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = $VENDU - 4', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('ventes', 'concurrence : une seule annulation enregistrée', 'SELECT 1 FROM annulations_ventes WHERE vente_id = $VID', 'lignes=1')" >/dev/null

echo "--- Non-régression : scénario complet de la phase 2"
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_v21.txt || { echo "ECHEC non-régression"; cat /tmp/rls_err_v21.txt; exit 1; }

echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
