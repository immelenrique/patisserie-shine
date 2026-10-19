S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $S/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
echo "base: $($D -tAc "select count(*) from pg_tables where schemaname='public'") tables, $($D -tAc "select count(*) from pg_policies where schemaname='public'") règles, $($D -tAc "select count(*) from profiles") profils"
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -v phase=avant -v victime=e0000000-0000-4000-8000-000000000005 -v victime_admin=e0000000-0000-4000-8000-000000000007 -f $S/20_tests.sql >/dev/null 2>/tmp/rls_err_avant.txt || { echo "ECHEC tests avant"; cat /tmp/rls_err_avant.txt; exit 1; }
$D -f $M/phase1_fermer_acces_anonyme.sql >/dev/null || { echo "ECHEC phase1"; exit 1; }; echo "phase 1 appliquée"
$D -v phase=apres -v victime=e0000000-0000-4000-8000-000000000006 -v victime_admin=e0000000-0000-4000-8000-000000000009 -f $S/20_tests.sql >/dev/null 2>/tmp/rls_err_apres.txt || { echo "ECHEC tests apres"; cat /tmp/rls_err_apres.txt; exit 1; }
$D -f $M/phase1_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }; echo "annulation appliquée"
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -v phase=annule -v victime=e0000000-0000-4000-8000-000000000008 -v victime_admin=e0000000-0000-4000-8000-000000000010 -f $S/20_tests.sql >/dev/null 2>/tmp/rls_err_annule.txt || { echo "ECHEC tests annule"; cat /tmp/rls_err_annule.txt; exit 1; }
echo TERMINE
echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
