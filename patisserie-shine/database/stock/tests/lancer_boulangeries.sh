# Banc d'essai de la partie 12 (deux boulangeries) : état production (parties 1 à 11) -> partie 12 -> annulation.
# Passage 1 : annulation exacte, étanchéité entre les boulangeries, annulation avec données.
# Passages 2 à 12 (bases neuves) : non-régression de toutes les parties avec la partie 12 (tout à Ouagadougou).
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
partie11() {
  $D -f $M/partie11_truncate.sql >/dev/null || { echo "ECHEC partie11_truncate"; exit 1; }
}
partie12() {
  $D -f $M/partie12_boulangeries.sql >/dev/null || { echo "ECHEC partie12_boulangeries"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_8; partie9; cuisine; partie10; partie11; partie12; }
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
  python3 - "$1" /tmp/rejeu_p12.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" "$S/rejeu_26_production.sql" <<'PY'
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
  $D -f /tmp/rejeu_p12.sql >/dev/null 2>/tmp/err_p12.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p12.txt; exit 1; }
}

echo "=== Passage 1 : annulation exacte, étanchéité, annulation avec données"
construire
comptes_recap
parties_2_8
partie9
cuisine
partie10
partie11
$D -tAc "select tests.photographier('avant')" >/dev/null
partie12
$D -f $M/partie12_annulation.sql >/dev/null || { echo "ECHEC annulation (base vide)"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
partie12
echo "partie 12 appliquée"
$D -f $S/35_tests_boulangeries.sql >/dev/null 2>/tmp/err_p12_35.txt || { echo "ECHEC scénario boulangeries"; cat /tmp/err_p12_35.txt; exit 1; }
echo "--- Annulation refusée avec des données d'Abidjan"
$D -f $M/partie12_annulation.sql >/dev/null 2>/tmp/err_p12_ann.txt
grep -q "autre boulangerie" /tmp/err_p12_ann.txt && $D -c "SELECT tests.verifier('annulation', 'refusée tant qu''Abidjan a des données', 'SELECT 1 WHERE to_regclass(''public.boulangeries'') IS NOT NULL', 'lignes=1')" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » sur base vide (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression (circuit, ventes, idempotence, sécurité) avec la partie 12"
base_neuve
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/;s/'production vers boutique (déclencheurs sans EXECUTE)', \(.*\), 'lignes=1');/'production directe fermée (declarer_production)', \1, 'erreur');/;s/'déclencheur : production en boutique', \(.*\), 'lignes=1');/'aucune entrée en boutique par production directe', \1, 'lignes=0');/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 : stock (partie 2)"
base_neuve
rejouer $S/26_tests_stock.sql stock stock_p12 creation,production
resultats

echo
echo "=== Passage 4 : récapitulatif (partie 3)"
base_neuve
python3 - "$S/27_tests_recap.sql" /tmp/27_p12.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_p12'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_p12.sql >/dev/null 2>/tmp/err_p12_27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_p12_27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 : achats (partie 4)"
base_neuve
rejouer $S/28_tests_achats.sql achats achats_p12 tout
resultats

echo
echo "=== Passage 6 : caisse (partie 5)"
base_neuve
rejouer $S/29_tests_caisse.sql caisse caisse_p12
resultats

echo
echo "=== Passage 7 : magasinier (partie 6)"
base_neuve
rejouer $S/30_tests_magasinier.sql magasin magasin_p12
resultats

echo
echo "=== Passage 8 : achats réservés (partie 7)"
base_neuve
rejouer $S/31_tests_achats_reserves.sql reserve reserve_p12
resultats

echo
echo "=== Passage 9 : inventaires et pertes (partie 8)"
base_neuve
# Sans utilisateur, la base voit les deux boulangeries : le début du scénario se lit en propriétaire (Ouagadougou)
sed "/^SELECT inventaires_a_faire(true) AS retards/i SELECT set_config('request.jwt.claims', :PROPRIO, false);" $S/32_tests_inventaires.sql > /tmp/32_p12.sql
grep -q "PROPRIO, false);" /tmp/32_p12.sql || { echo "ECHEC adaptation 32"; exit 1; }
rejouer /tmp/32_p12.sql inventaire inventaire_p12
resultats

echo
echo "=== Passage 10 : production par recette (partie 9)"
base_neuve
rejouer $S/33_tests_production.sql production production_p12
resultats

echo
echo "=== Passage 11 : cuisine (partie 10)"
base_neuve
rejouer $S/34_tests_cuisine.sql cuisine cuisine_p12
resultats

echo
echo "=== Passage 12 : TRUNCATE retiré (partie 11)"
base_neuve
$D >/dev/null <<'SQL'
SELECT tests.verifier('truncate_p12', 'des tables avaient TRUNCATE avant (liste gardée)', 'SELECT 1 FROM partie11_truncate_retire WHERE table_nom <> ''(défaut)''', 'lignes>0');
SELECT tests.verifier('truncate_p12', 'plus aucune table vidable par un compte connecté ou anonyme', 'SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ''public'' AND (has_table_privilege(''authenticated'', c.oid, ''TRUNCATE'') OR has_table_privilege(''anon'', c.oid, ''TRUNCATE''))', 'lignes=0');
CREATE TABLE public.table_neuve_p11 (id int);
SELECT tests.verifier('truncate_p12', 'une table créée ensuite n''est pas vidable par un compte connecté', 'SELECT 1 WHERE has_table_privilege(''authenticated'', ''public.table_neuve_p11'', ''TRUNCATE'')', 'lignes=0');
DROP TABLE public.table_neuve_p11;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT tests.verifier('truncate_p12', 'gérant : vidage des ventes refusé', 'TRUNCATE ventes CASCADE', 'erreur');
SELECT tests.verifier('truncate_p12', 'gérant : vidage du stock cuisine refusé', 'TRUNCATE stock_cuisine CASCADE', 'erreur');
SELECT tests.verifier('truncate_p12', 'gérant : vidage des comptes refusé', 'TRUNCATE profiles CASCADE', 'erreur');
SELECT tests.verifier('truncate_p12', 'gérant : la lecture marche toujours', 'SELECT 1 FROM produits LIMIT 1', 'lignes=1');
SELECT tests.verifier('truncate_p12', 'la liste gardée n''est pas lisible par un compte connecté', 'SELECT 1 FROM partie11_truncate_retire', 'erreur');
RESET ROLE;
SELECT tests.verifier('truncate_p12', 'le service garde son droit', 'SELECT 1 WHERE has_table_privilege(''service_role'', ''public.ventes'', ''TRUNCATE'')', 'lignes=1');
SELECT tests.verifier('truncate_p12', 'les données sont intactes (ventes, stock cuisine)', 'SELECT 1 WHERE (SELECT count(*) FROM ventes) > 0 AND (SELECT count(*) FROM stock_cuisine) = 3', 'lignes=1');
SQL
resultats
