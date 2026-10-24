-- Scénario de la partie 8 (phase = inventaire). Données : celles de lancer_inventaires.sh (parties 1 à 8).
-- Stock principal : Farine 1 (100 kg, 500 F), Sucre 3 (40 kg, 300 F), Pain 6 (30) ; atelier : Farine 20 ;
-- boutique : Croissant 2 (50, ligne 1, 500 F), Tarte 4 (1), Sans prix 5 (10).
\set ON_ERROR_STOP on
\set MAG '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set uid_mag 'f0000000-0000-4000-8000-000000000014'
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_prod 'f0000000-0000-4000-8000-000000000011'
\set uid_proprio 'b0000000-0000-4000-8000-000000000002'

-- ============ A. Qui compte où ; les quantités attendues restent cachées ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('inventaire', 'boutique : pas d''inventaire du stock principal', 'SELECT inventaire_ouvrir(''principal'')', 'erreur');
SELECT tests.verifier('inventaire', 'boutique : quantité attendue inaccessible (stock_lieu)', 'SELECT stock_lieu(''boutique'', 2)', 'erreur');
SELECT tests.verifier('inventaire', 'boutique : liste avec quantités inaccessible (produits_du_lieu)', 'SELECT * FROM produits_du_lieu(''boutique'')', 'erreur');
SELECT tests.verifier('inventaire', 'boutique : écriture directe du stock par l''outil interne refusée', 'SELECT stock_lieu_modifier(''boutique'', 2, 5)', 'erreur');
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('inventaire', 'production : pas d''inventaire de la boutique', 'SELECT inventaire_ouvrir(''boutique'')', 'erreur');
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('inventaire', 'magasinier : pas d''inventaire de l''atelier', 'SELECT inventaire_ouvrir(''atelier'')', 'erreur');
SELECT tests.verifier('inventaire', 'magasinier : réglage du rythme refusé', 'SELECT regler_inventaires(''principal'', ''tirage'', 5, ''quotidienne'', 1)', 'erreur');
SELECT inventaires_a_faire() AS af_mag \gset
RESET ROLE;
SELECT tests.verifier('inventaire', 'magasinier : « à faire » ne propose que le stock principal',
  format('SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(%L::jsonb) x WHERE x->>''lieu'' <> ''principal'')', :'af_mag'), 'lignes=1');

-- ============ B. Inventaire complet du stock principal par le magasinier ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT inventaire_ouvrir('principal') AS o1 \gset
SELECT inventaire_ouvrir('principal') AS o1bis \gset
SELECT (:'o1'::jsonb ->> 'inventaire_id')::bigint AS i1 \gset
SELECT tests.verifier('inventaire', 'magasinier : lignes de l''inventaire illisibles en direct', 'SELECT 1 FROM inventaire_lignes', 'lignes=0');
SELECT tests.verifier('inventaire', 'comptage refusé pour un produit hors inventaire', format('SELECT inventaire_compter(%s, ''[{"produit_id":2,"quantite":1}]'')', :i1), 'erreur');
SELECT tests.verifier('inventaire', 'quantité négative refusée', format('SELECT inventaire_compter(%s, ''[{"produit_id":1,"quantite":-1}]'')', :i1), 'erreur');
SELECT inventaire_compter(:i1, '[{"produit_id":1,"quantite":100},{"produit_id":3,"quantite":38}]') AS c1 \gset
SELECT tests.verifier('inventaire', 'fin refusée tant qu''un produit n''est pas compté', format('SELECT inventaire_cloturer(%s)', :i1), 'erreur');
SELECT inventaire_compter(:i1, '[{"produit_id":6,"quantite":30}]') AS c2 \gset
SELECT inventaire_cloturer(:i1) AS f1 \gset
SELECT inventaire_compter(:i1, '[{"produit_id":3,"quantite":38}]') AS c3 \gset
SELECT inventaire_cloturer(:i1) AS f2 \gset
SELECT inventaire_cloturer(:i1, '{"3":"sac percé, sucre perdu"}') AS f3 \gset
SELECT tests.verifier('inventaire', 'inventaire terminé : plus de comptage', format('SELECT inventaire_compter(%s, ''[{"produit_id":1,"quantite":1}]'')', :i1), 'erreur');
SELECT inventaires_a_faire() AS af_mag2 \gset
RESET ROLE;
SELECT tests.verifier('inventaire', 'ouverture : complet = les 3 produits en stock, sans aucune quantité',
  format('SELECT 1 WHERE (%L::jsonb ->> ''mode'') = ''complet'' AND jsonb_array_length(%L::jsonb -> ''lignes'') = 3 AND NOT (%L::jsonb::text ~ ''theorique|stock|attendu'')', :'o1', :'o1', :'o1'), 'lignes=1');
