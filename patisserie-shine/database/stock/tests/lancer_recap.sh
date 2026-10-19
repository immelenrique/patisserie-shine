# Banc d'essai de la partie 3 (récapitulatif) : état production (parties 1 et 2) -> partie 3 -> annulation.
# Passage 1 : scénario d'une journée, lu dans le récapitulatif, puis annulation exacte.
# Passage 2 (base neuve) : non-régression des parties précédentes avec la partie 3 appliquée.
S=$(cd "$(dirname "$0")" && pwd)
. "$S/commun.sh"

# Comptes de la partie 3 : rabi (super admin), admin1 (super admin avant la partie 3)
comptes_recap() {
  $D >/dev/null <<'SQL'
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('f0000000-0000-4000-8000-000000000013', 'admin1@shine.local', '{"username":"admin1","nom":"Nouveau Utilisateur"}');
UPDATE profiles SET role = 'admin', is_super_admin = true WHERE username = 'admin1';
UPDATE profiles SET role = 'admin', is_super_admin = true, nom = 'rabi' WHERE id = 'e0000000-0000-4000-8000-000000000010';
SQL
}

echo "=== Passage 1 : scénario de la partie 3, annulation"
construire
comptes_recap
$D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/partie3_recapitulatif.sql >/dev/null || { echo "ECHEC partie3_recapitulatif"; exit 1; }
echo "partie 3 appliquée"
$D -f $S/27_tests_recap.sql >/dev/null 2>/tmp/err_r27.txt || { echo "ECHEC scénario récapitulatif"; cat /tmp/err_r27.txt; exit 1; }

echo "--- Annulation de la partie 3"
$D -f $M/partie3_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('annulation', 'fonctions de la partie 3 supprimées, admin1 de nouveau super admin', 'SELECT 1 WHERE to_regprocedure(''public.recap_periode(date, date)'') IS NULL AND to_regprocedure(''public.est_super_admin()'') IS NULL AND (SELECT is_super_admin FROM profiles WHERE username = ''admin1'')', 'lignes=1')" >/dev/null
resultats
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
ecarts_annulation

echo
echo "=== Passage 2 : non-régression des parties précédentes avec la partie 3"
construire
comptes_recap
$D -f $M/partie2_stock_principal.sql >/dev/null || { echo "ECHEC partie2_stock_principal"; exit 1; }
$D -f $M/partie3_recapitulatif.sql >/dev/null || { echo "ECHEC partie3_recapitulatif"; exit 1; }
non_regression
resultats
