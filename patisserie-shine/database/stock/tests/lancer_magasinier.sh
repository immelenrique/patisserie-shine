# Banc d'essai de la partie 6 (magasinier, achats confirmés) : état production (parties 1 à 5) -> partie 6 -> annulation.
# Passage 1 : scénario, concurrence, annulation exacte. Passages 2 à 6 (bases neuves) : non-régression des parties
# précédentes (circuit, ventes, sécurité, stock, récapitulatif, achats, caisse) avec la partie 6 appliquée.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"
MAG='{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}'
PRO='{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}'

comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}
parties_2_5() {
  for f in partie2_stock_principal partie3_recapitulatif partie4_achats_recus partie5_caisse; do
    $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }
  done
}
partie6() {
  $D -f $M/partie6_magasinier.sql >/dev/null || { echo "ECHEC partie6_magasinier"; exit 1; }
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000014', 'magasin@shine.local', '{"username":"magasin","nom":"Magasinier"}');
UPDATE profiles SET role = 'magasinier' WHERE username = 'magasin';
SQL
}
base_neuve() { construire; comptes_recap; parties_2_5; partie6; }
# Deux appels identiques au même instant (double appui, coupure puis nouvel essai) ; affiche le nombre d'erreurs
en_meme_temps() {
  T=$(mktemp -d)
  for c in a b; do
    ( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$1', true) IS NOT NULL; SELECT $2 IS NOT NULL; SELECT pg_sleep(1); COMMIT;" > $T/$c.txt 2>&1 ) &
  done
  wait
  cat $T/a.txt $T/b.txt | grep -c ERROR
  rm -rf $T
}

echo "=== Passage 1 : scénario de la partie 6, concurrence, annulation"
construire
comptes_recap
parties_2_5
$D -tAc "select tests.photographier('avant')" >/dev/null
partie6
echo "partie 6 appliquée"
$D -f $S/30_tests_magasinier.sql >/dev/null 2>/tmp/err_m30.txt || { echo "ECHEC scénario magasinier"; cat /tmp/err_m30.txt; exit 1; }

echo "--- Concurrence : la même demande validée deux fois au même instant par le magasinier"
G=$($D -tA -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true) IS NULL; INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', 'c0000000-0000-4000-8000-000000000003', 1) RETURNING id; COMMIT;" | grep -E '^[0-9]+$')
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true); INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 3, 'Boutique', 'c0000000-0000-4000-8000-000000000003', $G); COMMIT;" >/dev/null
AVANT=$($D -tAc "SELECT quantite_restante FROM produits WHERE id = 6")
E=$(en_meme_temps "$MAG" "valider_demande_groupee($G, NULL)")
$D -c "SELECT tests.verifier('magasin', 'concurrence : un seul envoi, stock décompté une fois ($E refus attendu)', 'SELECT 1 WHERE (SELECT count(*) FROM envois WHERE demande_groupee_id = $G) = 1 AND (SELECT quantite_restante FROM produits WHERE id = 6) = $AVANT - 3 AND $E = 1', 'lignes=1')" >/dev/null
echo "--- Concurrence : le même achat confirmé deux fois au même instant"
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$MAG', true); SELECT reapprovisionner_produit(1, 5, 4000, current_date, '88888888-cccc-4ccc-8ccc-000000000009'); COMMIT;" >/dev/null
DEP=$($D -tAc "SELECT min(id) FROM depenses_comptables d WHERE achat_journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM confirmations_achats c WHERE c.depense_id = d.id)")
E=$(en_meme_temps "$PRO" "confirmer_achat($DEP, true)")
$D -c "SELECT tests.verifier('magasin', 'concurrence : une seule confirmation, sans erreur ($E)', 'SELECT 1 WHERE (SELECT count(*) FROM confirmations_achats WHERE depense_id = $DEP) = 1 AND $E = 0', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('magasin', 'journal du stock : intact après la concurrence', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1')" >/dev/null