SELECT tests.verifier('inventaire', 'second appui : le même inventaire',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_ouvert'')::boolean AND (%L::jsonb ->> ''inventaire_id'')::bigint = %s', :'o1bis', :'o1bis', :i1), 'lignes=1');
SELECT tests.verifier('inventaire', 'comptages : 2 notés, 1 restant', format('SELECT 1 WHERE (%L::jsonb ->> ''restants'')::int = 1', :'c1'), 'lignes=1');
SELECT tests.verifier('inventaire', 'premier passage : le sucre est à recompter, sans quantité révélée',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''a_recompter'' AND %L::jsonb -> ''a_recompter'' @> ''[{"produit_id":3}]'' AND jsonb_array_length(%L::jsonb -> ''a_recompter'') = 1 AND NOT (%L::jsonb::text ~ ''40'')', :'f1', :'f1', :'f1', :'f1'), 'lignes=1');
SELECT tests.verifier('inventaire', 'après recomptage : motif demandé pour le sucre',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''motif_requis'' AND %L::jsonb -> ''motif_requis'' @> ''[{"produit_id":3}]''', :'f2', :'f2'), 'lignes=1');
SELECT tests.verifier('inventaire', 'fin : 1 écart de -2 kg, -600 F',
  format('SELECT 1 WHERE %L::jsonb ->> ''statut'' = ''termine'' AND (%L::jsonb ->> ''nb_ecarts'')::int = 1 AND (%L::jsonb ->> ''valeur_ecarts'')::numeric = -600 AND %L::jsonb -> ''ecarts'' @> ''[{"produit_id":3,"attendu":40,"compte":38,"ecart":-2}]''', :'f3', :'f3', :'f3', :'f3'), 'lignes=1');
SELECT tests.verifier('inventaire', 'stock principal : sucre 40 → 38, farine et pain inchangés',
  'SELECT 1 FROM produits a, produits b, produits c WHERE a.id = 3 AND a.quantite_restante = 38 AND b.id = 1 AND b.quantite_restante = 100 AND c.id = 6 AND c.quantite_restante = 30', 'lignes=1');
SELECT tests.verifier('inventaire', 'journal : écart d''inventaire signé par le magasinier, avec le motif',
  format('SELECT 1 FROM journal_stock WHERE nature = ''inventaire'' AND lieu = ''principal'' AND produit_id = 3 AND quantite = -2 AND auteur_id = %L AND motif = ''Inventaire n°%s : sac percé, sucre perdu''', :'uid_mag', :i1), 'lignes=1');
SELECT tests.verifier('inventaire', 'les deux comptages du sucre sont gardés',
  format('SELECT 1 FROM inventaire_lignes WHERE inventaire_id = %s AND produit_id = 3 AND jsonb_array_length(comptages) = 2 AND ecart = -2', :i1), 'lignes=1');
SELECT tests.verifier('inventaire', 'propriétaire et gérants prévenus',
  'SELECT 1 FROM notifications WHERE type = ''alerte_generale'' AND message LIKE ''Inventaire du stock principal : 1 écart(s), -600 F''', 'lignes>0');
SELECT tests.verifier('inventaire', 'magasinier : plus d''inventaire attendu aujourd''hui',
  format('SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(%L::jsonb) x WHERE x->>''lieu'' = ''principal'' AND (x->>''attendu'')::boolean)', :'af_mag2'), 'lignes=1');

