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

---

## Partie 4 : chaque achat est une dépense, avec son reçu

### Ce qui était faux
- **Achats sans trace financière :** un achat (création ou réapprovisionnement) ne créait aucune dépense, et aucun reçu ne pouvait lui être lié.
- **Comptabilité fausse :** les achats étaient estimés en multipliant le prix moyen par la quantité cumulée de tout l'historique du produit, et comptés dans la période du dernier réapprovisionnement.
- **Dépenses modifiables sans trace :** une dépense pouvait être modifiée ou supprimée sans que personne ne le sache.

### Ce que fait `partie4_achats_recus.sql` (aucune suppression : exécutable directement)
- **Dépense créée par l'achat :** `creer_produit` et `reapprovisionner_produit` créent, dans la même opération, la dépense de l'achat. Elle contient le montant payé, la date et l'auteur, et elle est reliée à sa ligne du journal du stock (`achat_journal_id`). La clé anti-doublon vaut aussi pour la dépense.
- **`joindre_recu` :** ajoute un reçu (photo ou PDF) que la personne a elle-même déposé dans l'espace privé `depenses-pieces-jointes`. Peuvent le faire l'auteur de la dépense, le propriétaire ou un gérant. On ajoute, on ne retire jamais, et le même fichier n'est ajouté qu'une fois.
- **Dépense d'achat verrouillée :** son montant, sa date, son produit et son auteur ne se modifient pas, elle ne se supprime pas, et ses reçus ne se retirent pas. La description reste modifiable, et la modification est tracée.
- **`journal_depenses` (ajout seul) :** chaque création, modification ou suppression de dépense y est inscrite, avec l'auteur et l'état avant et après.
- **Récapitulatif :** il présente les achats et leurs reçus, consultables par un lien temporaire. Il signale en points à vérifier les achats sans reçu, les reçus disparus du stockage et les dépenses modifiées ou supprimées. L'ajout d'un reçu n'est pas signalé.

### Application
- **Formulaires de création et de réapprovisionnement :** bouton « Prendre le reçu en photo », qui ouvre l'appareil photo sur téléphone. La photo est réduite avant l'envoi, pour passer avec une connexion faible. Elle est déposée avant l'achat : si l'envoi échoue, rien n'est enregistré et l'on peut réessayer.
- **« À faire » :** une section « Achats sans reçu » (7 jours) avec le bouton « Ajouter le reçu ».
- **Dépenses :** les dépenses d'achat portent la mention « Achat de stock », sans bouton modifier ni supprimer.
- **Comptabilité :** les achats de stock sont la somme des dépenses d'achat. Pour une période antérieure au premier achat suivi, l'ancienne estimation reste affichée, avec la mention « Estimation (avant suivi des achats) ».

### Limite
Les fichiers sont gardés par le service de stockage de Supabase, qui appartient à Supabase et pas à la base. La base ne peut donc pas empêcher qu'un fichier y soit supprimé. En revanche, la référence au reçu reste dans la dépense, et un fichier disparu est signalé au propriétaire.

### Tests
- `PGHOST=... ./tests/lancer_achats.sh` :
  - passage 1 : **39/39** (scénario, deux tests de concurrence réels), annulation exacte sur 335 objets ;
  - passages 2 à 4, sur des bases neuves : non-régression **195/195**, stock **66/66**, récapitulatif **47/47**.
- `tests/stockage_emulation.sql` imite le schéma `storage` de Supabase. La passerelle du banc navigateur imite le dépôt de fichiers, le lien signé et la suppression, avec les mêmes règles que la production : on ne dépose que dans son propre dossier.
- **Banc navigateur :** `parcours_achats.js` **14/14** (réapprovisionnement avec photo malgré un double clic, reçu ajouté après coup depuis « À faire », écran Dépenses verrouillé, récapitulatif et « Voir le reçu »). Les autres parcours passent avec la partie 4 : 28/28, 14/14, 11/11, 22/22. La base est préparée avec `PARTIE2=1 PARTIE3=1 PARTIE4=1 preparer_base.sh`.
- La copie de test de la base reçoit les deux liens de la production entre une dépense, son produit et son auteur.

**Mise en production :** d'abord `partie4_achats_recus.sql`, puis l'application. Dans l'autre sens, l'ancienne application fonctionne encore : elle ignore simplement la dépense créée, et la base refuse d'elle-même toute modification d'une dépense d'achat.

