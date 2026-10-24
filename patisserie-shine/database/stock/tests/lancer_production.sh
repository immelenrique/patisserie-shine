# Banc d'essai de la partie 9 (production par recette, recettes protégées) : état production (parties 1 à 8)
# -> partie 9 -> annulation. Passage 1 : annulation exacte, scénario, concurrence, annulation avec données.
# Passages 2 à 9 (bases neuves) : non-régression des parties précédentes avec la partie 9.
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
parties_2_8() {
  for f in partie2_stock_principal partie3_recapitulatif partie4_achats_recus partie5_caisse partie6_magasinier; do
    $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }
  done
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000014', 'magasin@shine.local', '{"username":"magasin","nom":"Magasinier"}');
UPDATE profiles SET role = 'magasinier' WHERE username = 'magasin';
SQL
  $D -f $M/partie7_achats_reserves.sql >/dev/null || { echo "ECHEC partie7_achats_reserves"; exit 1; }
  $D -f $M/partie8_inventaires_pertes.sql >/dev/null 2>&1 || { echo "ECHEC partie8_inventaires_pertes"; exit 1; }
}
partie9() {
  $D -f $M/partie9_production_recettes.sql >/dev/null || { echo "ECHEC partie9_production_recettes"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_8; partie9; }
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
  python3 - "$1" /tmp/rejeu_p9.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" "$S/rejeu_26_production.sql" <<'PY'
import sys
src, dst, phase, nouvelle, tout, prod, mag, j26 = sys.argv[1:9]
modes = tout.split(',')
s = open(src).read().replace("tests.verifier('%s'" % phase, "tests.verifier('%s'" % nouvelle)
if 'tout' in modes:
    assert prod in s
    s = s.replace(prod, mag)
if 'creation' in modes:
    a = "SELECT set_config('request.jwt.claims', :PROD, false);\nSELECT creer_produit('Beurre'"
    assert a in s
    s = s.replace(a, "SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"%s\"}', false);\nSELECT creer_produit('Beurre'" % mag)
    for b in ["AND created_by = %L AND actif', :beurre, :'uid_prod')", "AND auteur_id = %L', :beurre, :'uid_prod')"]:
        assert b in s
        s = s.replace(b, b.replace(":'uid_prod'", "'%s'" % mag))
if 'production' in modes:
    # 26 : la production directe en boutique (déclencheur) est refusée depuis la partie 9
    a = s.index('-- ============ J. Production envoyée en boutique')
    b = s.index('-- ============ K. Intégrité')
    s = s[:a] + open(j26).read().replace('@PHASE@', nouvelle) + s[b:]
open(dst, 'w').write(s)
PY
  $D -f /tmp/rejeu_p9.sql >/dev/null 2>/tmp/err_p9.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p9.txt; exit 1; }
}

echo "=== Passage 1 : annulation exacte, scénario, concurrence, annulation avec données"
construire
comptes_recap
parties_2_8
$D -tAc "select tests.photographier('avant')" >/dev/null
partie9
$D -f $M/partie9_annulation.sql >/dev/null || { echo "ECHEC annulation (base vide)"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
partie9
echo "partie 9 appliquée"
$D -f $S/33_tests_production.sql >/dev/null 2>/tmp/err_p9_33.txt || { echo "ECHEC scénario production"; cat /tmp/err_p9_33.txt; exit 1; }

echo "--- Concurrence : la même production envoyée deux fois au même instant (même clé)"
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"a0000000-0000-4000-8000-000000000001\"}', true); SELECT recette_enregistrer('Pain double', '[{\"produit_id\":1,\"quantite\":1}]', 10, 1, 1, 'Pain double'); COMMIT;" >/dev/null
AVANT=$($D -tAc "SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1")
E=$(en_meme_temps "$PRD" "declarer_production('Pain double', 1, 10, false, '99999999-ffff-4fff-8fff-0000000000aa')")
$D -c "SELECT tests.verifier('production', 'concurrence : une seule production, farine retirée une fois ($E)', 'SELECT 1 WHERE (SELECT count(*) FROM productions WHERE recette = ''Pain double'') = 1 AND (SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1) = $AVANT - 1 AND $E = 0', 'lignes=1')" >/dev/null
echo "--- Concurrence : deux productions différentes au même instant sur la même farine"
AVANT=$($D -tAc "SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1")
E=$(en_meme_temps "$PRD" "declarer_production('Pain double', 2, 20)")
$D -c "SELECT tests.verifier('production', 'concurrence : les deux retraits comptent (2 + 2 kg)', 'SELECT 1 WHERE (SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1) = $AVANT - 4 AND (SELECT count(*) FROM productions WHERE recette = ''Pain double'') = 3 AND $E = 0', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('production', 'journal du stock : intact après la concurrence', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation avec des productions et des recettes enregistrées"
$D -f $M/partie9_annulation.sql >/dev/null 2>&1 || { echo "ECHEC annulation (avec données)"; exit 1; }
$D -c "SELECT tests.verifier('annulation', 'fiches et historique supprimés ; productions, stock et journal conservés', 'SELECT 1 WHERE to_regclass(''public.recettes_fiches'') IS NULL AND to_regprocedure(''public.declarer_production(text, numeric, numeric, boolean, uuid)'') IS NULL AND (SELECT count(*) FROM productions) >= 5 AND (SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1) = 8.4 AND (SELECT (verifier_journal_stock())->>''intact'') = ''true''', 'lignes=1')" >/dev/null
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"f0000000-0000-4000-8000-000000000011\"}', true); SELECT tests.verifier('annulation', 'les recettes redeviennent modifiables comme avant', 'UPDATE recettes SET quantite_necessaire = quantite_necessaire WHERE nom_produit = ''Vieux gâteau''', 'lignes=1'); COMMIT;" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » sur base vide (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression (circuit, ventes, idempotence, sécurité) avec la partie 9"
base_neuve
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/;s/'production vers boutique (déclencheurs sans EXECUTE)', \(.*\), 'lignes=1');/'production directe fermée (declarer_production)', \1, 'erreur');/;s/'déclencheur : production en boutique', \(.*\), 'lignes=1');/'aucune entrée en boutique par production directe', \1, 'lignes=0');/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 : stock (partie 2)"
base_neuve
rejouer $S/26_tests_stock.sql stock stock_p9 creation,production
resultats

echo
echo "=== Passage 4 : récapitulatif (partie 3)"
base_neuve
python3 - "$S/27_tests_recap.sql" /tmp/27_p9.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_p9'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_p9.sql >/dev/null 2>/tmp/err_p9_27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_p9_27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 : achats (partie 4)"
base_neuve
rejouer $S/28_tests_achats.sql achats achats_p9 tout
resultats

echo
echo "=== Passage 6 : caisse (partie 5)"
base_neuve
rejouer $S/29_tests_caisse.sql caisse caisse_p9
resultats

echo
echo "=== Passage 7 : magasinier (partie 6)"
base_neuve
rejouer $S/30_tests_magasinier.sql magasin magasin_p9
resultats

echo
echo "=== Passage 8 : achats réservés (partie 7)"
base_neuve
rejouer $S/31_tests_achats_reserves.sql reserve reserve_p9
resultats

echo
echo "=== Passage 9 : inventaires et pertes (partie 8)"
base_neuve
rejouer $S/32_tests_inventaires.sql inventaire inventaire_p9
resultats
