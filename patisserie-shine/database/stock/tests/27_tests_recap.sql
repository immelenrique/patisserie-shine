-- Scénario de la partie 3 (phase = recap). Données : celles de lancer_recap.sh, avec les parties 1 et 2 :
-- Pain (6) 30 au stock principal, Farine (1), Sucre (3) ; Croissant (2) en boutique ;
-- comptes : chef (gérant), proprietaire et rabi (super admins), vendeuse et caissier2 (boutique), admin1.
\set ON_ERROR_STOP on
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CAIS2 '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000012"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set RABI '\'{"role":"authenticated","sub":"e0000000-0000-4000-8000-000000000010"}\''
\set ADMIN1 '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000013"}\''
\set ANCIEN '\'{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}\''
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'
\set uid_rabi 'e0000000-0000-4000-8000-000000000010'

-- ============ A. Accès réservé aux super admins actifs ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('recap', 'caissier : récapitulatif refusé', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT tests.verifier('recap', 'caissier : n''est pas super admin', 'SELECT 1 WHERE NOT est_super_admin()', 'lignes=1');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('recap', 'gérant : récapitulatif refusé', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT tests.verifier('recap', 'gérant : fonction interne recap_nom fermée', format('SELECT recap_nom(%L)', :'uid_vend'), 'erreur');
SELECT set_config('request.jwt.claims', :ADMIN1, false);
SELECT tests.verifier('recap', 'admin1 : n''est plus super admin, récapitulatif refusé', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT set_config('request.jwt.claims', :ANCIEN, false);
SELECT tests.verifier('recap', 'compte désactivé : récapitulatif refusé', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT set_config('request.jwt.claims', :RABI, false);
SELECT tests.verifier('recap', 'rabi : super admin', 'SELECT 1 WHERE est_super_admin()', 'lignes=1');
SELECT tests.verifier('recap', 'rabi : récapitulatif du jour', 'SELECT recap_periode(current_date, current_date)', 'lignes=1');
SELECT tests.verifier('recap', 'période inversée refusée', 'SELECT recap_periode(current_date, current_date - 1)', 'erreur');
SELECT tests.verifier('recap', 'période de plus de 3 mois refusée', 'SELECT recap_periode(current_date - 100, current_date)', 'erreur');
SELECT tests.verifier('recap', 'période de 3 mois acceptée', 'SELECT recap_periode(current_date - 92, current_date)', 'lignes=1');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('recap', 'proprietaire : récapitulatif du jour', 'SELECT recap_periode(current_date, current_date)', 'lignes=1');
RESET ROLE;

-- ============ B. Comptes des super admins protégés ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('recap', 'gérant : désactiver rabi refusé', format('UPDATE profiles SET actif = false WHERE id = %L', :'uid_rabi'), 'erreur');
SELECT tests.verifier('recap', 'gérant : rétrograder rabi refusé', format('UPDATE profiles SET role = ''employe_boutique'' WHERE id = %L', :'uid_rabi'), 'erreur');
SELECT tests.verifier('recap', 'gérant : retirer le droit super admin à rabi refusé', format('UPDATE profiles SET is_super_admin = false WHERE id = %L', :'uid_rabi'), 'erreur');
SELECT tests.verifier('recap', 'gérant : se donner le droit super admin refusé', 'UPDATE profiles SET is_super_admin = true WHERE id = auth.uid()', 'erreur');
SELECT tests.verifier('recap', 'gérant : téléphone de rabi modifiable (hors rôle et statut)', format('UPDATE profiles SET telephone = ''0303'' WHERE id = %L', :'uid_rabi'), 'lignes=1');
SELECT tests.verifier('recap', 'gérant : désactiver un caissier toujours possible', 'UPDATE profiles SET actif = false WHERE username = ''caissier2''', 'lignes=1');
SELECT tests.verifier('recap', 'gérant : réactiver le caissier', 'UPDATE profiles SET actif = true WHERE username = ''caissier2''', 'lignes=1');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('recap', 'super admin : désactive rabi', format('UPDATE profiles SET actif = false WHERE id = %L', :'uid_rabi'), 'lignes=1');
SELECT set_config('request.jwt.claims', :RABI, false);
SELECT tests.verifier('recap', 'rabi désactivé : récapitulatif refusé', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('recap', 'super admin : réactive rabi', format('UPDATE profiles SET actif = true WHERE id = %L', :'uid_rabi'), 'lignes=1');
RESET ROLE;

-- ============ C. Une journée ============
SET ROLE authenticated;
-- 1. Demande de la vendeuse, validée par le gérant, reçue avec un écart motivé
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g1 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 10, 'Boutique', :'uid_vend', :g1);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT (valider_demande_groupee(:g1) ->> 'envoi_id') AS e1 \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT receptionner_envoi(:e1, '[{"produit_id":6,"quantite_recue":9,"motif":"1 pain écrasé"}]', true) IS NOT NULL AS ok \gset

-- 2. Demande du gérant, validée par lui-même, reçue par le second caissier
SELECT set_config('request.jwt.claims', :CHEF, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_chef', 1) RETURNING id AS g2 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 5, 'Boutique', :'uid_chef', :g2);
SELECT (valider_demande_groupee(:g2) ->> 'envoi_id') AS e2 \gset
SELECT set_config('request.jwt.claims', :CAIS2, false);
SELECT receptionner_envoi(:e2, '[{"produit_id":6,"quantite_recue":5}]') IS NOT NULL AS ok \gset

-- 3. Demande de la vendeuse, validée puis réceptionnée par le gérant (caissier absent)
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g3 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 3, 'Boutique', :'uid_vend', :g3);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT (valider_demande_groupee(:g3) ->> 'envoi_id') AS e3 \gset
SELECT receptionner_envoi(:e3, '[{"produit_id":6,"quantite_recue":3}]') IS NOT NULL AS ok \gset

-- 4. Demande refusée avec une raison
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g4 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (3, 4, 'Boutique', :'uid_vend', :g4);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT refuser_demande(:g4, 'Pas de sucre pour la boutique') IS NOT NULL AS ok \gset

-- 5. Envoi validé mais jamais réceptionné
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g5 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 2, 'Boutique', :'uid_vend', :g5);
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT (valider_demande_groupee(:g5) ->> 'envoi_id') AS e5 \gset

-- 6. Stock principal : achat, correction motivée ; boutique : utilisation
SELECT reapprovisionner_produit(1, 10, 5000) IS NOT NULL AS ok \gset
SELECT ajuster_stock_principal(3, (SELECT quantite_restante - 2 FROM produits WHERE id = 3), 'Casse constatée au comptage') IS NOT NULL AS ok \gset
SELECT utiliser_stock_boutique(1, 1, 'Dégustation client') IS NOT NULL AS ok \gset

-- 7. Ventes de la vendeuse, dont une annulée par le serveur
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT enregistrer_vente_boutique('[{"id":6,"quantite":2}]', 1000) IS NOT NULL AS ok \gset
SELECT enregistrer_vente_boutique('[{"id":6,"quantite":1}]', 500) IS NOT NULL AS ok \gset
RESET ROLE;
SELECT max(id) AS vente_annulee FROM ventes \gset
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT annuler_vente_boutique(:vente_annulee, 'Erreur de saisie client', :'uid_chef') IS NOT NULL AS ok \gset
RESET ROLE;

-- 8. Dépense, produit archivé, mot de passe réinitialisé par le gérant (écritures des routes serveur)
INSERT INTO depenses_comptables (type_depense, description, montant, utilisateur_id, date_depense)
VALUES ('fournitures', 'Sachets', 15000, :'uid_chef', current_date), ('autre', 'Ancienne dépense', 999, :'uid_chef', current_date - 5);
INSERT INTO produits (nom, prix_achat, quantite, quantite_restante, unite_id) VALUES ('Vieux colorant', 0, 1, 0, 1) RETURNING id AS vieux \gset
INSERT INTO password_change_log (user_id, changed_by, reason)
VALUES (:'uid_vend', :'uid_chef', 'Mot de passe réinitialisé par un administrateur'), (:'uid_chef', :'uid_chef', 'Password updated');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT archiver_produit(:vieux, 'Plus utilisé') IS NOT NULL AS ok \gset
RESET ROLE;

-- L'envoi 5 est parti il y a 30 heures (seule écriture « hors application » du scénario)
ALTER TABLE envois DISABLE TRIGGER USER;
UPDATE envois SET cree_le = now() - interval '30 hours' WHERE id = :e5;
ALTER TABLE envois ENABLE TRIGGER USER;

-- ============ D. Le récapitulatif du jour, lu par rabi ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :RABI, false);
SELECT recap_periode(current_date, current_date) AS r \gset
SELECT recap_periode(current_date - 3, current_date - 1) AS hier \gset
RESET ROLE;
CREATE TEMP TABLE recap AS SELECT :'r'::jsonb AS r, :'hier'::jsonb AS hier;
GRANT SELECT ON recap TO PUBLIC;

-- Demandes et décisions
SELECT tests.verifier('recap', 'demandes : les 5 demandes du jour, avec demandeur et quantités',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''demandes'') d WHERE (d->>''id'')::bigint IN (%s, %s, %s, %s, %s) HAVING count(*) = 5', :g1, :g2, :g3, :g4, :g5), 'lignes=1');
SELECT tests.verifier('recap', 'demandes : ligne de la demande 1 (Pain 10, par Awa)',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''demandes'') d WHERE (d->>''id'')::bigint = %s AND d->>''demandeur'' = ''Awa (vendeuse)'' AND d->''lignes''->0->>''produit'' = ''Pain'' AND (d->''lignes''->0->>''quantite'')::numeric = 10', :g1), 'lignes=1');
SELECT tests.verifier('recap', 'demandes : total identique à la base',
  'SELECT 1 FROM recap WHERE (r->''chiffres''->>''demandes'')::int = (SELECT count(*) FROM demandes_groupees WHERE created_at >= current_date::timestamptz AND created_at < (current_date + 1)::timestamptz)', 'lignes=1');
SELECT tests.verifier('recap', 'décisions : refus avec sa raison et son auteur',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''decisions'') d WHERE (d->>''id'')::bigint = %s AND d->>''statut'' = ''refusee'' AND d->>''raison_refus'' = ''Pas de sucre pour la boutique'' AND d->>''valideur'' = ''Chef Admin (chef)''', :g4), 'lignes=1');
SELECT tests.verifier('recap', 'décisions : auto-validation du gérant signalée',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''decisions'') d WHERE (d->>''id'')::bigint = %s AND (d->>''auto_validation'')::boolean AND (d->''lignes''->0->>''validee'')::numeric = 5', :g2), 'lignes=1');
SELECT tests.verifier('recap', 'chiffres : 4 validations, 1 refus, 1 auto-validation',
  'SELECT 1 FROM recap WHERE (r->''chiffres''->>''validations'')::int = 4 AND (r->''chiffres''->>''refus'')::int = 1 AND (r->''chiffres''->>''auto_validations'')::int = 1', 'lignes=1');

-- Envois et alertes
SELECT tests.verifier('recap', 'envois : écart de la demande 1 (envoyé 10, reçu 9, motif, par Awa)',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''envois'') e, jsonb_array_elements(e->''lignes'') l WHERE (e->>''id'')::bigint = %s AND (e->>''avec_ecart'')::boolean AND e->>''receptionnaire'' = ''Awa (vendeuse)'' AND (l->>''envoyee'')::numeric = 10 AND (l->>''recue'')::numeric = 9 AND (l->>''ecart'')::numeric = -1 AND l->>''motif_ecart'' = ''1 pain écrasé''', :e1), 'lignes=1');
SELECT tests.verifier('recap', 'alerte : l''écart figure dans la liste des écarts',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''alertes''->''ecarts'') x WHERE (x->>''envoi_id'')::bigint = %s AND (x->>''ecart'')::numeric = -1 AND x->>''valideur'' = ''Chef Admin (chef)''', :e1), 'lignes=1');
SELECT tests.verifier('recap', 'alerte : validé et réceptionné par la même personne (demande 3 seulement)',
  format('SELECT 1 FROM recap WHERE jsonb_array_length(r->''alertes''->''meme_personne'') = 1 AND (r->''alertes''->''meme_personne''->0->>''id'')::bigint = %s AND r->''alertes''->''meme_personne''->0->>''personne'' = ''Chef Admin (chef)'' AND (r->''chiffres''->>''meme_personne'')::int = 1', :e3), 'lignes=1');
SELECT tests.verifier('recap', 'alerte : envoi en transit depuis plus de 24 h (30 h)',
  format('SELECT 1 FROM recap WHERE jsonb_array_length(r->''alertes''->''transit_24h'') = 1 AND (r->''alertes''->''transit_24h''->0->>''id'')::bigint = %s AND (r->''alertes''->''transit_24h''->0->>''heures'')::int >= 30 AND r->''alertes''->''transit_24h''->0->''lignes''->0->>''produit'' = ''Pain''', :e5), 'lignes=1');