-- ============ C. Boutique : une vente pendant l'inventaire reste comptée ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT (inventaire_ouvrir('boutique') ->> 'inventaire_id')::bigint AS i2 \gset
SELECT inventaire_compter(:i2, '[{"produit_id":2,"quantite":49},{"produit_id":4,"quantite":1},{"produit_id":5,"quantite":10}]') IS NOT NULL AS ok \gset
-- Deux croissants vendus après le comptage (stock 50 → 48)
SELECT enregistrer_vente_boutique('[{"id":2,"quantite":2}]', 1000) IS NOT NULL AS ok \gset
SELECT inventaire_cloturer(:i2) AS g1 \gset
-- Recomptage : 47 en rayon pour 48 attendus
SELECT inventaire_compter(:i2, '[{"produit_id":2,"quantite":47}]') IS NOT NULL AS ok \gset
SELECT inventaire_cloturer(:i2) AS g2 \gset
SELECT inventaire_cloturer(:i2, '{"2":"un croissant écrasé jeté"}') AS g3 \gset
RESET ROLE;
SELECT tests.verifier('inventaire', 'boutique : seul le croissant ne correspond pas',
  format('SELECT 1 WHERE %L::jsonb -> ''a_recompter'' = ''[{"nom":"Croissant","unite":"Pièces","produit_id":2}]''::jsonb', :'g1'), 'lignes=1');
SELECT tests.verifier('inventaire', 'boutique : -1 croissant, la vente faite pendant l''inventaire reste comptée (47)',
  format('SELECT 1 FROM stock_boutique WHERE produit_id = 2 AND quantite_disponible - quantite_vendue - coalesce(quantite_utilisee, 0) = 47 AND %L::jsonb ->> ''statut'' = ''termine'' AND (%L::jsonb ->> ''nb_ecarts'')::int = 1', :'g3', :'g3'), 'lignes=1');

-- ============ D. Atelier : tirage au hasard, rien à redire ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT inventaires_a_faire() AS af_prod \gset
SELECT inventaire_ouvrir('atelier') AS o3 \gset
SELECT inventaire_compter((:'o3'::jsonb ->> 'inventaire_id')::bigint, '[{"produit_id":1,"quantite":20}]') IS NOT NULL AS ok \gset
SELECT inventaire_cloturer((:'o3'::jsonb ->> 'inventaire_id')::bigint) AS h1 \gset
SELECT inventaires_a_faire() AS af_prod2 \gset
RESET ROLE;
SELECT tests.verifier('inventaire', 'production : inventaire du soir attendu à l''atelier (tirage)',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb) x WHERE x->>''lieu'' = ''atelier'' AND x->>''mode'' = ''tirage'' AND (x->>''attendu'')::boolean', :'af_prod'), 'lignes=1');
SELECT tests.verifier('inventaire', 'atelier : tirage, juste, aucun écart, fait pour aujourd''hui',
  format('SELECT 1 WHERE %L::jsonb ->> ''mode'' = ''tirage'' AND %L::jsonb ->> ''statut'' = ''termine'' AND (%L::jsonb ->> ''nb_ecarts'')::int = 0 AND jsonb_array_length(%L::jsonb) = 0', :'o3', :'h1', :'h1', :'af_prod2'), 'lignes=1');