Annulation : `partie4_annulation.sql` (SQL Editor). Les dépenses déjà créées restent, comme dépenses ordinaires.

## Partie 5 : caisse ouverte, comptage de l'argent à l'aveugle

### Ce qui était faux
- **Montant attendu montré avant le comptage :** la clôture affichait « Montant théorique : X » puis demandait le montant réel. Il suffisait de recopier X et de garder un éventuel excédent, sans écart visible.
- **Calcul par le navigateur, écriture libre :** le montant attendu était calculé par l'écran (ventes du jour civil, sans fond de caisse), et n'importe quel compte pouvait écrire un arrêt de caisse.
- **Jamais utilisé :** en production, 0 arrêt, 0 ouverture et 0 relevé de caisse.

### Ce que fait `partie5_caisse.sql` (aucune suppression : exécutable directement)
- **`ouvrir_caisse(fond)` :** la caissière (ou le propriétaire, un gérant) déclare le fond de caisse. Une seule caisse ouverte par personne, même en cas de double appui simultané : la seconde demande renvoie la caisse existante, fond inchangé.
- **`cloturer_caisse(montant, confirmer, motif)` :**
  - la base calcule le montant attendu : fond + ventes non annulées de la personne depuis l'ouverture ;
  - si le comptage est juste, la caisse est clôturée ;
  - sinon la réponse dit seulement « écart », **sans révéler le montant attendu**, et l'on recompte ;
  - chaque comptage est gardé, y compris ceux refaits ;
  - pour clôturer avec un écart, un motif est obligatoire ; le propriétaire et les gérants sont alors prévenus (attendu, compté, nombre de comptages, motif).
- **Écriture fermée :** ouvertures, relevés et arrêts de caisse ne s'écrivent plus que par ces deux fonctions.
- **Récapitulatif :** section « Caisses » (fond, ventes, attendu, compté, écart, nombre de comptages). En points à vérifier :
  - les écarts de caisse, avec le premier comptage quand on a recompté ;
  - les caisses ouvertes depuis plus de 16 h (clôture oubliée) ;
  - les ventes faites sans caisse ouverte (argent compté nulle part).

### Application
- **Caisse :** bandeau « Caisse ouverte depuis HH:MM · fond X » ou « Caisse fermée », bouton « Ouvrir la caisse ». La première vente d'une caisse fermée demande d'abord le fond de caisse ; si l'on annule, la vente n'est pas faite.
- **Clôture :** « Montant compté », sans montant affiché. En cas d'écart : « Nouveau comptage » et « Motif » (laisser vide pour simplement recompter). Le détail (fond, ventes, attendu, compté, écart) n'est montré qu'après la clôture.
- La fenêtre de saisie accepte 0 quand c'est permis (fond de caisse vide).

### Limite
La caissière voit ses ventes dans « Ventes du jour » : elle pourrait refaire le calcul elle-même. Le comptage à l'aveugle empêche de recopier un chiffre donné par l'écran. Chaque comptage reste gardé et chaque écart est signalé.

### Tests
- `PGHOST=... ./tests/lancer_caisse.sh` :
  - passage 1 : **29/29** (scénario, deux tests de concurrence réels : ouvertures et clôtures simultanées), annulation exacte sur 347 objets ;
  - passages 2 à 5, sur des bases neuves : non-régression **195/195**, stock **66/66**, récapitulatif **47/47**, achats **34/34**.
