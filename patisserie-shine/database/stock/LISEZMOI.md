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
