# Sécurité de la base Supabase : phase 1

## Le problème
En production, 21 tables (dont `profiles`, `ventes` et `stock_boutique`) n'avaient pas RLS activé. De plus, le rôle `anon`
(la clé publique présente dans le JavaScript du site) avait tous les droits sur les tables, les vues, les séquences et
environ 90 fonctions, dont `safe_delete_user`. N'importe qui, sans compte, pouvait lire, modifier ou supprimer les données,
se donner le rôle admin ou supprimer un compte.

## Ce que fait `phase1_fermer_acces_anonyme.sql`
1. Retire au rôle `anon` tout droit sur le schéma `public` : tables, vues, séquences, fonctions et objets futurs.
2. Active RLS sur les 21 tables, avec deux règles :
   - les utilisateurs connectés gardent leurs accès actuels ;
   - un profil **actif** est exigé. Seule exception : la lecture de `profiles`, nécessaire à l'écran de connexion.
3. `handle_new_user` ne prend plus le rôle fourni lors d'une inscription : tout nouveau compte devient `employe_boutique`.
   La route `/api/admin/create-user` fixe ensuite le rôle choisi par l'admin.

Le script s'exécute en une seule transaction : soit tout passe, soit rien n'est modifié. Il abandonne si un verrou
n'est pas obtenu en 5 secondes.

## Ce que la phase 1 ne fait pas encore (phase 2)
- Un employé connecté peut toujours modifier n'importe quel profil, y compris son propre rôle.
- Les employés connectés peuvent toujours exécuter les fonctions sensibles (`safe_delete_user`, etc.).
- Les vues contournent RLS, puisqu'elles s'exécutent avec les droits de leur propriétaire.
- Les fonctions créées à l'avenir resteront exécutables par `PUBLIC` : il faudra retirer ce droit à chaque création.

## Annulation
`phase1_annulation.sql` remet exactement l'état d'avant. Le test l'a vérifié : 0 écart sur 170 objets comparés
(droits, règles, fonctions).

## Tests (`tests/`)
Ils recréent localement la structure de production, sans aucune donnée réelle, puis exécutent le même scénario trois fois :
avant la phase 1, après, puis après annulation. Le scénario couvre un visiteur non connecté, une vendeuse, un admin,
un compte désactivé, `service_role` et une inscription piégée. Il vérifie aussi les effets réels des déclencheurs
(audit des prix, envoi en boutique après une production, notifications), et pas seulement l'absence d'erreur.

```bash
PGHOST=/chemin/du/socket PGPORT=5432 ./tests/lancer.sh   # base PostgreSQL de test, JAMAIS la production
```

Résultat du 2026-10-19 : 156 vérifications sur 156 conformes. Pas de surcoût mesurable : la règle « compte actif »
est évaluée une fois par requête (`InitPlan`).

Deux bugs existaient déjà, indépendamment de RLS :
- `decrement_stock` échoue pour un employé boutique (le déclencheur `log_mouvement_stock` écrit dans
  `mouvements_stock`, réservé aux admins). L'application ne l'appelle qu'à la validation par un admin.
- Le déclencheur `audit_prix_changes_advanced` lit `prix_vente`, une colonne qui n'existe pas dans
  `prix_vente_produits`. Toute écriture dans cette table échoue : aucune ligne n'y a été ajoutée depuis le 2025-09-12.

Simplifications des tests : les deux fonctions d'audit des prix sont abrégées (elles écrivent dans les mêmes tables,
avec les mêmes droits), seules les clés étrangères utiles au scénario sont recréées, et deux fonctions dangereuses
non utilisées sont représentées par des bouchons.

---

# Phase 2 : droits entre utilisateurs connectés

**État : appliquée en production le 2026-10-19** (via le SQL Editor de Supabase). La connexion Supabase
de l'assistant met en attente les instructions `DROP` jusqu'à une confirmation qui n'aboutissait pas.

