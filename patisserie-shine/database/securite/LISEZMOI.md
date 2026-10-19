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
