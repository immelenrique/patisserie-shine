# Banc d'essai des ventes sans doublon : état production (phases 1-2, corrections, ventes atomiques)
# -> ventes_idempotence -> annulation
S=$(cd "$(dirname "$0")" && pwd)
M=$(cd "$S/.." && pwd)
: "${PGHOST:?Définir PGHOST (dossier du socket ou hôte de la base de test)}"
P="psql -p ${PGPORT:-5432} -U ${PGUSER:-postgres} -q -v ON_ERROR_STOP=1"
$P -d postgres -c "DROP DATABASE IF EXISTS shine_test" >/dev/null 2>&1
$P -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" -c "DROP ROLE IF EXISTS service_role" >/dev/null 2>&1
$P -d postgres -c "CREATE DATABASE shine_test" >/dev/null
D="$P -d shine_test"
for f in 00_emulation_supabase 01_schema 02_policies 03_functions_triggers 05_seed; do $D -f $S/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
for f in phase1_fermer_acces_anonyme phase2_droits_entre_employes corrections_1_fonctions corrections_2_roles ventes_atomiques; do $D -f $M/$f.sql >/dev/null || { echo "ECHEC $f"; exit 1; }; done
echo "état production reproduit (phases 1-2, corrections 1-2, ventes atomiques)"
$D >/dev/null <<'SQL'
INSERT INTO notifications (destinataire_id, type, message) VALUES ('c0000000-0000-4000-8000-000000000003', 'message_admin', 'bienvenue'), ('d0000000-0000-4000-8000-000000000004', 'message_admin', 'ancien');
INSERT INTO produits (id, nom, prix_achat, quantite, quantite_restante, unite_id) VALUES (4, 'Tarte', 0, 10, 0, 1), (5, 'Sans prix', 0, 10, 0, 1);
INSERT INTO stock_boutique (produit_id, quantite_disponible, quantite_vendue, prix_vente) VALUES (4, 1, 0, 2000), (5, 10, 0, NULL);
INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id, created_at) VALUES ('V-VIEILLE', 500, 500, 0, 'c0000000-0000-4000-8000-000000000003', localtimestamp - interval '9 days');
INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, 'Croissant', 1, 500, 500 FROM ventes WHERE numero_ticket = 'V-VIEILLE';
SQL
$D -tAc "select tests.photographier('avant')" >/dev/null
$D -f $M/ventes_idempotence.sql >/dev/null || { echo "ECHEC ventes_idempotence"; exit 1; }; echo "ventes_idempotence appliqué"

$D -f $S/24_tests_idempotence.sql >/dev/null 2>/tmp/rls_err_i.txt || { echo "ECHEC scénario idempotence"; cat /tmp/rls_err_i.txt; exit 1; }