## Ce que fait `phase2_droits_entre_employes.sql`
1. **Fonctions** : un employé connecté ne peut plus exécuter que 7 fonctions :
   - `est_utilisateur_actif` et `est_admin` (utilisées par les règles RLS) ;
   - `notify_all_admins`, `send_notification` et `ajouter_stock_boutique` (appelées par les déclencheurs) ;
   - `decrement_stock` et `safe_delete_user` (appelées par l'application).
2. **`safe_delete_user`** : réservée aux admins actifs. Elle refuse le compte propriétaire et son propre compte.
3. **`profiles`** : seuls les admins écrivent ; aucune suppression n'est possible depuis le navigateur.
   Le déclencheur `proteger_profils` exige d'être super admin pour modifier ce droit. Lui seul peut changer
   le rôle ou le statut du propriétaire. Le nom d'utilisateur ne peut plus être modifié.
4. **Ventes, lignes de vente, sorties, entrées boutique, arrêts de caisse** : les employés ajoutent et lisent ;
   seuls les admins modifient ou suppriment. L'audit des prix devient inaltérable.
5. **Vues** : les 23 vues passent en `security_invoker` et respectent RLS.
6. **Compte actif** : il est exigé aussi sur les 20 tables qui avaient déjà RLS.
7. **Fonctions futures** : elles ne sont plus exécutables par `PUBLIC` (donc par `anon`) par défaut.

## Tests
`PGHOST=... ./tests/lancer_phase2.sh` : 162 vérifications sur 162 conformes, et 0 écart sur 241 objets
après annulation.

Correction appliquée après coup : `est_admin` et `proteger_profils`, créées avant l'étape 7, avaient hérité
du droit `PUBLIC`. L'impact était nul : `est_admin` répond « non » pour un visiteur, et une fonction de
déclencheur ne peut pas être appelée directement. Le script et les tests ont été corrigés en conséquence.

## Encore à traiter
- Les droits fins par écran pour les employés, aujourd'hui gérés par `user_permissions` côté application.

---

# Corrections de la base (2026-10-19)

Tests : `PGHOST=... ./tests/lancer_corrections.sh` donne 80 vérifications sur 80 conformes, dont la
non-régression complète de la phase 2, et 0 écart après annulation.

## `corrections_1_fonctions.sql`
**Appliqué en production le 2026-10-19.**
- `audit_prix_changes_advanced` lit désormais les colonnes de façon générique. Les prix de
  `prix_vente_produits` peuvent de nouveau être créés et modifiés. Auparavant, l'erreur était
  `record "old" has no field "prix_vente"`. L'audit enregistre maintenant le nom du produit et l'auteur.
- `search_path = public, extensions` est fixé sur toutes les fonctions qui n'en avaient pas (102). C'est
  la valeur qu'elles utilisaient déjà, donc leur comportement ne change pas.
- Annulation : `corrections_1_annulation.sql`.

## `corrections_2_roles.sql`
**Appliqué en production le 2026-10-19** via le SQL Editor (le script contient des `DROP CONSTRAINT`).
- Les deux contraintes contradictoires sur `profiles.role` sont remplacées par une seule, qui accepte les
  4 rôles proposés par l'écran Utilisateurs : admin, employe_boutique, employe_production, employe_cuisine.
- Annulation : `corrections_2_annulation.sql`. Elle n'est possible que si aucun profil n'a reçu entre-temps
  le rôle employe_production ou employe_cuisine.

---

# Ventes atomiques (2026-10-19)

**`ventes_atomiques.sql` a été appliqué en production le 2026-10-19.** Le code qui l'utilise est livré dans la
même pull request.

## Ce qui était faux
- **Vente en plusieurs étapes** : une vente était écrite depuis le navigateur en plusieurs appels séparés, et
  les erreurs étaient ignorées. Résultat constaté en production : 19 ventes validées sans aucune ligne, et
  11 ventes dont le total ne correspond pas à leurs lignes (et 4 autres avec un écart d'arrondi de 0,02 F).
- **Prix et stock non contrôlés** : le prix et le total venaient du navigateur, et le stock n'était pas vérifié
  côté serveur. On compte 5 produits en stock négatif en boutique.
- **Annulation double** : le stock était rendu avant que la vente soit marquée annulée, sans verrou. Deux
  annulations simultanées rendaient donc le stock deux fois.
- **Clôture de caisse** : elle écrivait des colonnes inexistantes dans `arrets_caisse`, et échouait toujours
  (la table contient 0 ligne). Elle comptait aussi les ventes annulées.
- **Meilleures ventes** : le classement comptait les ventes annulées.
- **Reçus imprimés** : les noms de produits et de vendeurs y étaient insérés sans échappement (faille XSS).
- **Réimpression** : depuis l'historique, elle affichait des articles vides.

## Ce qui change
- **`enregistrer_vente_boutique`**, appelée par la caisse en une seule transaction :
  - le stock est verrouillé, puis vérifié (disponible − vendu − utilisé) ;
  - le prix et le total sont calculés par la base ;
  - soit tout est enregistré, soit rien.
- **`annuler_vente_boutique`**, réservée au serveur et appelée par `/api/admin/cancel-sale` :
  - la vente est verrouillée, ce qui empêche une double annulation ;
  - le statut et le délai de 7 jours sont contrôlés ;
  - le stock est rendu et l'annulation est tracée.
- **Clôture** : elle ne compte que les ventes validées et écrit dans les vraies colonnes de `arrets_caisse`.
- **Classement** : les meilleures ventes ne comptent que les ventes validées.
- **Reçus** : les 3 reçus et factures imprimés sont échappés (`utils.escapeHtml`).

## Tests
`PGHOST=... ./tests/lancer_ventes.sh` donne 88 vérifications sur 88 conformes, dont 2 tests de concurrence réels :
- **dernier article** : deux caisses vendent le même au même instant ; une seule vente passe ;
- **double annulation** : la même vente est annulée deux fois en même temps ; une seule annulation passe, et
  le stock n'est rendu qu'une fois.

Les données historiques incohérentes (ventes sans lignes, totaux faux, stocks négatifs) n'ont **pas** été
modifiées. Leur correction demande une décision métier.

Annulation : remettre l'ancien code, puis exécuter `ventes_atomiques_annulation.sql` (SQL Editor).

---

# Ventes en double (2026-10-19)

## Ce qui était faux
Le bouton « Finaliser la Vente » restait actif pendant l'enregistrement, avec le panier et le montant toujours
remplis. Chaque clic supplémentaire envoyait donc une nouvelle vente. C'était le cas dans la caisse boutique
comme dans la caisse cuisine, et la vente atomique ne l'empêche pas : chaque clic est une vente valide.

Constat en production (lecture seule) : 302 ventes validées sur 25 222 (1,2 %, environ 1,6 million FCFA)
reprennent la vente précédente du même vendeur, avec le même panier et le même montant donné, à moins de
60 secondes d'écart :
- 154 sont à moins de 5 secondes d'écart, ce qui correspond à des doubles clics ;
- 148 sont entre 5 et 60 secondes d'écart, ce qui correspond à des clics répétés sur un réseau lent.

Exemples :
- le 11/11/2025, 23 ventes identiques « Pain campagne x5 » ont été enregistrées en 17 secondes ;
- les 5 stocks négatifs viennent de deux paniers cuisine enregistrés deux fois chacun, le 03/12/2025
  (ventes 5329/5330 et 5331/5332) ;
- les ventes 528/529 et 564/565 sont des paniers identiques à 40 400 F et 37 400 F, enregistrés à
  17 secondes d'intervalle.

Ces chiffres sont des **suspicions**, pas des certitudes. Un même petit article peut réellement être vendu
deux fois de suite à deux clients différents.

Dans la caisse cuisine, le reçu imprimé automatiquement était celui de la vente précédente : rien n'était
imprimé à la première vente.

## Ce qui change
- Un verrou synchrone (`useRef`) ignore tout clic tant que la vente est en cours d'envoi. Le bouton est
  désactivé et affiche « Enregistrement… ». Il redevient actif dès la réponse, même en cas d'erreur.
- La caisse cuisine imprime le reçu de la vente qui vient d'être enregistrée.

## Vérification
Test dans Chromium sur les vrais écrans de caisse, avec un faux serveur qui répond en 3 secondes. Pour
2 ventes, l'utilisateur clique 5 fois sur le bouton à chaque fois :

| Code       | Boutique             | Cuisine                                          |
|------------|----------------------|--------------------------------------------------|
| Avant      | 10 ventes enregistrées | 10 ventes enregistrées, reçus faux             |
| Après      | 2 ventes enregistrées  | 2 ventes enregistrées, reçus 0001 puis 0002    |

En cas de refus du serveur (stock insuffisant), le message s'affiche une seule fois, le panier est conservé,
le bouton redevient actif et un nouvel essai fonctionne.

Les doublons historiques n'ont **pas** été modifiés. Leur traitement demande une décision métier.
