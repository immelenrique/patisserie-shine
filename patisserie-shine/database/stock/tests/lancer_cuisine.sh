# Banc d'essai de la partie 10 (cuisine sécurisée) : état production (parties 1 à 9) -> partie 10 -> annulation.
# Passage 1 : annulation exacte, scénario, concurrence, annulation avec données.
# Passages 2 à 10 (bases neuves) : non-régression des parties précédentes avec la partie 10.
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
cuisine() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000015', 'cuisine@shine.local', '{"username":"cuisine","nom":"Cuisine"}');
UPDATE profiles SET role = 'employe_cuisine' WHERE username = 'cuisine';
INSERT INTO produits_cuisine (id, nom, prix_vente, actif) VALUES (1, 'Riz sauce', 1500, true), (2, 'Jus', 500, true), (3, 'Sans stock', 1000, true), (4, 'Ancien plat', 800, false);
INSERT INTO stock_cuisine (produit_cuisine_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (1, 10, 0, NULL), (2, 20, 0, 600), (4, 5, 0, 800);
SQL
}
partie10() {
  $D -f $M/partie10_cuisine.sql >/dev/null || { echo "ECHEC partie10_cuisine"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_8; partie9; cuisine; partie10; }
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
  python3 - "$1" /tmp/rejeu_p10.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" "$S/rejeu_26_production.sql" <<'PY'
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
  $D -f /tmp/rejeu_p10.sql >/dev/null 2>/tmp/err_p10.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p10.txt; exit 1; }
}

echo "=== Passage 1 : annulation exacte, scénario, concurrence, annulation avec données"
construire
comptes_recap
parties_2_8
partie9
cuisine
$D -tAc "select tests.photographier('avant')" >/dev/null
partie10
$D -f $M/partie10_annulation.sql >/dev/null || { echo "ECHEC annulation (base vide)"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
partie10
echo "partie 10 appliquée"
$D -f $S/34_tests_cuisine.sql >/dev/null 2>/tmp/err_p10_34.txt || { echo "ECHEC scénario cuisine"; cat /tmp/err_p10_34.txt; exit 1; }

CUI='{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000015"}'
echo "--- Concurrence : la même vente envoyée deux fois au même instant (même clé)"
AVANT=$($D -tAc "SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 1")
NB=$($D -tAc "SELECT count(*) FROM ventes_cuisine")
E=$(en_meme_temps "$CUI" "enregistrer_vente_cuisine('[{\"id\":1,\"quantite\":1}]', 2000, '99999999-cccc-4ccc-8ccc-0000000000aa')")
$D -c "SELECT tests.verifier('cuisine', 'concurrence : une seule vente, stock retiré une fois ($E)', 'SELECT 1 WHERE (SELECT count(*) FROM ventes_cuisine) = $NB + 1 AND (SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 1) = $AVANT - 1 AND $E = 0', 'lignes=1')" >/dev/null
echo "--- Concurrence : deux ventes différentes au même instant pour les 3 derniers « Sans stock »"
$D -c "UPDATE stock_cuisine SET quantite_disponible = 3 WHERE produit_cuisine_id = 3" >/dev/null 2>&1 || true
$D -tAc "SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 3" | grep -qx "3.00" || { echo "ECHEC préparation concurrence"; exit 1; }
E=$(en_meme_temps "$CUI" "enregistrer_vente_cuisine('[{\"id\":3,\"quantite\":2}]', 5000)")
$D -c "SELECT tests.verifier('cuisine', 'concurrence : une vente passe, l''autre refusée faute de stock ($E)', 'SELECT 1 WHERE (SELECT quantite_disponible FROM stock_cuisine WHERE produit_cuisine_id = 3) = 1 AND (SELECT count(*) FROM lignes_vente_cuisine WHERE produit_cuisine_id = 3) = 1 AND $E = 1', 'lignes=1')" >/dev/null

echo "--- Annulation avec des ventes, des annulations et des mouvements enregistrés"
$D -f $M/partie10_annulation.sql >/dev/null 2>&1 || { echo "ECHEC annulation (avec données)"; exit 1; }
$D -c "SELECT tests.verifier('annulation', 'fonctions et annulations supprimées ; ventes, stock et historique conservés', 'SELECT 1 WHERE to_regclass(''public.annulations_ventes_cuisine'') IS NULL AND to_regprocedure(''public.enregistrer_vente_cuisine(jsonb, numeric, uuid)'') IS NULL AND (SELECT count(*) FROM ventes_cuisine) = 6 AND (SELECT count(*) FROM ventes_cuisine WHERE statut = ''annulee'') = 1 AND (SELECT count(*) FROM mouvements_stock_cuisine) >= 9', 'lignes=1')" >/dev/null
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$CUI', true); SELECT tests.verifier('annulation', 'la cuisine écrit de nouveau directement comme avant', 'UPDATE stock_cuisine SET quantite_disponible = quantite_disponible WHERE produit_cuisine_id = 1', 'lignes=1'); COMMIT;" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » sur base vide (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression (circuit, ventes, idempotence, sécurité) avec la partie 10"
base_neuve
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/;s/'production vers boutique (déclencheurs sans EXECUTE)', \(.*\), 'lignes=1');/'production directe fermée (declarer_production)', \1, 'erreur');/;s/'déclencheur : production en boutique', \(.*\), 'lignes=1');/'aucune entrée en boutique par production directe', \1, 'lignes=0');/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 : stock (partie 2)"
base_neuve
rejouer $S/26_tests_stock.sql stock stock_p10 creation,production
resultats

echo
echo "=== Passage 4 : récapitulatif (partie 3)"
base_neuve
python3 - "$S/27_tests_recap.sql" /tmp/27_p10.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_p10'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_p10.sql >/dev/null 2>/tmp/err_p10_27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_p10_27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 : achats (partie 4)"
base_neuve
rejouer $S/28_tests_achats.sql achats achats_p10 tout
resultats

echo
echo "=== Passage 6 : caisse (partie 5)"
base_neuve
rejouer $S/29_tests_caisse.sql caisse caisse_p10
resultats

echo
echo "=== Passage 7 : magasinier (partie 6)"
base_neuve
rejouer $S/30_tests_magasinier.sql magasin magasin_p10
resultats

echo
echo "=== Passage 8 : achats réservés (partie 7)"
base_neuve
rejouer $S/31_tests_achats_reserves.sql reserve reserve_p10
resultats

echo
echo "=== Passage 9 : inventaires et pertes (partie 8)"
base_neuve
rejouer $S/32_tests_inventaires.sql inventaire inventaire_p10
resultats

echo
echo "=== Passage 10 : production par recette (partie 9)"
base_neuve
rejouer $S/33_tests_production.sql production production_p10
resultats
