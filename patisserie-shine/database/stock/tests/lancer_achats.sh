# Banc d'essai de la partie 4 (achats et reçus) : état production (parties 1 à 3) -> partie 4 -> annulation.
# Passage 1 : scénario, concurrence, annulation exacte. Passages 2 à 4 (bases neuves) : non-régression des parties
# précédentes (circuit, ventes, sécurité, stock, récapitulatif) avec la partie 4 appliquée.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"
CHEF='{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}'

comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}
parties_2_3() {
  $D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
  $D -f $M/partie3_recapitulatif.sql >/dev/null || { echo "ECHEC partie3_recapitulatif"; exit 1; }
}

echo "=== Passage 1 : scénario de la partie 4, concurrence, annulation"
construire
comptes_recap
parties_2_3
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie4_achats_recus"; exit 1; }
echo "partie 4 appliquée"
$D -f $S/28_tests_achats.sql >/dev/null 2>/tmp/err_a28.txt || { echo "ECHEC scénario achats"; cat /tmp/err_a28.txt; exit 1; }

echo "--- Concurrence : même achat envoyé deux fois au même instant (coupure, nouvel essai)"
for c in a b; do
  ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CHEF', true) IS NOT NULL; SELECT reapprovisionner_produit(6, 4, 2000, NULL, '77777777-bbbb-4bbb-8bbb-000000000001') IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > /tmp/achat_$c.txt 2>&1 ) &
done
wait
$D -c "SELECT tests.verifier('achats', 'concurrence : une seule dépense pour le même achat', 'SELECT 1 FROM depenses_comptables d JOIN journal_stock j ON j.id = d.achat_journal_id WHERE j.cle = ''77777777-bbbb-4bbb-8bbb-000000000001'' HAVING count(*) = 1', 'lignes=1')" >/dev/null
echo "--- Concurrence : le même reçu joint deux fois au même instant"
DEP=$($D -tAc "SELECT d.id FROM depenses_comptables d JOIN journal_stock j ON j.id = d.achat_journal_id WHERE j.cle = '77777777-bbbb-4bbb-8bbb-000000000001'")
$D -c "INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ('depenses-pieces-jointes', 'a0000000-0000-4000-8000-000000000001/achats/pain.jpg', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001')" >/dev/null
for c in a b; do
  ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CHEF', true) IS NOT NULL; SELECT joindre_recu($DEP, '{\"chemin\":\"a0000000-0000-4000-8000-000000000001/achats/pain.jpg\"}') IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > /tmp/recu_$c.txt 2>&1 ) &
done
wait
$D -c "SELECT tests.verifier('achats', 'concurrence : le reçu n''est ajouté qu''une fois', 'SELECT 1 FROM depenses_comptables WHERE id = $DEP AND jsonb_array_length(pieces_jointes) = 1', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('achats', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation de la partie 4"
$D -f $M/partie4_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'objets de la partie 4 supprimés, dépenses conservées', 'SELECT 1 WHERE to_regprocedure(''public.joindre_recu(integer, jsonb)'') IS NULL AND to_regclass(''public.journal_depenses'') IS NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ''depenses_comptables'' AND column_name = ''achat_journal_id'') AND (SELECT count(*) FROM depenses_comptables WHERE type_depense IN (''achat_stock'', ''reapprovisionnement_stock'')) = 4', 'lignes=1')" >/dev/null
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"b0000000-0000-4000-8000-000000000002\"}', true); SELECT tests.verifier('annulation', 'récapitulatif de la partie 3 de nouveau en place et fonctionnel', 'SELECT 1 WHERE NOT (recap_periode(current_date, current_date) ? ''achats'')', 'lignes=1'); COMMIT;" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression des parties précédentes avec la partie 4"
construire
comptes_recap
parties_2_3
$D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie4_achats_recus"; exit 1; }
non_regression
resultats

echo
echo "=== Passage 3 (base neuve) : scénario du stock (partie 2) rejoué avec la partie 4"
construire
comptes_recap
parties_2_3
$D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie4_achats_recus"; exit 1; }
sed "s/tests.verifier('stock'/tests.verifier('stock_avec_achats'/" $S/26_tests_stock.sql > /tmp/26_a.sql
$D -f /tmp/26_a.sql >/dev/null 2>/tmp/err_a26.txt || { echo "ECHEC non-régression stock"; cat /tmp/err_a26.txt; exit 1; }
resultats

echo
echo "=== Passage 4 (base neuve) : récapitulatif de la partie 3 rejoué avec la partie 4"
construire
comptes_recap
parties_2_3
$D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie4_achats_recus"; exit 1; }
# Seul changement voulu : l'achat de 5 000 F du scénario est désormais une dépense (15 000 + 5 000)
python3 - "$S/27_tests_recap.sql" /tmp/27_a.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_avec_achats'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_a.sql >/dev/null 2>/tmp/err_a27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_a27.txt; exit 1; }
resultats