-- ============ E. Rythme réglé par le propriétaire ; tirage de N produits ; annulation ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('inventaire', 'gérant : réglage refusé', 'SELECT regler_inventaires(''principal'', ''tirage'', 2, ''quotidienne'', 1)', 'erreur');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT tests.verifier('inventaire', 'propriétaire : principal en tirage de 2 produits, chaque soir', 'SELECT regler_inventaires(''principal'', ''tirage'', 2, ''quotidienne'', 1)', 'lignes=1');
SELECT tests.verifier('inventaire', 'réglage invalide refusé', 'SELECT regler_inventaires(''principal'', ''hasard'', 2, ''quotidienne'', 1)', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT inventaire_ouvrir('principal') AS o4 \gset
SELECT tests.verifier('inventaire', 'tirage : 2 produits sur 3', format('SELECT 1 WHERE jsonb_array_length(%L::jsonb -> ''lignes'') = 2 AND %L::jsonb ->> ''mode'' = ''tirage''', :'o4', :'o4'), 'lignes=1');
SELECT tests.verifier('inventaire', 'annulation sans motif refusée', format('SELECT inventaire_annuler(%s, '''')', (:'o4'::jsonb ->> 'inventaire_id')), 'erreur');
SELECT tests.verifier('inventaire', 'gérant : annule l''inventaire', format('SELECT inventaire_annuler(%s, ''lancé par erreur'')', (:'o4'::jsonb ->> 'inventaire_id')), 'lignes=1');
SELECT inventaire_ouvrir('principal', 'complet') AS o5 \gset
SELECT tests.verifier('inventaire', 'gérant : peut choisir un inventaire complet', format('SELECT 1 WHERE jsonb_array_length(%L::jsonb -> ''lignes'') = 3', :'o5'), 'lignes=1');
SELECT inventaire_annuler((:'o5'::jsonb ->> 'inventaire_id')::bigint, 'contrôle du choix') IS NOT NULL AS ok \gset
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT inventaire_ouvrir('principal', 'complet') AS o6 \gset
SELECT tests.verifier('inventaire', 'magasinier : le mode réglé s''impose (tirage de 2)', format('SELECT 1 WHERE jsonb_array_length(%L::jsonb -> ''lignes'') = 2', :'o6'), 'lignes=1');
SELECT tests.verifier('inventaire', 'magasinier : ne peut pas annuler', format('SELECT inventaire_annuler(%s, ''pas envie'')', (:'o6'::jsonb ->> 'inventaire_id')), 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT inventaire_annuler((:'o6'::jsonb ->> 'inventaire_id')::bigint, 'contrôle du mode') IS NOT NULL AS ok \gset
RESET ROLE;
SELECT tests.verifier('inventaire', 'annulations : stock inchangé', 'SELECT 1 FROM produits WHERE id = 3 AND quantite_restante = 38', 'lignes=1');

-- ============ F. Pertes : déclarées sur place, décidées par le propriétaire ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT tests.verifier('inventaire', 'perte : motif obligatoire', 'SELECT declarer_perte(''atelier'', 1, 3, '''')', 'erreur');
SELECT tests.verifier('inventaire', 'perte : plus que le stock refusée', 'SELECT declarer_perte(''atelier'', 1, 25, ''pâte ratée'')', 'erreur');
SELECT tests.verifier('inventaire', 'perte : pas pour un autre lieu', 'SELECT declarer_perte(''boutique'', 2, 1, ''tombé'')', 'erreur');
SELECT declarer_perte('atelier', 1, 3, 'pâte ratée', '99999999-eeee-4eee-8eee-000000000001') AS p1 \gset
SELECT declarer_perte('atelier', 1, 3, 'pâte ratée', '99999999-eeee-4eee-8eee-000000000001') AS p1bis \gset
SELECT tests.verifier('inventaire', 'liste des produits pour une perte : noms seulement',
  'SELECT 1 FROM produits_pour_perte(''atelier'') x WHERE x.produit_id = 1 AND x.nom = ''Farine''', 'lignes=1');
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT declarer_perte('boutique', 4, 1, 'tarte tombée par terre') AS p2 \gset
SELECT tests.verifier('inventaire', 'boutique : ne voit que ses pertes', 'SELECT 1 FROM pertes', 'lignes=1');
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT declarer_perte('principal', 6, 5, 'pains moisis') AS p3 \gset
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('inventaire', 'gérant : ne valide pas une perte', format('SELECT decider_perte(%s, true)', (:'p1'::jsonb ->> 'perte_id')), 'erreur');
SELECT tests.verifier('inventaire', 'gérant : ne liste pas les pertes à valider', 'SELECT pertes_a_valider()', 'erreur');
SELECT tests.verifier('inventaire', 'gérant : écriture directe d''une décision refusée', 'UPDATE pertes SET statut = ''acceptee''', 'erreur');
-- Le pain baisse avant la décision : la perte n'est plus couverte
SELECT ajuster_stock_principal(6, 2, 'recomptage') IS NOT NULL AS ok \gset
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT pertes_a_valider() AS pav \gset
SELECT decider_perte((:'p1'::jsonb ->> 'perte_id')::bigint, true) AS d1 \gset
SELECT decider_perte((:'p1'::jsonb ->> 'perte_id')::bigint, false, 'second clic') AS d1bis \gset
SELECT tests.verifier('inventaire', 'refus sans motif refusé', format('SELECT decider_perte(%s, false)', (:'p2'::jsonb ->> 'perte_id')), 'erreur');
SELECT tests.verifier('inventaire', 'propriétaire : refuse la perte de tarte', format('SELECT decider_perte(%s, false, ''Tarte vendue hier, voir la caisse'')', (:'p2'::jsonb ->> 'perte_id')), 'lignes=1');
SELECT tests.verifier('inventaire', 'acceptation impossible si le stock ne couvre plus la perte', format('SELECT decider_perte(%s, true)', (:'p3'::jsonb ->> 'perte_id')), 'erreur');
SELECT decider_perte((:'p3'::jsonb ->> 'perte_id')::bigint, false, 'stock déjà corrigé') IS NOT NULL AS ok \gset
SELECT recap_inventaires(current_date, current_date) AS r \gset
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('inventaire', 'boutique : pas de récapitulatif des inventaires', 'SELECT recap_inventaires(current_date, current_date)', 'erreur');
RESET ROLE;
SELECT tests.verifier('inventaire', 'perte : en attente, même clé = même perte, stock atelier inchangé avant décision',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_enregistre'')::boolean AND (%L::jsonb ->> ''perte_id'') = (%L::jsonb ->> ''perte_id'') AND (SELECT count(*) FROM pertes WHERE lieu = ''atelier'') = 1',
    :'p1bis', :'p1bis', :'p1'), 'lignes=1');
