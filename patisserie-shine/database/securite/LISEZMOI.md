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
**À exécuter dans le SQL Editor**, car le script contient des `DROP CONSTRAINT`.
- Les deux contraintes contradictoires sur `profiles.role` sont remplacées par une seule, qui accepte les
  4 rôles proposés par l'écran Utilisateurs : admin, employe_boutique, employe_production, employe_cuisine.
- Annulation : `corrections_2_annulation.sql`. Elle n'est possible que si aucun profil n'a reçu entre-temps
  le rôle employe_production ou employe_cuisine.
