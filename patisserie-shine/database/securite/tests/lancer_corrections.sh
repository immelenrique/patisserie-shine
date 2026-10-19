# Banc d'essai des corrections : phases 1+2 (état production) -> corrections -> annulation
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $S/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
$D -f $M/phase1_fermer_acces_anonyme.sql >/dev/null && $D -f $M/phase2_droits_entre_employes.sql >/dev/null || { echo "ECHEC phases"; exit 1; }
echo "phases 1 et 2 appliquées (état actuel de la production)"
$D -c "INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien')" >/dev/null
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/corrections_1_fonctions.sql >/dev/null || { echo "ECHEC corrections 1"; exit 1; }
$D -f $M/corrections_2_roles.sql >/dev/null || { echo "ECHEC corrections 2"; exit 1; }
echo "corrections appliquées"
# Non-régression complète : le scénario de la phase 2 doit rester 100 % conforme avec les corrections
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_c21.txt || { echo "ECHEC non-régression"; cat /tmp/rls_err_c21.txt; exit 1; }
$D -v phase=corr -f $S/22_tests_corrections.sql >/dev/null 2>/tmp/rls_err_c22.txt || { echo "ECHEC tests corrections"; cat /tmp/rls_err_c22.txt; exit 1; }
$D -f $M/corrections_2_annulation.sql >/dev/null && $D -f $M/corrections_1_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
echo "corrections annulées"
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -v phase=corr_annule -f $S/22_tests_corrections.sql >/dev/null 2>/tmp/rls_err_c22a.txt || { echo "ECHEC tests annulation"; cat /tmp/rls_err_c22a.txt; exit 1; }
echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
echo "--- Écarts entre « avant corrections » et « corrections annulées » (aucune ligne = identique) :"
$D -P pager=off -c "
WITH norm AS (
  SELECT moment, objet,
    regexp_replace(etat, '\{([^}]*)\}', '', 'g') || ' ' ||
    coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array((regexp_match(etat, '\{([^}]*)\}'))[1], ',')) x), '') AS etat
  FROM tests.instantane)
SELECT coalesce(a.objet, b.objet) AS objet, a.etat AS avant, b.etat AS apres_annulation
FROM (SELECT * FROM norm WHERE moment = 'avant') a FULL JOIN (SELECT * FROM norm WHERE moment = 'annule') b USING (objet)
WHERE a.etat IS DISTINCT FROM b.etat"
