# Banc d'essai de la partie 2 (stock principal) : état production (avec partie 1) -> partie 2 -> annulation.
# Passage 1 : scénario partie 2, concurrence, annulation exacte. Passage 2 (base neuve) : non-régression
# des parties précédentes avec la partie 2 appliquée.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"

echo "=== Passage 1 : scénario de la partie 2, concurrence, annulation"
construire
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
echo "partie 2 appliquée"
$D -f $S/26_tests_stock.sql >/dev/null 2>/tmp/err_s26.txt || { echo "ECHEC scénario stock"; cat /tmp/err_s26.txt; exit 1; }

echo "--- Concurrence : deux réapprovisionnements du pain au même instant (+10 chacun)"
AVANT=$($D -tAc "SELECT quantite_restante FROM produits WHERE id = 6")
for c in a b; do
  ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CH', true) IS NOT NULL; SELECT reapprovisionner_produit(6, 10, 5000) IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > /tmp/reap_$c.txt 2>&1 ) &
done
wait
$D -c "SELECT tests.verifier('stock', 'concurrence : aucun réapprovisionnement perdu (+20)', 'SELECT 1 FROM produits WHERE id = 6 AND quantite_restante = $AVANT + 20', 'lignes=1')" >/dev/null
echo "--- Concurrence : même clé envoyée deux fois au même instant (coupure, nouvel essai)"
AVANT=$($D -tAc "SELECT quantite_restante FROM produits WHERE id = 6")
for c in a b; do
  ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CH', true) IS NOT NULL; SELECT reapprovisionner_produit(6, 7, 3500, NULL, '55555555-eeee-4eee-8eee-000000000001') IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > /tmp/reapk_$c.txt 2>&1 ) &
done
wait
$D -c "SELECT tests.verifier('stock', 'concurrence : même clé = un seul réapprovisionnement (+7)', 'SELECT 1 FROM produits WHERE id = 6 AND quantite_restante = $AVANT + 7', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('stock', 'journal : intact après la concurrence', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation de la partie 2"
$D -f $M/partie2_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'fonctions et colonnes de la partie 2 supprimées', 'SELECT 1 WHERE to_regprocedure(''public.creer_produit(text, date, numeric, numeric, integer, numeric, uuid)'') IS NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ''produits'' AND column_name = ''actif'')', 'lignes=1')" >/dev/null
sed "s/tests.verifier('ventes'/tests.verifier('ventes_apres_annulation'/" $B/23_tests_ventes.sql > /tmp/23_sa.sql
$D -f /tmp/23_sa.sql >/dev/null 2>/tmp/err_s23a.txt || { echo "ECHEC ventes après annulation"; cat /tmp/err_s23a.txt; exit 1; }
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression des parties précédentes avec la partie 2"
construire
$D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
non_regression
resultats
