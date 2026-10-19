# Stock : circuit fiable et traçable

Le but est que chaque mouvement de marchandise soit une preuve fiable, pour repérer un vol sans jamais
accuser quelqu'un à tort. Le travail se fait en plusieurs parties, chacune testée sur une copie de la base,
réversible, et mise en production avec accord.

## Constat de départ (2026-10-19, lecture seule)
- **Circuit réel :** le stock principal contient à la fois les matières premières et les produits finis.
  La boutique est servie presque uniquement depuis le stock principal (10 288 demandes) et l'atelier en
  reçoit les matières (1 808 demandes). L'atelier n'est jamais décompté : production et consommation ne
  sont pas enregistrées.
- **Aucune réception :** le stock arrivait à destination au clic du valideur, sans que personne ne compte.
- **Auto-validation :** environ 2 300 validations sur 2 660 ont été faites par l'auteur de la demande.
- **Doubles validations :** 47 demandes ont été transférées deux fois, ce qui a crédité 618 unités en trop à
  la boutique. Dans 17 cas, deux personnes ont validé la même demande en même temps.
- **Auteurs absents ou falsifiables :** 52 % des mouvements n'ont pas d'auteur, et les autres reçoivent un
  auteur fourni par le navigateur.
- **Historique effaçable :** supprimer un produit efface d'abord son historique de mouvements.

**Conséquence : l'historique d'avant cette partie ne permet d'attribuer aucun écart à une personne.**

## Partie 1 : demandes, validation, transit, réception

### Le circuit
1. **Demande.** Un caissier ou un gérant demande des produits au stock principal, pour la boutique ou pour
   l'atelier.
2. **Validation** par le propriétaire ou un gérant (rôle admin), avec `valider_demande_groupee`. Le valideur
   peut réduire une quantité ; 0 refuse la ligne. En une seule transaction :
   - le stock principal est décompté ;
   - la marchandise passe à l'état **« en transit »** (table `envois`) ;
   - une seconde validation est impossible (verrou, et un seul envoi par demande).
3. **Réception** par la destination, avec `receptionner_envoi` (écran « Réceptions ») :
   - la personne compte sans voir la quantité annoncée ;
   - en cas d'écart, la base le renvoie : on recompte, ou on confirme avec un **motif obligatoire** ;
   - la destination n'est créditée qu'à ce moment, de la quantité réellement comptée ;
   - un écart prévient le propriétaire et les gérants.
4. **Contrôle croisé :** si la demande a été validée par la personne qui l'a faite, **la réception doit être
   faite par quelqu'un d'autre**. La base refuse sinon. C'est la même règle pour l'envoi atelier → boutique
   (`envoyer_atelier_vers_boutique`), qui n'a pas de validation : l'expéditeur ne réceptionne pas.
5. **Annulation** (`annuler_envoi`, motif obligatoire) : possible tant que l'envoi n'est pas reçu. Le lieu
   d'origine récupère exactement ce qui était parti.

### Le journal infalsifiable (`journal_stock`)
- Chaque mouvement y est écrit avec l'auteur (`auth.uid()`) et l'heure fixés par la base.
- Aucune modification ni suppression n'est possible, même par le serveur.
- Chaque ligne contient l'empreinte SHA-256 de la précédente. `verifier_journal_stock()` détecte toute
  altération, y compris par quelqu'un qui contournerait les protections.
- Un envoi s'équilibre toujours : la somme de ses lignes, tous lieux confondus, est nulle (départ, transit,
  arrivée, écart).

### Verrous
- **Statuts des demandes :** ils ne changent plus que par les fonctions ci-dessus. À la création, le statut est
  forcé à « en attente » et le demandeur au compte connecté.
- **Quantité disponible :** un caissier ne peut plus la modifier directement, ni en boutique ni à l'atelier.
  Les ventes ne touchent que `quantite_vendue` et restent possibles.
- **Accès provisoire :** les admins et la production gardent un accès direct, pour les écrans non encore
  convertis (partie 2).
- **`decrement_stock` est fermée :** c'est la première étape de l'ancienne validation. Un écran resté ouvert
  avec l'ancien code échoue donc sans rien modifier.
- **`log_mouvement_stock`** enregistre désormais l'auteur des mouvements du stock principal.

### Fichiers
| Fichier | Rôle | Où l'exécuter |
|---|---|---|
| `partie1_circuit_demandes.sql` | Tables, fonctions, verrous | Directement (aucune suppression) |
| `partie1_contrainte_annulee.sql` | Autorise le statut « annulee » sur les lignes de demande | SQL Editor (DROP CONSTRAINT) |
| `partie1_annulation.sql` | Retour arrière ; refusé tant qu'un envoi est en transit | SQL Editor |
| `partie1_contrainte_annulee_annulation.sql` | Remet la contrainte, si aucune ligne n'est annulée | SQL Editor |