SELECT tests.verifier('recap', 'chiffres : 3 réceptions, 1 écart',
  'SELECT 1 FROM recap WHERE (r->''chiffres''->>''receptions'')::int = 3 AND (r->''chiffres''->>''ecarts'')::int = 1', 'lignes=1');

-- Stock principal, boutique, ventes, dépenses, comptes
SELECT tests.verifier('recap', 'mouvements : achat de farine +10 signé par le gérant',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''mouvements'') m WHERE m->>''nature'' = ''achat'' AND m->>''produit'' = ''Farine'' AND (m->>''quantite'')::numeric = 10 AND m->>''auteur'' = ''Chef Admin (chef)'' AND m->>''unite'' = ''Kilogramme''', 'lignes=1');
SELECT tests.verifier('recap', 'mouvements : correction du sucre -2 avec son motif',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''mouvements'') m WHERE m->>''nature'' = ''ajustement'' AND m->>''produit'' = ''Sucre'' AND (m->>''quantite'')::numeric = -2 AND m->>''motif'' = ''Casse constatée au comptage''', 'lignes=1');
SELECT tests.verifier('recap', 'mouvements : utilisation en boutique',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''mouvements'') m WHERE m->>''nature'' = ''utilisation'' AND m->>''lieu'' = ''boutique'' AND (m->>''quantite'')::numeric = -1', 'lignes=1');
SELECT tests.verifier('recap', 'ventes : chiffre d''affaires identique à la base (annulées exclues)',
  'SELECT 1 FROM recap WHERE (r->''ventes''->>''total'')::numeric = (SELECT sum(total) FROM ventes WHERE created_at >= current_date AND statut IS DISTINCT FROM ''annulee'') AND (r->''chiffres''->>''chiffre_affaires'')::numeric = (r->''ventes''->>''total'')::numeric', 'lignes=1');
