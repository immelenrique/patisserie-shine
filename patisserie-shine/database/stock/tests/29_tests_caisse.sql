-- Scénario de la partie 5 (phase = caisse). Données : celles de lancer_caisse.sh (parties 1 à 4 appliquées ;
-- Croissant (2) en boutique à 500 F ; comptes vendeuse et caissier2 (boutique), chef (gérant), prod, proprietaire).
\set ON_ERROR_STOP on
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CAIS2 '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000012"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_cais2 'f0000000-0000-4000-8000-000000000012'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'

-- ============ A. Ouverture ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('caisse', 'clôture sans caisse ouverte refusée', 'SELECT cloturer_caisse(100)', 'erreur');
SELECT tests.verifier('caisse', 'fond négatif refusé', 'SELECT ouvrir_caisse(-1)', 'erreur');
SELECT ouvrir_caisse(5000) AS o1 \gset
SELECT ouvrir_caisse(9999) AS o1bis \gset
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('caisse', 'production : pas de caisse', 'SELECT ouvrir_caisse(0)', 'erreur');
RESET ROLE;
SELECT tests.verifier('caisse', 'ouverture : fond 5 000 F au nom de la vendeuse',
  format('SELECT 1 FROM caisses_actives WHERE id = %s AND caissier_id = %L AND fond_caisse_initial = 5000 AND statut = ''ouverte''', (:'o1'::jsonb ->> 'caisse_id'), :'uid_vend'), 'lignes=1');
SELECT tests.verifier('caisse', 'ouverture : une seule caisse ouverte (second appel = la même, fond inchangé)',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_ouverte'')::boolean AND (%L::jsonb ->> ''caisse_id'') = (%L::jsonb ->> ''caisse_id'') AND (SELECT count(*) FROM caisses_actives WHERE caissier_id = %L) = 1',
    :'o1bis', :'o1bis', :'o1', :'uid_vend'), 'lignes=1');

-- ============ B. Rien ne s'écrit directement ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('caisse', 'vendeuse : faux relevé refusé',
  format('INSERT INTO releves_caisse (caissier_id, fond_caisse_initial, montant_theorique, montant_reel) VALUES (%L, 0, 0, 0)', :'uid_vend'), 'erreur');