**Ordre de mise en production :**
1. D'abord l'application. Tant que la base n'est pas à jour, valider affiche une erreur sans rien modifier.
2. Tout de suite après, `partie1_circuit_demandes.sql`, puis `partie1_contrainte_annulee.sql`.
3. Enfin, recharger tous les écrans ouverts.

### Tests
- `PGHOST=... ./tests/lancer_circuit.sh` : **229 vérifications sur 229**, et 0 écart sur 284 objets après
  annulation. Le banc couvre :
  - le scénario complet ;
  - deux tests de concurrence réels : deux validations simultanées donnent un seul envoi, deux réceptions
    simultanées donnent un seul crédit ;
  - une falsification simulée du journal, qui est détectée ;
  - la non-régression des ventes atomiques, des ventes sans doublon et de la sécurité phase 2.
- **Banc navigateur** (`tests/navigateur/`) : l'application réelle dans Chromium, sur une copie locale de la
  base servie par PostgREST, avec quatre comptes (caissière, gérant, second caissier, production). Résultat :
  **28 vérifications sur 28**. Le banc couvre la demande, la validation partielle, la réception avec écart,
  l'auto-validation, l'envoi de l'atelier et l'annulation.

**Changements volontaires dans la non-régression de la phase 2 :**
- un admin ne refuse plus une demande en modifiant la table : il passe par `refuser_demande` ;
- `decrement_stock` est fermée.

### Limites connues
- Le comptage « à l'aveugle » est assuré par l'écran. Un caissier qui interrogerait la base directement
  pourrait lire la quantité envoyée.
- Les envois créés avant cette partie n'existent pas : les demandes déjà validées gardent l'ancien
  fonctionnement (pas d'annulation possible depuis l'écran).

---

## Partie 2 : stock principal et fin des écritures directes

