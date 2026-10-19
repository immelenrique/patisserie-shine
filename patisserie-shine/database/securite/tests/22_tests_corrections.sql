-- Scénario des corrections, exécuté deux fois : phase = corr (corrections appliquées) | corr_annule
\set ON_ERROR_STOP on
SELECT now() AS debut, (:'phase' = 'corr') AS est_corr,
       CASE WHEN :'phase' = 'corr' THEN 'lignes=1' ELSE 'erreur' END AS si_corrige \gset

-- 1. Prix des produits (prix_vente_produits) : création et modification par un admin
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT tests.verifier(:'phase', 'crée un prix produit',        'INSERT INTO prix_vente_produits (produit_id, prix) VALUES (2, 600)', :'si_corrige');
SELECT tests.verifier(:'phase', 'modifie un prix produit',     'UPDATE prix_vente_produits SET prix = prix + 50 WHERE produit_id = 2', CASE WHEN :'phase' = 'corr' THEN 'lignes=1' ELSE 'lignes=0' END);
SELECT tests.verifier(:'phase', 'prix recette (autre table surveillée)', format('INSERT INTO prix_vente_recettes (nom_produit, prix_vente) VALUES (%L, 800)', 'Gateau-' || :'phase'), 'lignes=1');
RESET ROLE;
SELECT tests.verifier(:'phase', 'audit : création prix produit tracée avec nom et auteur',
  format('SELECT 1 FROM audit_prix_changes WHERE table_source = ''prix_vente_produits'' AND operation_type = ''INSERT'' AND nom_produit = ''Croissant'' AND nouveau_prix = 600 AND user_id = ''a0000000-0000-4000-8000-000000000001'' AND changed_at >= %L::timestamptz::timestamp', :'debut'),
  CASE WHEN :'phase' = 'corr' THEN 'lignes=1' ELSE 'lignes=0' END);
SELECT tests.verifier(:'phase', 'audit : modification prix produit tracée (600 -> 650)',
  format('SELECT 1 FROM audit_prix_changes WHERE table_source = ''prix_vente_produits'' AND operation_type = ''UPDATE'' AND ancien_prix = 600 AND nouveau_prix = 650 AND changed_at >= %L::timestamptz::timestamp', :'debut'),
  CASE WHEN :'phase' = 'corr' THEN 'lignes=1' ELSE 'lignes=0' END);
SELECT tests.verifier(:'phase', 'audit : prix recette toujours tracé',
  format('SELECT 1 FROM audit_prix_changes WHERE table_source = ''prix_vente_recettes'' AND nom_produit = %L AND nouveau_prix = 800', 'Gateau-' || :'phase'), 'lignes=1');
DELETE FROM prix_vente_produits WHERE produit_id = 2;

-- 2. Rôles (route serveur create-user / update-user, service_role)
SET ROLE service_role;
SELECT tests.verifier(:'phase', 'rôle employe_production',     'UPDATE profiles SET role = ''employe_production'' WHERE username = ''nouveau2_p2''', :'si_corrige');
SELECT tests.verifier(:'phase', 'rôle employe_cuisine',        'UPDATE profiles SET role = ''employe_cuisine'' WHERE username = ''victime_annul''', :'si_corrige');
SELECT tests.verifier(:'phase', 'rôle inventé refusé',         'UPDATE profiles SET role = ''pirate'' WHERE username = ''nouveau2_p2''', 'erreur');
SELECT tests.verifier(:'phase', 'rôles admin et boutique toujours acceptés', 'UPDATE profiles SET role = role WHERE role IN (''admin'', ''employe_boutique'')', 'lignes>0');
RESET ROLE;
-- Remettre des rôles acceptés par les anciennes contraintes, sinon l'annulation est refusée (voulu)
UPDATE profiles SET role = 'employe_boutique' WHERE role IN ('employe_production', 'employe_cuisine');

-- 3. search_path
SELECT tests.verifier(:'phase', 'fonctions public sans search_path fixe',
  'SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ''public'' AND p.prokind = ''f'' AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, ''{}'')) c WHERE c LIKE ''search_path=%'')',
  CASE WHEN :'phase' = 'corr' THEN 'lignes=0' ELSE 'lignes>0' END);
