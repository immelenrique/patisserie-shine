# Banc d'essai de la partie 5 (caisse) : état production (parties 1 à 4) -> partie 5 -> annulation.
# Passage 1 : scénario, concurrence, annulation exacte. Passages 2 à 5 (bases neuves) : non-régression des parties
# précédentes (circuit, ventes, sécurité, stock, récapitulatif, achats) avec la partie 5 appliquée.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"

comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}
parties_2_4() {
  $D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
  $D -f $M/partie3_recapitulatif.sql >/dev/null || { echo "ECHEC partie3_recapitulatif"; exit 1; }
  $D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie4_achats_recus"; exit 1; }
}
partie5() {
  $D -f $M/partie5_caisse.sql >/dev/null || { echo "ECHEC partie5_caisse"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_4; partie5; }
# Deux appels identiques au même instant, au nom de caissier2 (double appui, coupure puis nouvel essai)
en_meme_temps() {
  T=$(mktemp -d)
  for c in a b; do
    ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$C2', true) IS NOT NULL; SELECT $1 IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > $T/$c.txt 2>&1 ) &
  done
  wait
  cat $T/a.txt $T/b.txt | grep -c ERROR
  rm -rf $T
}

echo "=== Passage 1 : scénario de la partie 5, concurrence, annulation"
construire
comptes_recap
parties_2_4
$D -tAc "select tests.photographier('avant')" >/dev/null
partie5
echo "partie 5 appliquée"
$D -f $S/29_tests_caisse.sql >/dev/null 2>/tmp/err_c29.txt || { echo "ECHEC scénario caisse"; cat /tmp/err_c29.txt; exit 1; }

echo "--- Concurrence : deux ouvertures de caisse au même instant"
E=$(en_meme_temps "ouvrir_caisse(3000)")
$D -c "SELECT tests.verifier('caisse', 'concurrence : une seule caisse ouverte, sans erreur ($E erreur(s))', 'SELECT 1 FROM caisses_actives WHERE caissier_id = ''f0000000-0000-4000-8000-000000000012'' AND statut = ''ouverte'' HAVING count(*) = 1 AND $E = 0', 'lignes=1')" >/dev/null
echo "--- Concurrence : deux clôtures au même instant"
R=$($D -tAc "SELECT count(*) FROM releves_caisse WHERE caissier_id = 'f0000000-0000-4000-8000-000000000012'")
en_meme_temps "cloturer_caisse(3000)" >/dev/null
$D -c "SELECT tests.verifier('caisse', 'concurrence : un seul relevé de plus, caisse fermée', 'SELECT 1 WHERE (SELECT count(*) FROM releves_caisse WHERE caissier_id = ''f0000000-0000-4000-8000-000000000012'') = $R + 1 AND NOT EXISTS (SELECT 1 FROM caisses_actives WHERE caissier_id = ''f0000000-0000-4000-8000-000000000012'' AND statut = ''ouverte'')', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('caisse', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation de la partie 5"
$D -f $M/partie5_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'objets de la partie 5 supprimés, relevés conservés', 'SELECT 1 WHERE to_regprocedure(''public.ouvrir_caisse(numeric)'') IS NULL AND to_regprocedure(''public.cloturer_caisse(numeric, boolean, text)'') IS NULL AND to_regclass(''public.caisses_actives_une_ouverte'') IS NULL AND (SELECT count(*) FROM releves_caisse) >= 3', 'lignes=1')" >/dev/null
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"b0000000-0000-4000-8000-000000000002\"}', true); SELECT tests.verifier('annulation', 'récapitulatif de la partie 4 de nouveau en place et fonctionnel', 'SELECT 1 WHERE NOT (recap_periode(current_date, current_date) ? ''caisses'') AND (recap_periode(current_date, current_date) ? ''achats'')', 'lignes=1'); COMMIT;" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression des parties précédentes avec la partie 5"
base_neuve
# Changement voulu : l'arrêt de caisse ne s'écrit plus depuis le navigateur (cloturer_caisse le fait)
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 (base neuve) : scénario du stock (partie 2) rejoué avec la partie 5"
base_neuve
sed "s/tests.verifier('stock'/tests.verifier('stock_avec_caisse'/" $S/26_tests_stock.sql > /tmp/26_c.sql
$D -f /tmp/26_c.sql >/dev/null 2>/tmp/err_c26.txt || { echo "ECHEC non-régression stock"; cat /tmp/err_c26.txt; exit 1; }
resultats

echo
echo "=== Passage 4 (base neuve) : récapitulatif de la partie 3 rejoué avec les parties 4 et 5"
base_neuve
# Seul changement voulu (celui de la partie 4) : l'achat de 5 000 F du scénario est une dépense (15 000 + 5 000)
python3 - "$S/27_tests_recap.sql" /tmp/27_c.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_avec_caisse'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_c.sql >/dev/null 2>/tmp/err_c27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_c27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 (base neuve) : scénario des achats (partie 4) rejoué avec la partie 5"
base_neuve
sed "s/tests.verifier('achats'/tests.verifier('achats_avec_caisse'/" $S/28_tests_achats.sql > /tmp/28_c.sql
$D -f /tmp/28_c.sql >/dev/null 2>/tmp/err_c28.txt || { echo "ECHEC non-régression achats"; cat /tmp/err_c28.txt; exit 1; }
resultats
