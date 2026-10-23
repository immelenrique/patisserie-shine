-- Scénario de la partie 6 (phase = magasin). Données : celles de lancer_magasinier.sh (parties 1 à 6 appliquées ;
-- Farine 1 (kg) et Pain 6 au stock principal ; comptes magasinier, vendeuse, prod (atelier), chef (gérant),
-- proprietaire (super admin)).
\set ON_ERROR_STOP on
\set MAG '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000014"}\''
\set VEND '\'{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}\''
\set CHEF '\'{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}\''
\set PROD '\'{"role":"authenticated","sub":"f0000000-0000-4000-8000-000000000011"}\''
\set PROPRIO '\'{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000002"}\''
\set uid_mag 'f0000000-0000-4000-8000-000000000014'
\set uid_vend 'c0000000-0000-4000-8000-000000000003'
\set uid_chef 'a0000000-0000-4000-8000-000000000001'
\set uid_proprio 'b0000000-0000-4000-8000-000000000002'

-- ============ A. Le rôle ============
SELECT tests.verifier('magasin', 'le rôle magasinier est accepté', format('SELECT 1 FROM profiles WHERE id = %L AND role = ''magasinier''', :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'un rôle inconnu reste refusé', format('UPDATE profiles SET role = ''patron'' WHERE id = %L', :'uid_mag'), 'erreur');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
-- Sans effet (aucune ligne modifiable) : la règle de la base réserve la modification des profils aux gérants
SELECT tests.verifier('magasin', 'le magasinier ne peut pas se donner le rôle de gérant', 'UPDATE profiles SET role = ''admin'' WHERE id = auth.uid()', 'lignes=0');
SELECT tests.verifier('magasin', 'le magasinier ne peut pas se déclarer super admin', 'UPDATE profiles SET is_super_admin = true WHERE id = auth.uid()', 'lignes=0');
RESET ROLE;
SELECT tests.verifier('magasin', 'son profil est inchangé', format('SELECT 1 FROM profiles WHERE id = %L AND role = ''magasinier'' AND NOT is_super_admin', :'uid_mag'), 'lignes=1');

-- ============ B. Il entre la marchandise achetée ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT reapprovisionner_produit(6, 10, 5000, current_date, '88888888-cccc-4ccc-8ccc-000000000001') AS r1 \gset
SELECT creer_produit('Beurre', current_date, 4, 12000, 2, NULL, '88888888-cccc-4ccc-8ccc-000000000002') AS c1 \gset
SELECT tests.verifier('magasin', 'magasinier : correction du stock refusée', 'SELECT ajuster_stock_principal(6, 1, ''recomptage'')', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : modification du prix d''achat refusée', 'SELECT modifier_produit(6, ''Pain'', NULL, 1, 1)', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : archivage refusé', 'SELECT archiver_produit(6, ''plus vendu'')', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : écriture directe d''une quantité refusée', 'UPDATE produits SET quantite_restante = 999 WHERE id = 6', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : écriture directe d''un prix refusée', 'UPDATE produits SET prix_achat = 1 WHERE id = 6', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : vider le stock atelier refusé', 'SELECT vider_stock_atelier(''test'')', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : pas de caisse', 'SELECT ouvrir_caisse(0)', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : pas de récapitulatif', 'SELECT recap_periode(current_date, current_date)', 'erreur');
SELECT tests.verifier('magasin', 'magasinier : pas de journal du stock', 'SELECT 1 FROM journal_stock LIMIT 1', 'lignes=0');
RESET ROLE;
SELECT (:'r1'::jsonb ->> 'depense_id')::integer AS dep_pain, (:'c1'::jsonb ->> 'depense_id')::integer AS dep_beurre,
       (:'c1'::jsonb ->> 'produit_id')::integer AS beurre \gset
SELECT tests.verifier('magasin', 'achat du magasinier : stock 30 + 10, dépense de 5 000 F à son nom',
  format('SELECT 1 FROM produits p, depenses_comptables d WHERE p.id = 6 AND p.quantite_restante = 40 AND d.id = %s AND d.montant = 5000 AND d.utilisateur_id = %L', :dep_pain, :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'achat du magasinier : signé au journal',
  format('SELECT 1 FROM depenses_comptables d JOIN journal_stock j ON j.id = d.achat_journal_id WHERE d.id = %s AND j.auteur_id = %L AND j.quantite = 10', :dep_pain, :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'nouveau produit du magasinier : Beurre 4 kg, dépense de 12 000 F',
  format('SELECT 1 FROM produits p, depenses_comptables d WHERE p.id = %s AND p.quantite_restante = 4 AND d.id = %s AND d.montant = 12000 AND d.type_depense = ''achat_stock''', :beurre, :dep_beurre), 'lignes=1');
-- Le reçu de son achat
INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ('depenses-pieces-jointes', :'uid_mag' || '/achats/pain.jpg', :'uid_mag', :'uid_mag');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('magasin', 'magasinier : joint le reçu de son achat',
  format('SELECT joindre_recu(%s, ''{"chemin":"%s/achats/pain.jpg","nom":"pain.jpg"}'')', :dep_pain, :'uid_mag'), 'lignes=1');
RESET ROLE;

-- ============ C. Il fait sortir la marchandise ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g1 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 8, 'Boutique', :'uid_vend', :g1);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', :'uid_vend', 1) RETURNING id AS g2 \gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 2, 'Boutique', :'uid_vend', :g2);
RESET ROLE;
SELECT tests.verifier('magasin', 'le magasinier est prévenu des nouvelles demandes',
  format('SELECT 1 FROM notifications WHERE destinataire_id = %L AND type = ''demande_nouvelle'' HAVING count(*) = 2', :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'les gérants le sont toujours',
  format('SELECT 1 FROM notifications WHERE destinataire_id = %L AND type = ''demande_nouvelle'' HAVING count(*) >= 2', :'uid_chef'), 'lignes=1');

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT valider_demande_groupee(:g1, NULL) AS v1 \gset
SELECT tests.verifier('magasin', 'magasinier : refuse une demande', format('SELECT refuser_demande(%s, ''pas assez de pain'')', :g2), 'lignes=1');
SELECT (:'v1'::jsonb ->> 'envoi_id')::bigint AS e1 \gset
SELECT tests.verifier('magasin', 'magasinier : voit l''envoi qu''il a fait partir', format('SELECT 1 FROM envois WHERE id = %s', :e1), 'lignes=1');
SELECT tests.verifier('magasin', 'magasinier : voit ses lignes', format('SELECT 1 FROM envoi_lignes WHERE envoi_id = %s AND quantite_envoyee = 8', :e1), 'lignes=1');
SELECT tests.verifier('magasin', 'magasinier : ne réceptionne pas à la boutique',
  format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":8}]'')', :e1), 'erreur');
SELECT tests.verifier('magasin', 'magasinier : n''annule pas un envoi', format('SELECT annuler_envoi(%s, ''erreur de saisie'')', :e1), 'erreur');
RESET ROLE;
SELECT tests.verifier('magasin', 'sortie : stock principal 40 - 8, envoi signé par le magasinier, en transit',
  format('SELECT 1 FROM produits p, envois e WHERE p.id = 6 AND p.quantite_restante = 32 AND e.id = %s AND e.valideur_id = %L AND e.statut = ''en_transit'' AND NOT e.auto_validation', :e1, :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'refus : demande refusée par le magasinier, stock inchangé',
  format('SELECT 1 FROM demandes_groupees g, produits p WHERE g.id = %s AND g.statut = ''refusee'' AND g.valideur_id = %L AND p.id = 6 AND p.quantite_restante = 32', :g2, :'uid_mag'), 'lignes=1');
-- La vendeuse compte 7 : l'écart est au nom de celui qui a fait sortir
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :VEND, false);
SELECT tests.verifier('magasin', 'vendeuse : réceptionne avec un écart',
  format('SELECT receptionner_envoi(%s, ''[{"produit_id":6,"quantite_recue":7,"motif":"un pain manquant"}]'', true)', :e1), 'lignes=1');
RESET ROLE;
SELECT tests.verifier('magasin', 'écart à la réception : envoyé par le magasinier, compté par la vendeuse',
  format('SELECT 1 FROM envois WHERE id = %s AND statut = ''recu'' AND avec_ecart AND valideur_id = %L AND receptionnaire_id = %L', :e1, :'uid_mag', :'uid_vend'), 'lignes=1');
-- Il ne voit pas les envois de l'atelier
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :PROD, false);
SELECT envoyer_atelier_vers_boutique('[{"produit_id":1,"quantite":2}]', '88888888-cccc-4ccc-8ccc-000000000003') AS ea \gset
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('magasin', 'magasinier : ne voit pas les envois de l''atelier',
  format('SELECT 1 FROM envois WHERE id = %s', (:'ea'::jsonb ->> 'envoi_id')), 'lignes=0');
RESET ROLE;

-- ============ D. La propriétaire confirme les achats avec la facture ============
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('magasin', 'magasinier : ne confirme pas ses propres achats', format('SELECT confirmer_achat(%s, true)', :dep_pain), 'erreur');
SELECT tests.verifier('magasin', 'magasinier : ne voit pas la liste à confirmer', 'SELECT achats_a_confirmer()', 'erreur');
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('magasin', 'gérant : ne confirme pas non plus', format('SELECT confirmer_achat(%s, true)', :dep_pain), 'erreur');
SELECT tests.verifier('magasin', 'gérant : écriture directe d''une confirmation refusée',
  format('INSERT INTO confirmations_achats (depense_id, conforme, par) VALUES (%s, true, %L)', :dep_pain, :'uid_chef'), 'erreur');
SELECT set_config('request.jwt.claims', :PROPRIO, false);
SELECT achats_a_confirmer() AS liste1 \gset
SELECT tests.verifier('magasin', 'liste à confirmer : achat de pain du magasinier, 10 × 500 F, avec son reçu',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''a_confirmer'') a WHERE (a->>''depense_id'')::int = %s AND (a->>''quantite'')::numeric = 10 AND (a->>''prix_unitaire'')::numeric = 500 AND (a->>''montant'')::numeric = 5000 AND a->>''par'' LIKE ''Magasin%%'' AND a->>''nature'' = ''réapprovisionnement'' AND (a->''recus''->0->>''present'')::boolean', :'liste1', :dep_pain), 'lignes=1');
SELECT tests.verifier('magasin', 'liste à confirmer : nouveau produit Beurre, 4 kg à 3 000 F',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''a_confirmer'') a WHERE (a->>''depense_id'')::int = %s AND a->>''nature'' = ''nouveau produit'' AND (a->>''prix_unitaire'')::numeric = 3000 AND a->>''unite'' = ''Kilogramme'' AND jsonb_array_length(a->''recus'') = 0', :'liste1', :dep_beurre), 'lignes=1');
SELECT tests.verifier('magasin', 'conforme : le pain', format('SELECT confirmer_achat(%s, true)', :dep_pain), 'lignes=1');
SELECT confirmer_achat(:dep_pain, false, 'second clic') AS bis \gset
SELECT tests.verifier('magasin', 'second envoi : déjà confirmé, la première réponse reste',
  format('SELECT 1 WHERE (%L::jsonb ->> ''deja_confirme'')::boolean AND (%L::jsonb ->> ''conforme'')::boolean AND (SELECT count(*) FROM confirmations_achats WHERE depense_id = %s) = 1', :'bis', :'bis', :dep_pain), 'lignes=1');
SELECT tests.verifier('magasin', 'non conforme sans explication refusé', format('SELECT confirmer_achat(%s, false)', :dep_beurre), 'erreur');
SELECT tests.verifier('magasin', 'non conforme : le beurre', format('SELECT confirmer_achat(%s, false, ''Facture : 3 kg, pas 4'')', :dep_beurre), 'lignes=1');
SELECT tests.verifier('magasin', 'une dépense ordinaire ne se confirme pas',
  'SELECT confirmer_achat((SELECT min(id) FROM depenses_comptables WHERE achat_journal_id IS NULL), true)', 'erreur');
SELECT tests.verifier('magasin', 'dépense inconnue', 'SELECT confirmer_achat(999999, true)', 'erreur');
SELECT achats_a_confirmer() AS liste2 \gset
RESET ROLE;
SELECT tests.verifier('magasin', 'après confirmation : les deux achats ne sont plus à confirmer',
  format('SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''a_confirmer'') a WHERE (a->>''depense_id'')::int IN (%s, %s)) AND (%L::jsonb ->> ''nombre'')::int = (%L::jsonb ->> ''nombre'')::int - 2',
    :'liste2', :dep_pain, :dep_beurre, :'liste2', :'liste1'), 'lignes=1');
SELECT tests.verifier('magasin', 'non conformes : le beurre, avec le constat et l''auteur',
  format('SELECT 1 FROM jsonb_array_elements(%L::jsonb -> ''non_conformes'') a WHERE (a->>''depense_id'')::int = %s AND a->>''commentaire'' = ''Facture : 3 kg, pas 4'' AND a->>''par'' LIKE ''Magasin%%'' AND a->>''constate_par'' LIKE ''Proprio%%''', :'liste2', :dep_beurre), 'lignes=1');
SELECT tests.verifier('magasin', 'non conforme : gérants prévenus',
  format('SELECT 1 FROM notifications WHERE destinataire_id = %L AND type = ''alerte_generale'' AND message LIKE ''Achat non conforme%%''', :'uid_chef'), 'lignes>0');
SELECT tests.verifier('magasin', 'non conforme : le magasinier prévenu',
  format('SELECT 1 FROM notifications WHERE destinataire_id = %L AND type = ''alerte_generale'' AND message LIKE ''Achat non conforme%%'' AND details LIKE ''%%3 kg, pas 4%%''', :'uid_mag'), 'lignes=1');
SELECT tests.verifier('magasin', 'confirmation : ne se modifie pas', 'UPDATE confirmations_achats SET conforme = true', 'erreur');
SELECT tests.verifier('magasin', 'confirmation : ne se supprime pas', 'DELETE FROM confirmations_achats', 'erreur');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', :CHEF, false);
SELECT tests.verifier('magasin', 'gérant : lit les confirmations', 'SELECT 1 FROM confirmations_achats', 'lignes=2');
SELECT set_config('request.jwt.claims', :MAG, false);
SELECT tests.verifier('magasin', 'magasinier : ne lit pas les confirmations', 'SELECT 1 FROM confirmations_achats', 'lignes=0');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT tests.verifier('magasin', 'journal du stock : intact', 'SELECT 1 WHERE (verifier_journal_stock())->>''intact'' = ''true''', 'lignes=1');
