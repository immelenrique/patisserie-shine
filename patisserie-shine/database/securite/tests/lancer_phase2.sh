# Banc d'essai de la phase 2 : phase 1 seule -> phase 2 -> annulation de la phase 2
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $S/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
$D -f $M/phase1_fermer_acces_anonyme.sql >/dev/null || { echo "ECHEC phase1"; exit 1; }; echo "phase 1 appliquée (état actuel de la production)"
# Une notification existante pour la vendeuse et pour le compte désactivé
$D -c "INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien')" >/dev/null
$D -tAc "select tests.photographier('p1')" >/dev/null
$D -v phase=p1 -v victime_vendeuse=e0000000-0000-4000-8000-000000000008 -v victime_admin=e0000000-0000-4000-8000-000000000005 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_p1.txt || { echo "ECHEC tests p1"; cat /tmp/rls_err_p1.txt; exit 1; }
$D -f $M/phase2_droits_entre_employes.sql >/dev/null || { echo "ECHEC phase2"; exit 1; }; echo "phase 2 appliquée"
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_p2.txt || { echo "ECHEC tests p2"; cat /tmp/rls_err_p2.txt; exit 1; }
$D -f $M/phase2_annulation.sql >/dev/null || { echo "ECHEC annulation phase2"; exit 1; }; echo "phase 2 annulée"
$D -tAc "select tests.photographier('p2_annule')" >/dev/null
$D -v phase=p2_annule -v victime_vendeuse=e0000000-0000-4000-8000-000000000010 -v victime_admin=e0000000-0000-4000-8000-000000000007 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_p2a.txt || { echo "ECHEC tests p2_annule"; cat /tmp/rls_err_p2a.txt; exit 1; }
echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
echo "--- Écarts entre « phase 1 seule » et « phase 2 annulée » (droits triés, aucune ligne = identique) :"
$D -P pager=off -c "
WITH norm AS (
  SELECT moment, objet,
    regexp_replace(etat, '\{([^}]*)\}', '', 'g') || ' ' ||
    coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array((regexp_match(etat, '\{([^}]*)\}'))[1], ',')) x), '') AS etat
  FROM tests.instantane)
SELECT coalesce(a.objet, b.objet) AS objet, a.etat AS p1, b.etat AS p2_annule
FROM (SELECT * FROM norm WHERE moment = 'p1') a FULL JOIN (SELECT * FROM norm WHERE moment = 'p2_annule') b USING (objet)
WHERE a.etat IS DISTINCT FROM b.etat"
$D -tAc "SELECT count(*) || ' objets comparés' FROM tests.instantane WHERE moment = 'p1'"
