-- Scénario de test phase 2, exécuté trois fois : phase = p1 (phase 1 seule) | p2 | p2_annule
-- Variables psql : phase, victime_vendeuse, victime_admin (comptes jetables, un par phase)
\set ON_ERROR_STOP on
SELECT now() AS debut,
       (:'phase' = 'p2') AS est_p2,
       CASE WHEN :'phase' = 'p2' THEN 'erreur' ELSE 'lignes=1' END AS refus_erreur,
       CASE WHEN :'phase' = 'p2' THEN 'lignes=0' ELSE 'lignes=1' END AS refus_silencieux
\gset

-- ===================== 1. Vendeuse : son travail quotidien doit rester identique =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
SELECT tests.verifier(:'phase', 'lit produits / stock / profils', 'SELECT 1 FROM produits, stock_boutique, profiles', 'lignes>0');
SELECT tests.verifier(:'phase', 'lit la vue stock (security_invoker)', 'SELECT * FROM vue_stock_boutique', 'lignes>0');
SELECT tests.verifier(:'phase', 'caisse : crée la vente',      format('INSERT INTO ventes (numero_ticket, total, montant_donne, monnaie_rendue, vendeur_id) VALUES (%L, 500, 1000, 500, auth.uid())', 'V2-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : ligne de vente',     format('INSERT INTO lignes_vente (vente_id, produit_id, nom_produit, quantite, prix_unitaire, total) SELECT id, 2, ''Croissant'', 1, 500, 500 FROM ventes WHERE numero_ticket = %L', 'V2-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : sortie boutique',    format('INSERT INTO sorties_boutique (vente_id, produit_id, quantite, prix_unitaire, total) SELECT id, 2, 1, 500, 500 FROM ventes WHERE numero_ticket = %L', 'V2-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'caisse : décompte du stock',  'UPDATE stock_boutique SET quantite_vendue = quantite_vendue + 1 WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier(:'phase', 'change un prix (2 audits)',   'UPDATE stock_boutique SET prix_vente = prix_vente + 1 WHERE produit_id = 2', 'lignes=1');
SELECT tests.verifier(:'phase', 'utilisation boutique',        'INSERT INTO utilisations_boutique (stock_boutique_id, quantite_utilisee, utilisateur_id) VALUES (1, 1, auth.uid())', 'lignes=1');
SELECT tests.verifier(:'phase', 'clôture : arrêt de caisse',   'INSERT INTO arrets_caisse (vendeur_id, date_arret) VALUES (auth.uid(), current_date)', 'lignes=1');
SELECT tests.verifier(:'phase', 'demande groupée (notifie)',   'INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES (''Boutique'', auth.uid(), 1)', 'lignes=1');
SELECT tests.verifier(:'phase', 'ligne de demande',            'INSERT INTO demandes (produit_id, quantite, demandeur_id, demande_groupee_id) VALUES (1, 2, auth.uid(), 1)', 'lignes=1');
SELECT tests.verifier(:'phase', 'lit ses notifications',       'SELECT 1 FROM notifications WHERE destinataire_id = auth.uid() LIMIT 1', 'lignes>0');
SELECT tests.verifier(:'phase', 'marque ses notifications lues', 'UPDATE notifications SET lu = true WHERE destinataire_id = auth.uid()', 'lignes>0');

-- ===================== 2. Vendeuse : ce qui doit lui être retiré =====================
SELECT tests.verifier(:'phase', 'se promeut admin',            'UPDATE profiles SET role = ''admin'' WHERE id = auth.uid()', :'refus_silencieux');
SELECT tests.verifier(:'phase', 'modifie le profil d''un autre', 'UPDATE profiles SET nom = ''pirate'' WHERE username = ''chef''', :'refus_silencieux');
SELECT tests.verifier(:'phase', 'modifie une vente passée',    'UPDATE ventes SET total = 0 WHERE numero_ticket = ''V-SEED-1''', :'refus_silencieux');
SELECT tests.verifier(:'phase', 'efface une ligne de vente',   format('DELETE FROM lignes_vente WHERE vente_id = (SELECT id FROM ventes WHERE numero_ticket = %L)', 'V2-EMP-' || :'phase'), :'refus_silencieux');
SELECT tests.verifier(:'phase', 'efface l''audit des prix',    'DELETE FROM audit_prix_simple WHERE id = (SELECT min(id) FROM audit_prix_simple)', :'refus_silencieux');
SELECT tests.verifier(:'phase', 'appelle create_user_with_profile', 'SELECT create_user_with_profile(''x'',''x'',''x'',''x'',''x'',''admin'')', :'refus_erreur');
SELECT tests.verifier(:'phase', 'appelle admin_force_password_change', 'SELECT admin_force_password_change(''a0000000-0000-4000-8000-000000000001'')', :'refus_erreur');
SELECT tests.verifier(:'phase', 'supprime un compte (safe_delete_user)', format('SELECT safe_delete_user(%L)', :'victime_vendeuse'), :'refus_erreur');
RESET ROLE;
-- Réparer ce que la vendeuse a pu modifier hors phase 2
UPDATE profiles SET role = 'employe_boutique' WHERE username = 'vendeuse';
UPDATE profiles SET nom = 'Chef Admin' WHERE username = 'chef';
UPDATE ventes SET total = 1000 WHERE numero_ticket = 'V-SEED-1';
SELECT tests.verifier(:'phase', 'compte visé par la vendeuse encore présent',
  format('SELECT 1 FROM auth.users WHERE id = %L', :'victime_vendeuse'), CASE WHEN :'phase' = 'p2' THEN 'lignes=1' ELSE 'lignes=0' END);

-- ===================== 3. Admin (non super admin) =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT tests.verifier(:'phase', 'production vers boutique (déclencheurs sans EXECUTE)', 'INSERT INTO productions (produit, quantite, destination, producteur_id) VALUES (''Croissant'', 5, ''Boutique'', auth.uid())', 'lignes=1');
SELECT tests.verifier(:'phase', 'modifie nom, téléphone et rôle d''un employé', 'UPDATE profiles SET nom = ''Awa B.'', telephone = ''0700'', role = ''employe_boutique'' WHERE username = ''vendeuse''', 'lignes=1');
SELECT tests.verifier(:'phase', 'désactive puis réactive un employé', 'UPDATE profiles SET actif = actif WHERE username = ''vendeuse''', 'lignes=1');
SELECT tests.verifier(:'phase', 'annule une vente',            format('UPDATE ventes SET statut = ''annulee'' WHERE numero_ticket = %L', 'V2-EMP-' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'refuse une demande (notifie)', 'UPDATE demandes_groupees SET statut = ''refusee'', valideur_id = auth.uid() WHERE id = (SELECT max(id) FROM demandes_groupees)', 'lignes=1');
SELECT tests.verifier(:'phase', 'validation : rpc decrement_stock', 'SELECT decrement_stock(3, 1)', 'lignes=1');
SELECT tests.verifier(:'phase', 'lit admin_security_view',     'SELECT * FROM admin_security_view', 'lignes>0');
SELECT tests.verifier(:'phase', 'supprime un employé (safe_delete_user)', format('SELECT safe_delete_user(%L)', :'victime_admin'), 'lignes=1');
SELECT tests.verifier(:'phase', 'se donne le droit super admin', 'UPDATE profiles SET is_super_admin = true WHERE id = auth.uid()', :'refus_erreur');
\if :est_p2
SELECT tests.verifier(:'phase', 'rétrograde le propriétaire',  'UPDATE profiles SET role = ''employe_boutique'' WHERE username = ''proprietaire''', 'erreur');
SELECT tests.verifier(:'phase', 'désactive le propriétaire',   'UPDATE profiles SET actif = false WHERE username = ''proprietaire''', 'erreur');
SELECT tests.verifier(:'phase', 'supprime le propriétaire',    'SELECT safe_delete_user(''b0000000-0000-4000-8000-000000000002'')', 'erreur');
SELECT tests.verifier(:'phase', 'se supprime lui-même',        'SELECT safe_delete_user(auth.uid())', 'erreur');
SELECT tests.verifier(:'phase', 'change un nom d''utilisateur', 'UPDATE profiles SET username = ''awa2'' WHERE username = ''vendeuse''', 'erreur');
SELECT tests.verifier(:'phase', 'modifie le nom du propriétaire (autorisé)', 'UPDATE profiles SET telephone = ''0101'' WHERE username = ''proprietaire''', 'lignes=1');
\endif
RESET ROLE;
UPDATE profiles SET is_super_admin = false WHERE username = 'chef';

-- ===================== 4. Super admin (propriétaire) =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}', false);
SELECT tests.verifier(:'phase', 'super admin nomme un super admin', 'UPDATE profiles SET is_super_admin = true WHERE username = ''chef''', 'lignes=1');
SELECT tests.verifier(:'phase', 'super admin lui retire ce droit',  'UPDATE profiles SET is_super_admin = false WHERE username = ''chef''', 'lignes=1');
RESET ROLE;

-- ===================== 5. Compte désactivé =====================
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000004"}', false);
SELECT tests.verifier(:'phase', 'inactif lit son profil (connexion)', 'SELECT * FROM profiles WHERE id = auth.uid()', 'lignes=1');
SELECT tests.verifier(:'phase', 'inactif lit les notifications', 'SELECT * FROM notifications', CASE WHEN :'phase' = 'p2' THEN 'lignes=0' ELSE 'lignes>0' END);
SELECT tests.verifier(:'phase', 'inactif lit les ventes',      'SELECT * FROM ventes', 'lignes=0');
RESET ROLE;

-- ===================== 6. Serveur et visiteur =====================
-- Création du compte par Supabase Auth (createUser), puis la route fixe le rôle avec service_role
INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('nouveau2_' || :'phase' || '@shine.local', json_build_object('username', 'nouveau2_' || :'phase'));
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SELECT tests.verifier(:'phase', 'create-user fixe le rôle',    format('UPDATE profiles SET role = ''admin'' WHERE username = %L', 'nouveau2_' || :'phase'), 'lignes=1');
SELECT tests.verifier(:'phase', 'route update-user modifie le propriétaire', 'UPDATE profiles SET telephone = ''0202'' WHERE username = ''proprietaire''', 'lignes=1');
SELECT tests.verifier(:'phase', 'route cancel-sale met à jour une vente', 'UPDATE ventes SET statut = statut WHERE id = 1', 'lignes=1');
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tests.verifier(:'phase', 'anon toujours bloqué',        'SELECT * FROM profiles', 'erreur');
SELECT tests.verifier(:'phase', 'anon : aucune fonction exécutable',
  'SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ''public'' AND has_function_privilege(''anon'', p.oid, ''EXECUTE'')', 'lignes=0');
SELECT tests.verifier(:'phase', 'connectés : aucune fonction hors liste autorisée',
  'SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ''public'' AND has_function_privilege(''authenticated'', p.oid, ''EXECUTE'') AND p.proname NOT IN (''est_utilisateur_actif'', ''est_admin'', ''notify_all_admins'', ''send_notification'', ''ajouter_stock_boutique'', ''decrement_stock'', ''safe_delete_user'', ''enregistrer_vente_boutique'', ''role_courant'', ''verifier_journal_stock'', ''valider_demande_groupee'', ''refuser_demande'', ''envoyer_atelier_vers_boutique'', ''annuler_envoi'', ''receptionner_envoi'', ''creer_produit'', ''reapprovisionner_produit'', ''modifier_produit'', ''ajuster_stock_principal'', ''archiver_produit'', ''ajuster_stock_atelier'', ''vider_stock_atelier'', ''utiliser_stock_boutique'')',
  CASE WHEN :'phase' = 'p2' THEN 'lignes=0' ELSE 'lignes>0' END);
RESET ROLE;

-- ===================== 7. Effets réels des déclencheurs pendant cette phase =====================
SELECT tests.verifier(:'phase', 'déclencheur : audit prix simple', format('SELECT 1 FROM audit_prix_simple WHERE changed_at >= %L::timestamptz::timestamp', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : audit prix détaillé', format('SELECT 1 FROM audit_prix_changes WHERE changed_at >= %L::timestamptz::timestamp', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : utilisation reportée', format('SELECT 1 FROM stock_boutique WHERE id = 1 AND updated_at >= %L::timestamptz::timestamp', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : production en boutique', format('SELECT 1 FROM entrees_boutique WHERE source = ''Production'' AND created_at >= %L', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : notification aux admins', format('SELECT 1 FROM notifications WHERE type = ''demande_nouvelle'' AND created_at >= %L', :'debut'), 'lignes>0');
SELECT tests.verifier(:'phase', 'déclencheur : notification à la vendeuse', format('SELECT 1 FROM notifications WHERE type = ''demande_refusee'' AND created_at >= %L', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'déclencheur : mouvement de stock tracé', format('SELECT 1 FROM mouvements_stock WHERE produit_id = 3 AND created_at >= %L', :'debut'), 'lignes=1');
SELECT tests.verifier(:'phase', 'propriétaire intact',         'SELECT 1 FROM profiles WHERE username = ''proprietaire'' AND role = ''admin'' AND actif', 'lignes=1');

-- ===================== 8. Fonction créée après coup =====================
CREATE FUNCTION public.fonction_future_test() RETURNS int LANGUAGE sql AS 'SELECT 1';
SELECT tests.verifier(:'phase', 'fonction future : anon peut l''exécuter',
  'SELECT 1 WHERE has_function_privilege(''anon'', ''public.fonction_future_test()'', ''EXECUTE'')',
  CASE WHEN :'phase' = 'p2' THEN 'lignes=0' ELSE 'lignes=1' END);
SELECT tests.verifier(:'phase', 'fonction future : connectés peuvent l''exécuter',
  'SELECT 1 WHERE has_function_privilege(''authenticated'', ''public.fonction_future_test()'', ''EXECUTE'')', 'lignes=1');
DROP FUNCTION public.fonction_future_test();