SELECT tests.verifier('caisse', 'vendeuse : fermeture directe de sa caisse refusée', 'UPDATE caisses_actives SET statut = ''fermee'' WHERE caissier_id = auth.uid()', 'erreur');
SELECT tests.verifier('caisse', 'vendeuse : changement du fond refusé', 'UPDATE caisses_actives SET fond_caisse_initial = 0 WHERE caissier_id = auth.uid()', 'erreur');
SELECT tests.verifier('caisse', 'vendeuse : ancien arrêt de caisse (navigateur) refusé',
  format('INSERT INTO arrets_caisse (vendeur_id, date_arret, montant_attendu, montant_declare, ecart) VALUES (%L, current_date, 0, 0, 0)', :'uid_vend'), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('caisse', 'gérant : suppression d''une caisse refusée', 'DELETE FROM caisses_actives', 'erreur');
RESET ROLE;

-- ============ C. Ventes de la session : 1 000 + 500, dont 500 annulés ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":2}]', 1000) IS NOT NULL AS ok \gset
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":1}]', 500) IS NOT NULL AS ok \gset
RESET ROLE;
SELECT max(id) AS vente_annulee FROM ventes \gset
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT annuler_vente_boutique(:vente_annulee, 'Erreur de saisie client', :'uid_chef') IS NOT NULL AS ok \gset
RESET ROLE;

-- ============ D. Clôture à l'aveugle : 6 200 comptés pour 6 000 attendus (5 000 + 1 000) ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT cloturer_caisse(6200) AS c1 \gset
SELECT tests.verifier('caisse', 'clôture avec écart, sans motif, refusée', 'SELECT cloturer_caisse(6200, true)', 'erreur');
RESET ROLE;
SELECT tests.verifier('caisse', 'premier comptage faux : « recompter », le montant attendu n''est pas révélé',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''ecart'' AND NOT (%L::jsonb ? ''attendu'') AND NOT (%L::jsonb ? ''ecart'')', :'c1', :'c1', :'c1'), 'lignes=1');
SELECT tests.verifier('caisse', 'premier comptage gardé, caisse toujours ouverte',
  format('SELECT 1 FROM caisses_actives WHERE caissier_id = %L AND statut = ''ouverte'' AND (details->''comptages''->0->>''montant'')::numeric = 6200', :'uid_vend'), 'lignes=1');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT cloturer_caisse(6200, true, 'Monnaie d''un client oubliée') AS c2 \gset
RESET ROLE;
SELECT tests.verifier('caisse', 'clôture confirmée : attendu 6 000, compté 6 200, écart +200, 2 comptages',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''cloturee'' AND (%L::jsonb ->> ''attendu'')::numeric = 6000 AND (%L::jsonb ->> ''ecart'')::numeric = 200 AND (%L::jsonb ->> ''comptages'')::int = 2', :'c2', :'c2', :'c2', :'c2'), 'lignes=1');
SELECT tests.verifier('caisse', 'relevé : fond 5 000, ventes 1 000 (annulation exclue), motif, signé par la vendeuse',
  format('SELECT 1 FROM releves_caisse WHERE caissier_id = %L AND fond_caisse_initial = 5000 AND total_ventes = 1000 AND nombre_ventes = 1 AND montant_theorique = 6000 AND montant_reel = 6200 AND observations = ''Monnaie d''''un client oubliée'' AND jsonb_array_length(details_ventes->''comptages'') = 2', :'uid_vend'), 'lignes=1');
SELECT tests.verifier('caisse', 'caisse fermée et reliée à son relevé',
  format('SELECT 1 FROM caisses_actives c JOIN releves_caisse r ON r.id = c.releve_id WHERE c.caissier_id = %L AND c.statut = ''fermee'' AND c.montant_final = 6200 AND c.date_fermeture IS NOT NULL', :'uid_vend'), 'lignes=1');
SELECT tests.verifier('caisse', 'gérants prévenus de l''écart',
  'SELECT 1 FROM notifications WHERE type = ''alerte_generale'' AND message LIKE ''Écart de caisse : Awa%%(+200%%'' AND destinataire_id = ''a0000000-0000-4000-8000-000000000001''', 'lignes>0');

-- ============ E. Caisse juste : clôturée du premier coup ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CAIS2, false);
SELECT ouvrir_caisse(0) IS NOT NULL AS ok \gset
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":1}]', 500) IS NOT NULL AS ok \gset
SELECT cloturer_caisse(500) AS c3 \gset
RESET ROLE;
SELECT tests.verifier('caisse', 'caisse juste : clôturée au premier comptage, écart 0',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''cloturee'' AND (%L::jsonb ->> ''ecart'')::numeric = 0 AND (%L::jsonb ->> ''comptages'')::int = 1', :'c3', :'c3', :'c3'), 'lignes=1');
SELECT tests.verifier('caisse', 'pas d''alerte pour une caisse juste', 'SELECT 1 FROM notifications WHERE message LIKE ''Écart de caisse : Caissier 2%%''', 'lignes=0');

-- ============ F. Vente après la clôture, caisse oubliée ouverte ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":1}]', 500) IS NOT NULL AS ok \gset
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT ouvrir_caisse(2000) IS NOT NULL AS ok \gset
RESET ROLE;
-- La caisse du gérant a été ouverte il y a 20 h (seule écriture « hors application » du scénario)
ALTER TABLE caisses_actives DISABLE TRIGGER USER;
UPDATE caisses_actives SET date_ouverture = now() - interval '20 hours' WHERE caissier_id = :'uid_chef';
ALTER TABLE caisses_actives ENABLE TRIGGER USER;

-- ============ G. Récapitulatif du propriétaire ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT recap_periode(current_date, current_date) AS r \gset
RESET ROLE;
CREATE TEMP TABLE recap5 AS SELECT :'r'::jsonb AS r;
GRANT SELECT ON recap5 TO PUBLIC;
SELECT tests.verifier('caisse', 'récap : les caisses de la vendeuse et du caissier 2',
  'SELECT 1 FROM recap5 WHERE (SELECT count(*) FROM jsonb_array_elements(r->''caisses'') x WHERE x->>''statut'' = ''fermee'') = 2', 'lignes=1');
SELECT tests.verifier('caisse', 'récap : écart de caisse de la vendeuse, premier comptage et motif',
  'SELECT 1 FROM recap5 WHERE jsonb_array_length(r->''alertes''->''ecarts_caisse'') = 1 AND r->''alertes''->''ecarts_caisse''->0->>''caissier'' = ''Awa (vendeuse)'' AND (r->''alertes''->''ecarts_caisse''->0->>''ecart'')::numeric = 200 AND (r->''alertes''->''ecarts_caisse''->0->>''comptages'')::int = 2 AND (r->''alertes''->''ecarts_caisse''->0->>''premier_comptage'')::numeric = 6200 AND (r->''chiffres''->>''ecarts_caisse'')::int = 1', 'lignes=1');
SELECT tests.verifier('caisse', 'récap : caisse du gérant ouverte depuis 20 h signalée',
  'SELECT 1 FROM recap5 WHERE jsonb_array_length(r->''alertes''->''caisses_ouvertes'') = 1 AND r->''alertes''->''caisses_ouvertes''->0->>''caissier'' = ''Chef Admin (chef)'' AND (r->''alertes''->''caisses_ouvertes''->0->>''heures'')::int >= 20', 'lignes=1');
SELECT tests.verifier('caisse', 'récap : ventes sans caisse ouverte de la vendeuse (avant l''ouverture et après la clôture)',
  'SELECT 1 FROM recap5, jsonb_array_elements(r->''alertes''->''ventes_hors_caisse'') x WHERE x->>''vendeur'' = ''Awa (vendeuse)'' AND (x->>''nombre'')::int = 2', 'lignes=1');
SELECT tests.verifier('caisse', 'récap : la vente du caissier 2, faite caisse ouverte, n''est pas signalée',
  'SELECT 1 FROM recap5, jsonb_array_elements(r->''alertes''->''ventes_hors_caisse'') x WHERE x->>''vendeur'' LIKE ''Caissier 2%%''', 'lignes=0');
