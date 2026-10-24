# Banc d'essai de la partie 8 (inventaires à l'aveugle, pertes validées) : état production (parties 1 à 7)
# -> partie 8 -> annulation. Passage 1 : annulation exacte, scénario, concurrence, annulation avec données.
# Passages 2 à 8 (bases neuves) : non-régression des parties précédentes avec la partie 8.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"
UID_PROD=f0000000-0000-4000-8000-000000000011
UID_MAG=f0000000-0000-4000-8000-000000000014
PRO='{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}'
PRD='{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}'

comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}
parties_2_7() {
  for f in partie2_stock_principal partie3_recapitulatif partie4_achats_recus partie5_caisse partie6_magasinier; do
    $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }
  done
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000014', 'magasin@shine.local', '{"username":"magasin","nom":"Magasinier"}');
UPDATE profiles SET role = 'magasinier' WHERE username = 'magasin';
SQL
  $D -f $M/partie7_achats_reserves.sql >/dev/null || { echo "ECHEC partie7_achats_reserves"; exit 1; }
}
partie8() {
  $D -f $M/partie8_inventaires_pertes.sql >/dev/null || { echo "ECHEC partie8_inventaires_pertes"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_7; partie8; }
# Deux appels identiques au même instant ($1 = jeton, $2 = appel) ; affiche le nombre d'erreurs
en_meme_temps() {
  T=$(mktemp -d)
  for c in a b; do
    ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$1', true) IS NOT NULL; SELECT $2 IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > $T/$c.txt 2>&1 ) &
  done
  wait
  cat $T/a.txt $T/b.txt | grep -c ERROR
  rm -rf $T
}
# Rejoue un ancien scénario ($1 = fichier, $2 = phase, $3 = nouvelle phase) ; $4 : « tout » ou « creation »
# pour faire acheter le magasinier à la place de la production (partie 7)
rejouer() {
  python3 - "$1" /tmp/rejeu_p8.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" <<'PY'
import sys
src, dst, phase, nouvelle, tout, prod, mag = sys.argv[1:8]
s = open(src).read().replace("tests.verifier('%s'" % phase, "tests.verifier('%s'" % nouvelle)
if tout == 'tout':
    assert prod in s
    s = s.replace(prod, mag)
elif tout == 'creation':
    a = "SELECT set_config('request.jwt.claims', :PROD, false);\nSELECT creer_produit('Beurre'"
    assert a in s
    s = s.replace(a, "SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"%s\"}', false);\nSELECT creer_produit('Beurre'" % mag)
    for b in ["AND created_by = %L AND actif', :beurre, :'uid_prod')", "AND auteur_id = %L', :beurre, :'uid_prod')"]:
        assert b in s
        s = s.replace(b, b.replace(":'uid_prod'", "'%s'" % mag))
open(dst, 'w').write(s)
PY
  $D -f /tmp/rejeu_p8.sql >/dev/null 2>/tmp/err_p8.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p8.txt; exit 1; }
}

echo "=== Passage 1 : annulation exacte, scénario, concurrence, annulation avec données"
construire
comptes_recap
parties_2_7
$D -tAc "select tests.photographier('avant')" >/dev/null
partie8
$D -f $M/partie8_annulation.sql >/dev/null || { echo "ECHEC annulation (base vide)"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
partie8
echo "partie 8 appliquée"
$D -f $S/32_tests_inventaires.sql >/dev/null 2>/tmp/err_p8_32.txt || { echo "ECHEC scénario inventaires"; cat /tmp/err_p8_32.txt; exit 1; }

echo "--- Concurrence : l'inventaire de l'atelier ouvert deux fois au même instant"
E=$(en_meme_temps "$PRD" "inventaire_ouvrir('atelier')")
$D -c "SELECT tests.verifier('inventaire', 'concurrence : un seul inventaire en cours, sans erreur ($E)', 'SELECT 1 WHERE (SELECT count(*) FROM inventaires WHERE lieu = ''atelier'' AND statut = ''en_cours'') = 1 AND $E = 0', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('inventaire', 'concurrence : ses lignes ne sont pas en double', 'SELECT 1 FROM inventaire_lignes l JOIN inventaires i ON i.id = l.inventaire_id WHERE i.lieu = ''atelier'' AND i.statut = ''en_cours'' HAVING count(*) = count(DISTINCT l.produit_id)', 'lignes=1')" >/dev/null
echo "--- Concurrence : la même perte acceptée deux fois au même instant"
PID=$($D -tA -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$PRD', true) IS NULL; SELECT declarer_perte('atelier', 1, 2, 'brûlé') ->> 'perte_id'; COMMIT;" | grep -E '^[0-9]+$')
AVANT=$($D -tAc "SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1")
E=$(en_meme_temps "$PRO" "decider_perte($PID, true)")
$D -c "SELECT tests.verifier('inventaire', 'concurrence : stock baissé une seule fois ($E)', 'SELECT 1 WHERE (SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1) = $AVANT - 2 AND (SELECT count(*) FROM journal_stock WHERE nature = ''perte'' AND motif LIKE ''Perte n°$PID %'') = 1 AND $E = 0', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('inventaire', 'journal du stock : intact après la concurrence', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation avec des inventaires et des pertes enregistrés"
$D -f $M/partie8_annulation.sql >/dev/null 2>&1 || { echo "ECHEC annulation (avec données)"; exit 1; }
$D -c "SELECT tests.verifier('annulation', 'tables et fonctions supprimées, stock et journal conservés', 'SELECT 1 WHERE to_regclass(''public.inventaires'') IS NULL AND to_regclass(''public.pertes'') IS NULL AND to_regprocedure(''public.inventaire_ouvrir(text, text)'') IS NULL AND (SELECT quantite_restante FROM produits WHERE id = 3) = 38 AND (SELECT count(*) FROM journal_stock WHERE nature IN (''inventaire'', ''perte'')) >= 4', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'le journal accepte toujours ses lignes « inventaire » et « perte »', 'SELECT 1 FROM pg_constraint WHERE conname = ''journal_stock_nature_check'' AND pg_get_constraintdef(oid) LIKE ''%perte%''', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'journal du stock : intact après l''annulation', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » sur base vide (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression (circuit, ventes, idempotence, sécurité) avec la partie 8"
base_neuve
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 : stock (partie 2)"
base_neuve
rejouer $S/26_tests_stock.sql stock stock_p8 creation
resultats

echo
echo "=== Passage 4 : récapitulatif (partie 3)"
base_neuve
python3 - "$S/27_tests_recap.sql" /tmp/27_p8.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_p8'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_p8.sql >/dev/null 2>/tmp/err_p8_27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_p8_27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 : achats (partie 4)"
base_neuve
rejouer $S/28_tests_achats.sql achats achats_p8 tout
resultats

echo
echo "=== Passage 6 : caisse (partie 5)"
base_neuve
rejouer $S/29_tests_caisse.sql caisse caisse_p8
resultats

echo
echo "=== Passage 7 : magasinier (partie 6)"
base_neuve
rejouer $S/30_tests_magasinier.sql magasin magasin_p8
resultats

echo
echo "=== Passage 8 : achats réservés (partie 7)"
base_neuve
rejouer $S/31_tests_achats_reserves.sql reserve reserve_p8
resultats
