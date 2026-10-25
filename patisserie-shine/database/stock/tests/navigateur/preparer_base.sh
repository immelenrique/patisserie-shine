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
$D -f $N/../stockage_emulation.sql >/dev/null || { echo "ECHEC stockage_emulation"; exit 1; }
for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles ventes_atomiques ventes_idempotence; do $D -f $SEC/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
$D -f $M/partie1_circuit_demandes.sql >/dev/null && $D -f $M/partie1_contrainte_annulee.sql >/dev/null || { echo "ECHEC partie 1"; exit 1; }
# Partie 2 si demandée (PARTIE2=1)
if [ "${PARTIE2:-0}" = 1 ]; then $D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie 2"; exit 1; }; fi
# Partie 3 si demandée (PARTIE3=1, avec la partie 2)
if [ "${PARTIE3:-0}" = 1 ]; then $D -f $M/partie3_recapitulatif.sql >/dev/null || { echo "ECHEC partie 3"; exit 1; }; fi
# Partie 4 si demandée (PARTIE4=1, avec les parties 2 et 3)
if [ "${PARTIE4:-0}" = 1 ]; then $D -f $M/partie4_achats_recus.sql >/dev/null || { echo "ECHEC partie 4"; exit 1; }; fi
# Partie 5 si demandée (PARTIE5=1, avec les parties 2 à 4)
if [ "${PARTIE5:-0}" = 1 ]; then $D -f $M/partie5_caisse.sql >/dev/null || { echo "ECHEC partie 5"; exit 1; }; fi
$D >/dev/null <<'SQL'
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (6, 'Pain', 0, 30, 30, 1);
INSERT INTO prix_vente_produits (produit_id, prix, actif) VALUES (6, 500, true);
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000011', 'prod@shine.local', '{"username":"prod","nom":"Atelier"}'),
 ('f0000000-0000-4000-8000-000000000012', 'caissier2@shine.local', '{"username":"caissier2","nom":"Caissier 2"}');
UPDATE profiles SET role = 'employe_production' WHERE username = 'prod';
UPDATE profiles SET force_password_change = false;
-- Une fourniture en boutique (article non vendable), pour l'écran « marquer comme utilisé »
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (7, 'Sachets', 0, 100, 0, 1);
INSERT INTO stock_boutique (produit_id, nom_produit, quantite_disponible, quantite_vendue, quantite_utilisee, prix_vente, type_produit) VALUES (7, 'Sachets', 100, 0, 0, NULL, 'fourniture');
DELETE FROM lignes_vente WHERE id > 100;
CREATE ROLE authenticator LOGIN PASSWORD 'e2e' NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
SQL
# Partie 6 si demandée (PARTIE6=1, avec les parties 2 à 5) : rôle magasinier et son compte
if [ "${PARTIE6:-0}" = 1 ]; then
  $D -f $M/partie6_magasinier.sql >/dev/null || { echo "ECHEC partie 6"; exit 1; }
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000014', 'magasin@shine.local', '{"username":"magasin","nom":"Moussa (magasin)"}');
UPDATE profiles SET role = 'magasinier', force_password_change = false WHERE username = 'magasin';
SQL
fi
# Partie 7 si demandée (PARTIE7=1, avec la partie 6) : achats réservés au magasinier, au propriétaire et aux gérants
if [ "${PARTIE7:-0}" = 1 ]; then $D -f $M/partie7_achats_reserves.sql >/dev/null || { echo "ECHEC partie 7"; exit 1; }; fi
# Partie 8 si demandée (PARTIE8=1, avec la partie 7) : inventaires à l'aveugle et pertes
if [ "${PARTIE8:-0}" = 1 ]; then $D -f $M/partie8_inventaires_pertes.sql >/dev/null || { echo "ECHEC partie 8"; exit 1; }; fi
# Partie 9 si demandée (PARTIE9=1, avec la partie 8) : production par recette, recettes protégées
if [ "${PARTIE9:-0}" = 1 ]; then $D -f $M/partie9_production_recettes.sql >/dev/null || { echo "ECHEC partie 9"; exit 1; }; fi
# Cuisine : un compte, trois plats en stock (le Jus au prix du stock, 600 F)
$D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000015', 'cuisine@shine.local', '{"username":"cuisine","nom":"Fatou (cuisine)"}');
UPDATE profiles SET role = 'employe_cuisine', force_password_change = false WHERE username = 'cuisine';
INSERT INTO produits_cuisine (id, nom, prix_vente, actif) VALUES (1, 'Riz sauce', 1500, true), (2, 'Jus', 500, true), (3, 'Poulet braisé', 3000, true);
SELECT setval('produits_cuisine_id_seq', 3);
INSERT INTO stock_cuisine (produit_cuisine_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (1, 10, 0, NULL), (2, 20, 0, 600), (3, 5, 0, NULL);
SQL
# Partie 10 si demandée (PARTIE10=1, avec la partie 9) : cuisine sécurisée
if [ "${PARTIE10:-0}" = 1 ]; then $D -f $M/partie10_cuisine.sql >/dev/null || { echo "ECHEC partie 10"; exit 1; }; fi
echo "base e2e prête"
