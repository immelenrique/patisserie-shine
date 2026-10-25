# Banc d'essai de remise_a_zero.sql : base complète (parties 1 à 11) avec des données, sauvegarde, effacement,
# puis l'application doit refonctionner (achat, demande, envoi, vente, caisse).
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
base_neuve() { construire; comptes_recap; parties_2_8; partie9; cuisine; partie10; partie11; }
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
  python3 - "$1" /tmp/rejeu_p11.sql "$2" "$3" "${4:-}" "$UID_PROD" "$UID_MAG" "$S/rejeu_26_production.sql" <<'PY'
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
  $D -f /tmp/rejeu_p11.sql >/dev/null 2>/tmp/err_p11.txt || { echo "ECHEC rejeu $1"; cat /tmp/err_p11.txt; exit 1; }
}

SAUVEGARDE=$(cat <<'SQL'
CREATE SCHEMA sauvegarde_20261025;
CREATE TABLE sauvegarde_20261025.inventaire (table_nom text PRIMARY KEY, lignes bigint NOT NULL, copie_le timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t record; n bigint; BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE ns.nspname = 'public' AND c.relkind = 'r' LOOP
    EXECUTE format('CREATE TABLE sauvegarde_20261025.%I AS TABLE public.%I', t.relname, t.relname);
    EXECUTE format('SELECT count(*) FROM sauvegarde_20261025.%I', t.relname) INTO n;
    INSERT INTO sauvegarde_20261025.inventaire (table_nom, lignes) VALUES (t.relname, n);
  END LOOP; END $$;
SQL
)

echo "=== 1. Sans sauvegarde : le script refuse et n'efface rien"
base_neuve
$D -f $S/34_tests_cuisine.sql >/dev/null 2>&1
AVANT=$($D -tAc "SELECT count(*) FROM ventes")
$D -f $M/remise_a_zero.sql >/dev/null 2>/tmp/err_raz1.txt
$D -c "SELECT tests.verifier('raz', 'sans sauvegarde : refus, ventes intactes ($AVANT)', 'SELECT 1 WHERE (SELECT count(*) FROM ventes) = $AVANT AND $AVANT > 0', 'lignes=1')" >/dev/null
grep -q "Sauvegarde sauvegarde_20261025 absente" /tmp/err_raz1.txt && $D -c "SELECT tests.verifier('raz', 'message : sauvegarde absente', 'SELECT 1', 'lignes=1')" >/dev/null

echo "=== 2. Sauvegarde périmée (une vente de plus) : refus"
$D -c "$SAUVEGARDE" >/dev/null
$D -c "INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id) VALUES ('V-APRES', 1, 1, 0, 'c0000000-0000-4000-8000-000000000003')" >/dev/null
$D -f $M/remise_a_zero.sql >/dev/null 2>/tmp/err_raz2.txt
grep -q "plus que la sauvegarde" /tmp/err_raz2.txt && $D -c "SELECT tests.verifier('raz', 'sauvegarde périmée : refus, rien effacé', 'SELECT 1 WHERE (SELECT count(*) FROM ventes) = $AVANT + 1', 'lignes=1')" >/dev/null
$D -c "DROP SCHEMA sauvegarde_20261025 CASCADE" >/dev/null

echo "=== 3. Avec une sauvegarde à jour : tout est effacé sauf les comptes"
$D -c "$SAUVEGARDE" >/dev/null
COMPTES=$($D -tAc "SELECT count(*) FROM profiles")
$D -f $M/remise_a_zero.sql >/dev/null 2>/tmp/err_raz3.txt || { echo "ECHEC remise à zéro"; cat /tmp/err_raz3.txt; exit 1; }
$D >/dev/null <<SQL
SELECT tests.verifier('raz', 'ventes, stocks, produits, demandes, journaux : vides', 'SELECT 1 WHERE (SELECT count(*) FROM ventes) + (SELECT count(*) FROM lignes_vente) + (SELECT count(*) FROM produits) + (SELECT count(*) FROM stock_boutique) + (SELECT count(*) FROM stock_atelier) + (SELECT count(*) FROM stock_cuisine) + (SELECT count(*) FROM demandes_groupees) + (SELECT count(*) FROM journal_stock) + (SELECT count(*) FROM ventes_cuisine) + (SELECT count(*) FROM recettes) + (SELECT count(*) FROM notifications) = 0', 'lignes=1');
SELECT tests.verifier('raz', 'comptes gardés ($COMPTES) avec leur rôle', 'SELECT 1 WHERE (SELECT count(*) FROM profiles) = $COMPTES AND EXISTS (SELECT 1 FROM profiles WHERE role = ''magasinier'') AND (SELECT count(*) FROM unites) > 0', 'lignes=1');
SELECT tests.verifier('raz', 'protections remises : vidage du journal refusé', 'TRUNCATE journal_stock', 'erreur');
SELECT tests.verifier('raz', 'la sauvegarde contient toujours les ventes ($AVANT + 1)', 'SELECT 1 WHERE (SELECT count(*) FROM sauvegarde_20261025.ventes) = $AVANT + 1', 'lignes=1');
SELECT tests.verifier('raz', 'journal du stock intact (vide)', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
SQL

echo "=== 4. L'application refonctionne : achat, envoi à la boutique, vente en caisse, clôture"
$D >/dev/null <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}', false);
SELECT tests.verifier('raz', 'magasinier : nouveau produit acheté (id 1)', 'SELECT creer_produit(''Farine'', current_date, 50, 25000, 1, NULL, NULL)', 'lignes=1');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
SELECT tests.verifier('raz', 'boutique : demande', 'INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES (''Boutique'', auth.uid(), 1)', 'lignes=1');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT tests.verifier('raz', 'gérant : entrée en stock cuisine refusée sans produit', 'SELECT entree_stock_cuisine(1, 5)', 'erreur');
SELECT tests.verifier('raz', 'gérant : caisse ouverte', 'SELECT ouvrir_caisse(0)', 'lignes=1');
SELECT tests.verifier('raz', 'gérant : clôture juste à 0', 'SELECT 1 WHERE (cloturer_caisse(0))->>''statut'' = ''cloturee''', 'lignes=1');
RESET ROLE;
SELECT tests.verifier('raz', 'achat inscrit au journal, numéros repartis de 1', 'SELECT 1 WHERE (SELECT min(id) FROM produits) = 1 AND (SELECT count(*) FROM journal_stock) >= 1 AND (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
SQL
resultats