SELECT tests.verifier('recap', 'ventes : 2 pains vendus par Awa (la vente annulée ne compte pas)',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''ventes''->''articles'') a WHERE a->>''produit'' = ''Pain'' AND (a->>''quantite'')::numeric = 2', 'lignes=1');
SELECT tests.verifier('recap', 'ventes : annulation avec motif, auteur et vendeuse',
  format('SELECT 1 FROM recap, jsonb_array_elements(r->''ventes''->''annulations'') a JOIN ventes v ON v.numero_ticket = a->>''ticket'' WHERE v.id = %s AND a->>''motif'' = ''Erreur de saisie client'' AND a->>''annule_par'' = ''Chef Admin (chef)'' AND a->>''vendeur'' = ''Awa (vendeuse)''', :vente_annulee), 'lignes=1');
SELECT tests.verifier('recap', 'dépenses : 15 000 F du jour (l''ancienne dépense exclue)',
  'SELECT 1 FROM recap WHERE (r->''depenses''->>''total'')::numeric = 15000 AND r->''depenses''->''lignes''->0->>''description'' = ''Sachets''', 'lignes=1');
SELECT tests.verifier('recap', 'archives : produit archivé avec motif et auteur',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''archives'') a WHERE a->>''produit'' = ''Vieux colorant'' AND a->>''motif'' = ''Plus utilisé'' AND a->>''par'' = ''Chef Admin (chef)''', 'lignes=1');
SELECT tests.verifier('recap', 'comptes : mot de passe de la vendeuse réinitialisé par le gérant signalé',
  'SELECT 1 FROM recap, jsonb_array_elements(r->''comptes'') c WHERE c->>''compte'' = ''Awa (vendeuse)'' AND c->>''par'' = ''Chef Admin (chef)'' AND (c->>''par_autre'')::boolean', 'lignes=1');
SELECT tests.verifier('recap', 'comptes : changement de son propre mot de passe non signalé comme « par un autre »',
  'SELECT 1 FROM recap WHERE (r->''chiffres''->>''comptes_par_autre'')::int = 1', 'lignes=1');
SELECT tests.verifier('recap', 'journal : intégrité vérifiée et intacte',
  'SELECT 1 FROM recap WHERE (r->''journal''->>''intact'')::boolean AND (r->''journal''->>''lignes_verifiees'')::int > 0', 'lignes=1');

-- Autre période : seuls les états actuels (transit, en attente) apparaissent
SELECT tests.verifier('recap', 'jours précédents : aucune demande ni écart, mais l''envoi bloqué reste signalé',
  'SELECT 1 FROM recap WHERE jsonb_array_length(hier->''demandes'') = 0 AND jsonb_array_length(hier->''alertes''->''ecarts'') = 0 AND jsonb_array_length(hier->''alertes''->''meme_personne'') = 0 AND jsonb_array_length(hier->''alertes''->''transit_24h'') = 1', 'lignes=1');
SELECT tests.verifier('recap', 'jours précédents : l''ancienne dépense de J-5 hors période (J-3 à J-1)',
  'SELECT 1 FROM recap WHERE (hier->''depenses''->>''total'')::numeric = 0', 'lignes=1');

-- Le récapitulatif ne modifie rien
SELECT tests.verifier('recap', 'lecture seule : la fonction est déclarée STABLE',
  'SELECT 1 FROM pg_proc WHERE proname = ''recap_periode'' AND provolatile = ''s''', 'lignes=1');
