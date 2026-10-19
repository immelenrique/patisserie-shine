# Base locale « shine_e2e » : état production + partie 1 + données de démonstration
N=$(cd "$(dirname "$0")" && pwd)
B=$(cd "$N/../../../securite/tests" && pwd)
SEC=$(cd "$N/../../../securite" && pwd)
M=$(cd "$N/../.." && pwd)
P="psql -p ${PGPORT:-55432} -U postgres -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_e2e" >/dev/null 2>&1
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS authenticator" -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_e2e" >/dev/null
D="$P -d shine_e2e"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $B/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles ventes_atomiques ventes_idempotence; do $D -f $SEC/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
$D -f $M/partie1_circuit_demandes.sql >/dev/null && $D -f $M/partie1_contrainte_annulee.sql >/dev/null || { echo "ECHEC partie 1"; exit 1; }
$D >/dev/null <<'SQL'
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (6, 'Pain', 0, 30, 30, 1);
INSERT INTO prix_vente_produits (produit_id, prix, actif) VALUES (6, 500, true);
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000011', 'prod@shine.local', '{"username":"prod","nom":"Atelier"}'),
 ('f0000000-0000-4000-8000-000000000012', 'caissier2@shine.local', '{"username":"caissier2","nom":"Caissier 2"}');
UPDATE profiles SET role = 'employe_production' WHERE username = 'prod';
UPDATE profiles SET force_password_change = false;
DELETE FROM lignes_vente WHERE id > 100;
CREATE ROLE authenticator LOGIN PASSWORD 'e2e' NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
SQL
echo "base e2e prête"