### Ce qui était faux
- **Écritures directes depuis le navigateur.** Le stock principal était modifié directement : création,
  réapprovisionnement (lu puis réécrit, donc deux réappros simultanés pouvaient s'écraser), correction de
  quantité, changement d'unité sans conversion.
- **Suppression destructrice.** Supprimer un produit effaçait d'abord son historique, avec les droits complets
  du serveur.
- **Quantités modifiables sans trace.** Un gérant ou la production pouvait modifier toutes les quantités
  (boutique, atelier, principal).
- **Double comptage.** « Marquer comme utilisé » comptait chaque utilisation deux fois : l'écran et le
  déclencheur ajoutaient tous les deux.
- **Prix et historique ouverts à tous.** N'importe quel utilisateur connecté pouvait changer un prix de vente
  ou insérer de faux mouvements d'historique.

### Ce que fait `partie2_stock_principal.sql` (SQL Editor : il contient un DROP CONSTRAINT)
- **Fonctions, seul chemin possible :**
  - `creer_produit` et `reapprovisionner_produit` (achats) : prix moyen pondéré calculé par la base, clé
    anti-doublon contre le double clic et le nouvel essai après une coupure ;
  - `modifier_produit` : nom, date, prix d'achat ; l'unité ne change que si le produit n'a plus de stock
    nulle part ;
  - `ajuster_stock_principal` et `ajuster_stock_atelier` : propriétaire et gérants, **motif obligatoire** ;
  - `vider_stock_atelier` : une correction motivée par produit ;
  - `archiver_produit` : au lieu de supprimer, seulement sans stock ; l'historique est conservé ;
  - `utiliser_stock_boutique` : une seule écriture.
- **Journal :** il reçoit les achats, les corrections, les utilisations, les ventes et leurs annulations, et la
  production envoyée en boutique.
  - Les ventes sont inscrites par déclencheur, quel que soit le chemin.
  - L'auteur d'une annulation de vente est l'admin vérifié par le serveur.
- **Verrous :**
  - plus personne ne modifie directement une quantité de stock, pas même les gérants, ni la quantité vendue :
    impossible de « cacher » une vente ;
  - le prix de vente et le type d'article sont réservés au propriétaire et aux gérants ;
  - un produit ne se supprime plus ;
  - l'historique (`mouvements_stock`, `entrees_boutique`, `utilisations_boutique`) n'est écrit que par la base.
- **Vente :** `enregistrer_vente_boutique` s'exécute avec les droits du propriétaire et vérifie que le compte
  est actif.
- **Production vers la boutique :** le module est encore peu utilisé et sera refait. Il traverse les verrous,
  s'inscrit au journal et n'écrase plus un prix existant par 1000 F.
- **Route de suppression :** la route `/api/admin/delete-product` répond « 410 : remplacée par l'archivage ».

### Tests
- `PGHOST=... ./tests/lancer_stock.sh` :
  - passage 1 : **96/96** (scénario, deux tests de concurrence réels, annulation exacte sur 315 objets) ;
  - passage 2, sur une base neuve : **195/195** (non-régression du circuit, des ventes, des ventes sans
    doublon et de la sécurité).
- **Banc navigateur :**
  - `tests/navigateur/parcours_stock.js` : **13/13** (création malgré un double clic, réappro, correction
    motivée, archivage refusé puis accepté, vidage de l'atelier, utilisation comptée une fois) ;
  - `parcours.js` : **28/28** avec la partie 2 appliquée.
  - Préparer la base avec `PARTIE2=1 preparer_base.sh`.

**Changements volontaires dans le scénario de sécurité :**
- un décompte direct en caisse est refusé : la vente passe par sa fonction ;
- la vendeuse ne change plus un prix (c'est le gérant qui le fait) ;
- l'utilisation passe par sa fonction ;
- la baisse du stock principal passe par `ajuster_stock_principal`.

**Mise en production :**
1. D'abord l'application : tant que la base n'est pas à jour, les nouvelles opérations affichent une erreur
   sans rien modifier, et la route de suppression est déjà fermée.
2. Tout de suite après, `partie2_stock_principal.sql` dans le SQL Editor.
3. Recharger tous les écrans.

Annulation : `partie2_annulation.sql` (SQL Editor). La liste élargie des types de mouvement du journal reste
en place, car les lignes déjà écrites ne s'effacent pas.

---

## Partie 3 : récapitulatif pour le propriétaire

### Principe
- Un écran **« Récapitulatif »**, visible seulement des super admins (rabi et proprietaire). La base refuse
  aussi les autres comptes.
- Rien n'est envoyé par e-mail et rien n'est stocké : `recap_periode(du, au)` calcule le récapitulatif à
  la demande, à partir des données d'origine. Il n'y a donc rien à nettoyer, et toute période peut être
  régénérée.
- **Choix de la période :**
  - par défaut, la veille ;
  - boutons « Aujourd'hui », « 7 derniers jours », « 14 derniers jours » ;
  - un bouton par jour pour les 14 derniers jours ;
  - n'importe quelle période de 3 mois au plus.
- L'écran s'imprime.

### Contenu
- **Points à vérifier :**
  - marchandise en transit depuis plus de 24 h (état actuel) ;
  - envois validés et réceptionnés par la même personne (un gérant qui reçoit parce que le caissier est
    absent : c'est permis, mais signalé) ;
  - écarts à la réception, avec le motif ;
  - corrections de stock, avec le motif ;
  - ventes annulées ;
  - comptes modifiés par une autre personne (mot de passe réinitialisé, compte bloqué) ;
  - intégrité du journal, vérifiée à chaque génération.
- **Validations et refus :** qui a demandé, qui a validé, quantités demandées et validées, raison du refus,
  validations de sa propre demande.
- **Envois et réceptions :** quantités envoyées et reçues, qui a reçu, annulations.
- **Autres sections :** demandes faites ; achats, corrections, utilisations et production ; ventes par
  vendeur et par article ; dépenses avec leurs justificatifs ; comptes ; produits archivés.

### Comptes des super admins protégés
- **Avant :** seul le compte « proprietaire » était protégé. Un gérant pouvait réinitialiser le mot de passe
  de rabi, puis agir sous son nom sans laisser de trace.
- **Maintenant :**
  - **Compte d'un super admin :** seul un super admin, ou la personne elle-même, change son mot de passe,
    son rôle ou son statut, ou le désactive. La règle vaut dans la base (`proteger_profils`) et dans les
    routes serveur.
  - **Suppression définitive d'un compte :** réservée aux super admins, car elle efface l'historique du
    compte. Les gérants désactivent.
  - **Traces :** les routes serveur notent qui a changé un mot de passe ou bloqué un compte. Le récapitulatif
    l'affiche.
- **admin1** n'est plus super admin (décision du 2026-10-19). Les super admins sont rabi et proprietaire.

### Fichiers
| Fichier | Rôle | Où l'exécuter |
|---|---|---|
| `partie3_recapitulatif.sql` | Fonctions du récapitulatif, protection des super admins, admin1 | Directement (aucune suppression) |
| `partie3_annulation.sql` | Retour arrière | SQL Editor (DROP) |

### Tests
- `PGHOST=... ./tests/lancer_recap.sh` :
  - passage 1 : **48/48**. Une journée complète est jouée : écart, auto-validation, réception par le
    valideur, refus, envoi bloqué 30 h, achat, correction, utilisation, ventes et annulation, dépense,
    archivage, mot de passe réinitialisé. Chaque élément est retrouvé dans le récapitulatif, avec des totaux
    identiques à la base. L'annulation est exacte sur 332 objets.
  - passage 2 : **195/195** (non-régression des parties 1 et 2, des ventes et de la sécurité).
- **Banc navigateur :** `tests/navigateur/parcours_recap.js` : **11/11**. Le gérant n'a pas l'onglet ; le
  propriétaire voit les alertes, les chiffres et les refus. La base est préparée avec
  `PARTIE2=1 PARTIE3=1 preparer_base.sh`.
- `tests/commun.sh` regroupe la construction de la base et la non-régression, communes aux bancs des parties
  2 et 3.

**Mise en production :** après la partie 2.
1. L'application.
2. `partie3_recapitulatif.sql`.
