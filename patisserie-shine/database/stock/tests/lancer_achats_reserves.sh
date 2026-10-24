# Banc d'essai de la partie 7 (achats réservés au magasinier, au propriétaire et aux gérants) :
# état production (parties 1 à 6) -> partie 7 -> annulation. Passages 2 à 7 (bases neuves) : non-régression
# des parties précédentes avec la partie 7 ; là où la production achetait, c'est désormais le magasinier.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"
UID_PROD=f0000000-0000-4000-8000-000000000011
UID_MAG=f0000000-0000-4000-8000-000000000014

comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}
parties_2_6() {
  for f in partie2_stock_principal partie3_recapitulatif partie4_achats_recus partie5_caisse partie6_magasinier; do
    $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }
  done
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000014', 'magasin@shine.local', '{"username":"magasin","nom":"Magasinier"}');
UPDATE profiles SET role = 'magasinier' WHERE username = 'magasin';
SQL
}
partie7() {
  $D -f $M/partie7_achats_reserves.sql >/dev/null || { echo "ECHEC partie7_achats_reserves"; exit 1; }
}
base_neuve() { construire; comptes_recap; parties_2_6; partie7; }
# Rejoue un ancien scénario ($1 = fichier, $2 = phase, $3 = nouvelle phase) ; $4 = « tout » pour faire
# acheter le magasinier à la place de la production dans tout le fichier
rejouer() {
  python3 - "$1" /tmp/rejeu_p7.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" <<'PY'
import sys
src, dst, phase, nouvelle, tout, prod, mag = sys.argv[1:8]
s = open(src).read().replace("tests.verifier('%s'" % phase, "tests.verifier('%s'" % nouvelle)
if tout == 'tout':
    # Toutes les actions de la production deviennent celles du magasinier (achats, reçus, refus)
    assert prod in s
    s = s.replace(prod, mag)
elif tout == 'creation':
    # 26 : seule la création du beurre était faite par la production
    a = "SELECT set_config('request.jwt.claims', :PROD, false);\nSELECT creer_produit('Beurre'"
    assert a in s
    s = s.replace(a, "SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"%s\"}', false);\nSELECT creer_produit('Beurre'" % mag)
    for b in ["AND created_by = %L AND actif', :beurre, :'uid_prod')", "AND auteur_id = %L', :beurre, :'uid_prod')"]:
        assert b in s
        s = s.replace(b, b.replace(":'uid_prod'", "'%s'" % mag))
open(dst, 'w').write(s)
PY
  $D -f /tmp/rejeu_p7.sql >/dev/null 2>/tmp/err_p7.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p7.txt; exit 1; }
}

echo "=== Passage 1 : scénario de la partie 7, annulation"
construire
comptes_recap
parties_2_6
$D -tAc "select tests.photographier('avant')" >/dev/null
partie7
echo "partie 7 appliquée"
$D -f $S/31_tests_achats_reserves.sql >/dev/null 2>/tmp/err_p7_31.txt || { echo "ECHEC scénario partie 7"; cat /tmp/err_p7_31.txt; exit 1; }
$D -f $M/partie7_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"$UID_PROD\"}', true); SELECT tests.verifier('annulation', 'la production peut de nouveau réapprovisionner', 'SELECT reapprovisionner_produit(1, 1, 100)', 'lignes=1'); COMMIT;" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression (circuit, ventes, idempotence, sécurité) avec la partie 7"
base_neuve
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 : stock (partie 2), le beurre acheté par le magasinier"
base_neuve
rejouer $S/26_tests_stock.sql stock stock_p7 creation
resultats

echo
echo "=== Passage 4 : récapitulatif (partie 3)"
base_neuve
python3 - "$S/27_tests_recap.sql" /tmp/27_p7.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_p7'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_p7.sql >/dev/null 2>/tmp/err_p7_27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_p7_27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 : achats (partie 4), achats et reçus du magasinier à la place de la production"
base_neuve
rejouer $S/28_tests_achats.sql achats achats_p7 tout
resultats

echo
echo "=== Passage 6 : caisse (partie 5)"
base_neuve
rejouer $S/29_tests_caisse.sql caisse caisse_p7
resultats

echo
echo "=== Passage 7 : magasinier (partie 6)"
base_neuve
rejouer $S/30_tests_magasinier.sql magasin magasin_p7
resultats