SELECT tests.verifier('inventaire', 'à valider : 3 pertes, farine 3 kg = 1 500 F, déclarée par l''atelier',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb) x WHERE jsonb_array_length(%L::jsonb) = 3 AND x->>''produit'' = ''Farine'' AND (x->>''valeur'')::numeric = 1500 AND x->>''par'' LIKE ''Atelier%%''', :'pav', :'pav'), 'lignes=1');
SELECT tests.verifier('inventaire', 'acceptée : atelier 20 → 17, journal « perte » signé par le propriétaire',
  format('SELECT 1 FROM stock_atelier s, journal_stock j WHERE s.produit_id = 1 AND s.quantite_disponible = 17 AND j.nature = ''perte'' AND j.lieu = ''atelier'' AND j.quantite = -3 AND j.auteur_id = %L AND j.motif LIKE ''%%pâte ratée''', :'uid_proprio'), 'lignes=1');
SELECT tests.verifier('inventaire', 'second clic : déjà décidée, rien de plus',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_decidee'')::boolean AND (SELECT count(*) FROM journal_stock WHERE nature = ''perte'') = 1', :'d1bis'), 'lignes=1');
SELECT tests.verifier('inventaire', 'refusée : tarte toujours en stock, motif gardé',
  'SELECT 1 FROM pertes p, stock_boutique s WHERE p.produit_id = 4 AND p.statut = ''refusee'' AND p.motif_refus LIKE ''Tarte vendue%'' AND s.produit_id = 4 AND s.quantite_disponible - s.quantite_vendue = 1', 'lignes=1');
SELECT tests.verifier('inventaire', 'les auteurs sont prévenus de la décision',
  format('SELECT 1 FROM notifications WHERE destinataire_id IN (%L, %L) AND message LIKE ''Perte %%'' HAVING count(DISTINCT destinataire_id) = 2', :'uid_prod', :'uid_vend'), 'lignes=1');
SELECT tests.verifier('inventaire', 'récap : 6 inventaires (3 terminés, 3 annulés), 3 pertes, aucune en attente',
  format('SELECT 1 WHERE jsonb_array_length(%L::jsonb -> ''inventaires'') = 6 AND jsonb_array_length(%L::jsonb -> ''pertes'') = 3 AND (%L::jsonb ->> ''pertes_en_attente'')::int = 0', :'r', :'r', :'r'), 'lignes=1');
SELECT tests.verifier('inventaire', 'récap : écart du sucre avec ses 2 comptages, le premier à 38, et son motif',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''inventaires'') i, jsonb_array_elements(i -> ''ecarts'') e WHERE e->>''produit'' = ''Sucre'' AND (e->>''comptages'')::int = 2 AND (e->>''premier'')::numeric = 38 AND (e->>''valeur'')::numeric = -600 AND e->>''motif'' LIKE ''sac percé%%''', :'r'), 'lignes=1');

-- ============ G. Rien ne s'écrit ni ne s'efface en direct ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('inventaire', 'gérant : faux inventaire refusé', format('INSERT INTO inventaires (lieu, mode, ouvert_par) VALUES (''atelier'', ''complet'', %L)', :'uid_proprio'), 'erreur');
SELECT tests.verifier('inventaire', 'gérant : modification d''un comptage refusée', 'UPDATE inventaire_lignes SET quantite_comptee = 40', 'erreur');
SELECT tests.verifier('inventaire', 'gérant : modification du rythme en direct refusée', 'UPDATE inventaires_reglages SET frequence = ''aucune''', 'erreur');
RESET ROLE;
SELECT tests.verifier('inventaire', 'suppression d''un inventaire impossible', 'DELETE FROM inventaires', 'erreur');
SELECT tests.verifier('inventaire', 'suppression d''une perte impossible', 'DELETE FROM pertes', 'erreur');
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('inventaire', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