- **Changement voulu dans le scénario de sécurité :** l'écriture directe d'un arrêt de caisse est refusée.
- **Banc navigateur :** `parcours_caisse.js` **18/18** (ouverture avec fond, vente, comptage faux sans que l'attendu soit montré, recomptage, clôture avec motif, alerte, vente caisse fermée, fond nul, récapitulatif). Les autres parcours passent avec la partie 5, en version de production : 28/28, 14/14, 11/11, 22/22, 14/14, et le tour des 20 écrans 5/5. La base est préparée avec `PARTIE5=1`.

**Mise en production : d'abord `partie5_caisse.sql`, puis l'application.**
- Dans cet ordre, l'ancienne application fonctionne encore pour vendre ; seule son ancienne clôture est refusée, et elle n'a jamais servi.
- Dans l'autre ordre, la nouvelle application ne pourrait pas ouvrir de caisse, donc pas vendre.

Annulation : `partie5_annulation.sql` (SQL Editor). Les caisses et relevés déjà enregistrés restent.

## Partie 6 : le magasinier, et les achats confirmés sur facture

### Ce qui est demandé
Le magasinier réceptionne la marchandise achetée et la fait sortir : c'est lui qui valide les demandes, seul. La propriétaire suit tout, et confirme avec les factures les quantités et montants qu'il a saisis.

### Ce que fait `partie6_magasinier.sql` (SQL Editor : il contient un DROP CONSTRAINT)
- **Rôle `magasinier` :** ajouté à la liste des rôles acceptés.
- **Entrées :** `creer_produit` et `reapprovisionner_produit` lui sont ouvertes. Chaque achat crée sa dépense à son nom, avec la photo de la facture (partie 4).
- **Sorties :** `valider_demande_groupee` et `refuser_demande` lui sont ouvertes. Pour ces quatre fonctions, seul le contrôle du rôle change. Le magasinier est prévenu de chaque nouvelle demande, et voit les envois qui partent du stock principal.
- **Ce qu'il ne peut pas faire :**
  - corriger une quantité du stock, modifier un prix d'achat, archiver un produit ;
  - annuler un envoi, réceptionner un envoi ;
  - tenir une caisse ;
  - lire le journal du stock, le récapitulatif ou les confirmations.
- **Contrôle de ses sorties :** la personne qui reçoit compte sans voir la quantité envoyée (partie 1). Un écart est donc inscrit « validé par le magasinier, compté par X ».
- **`confirmer_achat(dépense, conforme, commentaire)`, propriétaire seulement :**
  - « conforme » : la facture correspond à la quantité et au montant saisis ;
  - « non conforme » : le constat est obligatoire, et les gérants ainsi que l'auteur de l'achat sont prévenus ;
  - la confirmation ne se modifie pas et ne se supprime pas ; un second envoi renvoie la première réponse ;
  - si la quantité en stock est fausse, la propriétaire la rectifie ensuite par une correction motivée (partie 2).
- **`achats_a_confirmer()`, propriétaire seulement :** les achats pas encore comparés à la facture (avec quantité, prix unitaire, auteur et reçu), et les achats non conformes des 30 derniers jours.

### Application
- **Équipe :** le rôle « Magasinier » se choisit à la création et à la modification d'un compte. Le serveur refuse aussi tout rôle inconnu à la création.
- **Le magasinier voit trois onglets :** À faire, Stock Principal (créer, réapprovisionner avec la photo de la facture), Demandes (toutes les demandes, validation et refus). Son « À faire » contient les demandes à valider.
- **La propriétaire :** section « Achats à confirmer avec la facture » dans « À faire », avec « Voir le reçu », « Conforme » et « Non conforme ». Le récapitulatif liste aussi les achats à confirmer et les achats non conformes.

### Tests
- `PGHOST=... ./tests/lancer_magasinier.sh` :
  - passage 1 : **57/57**. Cela comprend le scénario, deux validations simultanées de la même demande (un seul envoi) et deux confirmations simultanées du même achat (une seule). L'annulation est refusée tant qu'un compte est magasinier, puis exacte sur 349 objets ;
  - passages 2 à 6, sur des bases neuves : non-régression **195/195**, stock **66/66**, récapitulatif **47/47**, achats **34/34**, caisse **24/24**.
- **Banc navigateur :** `parcours_magasinier.js` **22/22**. Il couvre les onglets du magasinier, la validation depuis « À faire », deux achats (dont un avec facture), la confirmation « conforme » et « non conforme », le récapitulatif et l'écran Équipe. La base est préparée avec `PARTIE6=1`.

**Mise en production : d'abord `partie5_caisse.sql`, puis `partie6_magasinier.sql` (SQL Editor), puis l'application.** Créez ensuite le compte du magasinier depuis l'écran Utilisateurs.

Annulation : `partie6_annulation.sql` (SQL Editor). Elle est refusée tant qu'un compte a le rôle magasinier. Les confirmations déjà faites sont affichées, puis supprimées avec leur table. Achats, dépenses, demandes et envois restent.

## Partie 7 : les achats réservés au magasinier, au propriétaire et aux gérants

Décision de la propriétaire : « seul le magasinier gère cela ». Le propriétaire et les gérants gardent le droit d'acheter pour dépanner.

### Ce que fait `partie7_achats_reserves.sql` (aucune suppression : exécutable directement)
- **Droit d'acheter :** `creer_produit` et `reapprovisionner_produit` n'acceptent plus le rôle production ; seul le contrôle du rôle change.
- **Achats du propriétaire et des gérants :** ils restent à confirmer avec la facture, comme ceux du magasinier.
- **Ce que la production garde :** stock atelier, envois de l'atelier vers la boutique, production, et la modification du nom, de l'unité ou du prix d'un produit (`modifier_produit`, inchangé).

### Application
- **Stock Principal :** « Nouveau Produit » et « Réapprovisionner » n'apparaissent que pour le magasinier, le propriétaire et les gérants.
- **« Modifier » :** ce bouton n'apparaît que pour les gérants et la production, comme le permet la base. Le magasinier ne l'a pas.

### Tests
- `PGHOST=... ./tests/lancer_achats_reserves.sh` :
  - passage 1 : **12/12**, annulation exacte sur 357 objets ;
  - passages 2 à 7, sur des bases neuves : non-régression **195/195**, stock **66/66**, récapitulatif **47/47**, achats **34/34**, caisse **24/24**, magasinier **51/51** ;
  - là où les anciens scénarios faisaient acheter la production, c'est le magasinier qui achète.
- **Banc navigateur :** `parcours_magasinier.js` passe à **24/24** (la production n'a plus de bouton d'achat, le magasinier n'a pas « Modifier ») ; la base est préparée avec `PARTIE7=1`.

**Mise en production :** l'ordre n'a pas d'importance.
- Avec la base modifiée mais l'ancienne application, la production verrait encore les boutons d'achat, mais la base refuserait l'achat.

Annulation : `partie7_annulation.sql`.

## Partie 8 : inventaires à l'aveugle et pertes validées par la propriétaire

### Décisions de la propriétaire
- **Inventaire :** les produits à compter sont tirés au hasard (personne ne sait lesquels à l'avance).
- **Rythme de départ :** l'atelier chaque soir ; le stock principal et la boutique une fois par semaine, tous les produits. Le rythme se change dans l'application.
- **Pertes :** une perte ne baisse le stock qu'après la validation de la propriétaire.

### Ce que fait `partie8_inventaires_pertes.sql` (SQL Editor : il contient un DROP CONSTRAINT)
- **Journal :** deux nouveaux types de mouvement, « inventaire » et « perte ».
- **Qui compte :** le magasinier (stock principal), la production (atelier), la boutique (boutique), le propriétaire et les gérants (partout). Un seul inventaire en cours par lieu.
- **`inventaire_ouvrir(lieu)` :** la liste des produits à compter, sans aucune quantité.
  - « tirage » : N produits au hasard parmi ceux qui ont du stock ; « complet » : tous.
  - Le mode vient du réglage du lieu ; le propriétaire et les gérants peuvent le choisir.
- **`inventaire_compter` :** la quantité attendue est notée par la base au moment du comptage, sans jamais être renvoyée. Chaque comptage est gardé.
- **`inventaire_cloturer`, en trois temps :**
  1. les produits qui ne correspondent pas sont désignés, sans quantité, pour être recomptés ;
  2. après recomptage, s'ils ne correspondent toujours pas, un motif par produit est obligatoire ;
  3. le stock est alors corrigé de l'écart, l'écart est inscrit au journal, et le propriétaire et les gérants sont prévenus avec sa valeur.
  - La correction porte sur le stock actuel : une vente faite entre le comptage et la fin reste comptée.
- **`inventaire_annuler` (gérants) et `regler_inventaires` (propriétaire).** `inventaires_a_faire` indique ce qui est attendu aujourd'hui.
- **Pertes :**
  - `declarer_perte(lieu, produit, quantité, motif)` : la perte est en attente, le stock ne bouge pas. Le même envoi répété ne crée pas une seconde perte.
  - `decider_perte(perte, accepter, motif)`, par la propriétaire seulement : acceptée, le stock baisse et la perte est inscrite au journal ; refusée, avec un motif. La personne est prévenue dans les deux cas.
  - Une perte que le stock ne couvre plus ne peut pas être acceptée.
- **Quantités attendues :** les fonctions internes qui les donnent ne sont pas accessibles depuis l'application. Les tables d'inventaire ne sont lisibles que par le propriétaire et les gérants. Rien ne se supprime ni ne s'écrit en direct.
- **`recap_inventaires(du, au)` :** inventaires de la période, écarts (avec le premier comptage), pertes, inventaires attendus pas encore faits.

### Application
- **Onglet « Inventaires » (groupe Stocks) :**
  - le lieu de la personne (les trois pour le propriétaire et les gérants) ;
  - « Commencer » ou « Reprendre l'inventaire », puis la colonne « Compté » ;
  - les produits à recompter en orange (champ vidé), puis la raison de chaque écart ;
  - le résultat à la fin ;
  - « Déclarer une perte » et « Mes pertes déclarées » ;
  - pour le propriétaire, « Rythme des inventaires ».
- **« À faire » :** « Inventaires à faire » pour chacun ; « Pertes à valider » (Accepter / Refuser) pour le propriétaire.
- **Récapitulatif :**
  - en points à vérifier : écarts d'inventaire, pertes acceptées, inventaires en retard (une échéance passée a été manquée : hier pour le soir, le jour prévu pour la semaine ; un inventaire simplement à faire aujourd'hui n'est pas un retard) ;
  - une section « Inventaires et pertes ».

### Limite
La personne qui compte peut ouvrir l'écran de son stock et y lire la quantité enregistrée. Le comptage à l'aveugle empêche de recopier un chiffre donné par l'inventaire ; il n'empêche pas un compteur malhonnête de chercher ce chiffre ailleurs. Deux protections jouent contre cela :
- le tirage au hasard, qui empêche de préparer ;
- les inventaires que le propriétaire ou un gérant peut faire lui-même, dans n'importe quel lieu et à n'importe quel moment.

### Tests
- `PGHOST=... ./tests/lancer_inventaires.sh` :
  - passage 1 : **76/76**. Cela comprend l'annulation sur base vide (exacte, 357 objets), le scénario de 73 vérifications (dont l'inventaire attendu et l'inventaire en retard) et deux tests de concurrence (inventaire ouvert deux fois, perte acceptée deux fois), puis l'annulation avec des données (stock et journal conservés) ;
  - passages 2 à 8, sur des bases neuves : non-régression **195/195**, stock **66/66**, récapitulatif **47/47**, achats **34/34**, caisse **24/24**, magasinier **51/51**, achats réservés **11/11**.
- **Banc navigateur :** `parcours_inventaires.js` **23/23**. Il couvre :
  - l'inventaire du soir de l'atelier, avec écart, recomptage et raison ;
  - une perte déclarée puis acceptée par la propriétaire ;
  - l'écran limité de la vendeuse ;
  - le réglage du rythme et le récapitulatif.
  La base est préparée avec `PARTIE8=1`.

**Mise en production : d'abord `partie8_inventaires_pertes.sql` (SQL Editor), puis l'application.** Dans cet ordre, rien ne casse : la partie 8 seule ne change rien aux écrans actuels. Dans l'autre ordre, « À faire » et le récapitulatif restent corrects (sections absentes), mais l'onglet « Inventaires » afficherait des erreurs jusqu'à l'application du script.

Annulation : `partie8_annulation.sql` (SQL Editor).
- Les inventaires et pertes enregistrés sont affichés, puis supprimés avec leurs tables.
- Le stock et le journal restent tels quels.
- Les types « inventaire » et « perte » restent acceptés si le journal en contient.

## Partie 9 : production de l'atelier par recette, recettes protégées

### Ce qui était faux
- **Matières :** une production n'enlevait aucune matière du stock atelier. Un vol de farine ou de beurre restait donc invisible.
- **Boutique :** une production « Boutique » ajoutait directement le stock boutique, sans envoi ni comptage à l'arrivée. L'ancien déclencheur réagit aussi aux modifications.
- **Recettes :** n'importe quel compte connecté pouvait modifier une recette, donc les quantités à retirer. Le remplacement d'une recette depuis l'écran échouait par ailleurs : la suppression était refusée, et l'ajout se faisait en doublon.
- **Coûts :** le coût affiché d'une recette divisait deux fois par la quantité, alors que le prix d'achat enregistré est déjà un prix à l'unité.

### Décisions de la propriétaire
- **Destination :** le produit fini entre au stock atelier, puis part à la boutique par un envoi compté à l'arrivée.
- **Matières manquantes :** s'il en manque au stock enregistré, la production est acceptée. On retire ce qui est enregistré, sans jamais descendre sous zéro, et le manque est simplement noté.
- **Rendement :** une recette donne environ N produits par fournée, dans une marge (par exemple N-3 à N+2). Hors de la marge, le propriétaire et les gérants sont prévenus.

### Ce que fait `partie9_production_recettes.sql` (aucune suppression : exécutable directement)
- **`recettes_fiches`, une par recette :** rendement par fournée, marge en moins et en plus, nom du produit fini. `journal_recettes` (ajout seul) garde chaque version.
- **`recette_enregistrer` et `recette_supprimer`,** pour le propriétaire et les gérants seulement :
  - les ingrédients et la fiche sont remplacés ensemble ;
  - l'ancienne version reste dans l'historique ;
  - la suppression demande un motif.
  - Les recettes ne s'écrivent plus en direct.
- **`declarer_production(recette, fournées, quantité obtenue, envoyer)`, pour la production et les gérants :**
  - les matières (fournées × quantités) sortent du stock atelier et sont inscrites au journal ;
  - le produit fini, trouvé par son nom ou créé, entre au stock atelier ;
  - il reprend le prix de vente de la recette s'il n'en a pas ;
  - « envoyer » crée aussitôt l'envoi vers la boutique ;
  - une quantité hors marge prévient le propriétaire et les gérants ;
  - le même envoi répété ne crée pas une seconde production.
  - Les productions ne s'écrivent plus en direct et ne se suppriment pas.
- **`recap_productions(du, au)` :** productions (obtenu, attendu, manques, coût), recettes modifiées et recettes sans rendement.

### Application
- **Production :** nouvelle production avec recette, nombre de fournées et quantité obtenue.
  - Avant d'enregistrer, l'écran montre les matières retirées, le stock atelier enregistré et le manque éventuel, et annonce un résultat hors marge.
  - Une case « Envoyer tout à la boutique maintenant » fait partir l'envoi.
  - La liste des dernières productions suit.
- **Recettes :**
  - pour chaque recette, « Donne environ N par fournée (marge) » ou « Rendement à indiquer » ;
  - « Modifier » et « Supprimer » pour le propriétaire et les gérants ;
  - quatre champs dans la fenêtre : produits par fournée, marges, nom du produit fini.
- **« À faire »** des gérants : « Recettes à compléter ».
- **Récapitulatif :**
  - en points à vérifier : productions hors marge, recettes modifiées (avec l'ancienne version), recettes sans rendement ;
  - une section « Productions ».

**À faire après la mise en production :** les 9 recettes actuelles n'ont pas de rendement, donc la production ne pourra pas les utiliser tant qu'elles ne sont pas complétées. Il faut indiquer pour chacune combien elle donne par fournée et vérifier ses quantités : par exemple, « 1 pain au lait » contient 100 de farine.

### Tests
- `PGHOST=... ./tests/lancer_production.sh` :
  - passage 1 : **44/44**. Cela comprend l'annulation sur base vide (exacte, 387 objets), le scénario de 42 vérifications, deux tests de concurrence (même production envoyée deux fois, deux productions simultanées sur la même farine), puis l'annulation avec des données ;
  - passages 2 à 9, sur des bases neuves : non-régression **195/195**, stock **65/65**, récapitulatif **47/47**, achats **34/34**, caisse **24/24**, magasinier **51/51**, achats réservés **11/11**, inventaires **69/69**.
- **Changements voulus dans les anciens scénarios :** la production directe en boutique est refusée (scénarios stock et sécurité).
- **Banc navigateur :** `parcours_production.js` **20/20**. Il couvre :
  - le réglage d'une recette par un gérant ;
  - la production sans droit de modifier les recettes ;
  - deux productions, dont une hors marge ;
  - le comptage en boutique ;
  - le récapitulatif.
  La base est préparée avec `PARTIE9=1`.

**Mise en production : d'abord `partie9_production_recettes.sql`, puis l'application.**

Annulation : `partie9_annulation.sql` (SQL Editor).
- Les fiches et l'historique des recettes sont affichés, puis supprimés.
- Les productions restent, sans leur détail.
- Les recettes redeviennent modifiables par tous, comme avant.
