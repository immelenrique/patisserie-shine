# MANUEL D'UTILISATION - ADMINISTRATEUR

## Table des matières
1. [Introduction](#introduction)
2. [Connexion](#connexion)
3. [Tableau de bord](#tableau-de-bord)
4. [Gestion des stocks](#gestion-des-stocks)
5. [Gestion de la production](#gestion-de-la-production)
6. [Gestion des demandes](#gestion-des-demandes)
7. [Caisse et ventes](#caisse-et-ventes)
8. [Comptabilité](#comptabilité)
9. [Gestion des dépenses](#gestion-des-dépenses)
10. [Gestion des utilisateurs](#gestion-des-utilisateurs)
11. [Gestion de l'équipe](#gestion-de-léquipe)
12. [Configuration du système](#configuration-du-système)

---

## Introduction

Bienvenue dans le manuel d'utilisation pour les **Administrateurs** de Patisserie Shine.

En tant qu'administrateur, vous avez accès à l'ensemble des fonctionnalités du système, à l'exception de la gestion des permissions (réservée au propriétaire).

**Vos responsabilités principales :**
- Superviser l'ensemble des opérations
- Gérer les stocks sur tous les emplacements
- Approuver ou rejeter les demandes de stock
- Créer et gérer les comptes utilisateurs
- Suivre les ventes et la comptabilité
- Gérer les dépenses de l'entreprise
- Configurer les produits et unités de mesure

**Votre rôle :** `admin` (Administrateur 👑)

---

## Connexion

### Première connexion

1. Ouvrez l'application Patisserie Shine dans votre navigateur
2. Entrez votre **nom d'utilisateur** (fourni par le propriétaire)
3. Entrez votre **mot de passe temporaire** (fourni par le propriétaire)
4. Cliquez sur **Se connecter**
5. Lors de la première connexion, vous serez invité à **changer votre mot de passe**
   - Entrez votre ancien mot de passe
   - Créez un nouveau mot de passe sécurisé
   - Confirmez le nouveau mot de passe
   - Cliquez sur **Changer le mot de passe**

### Connexions suivantes

1. Entrez votre nom d'utilisateur
2. Entrez votre mot de passe
3. Cliquez sur **Se connecter**

### Déconnexion

- Cliquez sur votre nom en haut à droite
- Sélectionnez **Déconnexion**

---

## Tableau de bord

Le tableau de bord est votre page d'accueil. Il affiche un aperçu global de l'activité.

### Statistiques affichées

**Cartes de statistiques :**
- **Produits fabriqués aujourd'hui** : Nombre de produits manufacturés dans la journée
- **Alertes stock principal** : Nombre de produits en stock critique dans l'entrepôt
- **Alertes stock atelier** : Nombre de produits en stock critique dans l'atelier
- **Demandes en attente** : Nombre de demandes de stock à traiter
- **Total stocks** : Nombre total d'articles en inventaire
- **Efficacité production** : Pourcentage d'efficacité de la production
- **Utilisateurs actifs** : Nombre d'utilisateurs actifs dans le système

**Section d'alertes :**
- Liste des produits en stock critique (nécessitant un réapprovisionnement urgent)
- Chaque alerte affiche le nom du produit et l'emplacement (principal ou atelier)

**Historique des ventes par employé (Admin uniquement) :**
- Onglet spécial vous permettant de voir les ventes réalisées par chaque employé
- Sélectionnez une date pour voir l'historique
- Détails par vendeur : nombre de ventes, montant total

### Actions possibles

- Consulter les statistiques en temps réel
- Identifier rapidement les produits à réapprovisionner
- Accéder aux demandes en attente depuis le tableau de bord
- Surveiller la performance des employés

---

## Gestion des stocks

En tant qu'administrateur, vous gérez **trois types de stocks** :
1. **Stock Principal** : Entrepôt principal
2. **Stock Atelier** : Zone de production
3. **Stock Boutique** : Zone de vente

### Stock Principal

**Accès :** Menu principal > **Stock**

#### Consulter le stock principal

- La page affiche tous les articles de l'entrepôt principal
- Colonnes affichées :
  - Produit
  - Quantité disponible
  - Unité de mesure
  - Date d'achat
  - Prix d'achat
  - Prix de vente (si défini)
  - Actions

#### Ajouter un nouvel article

1. Cliquez sur **+ Ajouter produit** (en haut à droite)
2. Remplissez le formulaire :
   - **Produit** : Sélectionnez le produit dans la liste déroulante
   - **Quantité** : Entrez la quantité achetée
   - **Unité** : Sélectionnez l'unité de mesure (kg, g, L, pièce, etc.)
   - **Date d'achat** : Sélectionnez la date d'acquisition
   - **Prix d'achat** : Prix unitaire d'achat
   - **Prix de vente** (optionnel) : Prix de vente si applicable
3. Cliquez sur **Ajouter**
4. Le produit apparaît dans la liste

#### Réapprovisionner un article existant

1. Trouvez l'article dans la liste
2. Cliquez sur l'icône **Réapprovisionner** (flèche circulaire)
3. Remplissez le formulaire :
   - **Quantité à ajouter** : Quantité supplémentaire
   - **Prix d'achat** : Nouveau prix unitaire
   - **Date d'achat** : Date du réapprovisionnement
4. Cliquez sur **Réapprovisionner**
5. La quantité est ajoutée au stock existant

#### Modifier un article

1. Cliquez sur l'icône **Modifier** (crayon)
2. Modifiez les informations nécessaires
3. Cliquez sur **Enregistrer**

#### Supprimer un article

1. Cliquez sur l'icône **Supprimer** (poubelle)
2. Confirmez la suppression dans la boîte de dialogue
3. L'article est retiré du stock

#### Rechercher un article

- Utilisez la barre de recherche en haut de la page
- Tapez le nom du produit
- La liste se filtre automatiquement

### Stock Atelier

**Accès :** Menu principal > **Stock Atelier**

#### Consulter le stock atelier

- Vue de tous les articles disponibles dans l'atelier de production
- Colonnes :
  - Produit
  - Quantité disponible
  - Unité
  - Statut (alerte si stock faible)

#### Transférer vers la boutique

L'atelier peut transférer des produits finis vers la boutique :

1. Trouvez le produit fini dans la liste
2. Cliquez sur **Transférer vers boutique**
3. Remplissez :
   - **Quantité à transférer** : Nombre d'unités
   - Vérifiez que le stock est suffisant
4. Cliquez sur **Transférer**
5. Le stock atelier diminue, le stock boutique augmente
6. Un historique du transfert est créé automatiquement

#### Consulter l'historique des entrées

- Onglet **Historique** : Liste de tous les mouvements de stock
- Informations par entrée :
  - Date
  - Produit
  - Quantité
  - Type d'opération (ajout, transfert, production)

### Stock Boutique

**Accès :** Menu principal > **Stock Boutique**

#### Consulter le stock boutique

- Vue de tous les produits disponibles à la vente
- Colonnes :
  - Produit
  - Stock réel
  - Quantité vendue
  - Quantité disponible
  - Prix de vente
  - Type de produit

#### Modifier les prix de vente (Admin uniquement)

1. Trouvez le produit dans la liste
2. Cliquez sur **Modifier le prix**
3. Entrez le nouveau prix de vente
4. Cliquez sur **Enregistrer**
5. Le nouveau prix est appliqué immédiatement
6. L'historique des prix est conservé

#### Voir l'historique des entrées

- Onglet **Historique** : Tous les mouvements entrants
- Source des entrées :
  - Transferts depuis l'atelier
  - Production directe
  - Ajustements manuels

---

## Gestion de la production

### Référentiel Produits

**Accès :** Menu principal > **Référentiel Produits** (Admin uniquement)

Le référentiel est la **base de données maître** de tous les produits de l'entreprise.

#### Consulter le référentiel

- Liste de tous les produits avec :
  - Code de référence
  - Nom du produit
  - Type d'emballage (sac, boîte, etc.)
  - Unité de mesure
  - Quantité par emballage
  - Prix d'acquisition

#### Ajouter un nouveau produit au référentiel

1. Cliquez sur **+ Ajouter produit**
2. Remplissez :
   - **Code référence** : Code unique du produit
   - **Nom** : Nom du produit
   - **Emballage** : Type d'emballage (sac, boîte, palette, etc.)
   - **Unité** : Unité de mesure (kg, L, pièce, etc.)
   - **Quantité/emballage** : Nombre d'unités par emballage
   - **Prix d'acquisition** : Prix de base
3. Cliquez sur **Ajouter**

#### Modifier un produit

1. Cliquez sur **Modifier**
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

#### Supprimer un produit

1. Cliquez sur **Supprimer**
2. Confirmez (attention : vérifiez qu'il n'est pas utilisé dans des recettes ou stocks)

### Recettes

**Accès :** Menu principal > **Recettes**

Les recettes définissent les ingrédients nécessaires pour fabriquer un produit fini.

#### Consulter les recettes

- Liste de toutes les recettes avec :
  - Produit fini
  - Ingrédients utilisés
  - Prix de vente
  - Actions

#### Créer une nouvelle recette

1. Cliquez sur **+ Nouvelle recette**
2. **Sélectionnez le produit fini** : Produit qui sera fabriqué
3. **Ajoutez les ingrédients** :
   - Cliquez sur **+ Ajouter ingrédient**
   - Sélectionnez l'ingrédient dans la liste
   - Entrez la quantité nécessaire
   - Répétez pour tous les ingrédients
4. **Définissez le prix de vente** (optionnel)
5. Cliquez sur **Enregistrer la recette**

#### Calculateur de recette

Outil pratique pour calculer les besoins en ingrédients :

1. Sélectionnez une recette
2. Cliquez sur **Calculer**
3. Entrez la **quantité désirée** à produire
4. Le système affiche :
   - Quantité de chaque ingrédient nécessaire
   - Coût total des ingrédients
   - Coût unitaire
   - Disponibilité des ingrédients en stock

#### Modifier une recette

1. Cliquez sur **Modifier**
2. Ajoutez ou retirez des ingrédients
3. Modifiez les quantités
4. Cliquez sur **Enregistrer**

#### Copier une recette

- Utile pour créer des variantes
- Cliquez sur **Copier**
- Modifiez la copie selon vos besoins

#### Supprimer une recette

1. Cliquez sur **Supprimer**
2. Confirmez la suppression

### Production

**Accès :** Menu principal > **Production**

Gestion des ordres de production.

#### Consulter les ordres de production

- Liste des ordres actifs et passés
- Informations :
  - Produit à fabriquer
  - Quantité
  - Destination (Atelier ou Boutique)
  - Date de production
  - Statut

#### Créer un ordre de production

1. Cliquez sur **+ Nouvel ordre**
2. Remplissez :
   - **Recette/Produit** : Sélectionnez ce qui sera fabriqué
   - **Quantité** : Nombre d'unités à produire
   - **Destination** : Boutique ou Atelier
   - **Date de production** : Date prévue
3. Vérifiez le **coût des ingrédients** affiché
4. Cliquez sur **Créer l'ordre**
5. Le système :
   - Déduit automatiquement les ingrédients du stock atelier
   - Ajoute le produit fini à la destination choisie
   - Enregistre l'ordre dans l'historique

#### Suivre le statut d'un ordre

- Statuts possibles : En attente, En cours, Terminé
- Visualisez les détails en cliquant sur un ordre

---

## Gestion des demandes

**Accès :** Menu principal > **Demandes**

Les demandes permettent aux employés de commander du stock d'un emplacement à un autre.

### Onglet : Demandes en attente

Toutes les demandes non traitées (statuts : `en_attente`, `en_traitement`)

#### Visualiser une demande

- Liste des demandes avec :
  - Numéro de demande
  - Demandeur
  - Date
  - Produits demandés
  - Destination
  - Statut
  - Commentaires

#### Approuver une demande complète

1. Cliquez sur **Voir détails** d'une demande
2. Vérifiez les produits demandés et les quantités
3. Si tout est OK, cliquez sur **Approuver tout**
4. Confirmez l'approbation
5. Le stock est automatiquement transféré
6. Le demandeur est notifié

#### Rejeter une demande complète

1. Ouvrez les détails de la demande
2. Cliquez sur **Rejeter tout**
3. Ajoutez un commentaire expliquant le refus (optionnel)
4. Confirmez le rejet
5. Le demandeur est notifié

#### Approbation partielle

Vous pouvez approuver certains articles et en rejeter d'autres :

1. Ouvrez les détails de la demande
2. Pour chaque produit :
   - Cliquez sur **Approuver** pour valider l'article
   - Cliquez sur **Rejeter** pour refuser l'article
3. Ajoutez des commentaires si nécessaire
4. Confirmez vos choix
5. Le transfert est effectué uniquement pour les articles approuvés

#### Ajouter un commentaire

- Utile pour communiquer avec le demandeur
- Entrez votre message dans le champ **Commentaire**
- Cliquez sur **Ajouter commentaire**

### Onglet : Demandes traitées

Historique de toutes les demandes complétées (statuts : `approuvé`, `rejeté`, `annulé`, `partiellement_approuvé`)

#### Consulter l'historique

- Toutes les demandes passées
- Filtrez par statut si nécessaire
- Voir qui a approuvé/rejeté et quand

---

## Caisse et ventes

**Accès :** Menu principal > **Caisse**

### Interface de caisse (POS)

#### Créer une vente

1. **Sélectionnez les produits** :
   - Recherchez un produit par nom dans la barre de recherche
   - OU parcourez le catalogue
   - Cliquez sur un produit pour l'ajouter au panier
2. **Ajustez les quantités** :
   - Utilisez les boutons +/- dans le panier
   - OU entrez la quantité manuellement
3. **Vérifiez le panier** :
   - Liste des articles
   - Quantités
   - Prix unitaires
   - Total
4. **Encaissez** :
   - Cliquez sur **Encaisser**
   - Entrez le **montant donné** par le client
   - Le système calcule la **monnaie à rendre**
5. **Imprimez le ticket** :
   - Un numéro de ticket est généré automatiquement
   - Cliquez sur **Imprimer ticket** si nécessaire
6. Le stock boutique est automatiquement mis à jour

#### Vérifier la disponibilité

- Chaque produit affiche son stock disponible
- Si le stock est insuffisant, un message d'alerte apparaît
- Vous ne pouvez pas vendre plus que le stock disponible

### Tableau de bord caisse (Admin)

**Fonctionnalités avancées pour les admins :**

#### Statistiques des ventes

- **Ventes par heure** : Graphique montrant le volume de ventes par tranche horaire
- **Ventes du jour** : Total des ventes de la journée
- **Ventes par caissier** : Performance de chaque employé

#### Filtrer les données

- Par date (sélecteur de date)
- Par caissier (liste déroulante)
- Afficher les ventes d'une période spécifique

#### Historique des ventes

- Liste de toutes les transactions
- Informations par vente :
  - Numéro de ticket
  - Date et heure
  - Caissier
  - Produits vendus
  - Montant total
  - Montant donné
  - Monnaie rendue

### Annulation de vente (Admin uniquement)

**Délai d'annulation : 7 jours maximum**

#### Procédure d'annulation

1. Accédez à l'historique des ventes
2. Trouvez la vente à annuler (max 7 jours)
3. Cliquez sur **Annuler la vente**
4. Remplissez le formulaire :
   - **Raison de l'annulation** : Obligatoire (erreur de saisie, retour client, etc.)
   - Vérifiez les détails de la vente
5. Cliquez sur **Confirmer l'annulation**
6. Le système :
   - Marque la vente comme annulée
   - **Restore automatiquement le stock**
   - Enregistre qui a annulé, quand et pourquoi
   - Crée un audit trail complet

**Important :**
- L'annulation est **irréversible**
- Une confirmation est demandée avant validation
- Après 7 jours, l'annulation n'est plus possible (contactez le support si nécessaire)
- Le stock est restauré dans l'état exact d'avant la vente

---

## Comptabilité

**Accès :** Menu principal > **Comptabilité**

### Rapport mensuel

#### Consulter le rapport du mois

1. Sélectionnez le **mois** et l'**année**
2. Le système affiche :
   - **Chiffre d'affaires total** du mois
   - **Répartition par catégorie** de produits
   - **Évolution mensuelle** (graphique comparant les mois de l'année)

#### Plage de dates personnalisée

1. Cliquez sur **Période personnalisée**
2. Sélectionnez la **date de début**
3. Sélectionnez la **date de fin**
4. Cliquez sur **Générer le rapport**

### Top produits

- **Produits les plus vendus** de la période sélectionnée
- Informations par produit :
  - Nom
  - Nombre de ventes
  - Contribution au chiffre d'affaires

### Évolution mensuelle

- **Graphique de tendance** montrant l'évolution des ventes sur l'année
- Identification des périodes hautes et basses
- Analyse saisonnière

### Détails des ventes

- Vue détaillée des transactions
- Filtres :
  - Par vendeur
  - Par date
  - Par montant
- Informations :
  - Numéro de ticket
  - Vendeur
  - Produits
  - Montant total
  - Monnaie rendue

### Exporter les données

#### Export CSV

1. Sélectionnez la période
2. Cliquez sur **Exporter CSV**
3. Le fichier est téléchargé automatiquement
4. Ouvrez avec Excel ou équivalent

#### Export PDF

1. Sélectionnez la période
2. Cliquez sur **Exporter PDF**
3. Le rapport PDF est généré et téléchargé
4. Prêt pour impression ou archivage

---

## Gestion des dépenses

**Accès :** Menu principal > **Dépenses** (Admin uniquement)

### Types de dépenses

Le système catégorise les dépenses en :
- **Achats de stock**
- **Réapprovisionnement stock**
- **Frais généraux**
- **Salaires**
- **Loyer**
- **Électricité**
- **Eau**
- **Transport**
- **Marketing**
- **Maintenance**
- **Fournitures de bureau**
- **Autres**

### Ajouter une dépense

1. Cliquez sur **+ Nouvelle dépense**
2. Remplissez le formulaire :
   - **Type de dépense** : Sélectionnez la catégorie
   - **Montant** : Montant de la dépense (FCFA ou autre devise)
   - **Date** : Date de la dépense
   - **Description** : Description détaillée
   - **Numéro de facture** (optionnel) : Référence de la facture
   - **Documents** (optionnel) : Joindre une photo ou un scan de la facture
3. Cliquez sur **Ajouter**

### Joindre des documents

1. Lors de l'ajout ou modification d'une dépense
2. Cliquez sur **Joindre un fichier**
3. Sélectionnez l'image ou le PDF
4. Le fichier est téléchargé et attaché à la dépense
5. Vous pouvez voir/télécharger le document ultérieurement

### Consulter les dépenses

- **Vue en liste** : Toutes les dépenses avec :
  - Type
  - Date
  - Montant
  - Description
  - Numéro de facture
  - Documents joints
  - Actions

### Filtrer les dépenses

#### Recherche

- Tapez dans la barre de recherche
- Recherche par description ou montant

#### Filtre par date

1. Cliquez sur **Filtrer par date**
2. Sélectionnez la **date de début**
3. Sélectionnez la **date de fin**
4. Cliquez sur **Appliquer**

#### Filtre par type

1. Cliquez sur **Filtrer par type**
2. Sélectionnez un ou plusieurs types de dépenses
3. La liste se met à jour automatiquement

#### Afficher/Masquer les montants nuls

- Option pour masquer les dépenses à 0 FCFA
- Cochez/décochez selon votre besoin

### Statistiques des dépenses

- **Total des dépenses** sur la période affichée
- **Répartition par type** (graphique ou liste)
- **Indicateur de tendance** (hausse/baisse par rapport à la période précédente)

### Modifier une dépense

1. Cliquez sur l'icône **Modifier** (crayon)
2. Modifiez les informations nécessaires
3. Cliquez sur **Enregistrer**

### Supprimer une dépense

1. Cliquez sur l'icône **Supprimer** (poubelle)
2. Confirmez la suppression
3. La dépense est retirée (action irréversible)

---

## Gestion des utilisateurs

**Accès :** Menu principal > **Utilisateurs** (Admin uniquement)

### Consulter les utilisateurs

#### Vue Utilisateurs actifs

- Liste de tous les utilisateurs actifs
- Colonnes :
  - Nom d'utilisateur
  - Nom complet
  - Téléphone
  - Rôle
  - Statut
  - Actions

#### Vue Utilisateurs inactifs

- Liste des utilisateurs désactivés (soft delete)
- Possibilité de les réactiver

### Créer un nouvel utilisateur

1. Cliquez sur **+ Créer utilisateur**
2. Remplissez le formulaire :
   - **Nom d'utilisateur** : Identifiant unique (minuscules, sans espaces)
   - **Nom complet** : Prénom et nom
   - **Téléphone** : Numéro de téléphone
   - **Rôle** : Sélectionnez parmi :
     - `admin` : Administrateur
     - `employe_production` : Employé Production
     - `employe_boutique` : Employé Boutique
3. Cliquez sur **Créer**
4. Le système :
   - Génère un **mot de passe temporaire** automatiquement
   - Affiche le mot de passe (notez-le, il ne sera plus visible)
   - Active l'option **Changement de mot de passe obligatoire** à la première connexion
5. Communiquez les identifiants à l'utilisateur

**Important :**
- Le mot de passe généré n'est affiché qu'une seule fois
- L'utilisateur devra le changer lors de sa première connexion
- Assurez-vous de noter le mot de passe avant de fermer la boîte de dialogue

### Modifier un utilisateur

1. Cliquez sur l'icône **Modifier** (crayon)
2. Modifiez :
   - Nom complet
   - Téléphone
   - Rôle
3. Cliquez sur **Enregistrer**

**Note :** Le nom d'utilisateur ne peut pas être modifié après création.

### Réinitialiser le mot de passe

1. Cliquez sur **Réinitialiser mot de passe**
2. Un nouveau mot de passe temporaire est généré
3. Notez le nouveau mot de passe
4. L'option **Changement obligatoire** est activée
5. Communiquez le nouveau mot de passe à l'utilisateur

### Désactiver un utilisateur (Soft delete)

**Action réversible**

1. Cliquez sur **Désactiver**
2. Confirmez la désactivation
3. L'utilisateur est déplacé vers **Utilisateurs inactifs**
4. Il ne peut plus se connecter
5. Ses données sont conservées

### Réactiver un utilisateur

1. Allez dans l'onglet **Utilisateurs inactifs**
2. Trouvez l'utilisateur à réactiver
3. Cliquez sur **Réactiver**
4. L'utilisateur est déplacé vers **Utilisateurs actifs**
5. Il peut à nouveau se connecter

### Supprimer définitivement un utilisateur (Hard delete)

**Action irréversible**

1. Cliquez sur **Supprimer définitivement**
2. Une boîte de confirmation s'affiche avec un avertissement
3. Tapez "SUPPRIMER" pour confirmer (si demandé)
4. Cliquez sur **Confirmer**
5. L'utilisateur et toutes ses données sont supprimés de façon permanente

**Attention :** Cette action ne peut pas être annulée. Utilisez-la avec précaution.

### Changer le statut d'un utilisateur

- Basculez entre **Actif** et **Inactif** avec l'interrupteur
- Un utilisateur inactif ne peut pas se connecter

---

## Gestion de l'équipe

**Accès :** Menu principal > **Équipe** (Admin uniquement)

### Consulter l'équipe

- Vue d'ensemble de tous les membres de l'équipe
- Informations affichées :
  - Nom
  - Rôle
  - Téléphone
  - Statut (actif/inactif)
  - Date d'ajout

### Gérer les membres

- Ajout/modification via la section **Utilisateurs**
- Vue consolidée de l'équipe pour un aperçu rapide

---

## Configuration du système

### Unités de mesure

**Accès :** Menu principal > **Unités** (Admin uniquement)

#### Consulter les unités

- Liste de toutes les unités de mesure disponibles :
  - kg (kilogramme)
  - g (gramme)
  - L (litre)
  - mL (millilitre)
  - pièce
  - boîte
  - sac
  - etc.

#### Créer une nouvelle unité

1. Cliquez sur **+ Nouvelle unité**
2. Remplissez :
   - **Nom** : Nom de l'unité (ex : "douzaine")
   - **Symbole** : Abréviation (ex : "dz")
   - **Description** (optionnel)
3. Cliquez sur **Créer**

#### Modifier une unité

1. Cliquez sur **Modifier**
2. Modifiez les informations
3. Cliquez sur **Enregistrer**

#### Supprimer une unité

1. Vérifiez qu'elle n'est pas utilisée dans les stocks ou recettes
2. Cliquez sur **Supprimer**
3. Confirmez

**Attention :** Ne supprimez pas une unité en cours d'utilisation, cela causera des erreurs.

---

## Résumé des responsabilités

### Ce que vous POUVEZ faire

- ✅ Gérer tous les stocks (principal, atelier, boutique)
- ✅ Approuver ou rejeter les demandes de stock
- ✅ Créer et gérer les utilisateurs
- ✅ Gérer les recettes et la production
- ✅ Voir toutes les ventes et statistiques
- ✅ Annuler des ventes (dans les 7 jours)
- ✅ Gérer les dépenses
- ✅ Configurer les produits et unités
- ✅ Accéder à la comptabilité et exporter les rapports
- ✅ Voir les ventes par employé
- ✅ Modifier les prix de vente

### Ce que vous NE POUVEZ PAS faire

- ❌ Gérer les permissions système (réservé au propriétaire uniquement)
- ❌ Modifier le nom d'utilisateur après création
- ❌ Annuler des ventes de plus de 7 jours
- ❌ Récupérer un utilisateur après suppression définitive

---

## Conseils et bonnes pratiques

### Gestion quotidienne

1. **Commencez par le tableau de bord** : Identifiez les alertes et priorités
2. **Traitez les demandes en attente** : Ne laissez pas les employés bloqués
3. **Vérifiez les stocks critiques** : Réapprovisionnez avant la rupture
4. **Surveillez les ventes** : Assurez-vous que les employés enregistrent correctement

### Sécurité

- Changez votre mot de passe régulièrement
- Ne partagez jamais vos identifiants
- Déconnectez-vous après chaque session
- Vérifiez les autorisations des utilisateurs périodiquement

### Organisation

- Créez les recettes avant de planifier la production
- Maintenez le référentiel produits à jour
- Documentez les raisons d'annulation de vente
- Archivez régulièrement les rapports comptables

### Gestion des stocks

- Effectuez des inventaires physiques réguliers
- Comparez avec les données système
- Ajustez si nécessaire
- Identifiez les écarts et leurs causes

### Gestion des utilisateurs

- Désactivez immédiatement les comptes des employés partis
- Vérifiez les rôles attribués régulièrement
- Forcez le changement de mot de passe si compromis
- Gardez une trace des comptes créés

---

## Support et assistance

### En cas de problème

1. Vérifiez d'abord votre connexion internet
2. Actualisez la page (F5)
3. Vérifiez que vous avez les permissions nécessaires
4. Consultez ce manuel
5. Contactez le support technique si le problème persiste

### Erreurs courantes

**"Permission refusée"** :
- Vérifiez que vous êtes connecté en tant qu'admin
- Contactez le propriétaire si vous devriez avoir accès

**"Stock insuffisant"** :
- Vérifiez la quantité disponible
- Réapprovisionnez le stock si nécessaire

**"Utilisateur déjà existant"** :
- Le nom d'utilisateur est déjà pris
- Choisissez un autre nom d'utilisateur

**"Impossible de supprimer"** :
- L'élément est peut-être utilisé ailleurs
- Vérifiez les dépendances avant suppression

---

## Annexes

### Raccourcis clavier

- **Ctrl+S** : Sauvegarder (sur les formulaires)
- **Échap** : Fermer une boîte de dialogue
- **Ctrl+F** : Rechercher (dans les listes)

### Limites du système

- **Annulation de vente** : Maximum 7 jours
- **Taille des fichiers joints** : Maximum 5 Mo
- **Formats acceptés** : Images (JPG, PNG) et PDF

---

**Version du manuel :** 1.0
**Date de dernière mise à jour :** 10 décembre 2025
**Rôle concerné :** Administrateur (`admin`)