echo "--- Annulation de la partie 6"
if $D -f $M/partie6_annulation.sql >/dev/null 2>&1; then
  $D -c "SELECT tests.verifier('annulation', 'refusée tant qu''un compte est magasinier', 'SELECT 1 WHERE false', 'lignes=1')" >/dev/null
else
  $D -c "SELECT tests.verifier('annulation', 'refusée tant qu''un compte est magasinier', 'SELECT 1 WHERE to_regclass(''public.confirmations_achats'') IS NOT NULL', 'lignes=1')" >/dev/null
fi
$D -c "UPDATE profiles SET role = 'employe_boutique' WHERE role = 'magasinier'" >/dev/null
$D -f $M/partie6_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'objets de la partie 6 supprimés, achats et envois conservés', 'SELECT 1 WHERE to_regclass(''public.confirmations_achats'') IS NULL AND to_regprocedure(''public.confirmer_achat(integer, boolean, text)'') IS NULL AND (SELECT count(*) FROM envois WHERE valideur_id = ''f0000000-0000-4000-8000-000000000014'') = 2', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'le rôle magasinier est de nouveau refusé', 'UPDATE profiles SET role = ''magasinier'' WHERE username = ''magasin''', 'erreur')" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression des parties précédentes avec la partie 6"
base_neuve
# Changement voulu (partie 5) : l'arrêt de caisse ne s'écrit plus depuis le navigateur
AJUST_21="s/'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1'/'clôture : arrêt de caisse direct fermé (cloturer_caisse)', 'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'erreur'/"
non_regression
unset AJUST_21
resultats

echo
echo "=== Passage 3 (base neuve) : scénario du stock (partie 2) rejoué avec la partie 6"
base_neuve
sed "s/tests.verifier('stock'/tests.verifier('stock_avec_magasin'/" $S/26_tests_stock.sql > /tmp/26_m.sql
$D -f /tmp/26_m.sql >/dev/null 2>/tmp/err_m26.txt || { echo "ECHEC non-régression stock"; cat /tmp/err_m26.txt; exit 1; }
resultats

echo
echo "=== Passage 4 (base neuve) : récapitulatif de la partie 3 rejoué avec les parties 4 à 6"
base_neuve
# Seul changement voulu (celui de la partie 4) : l'achat de 5 000 F du scénario est une dépense (15 000 + 5 000)
python3 - "$S/27_tests_recap.sql" /tmp/27_m.sql <<'PY'
import sys
s = open(sys.argv[1]).read().replace("tests.verifier('recap'", "tests.verifier('recap_avec_magasin'")
a = "(r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''"
b = "(r->''depenses''->>''total'')::numeric = 20000 AND r->''depenses''->''lignes'' @> ''[{\"description\":\"Sachets\"}]''"
assert a in s; s = s.replace(a, b)
open(sys.argv[2], 'w').write(s)
PY
$D -f /tmp/27_m.sql >/dev/null 2>/tmp/err_m27.txt || { echo "ECHEC non-régression récapitulatif"; cat /tmp/err_m27.txt; exit 1; }
resultats

echo
echo "=== Passage 5 (base neuve) : scénario des achats (partie 4) rejoué avec la partie 6"
base_neuve
sed "s/tests.verifier('achats'/tests.verifier('achats_avec_magasin'/" $S/28_tests_achats.sql > /tmp/28_m.sql
$D -f /tmp/28_m.sql >/dev/null 2>/tmp/err_m28.txt || { echo "ECHEC non-régression achats"; cat /tmp/err_m28.txt; exit 1; }
resultats

echo
echo "=== Passage 6 (base neuve) : scénario de la caisse (partie 5) rejoué avec la partie 6"
base_neuve
sed "s/tests.verifier('caisse'/tests.verifier('caisse_avec_magasin'/" $S/29_tests_caisse.sql > /tmp/29_m.sql
$D -f /tmp/29_m.sql >/dev/null 2>/tmp/err_m29.txt || { echo "ECHEC non-régression caisse"; cat /tmp/err_m29.txt; exit 1; }
resultats