echo "--- Concurrence : la même vente arrive deux fois au même instant (premier envoi encore en cours)"
J='{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}'
K=22222222-bbbb-4bbb-8bbb-000000000001
NB=$($D -tAc "SELECT count(*) FROM ventes"); VENDU=$($D -tAc "SELECT quantite_vendue FROM stock_boutique WHERE produit_id = 2")
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$J', true) IS NOT NULL; SELECT (enregistrer_vente_boutique('[{\"id\":2,\"quantite\":3}]', 1500, '$K'))->>'deja_enregistree'; SELECT pg_sleep(2); COMMIT;" > /tmp/idem_a.txt 2>&1 ) &
sleep 0.5
( $P -d shine_test -tA -v ON_ERROR_STOP=0 -c "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '$J', true) IS NOT NULL; SELECT (enregistrer_vente_boutique('[{\"id\":2,\"quantite\":3}]', 1500, '$K'))->>'deja_enregistree'; COMMIT;" > /tmp/idem_b.txt 2>&1 ) &
wait
echo "envoi A : deja_enregistree=$(grep -E '^(true|false)$' /tmp/idem_a.txt | tail -1) $(grep -o 'ERROR.*' /tmp/idem_a.txt | head -1)"
echo "envoi B : deja_enregistree=$(grep -E '^(true|false)$' /tmp/idem_b.txt | tail -1) $(grep -o 'ERROR.*' /tmp/idem_b.txt | head -1)"
$D -c "SELECT tests.verifier('idem', 'concurrence : premier envoi crée la vente', 'SELECT 1 WHERE ''$(grep -E '^(true|false)$' /tmp/idem_a.txt | tail -1)'' = ''false''', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('idem', 'concurrence : second envoi attend et rend la même vente', 'SELECT 1 WHERE ''$(grep -E '^(true|false)$' /tmp/idem_b.txt | tail -1)'' = ''true''', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('idem', 'concurrence : une seule vente enregistrée', 'SELECT 1 FROM ventes HAVING count(*) = $NB + 1', 'lignes=1')" >/dev/null
$D -c "SELECT tests.verifier('idem', 'concurrence : stock décompté une seule fois', 'SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_vendue = $VENDU + 3', 'lignes=1')" >/dev/null

echo "--- Non-régression : scénario ventes atomiques (via l'ancienne version à 2 paramètres)"
sed "s/tests.verifier('ventes'/tests.verifier('ventes_avec_idem'/" $S/23_tests_ventes.sql > /tmp/23_idem.sql
$D -f /tmp/23_idem.sql >/dev/null 2>/tmp/rls_err_i23.txt || { echo "ECHEC non-régression ventes"; cat /tmp/rls_err_i23.txt; exit 1; }

echo "--- Non-régression : scénario complet de la phase 2"
$D -v phase=p2 -v victime_vendeuse=e0000000-0000-4000-8000-000000000009 -v victime_admin=e0000000-0000-4000-8000-000000000006 -f $S/21_tests_phase2.sql >/dev/null 2>/tmp/rls_err_i21.txt || { echo "ECHEC non-régression phase 2"; cat /tmp/rls_err_i21.txt; exit 1; }
# Le scénario de la phase 2 modifie le prix du croissant : on le remet pour le scénario ventes suivant
$D -c "UPDATE stock_boutique SET prix_vente = 500 WHERE produit_id = 2" >/dev/null

echo "--- Annulation"
$D -f $M/ventes_idempotence_annulation.sql >/dev/null || { echo "ECHEC annulation"; exit 1; }
$D -tAc "select tests.photographier('annule')" >/dev/null
$D -c "SELECT tests.verifier('idem_annule', 'annulation : colonne et index supprimés', 'SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ''ventes'' AND column_name = ''cle_idempotence'') AND to_regclass(''public.ventes_cle_idempotence_key'') IS NULL', 'lignes=1')" >/dev/null
sed "s/tests.verifier('ventes'/tests.verifier('ventes_annule'/" $S/23_tests_ventes.sql > /tmp/23_annule.sql
$D -f /tmp/23_annule.sql >/dev/null 2>/tmp/rls_err_ia.txt || { echo "ECHEC scénario ventes après annulation"; cat /tmp/rls_err_ia.txt; exit 1; }

echo "--- Résultats non conformes (aucune ligne = tout est conforme) :"
$D -P pager=off -c "SELECT phase, test, attendu, obtenu FROM tests.resultats WHERE NOT ok ORDER BY id"
$D -tAc "SELECT count(*) || ' vérifications, ' || count(*) FILTER (WHERE ok) || ' conformes' FROM tests.resultats"
$D -tAc "SELECT phase || ' : ' || count(*) FILTER (WHERE ok) || '/' || count(*) FROM tests.resultats GROUP BY phase ORDER BY min(id)"
echo "--- Écarts entre « avant » et « annulé » (aucune ligne = identique) :"
$D -P pager=off -c "
WITH norm AS (
  SELECT moment, objet,
    regexp_replace(etat, '\{([^}]*)\}', '', 'g') || ' ' ||
    coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array((regexp_match(etat, '\{([^}]*)\}'))[1], ',')) x), '') AS etat
  FROM tests.instantane)
SELECT coalesce(a.objet, b.objet) AS objet, a.etat AS avant, b.etat AS apres_annulation
FROM (SELECT * FROM norm WHERE moment = 'avant') a FULL JOIN (SELECT * FROM norm WHERE moment = 'annule') b USING (objet)
WHERE a.etat IS DISTINCT FROM b.etat"
$D -tAc "SELECT count(*) || ' objets comparés' FROM tests.instantane WHERE moment = 'avant'"
