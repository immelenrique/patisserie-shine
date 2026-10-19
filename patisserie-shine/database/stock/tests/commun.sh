# Fonctions communes aux bancs d'essai du stock (sourcé par lancer_stock.sh et lancer_recap.sh).
# Le script appelant définit S (dossier des tests) avant de sourcer ce fichier.
M=$(cd "$S/.." && pwd)
B=$(cd "$S/../../securite/tests" && pwd)
SEC=$(cd "$S/../../securite" && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
D="$P -d shine_test"
V='{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}'
C2='{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000012"}'
CH='{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}'

construire() {
  $P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
  $P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
  $P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
  for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $B/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
  for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles ventes_atomiques ventes_idempotence; do $D -f $SEC/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
  $D -f $M/partie1_circuit_demandes.sql >/dev/null && $D -f $M/partie1_contrainte_annulee.sql >/dev/null || { echo "ECHEC partie 1"; exit 1; }
  $D >/dev/null <<'SQL'
INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien');
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (4, 'Tarte', 0, 10, 0, 1), (5, 'Sans prix', 0, 10, 0, 1);
INSERT INTO stock_boutique (produit_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (4, 1, 0, 2000), (5, 10, 0, NULL);
INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, created_at) VALUES ('V-VIEILLE', 500, 500, 0, 'c0000000-0000-4000-8000-000000000003', localtimestamp - interval '9 days');
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, 'Croissant', 1, 500, 500 FROM ventes WHERE numero_ticket = 'V-VIEILLE';
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (6, 'Pain', 0, 30, 30, 1);
INSERT INTO prix_vente_produits (produit_id, prix, actif) VALUES (6, 500, true);
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000011', 'prod@shine.local', '{"username":"prod","nom":"Atelier"}'),
 ('f0000000-0000-4000-8000-000000000012', 'caissier2@shine.local', '{"username":"caissier2","nom":"Caissier 2"}');
UPDATE profiles SET role = 'employe_production' WHERE username = 'prod';
SQL
}

resultats() {
  $D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
  $D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
  $D -tAc "SELECT phase || ' : ' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM tests.resultats GROUP BY phase ORDER BY min(id)"
}

# Écarts entre les photographies « avant » et « annule » (aucune ligne = identique)
ecarts_annulation() {
$D -P pager=off -c "
WITH norm AS (
  SELECT moment, objet,
    regexp_replace(etat, '\{([^}]*)\}', '', 'g') || ' ' ||
    coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array((regexp_match(etat, '\{([^}]*)\}'))[1], ',')) x), '') AS etat
  FROM tests.instantane)
(SELECT 'avant seulement' AS cote, objet, etat FROM norm WHERE moment = 'avant'
 EXCEPT ALL SELECT 'avant seulement', objet, etat FROM norm WHERE moment = 'annule')
UNION ALL
(SELECT 'après annulation seulement', objet, etat FROM norm WHERE moment = 'annule'
 EXCEPT ALL SELECT 'après annulation seulement', objet, etat FROM norm WHERE moment = 'avant')"
$D -tAc "SELECT count(*) || ' objets comparés' FROM tests.instantane WHERE moment = 'avant'"
}

# Non-régression du circuit, des ventes, de l'idempotence et de la sécurité, sur une base où la partie 2
# (et les suivantes) est appliquée
non_regression() {
sed "s/tests.verifier('circuit'/tests.verifier('circuit_avec_stock'/" $S/25_tests_circuit.sql > /tmp/25_s.sql
$D -f /tmp/25_s.sql >/dev/null 2>/tmp/err_s25.txt || { echo "ECHEC non-régression circuit"; cat /tmp/err_s25.txt; exit 1; }
sed "s/tests.verifier('ventes'/tests.verifier('ventes_avec_stock'/" $B/23_tests_ventes.sql > /tmp/23_s.sql
$D -f /tmp/23_s.sql >/dev/null 2>/tmp/err_s23.txt || { echo "ECHEC non-régression ventes"; cat /tmp/err_s23.txt; exit 1; }
sed "s/tests.verifier('idem'/tests.verifier('idem_avec_stock'/" $B/24_tests_idempotence.sql > /tmp/24_s.sql
$D -f /tmp/24_s.sql >/dev/null 2>/tmp/err_s24.txt || { echo "ECHEC non-régression idempotence"; cat /tmp/err_s24.txt; exit 1; }
# Changements voulus dans le scénario de sécurité : refus par refuser_demande, decrement_stock fermée,
# baisse du stock principal par ajuster_stock_principal (plus d'écriture directe)
$D -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$V', true); INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', 'c0000000-0000-4000-8000-000000000003', 1); COMMIT;" >/dev/null
sed -e "s/'UPDATE demandes_groupees SET statut = ''refusee'', valideur_id = auth.uid() WHERE id = (SELECT max(id) FROM demandes_groupees)'/'SELECT refuser_demande((SELECT max(id) FROM demandes_groupees WHERE statut = ''en_attente''), ''test'')'/" \
    -e "s/'validation : rpc decrement_stock', 'SELECT decrement_stock(3, 1)', 'lignes=1'/'validation : ancienne rpc decrement_stock fermée', 'SELECT decrement_stock(3, 1)', 'erreur'/" \
    $B/21_tests_phase2.sql > /tmp/21_s.sql
sed -i "/ancienne rpc decrement_stock fermée/a SELECT tests.verifier(:'phase', 'admin : correction motivée du stock principal (tracée par le déclencheur)', 'SELECT ajuster_stock_principal(3, (SELECT quantite_restante - 1 FROM produits WHERE id = 3), ''test de non-régression'')', 'lignes=1');" /tmp/21_s.sql
python3 - /tmp/21_s.sql <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
def rep(a, b):
    global s
    assert a in s, a[:60]; s = s.replace(a, b, 1)
rep("'caisse : décompte du stock',  'UPDATE stock_boutique SET quantite_vendue = quantite_vendue + 1 WHERE produit_id = 2', 'lignes=1'",
    "'caisse : décompte direct fermé (vente par enregistrer_vente_boutique)', 'UPDATE stock_boutique SET quantite_vendue = quantite_vendue + 1 WHERE produit_id = 2', 'erreur'")
rep("'change un prix (2 audits)',   'UPDATE stock_boutique SET prix_vente = prix_vente + 1 WHERE produit_id = 2', 'lignes=1'",
    "'vendeuse : changement de prix refusé', 'UPDATE stock_boutique SET prix_vente = prix_vente + 1 WHERE produit_id = 2', 'erreur'")
rep("'utilisation boutique',        'INSERT INTO utilisations_boutique (stock_boutique_id, quantite_utilisee, utilisateur_id) VALUES (1, 1, auth.uid())', 'lignes=1'",
    "'utilisation boutique (fonction)', 'SELECT utiliser_stock_boutique(1, 1)', 'lignes=1'")
admin = """SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);\n"""
rep(admin, admin + "SELECT tests.verifier(:'phase', 'admin : change un prix (2 audits)', 'UPDATE stock_boutique SET prix_vente = prix_vente + 1 WHERE produit_id = 2', 'lignes=1');\n")
open(p, 'w').write(s)
PY
grep -q "SELECT refuser_demande" /tmp/21_s.sql && grep -q "correction motivée du stock principal" /tmp/21_s.sql || { echo "ECHEC adaptation du scénario de sécurité"; exit 1; }
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f /tmp/21_s.sql >/dev/null 2>/tmp/err_s21.txt || { echo "ECHEC non-régression phase 2"; cat /tmp/err_s21.txt; exit 1; }
}
