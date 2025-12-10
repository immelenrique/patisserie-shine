# MANUEL D'UTILISATION - EMPLOYÉ PRODUCTION

## Table des matières
1. [Introduction](#introduction)
2. [Connexion](#connexion)
3. [Tableau de bord](#tableau-de-bord)
4. [Consultation du stock](#consultation-du-stock)
5. [Stock atelier](#stock-atelier)
6. [Recettes](#recettes)
7. [Production](#production)
8. [Demandes de stock](#demandes-de-stock)
9. [Bonnes pratiques](#bonnes-pratiques)

---

## Introduction

Bienvenue dans le manuel d'utilisation pour les **Employés de Production** de Patisserie Shine.

En tant qu'employé de production, votre rôle est essentiel dans la fabrication des produits de la pâtisserie. Vous gérez la production, consultez les recettes, et assurez la disponibilité des ingrédients nécessaires.

**Vos responsabilités principales :**
- Consulter et suivre les recettes
- Créer des ordres de production
- Gérer le stock de l'atelier
- Demander des ingrédients au stock principal si nécessaire
- Surveiller les alertes de stock

**Votre rôle :** `employe_production` (Employé Production 👩‍🍳)

---

## Connexion

### Première connexion

1. Ouvrez l'application Patisserie Shine dans votre navigateur
2. Entrez votre **nom d'utilisateur** (fourni par l'administrateur)
3. Entrez votre **mot de passe temporaire** (fourni par l'administrateur)
4. Cliquez sur **Se connecter**
5. Lors de la première connexion, vous **devez changer votre mot de passe** :
   - Entrez votre ancien mot de passe (celui fourni)
   - Créez un **nouveau mot de passe sécurisé**
     - Au moins 8 caractères
     - Mélangez lettres, chiffres et caractères spéciaux
   - Confirmez le nouveau mot de passe
   - Cliquez sur **Changer le mot de passe**

### Connexions suivantes

1. Entrez votre nom d'utilisateur
2. Entrez votre mot de passe personnel
3. Cliquez sur **Se connecter**

### Déconnexion

- Cliquez sur votre nom en haut à droite de l'écran
- Sélectionnez **Déconnexion**

**Important :** Déconnectez-vous toujours après votre travail pour sécuriser votre compte.

---

## Tableau de bord

Le tableau de bord est votre page d'accueil. Il vous donne un aperçu rapide de l'activité de production.

### Informations affichées

**Cartes statistiques :**

1. **Produits fabriqués aujourd'hui**
   - Nombre total de produits manufacturés dans la journée
   - Mise à jour en temps réel

2. **Alertes stock principal**
   - Nombre de produits en stock critique dans l'entrepôt principal
   - Indicateur rouge si urgent

3. **Alertes stock atelier**
   - Nombre d'ingrédients en stock faible dans votre atelier
   - Nécessite une action rapide (demande de réapprovisionnement)

4. **Demandes en attente**
   - Nombre de vos demandes de stock en attente d'approbation
   - Vérifiez régulièrement leur statut

5. **Total stocks**
   - Nombre total d'articles en inventaire (tous emplacements)

6. **Efficacité production**
   - Pourcentage d'efficacité de la production
   - Indicateur de performance

**Section Alertes :**
- Liste des produits en **stock critique**
- Nom du produit et emplacement (principal ou atelier)
- Action requise : demander un réapprovisionnement

### Actions à effectuer depuis le tableau de bord

1. **Vérifier les alertes stock atelier** : Si un ingrédient est faible, créez une demande
2. **Suivre vos demandes en attente** : Vérifiez si elles ont été approuvées
3. **Planifier la production** : Basez-vous sur les alertes et les besoins

---

## Consultation du stock

### Stock principal

**Accès :** Menu principal > **Stock**

Le stock principal contient tous les ingrédients et matières premières de l'entrepôt.

#### Que pouvez-vous voir ?

- **Liste complète** de tous les articles en stock
- Informations par article :
  - Nom du produit
  - Quantité disponible
  - Unité de mesure (kg, g, L, pièce, etc.)
  - Date d'achat
  - Prix d'achat (si visible)

#### Que pouvez-vous faire ?

**Consultation uniquement :**
- ✅ Voir les quantités disponibles
- ✅ Rechercher un produit spécifique
- ✅ Vérifier la disponibilité avant de créer un ordre de production
- ❌ Vous ne pouvez **pas ajouter, modifier ou supprimer** de stock (réservé aux admins)

#### Rechercher un produit

1. Utilisez la **barre de recherche** en haut de la page
2. Tapez le nom de l'ingrédient recherché
3. La liste se filtre automatiquement

**Conseil :** Vérifiez toujours la disponibilité des ingrédients avant de lancer une production.

---

## Stock atelier

**Accès :** Menu principal > **Stock Atelier**

Le stock atelier contient les ingrédients et produits présents dans votre zone de production.

### Consulter le stock atelier

- Vue de tous les articles dans l'atelier
- Colonnes affichées :
  - Produit
  - Quantité disponible
  - Unité
  - Statut (alerte si stock faible)

### Alertes de stock

- Les produits en **quantité critique** sont surlignés en rouge
- Prenez action rapidement en demandant un réapprovisionnement

### Transférer vers la boutique

Lorsqu'un produit fini est prêt, vous pouvez le transférer vers la boutique :

#### Procédure de transfert

1. Trouvez le **produit fini** dans la liste du stock atelier
2. Cliquez sur **Transférer vers boutique**
3. Une fenêtre s'ouvre :
   - Vérifiez le nom du produit
   - Entrez la **quantité à transférer**
   - Assurez-vous que la quantité est disponible (le système vérifie automatiquement)
4. Cliquez sur **Transférer**
5. Confirmez le transfert

**Résultat :**
- Le stock atelier diminue de la quantité transférée
- Le stock boutique augmente automatiquement
- Un historique du transfert est créé

**Important :**
- Ne transférez que des produits **finis et prêts à la vente**
- Vérifiez la qualité avant le transfert
- Le transfert ne peut pas être annulé facilement, soyez certain de vos quantités

### Consulter l'historique

**Onglet Historique** :
- Liste de tous les mouvements de stock dans l'atelier
- Informations par entrée :
  - Date et heure
  - Produit
  - Quantité ajoutée ou retirée
  - Type d'opération (production, transfert, demande)
  - Responsable

**Utilité :** Suivre d'où viennent les ingrédients et où vont les produits finis.

---

## Recettes

**Accès :** Menu principal > **Recettes**

Les recettes définissent les ingrédients et quantités nécessaires pour fabriquer chaque produit.

### Consulter les recettes

- Liste de **toutes les recettes** disponibles
- Informations affichées :
  - Nom du produit fini
  - Liste des ingrédients nécessaires
  - Quantités par ingrédient
  - Prix de vente (si défini)

### Voir les détails d'une recette

1. Cliquez sur une recette pour l'ouvrir
2. Vous verrez :
   - **Produit fini** : Ce que la recette permet de fabriquer
   - **Ingrédients** : Liste complète avec quantités exactes
   - **Unités** : kg, g, L, etc.

**Important :** Respectez strictement les quantités indiquées pour garantir la qualité du produit.

### Calculateur de recette

Outil très utile pour planifier la production.

#### Comment utiliser le calculateur

1. Sélectionnez une **recette** dans la liste
2. Cliquez sur **Calculer** ou **Calculateur**
3. Entrez la **quantité désirée** que vous voulez produire
   - Exemple : Si vous voulez faire 50 croissants, entrez "50"
4. Cliquez sur **Calculer**

**Le système affiche :**
- **Quantité de chaque ingrédient nécessaire** pour la production souhaitée
- **Coût total** des ingrédients (si les prix sont disponibles)
- **Coût unitaire** par produit fini
- **Disponibilité en stock** : le système vérifie si vous avez assez d'ingrédients

**Exemple :**
```
Recette : Croissants (quantité de base : 10)
Vous voulez produire : 50 croissants

Résultat du calculateur :
- Farine : 2,5 kg (disponible : 3 kg) ✅
- Beurre : 1,25 kg (disponible : 0,8 kg) ❌ STOCK INSUFFISANT
- Sucre : 0,5 kg (disponible : 2 kg) ✅

Coût total : 5 000 FCFA
Coût unitaire : 100 FCFA/pièce
```

**Action si stock insuffisant :**
- Créez une **demande de stock** pour les ingrédients manquants
- Attendez l'approbation avant de lancer la production

### Limitations

**Ce que vous NE POUVEZ PAS faire :**
- ❌ Créer de nouvelles recettes (réservé aux admins)
- ❌ Modifier les recettes existantes
- ❌ Supprimer des recettes

**Pourquoi ?** Seuls les admins peuvent modifier les recettes pour garantir la cohérence et la qualité des produits.

**Si une recette est incorrecte :** Signalez-le à votre administrateur.

---

## Production

**Accès :** Menu principal > **Production**

C'est ici que vous gérez vos ordres de production.

### Consulter les ordres de production

- Liste de **tous les ordres** (actifs et passés)
- Informations par ordre :
  - Produit à fabriquer
  - Quantité
  - Destination (Atelier ou Boutique)
  - Date de production
  - Statut (En attente, En cours, Terminé)
  - Coût des ingrédients

### Créer un nouvel ordre de production

#### Étape par étape

1. Cliquez sur **+ Nouvel ordre** ou **Créer un ordre**

2. **Sélectionnez la recette/produit** :
   - Liste déroulante de toutes les recettes disponibles
   - Choisissez ce que vous allez fabriquer

3. **Entrez la quantité** :
   - Nombre d'unités à produire
   - Exemple : 100 croissants

4. **Choisissez la destination** :
   - **Atelier** : Le produit fini reste dans l'atelier (pour transformation ultérieure)
   - **Boutique** : Le produit fini va directement à la vente

5. **Sélectionnez la date de production** :
   - Date prévue pour la fabrication
   - Par défaut : aujourd'hui

6. **Vérifiez le coût** :
   - Le système affiche automatiquement le **coût total des ingrédients**
   - Basé sur les prix d'achat

7. Cliquez sur **Créer l'ordre** ou **Valider**

#### Que se passe-t-il après la création ?

**Le système automatiquement :**
1. **Vérifie la disponibilité** des ingrédients dans le stock atelier
2. **Déduit les ingrédients** du stock atelier selon les quantités de la recette
3. **Ajoute le produit fini** à la destination choisie (atelier ou boutique)
4. **Enregistre l'ordre** dans l'historique

**Important :**
- Si les ingrédients ne sont **pas suffisants**, une erreur apparaît
- Vous devez d'abord demander un réapprovisionnement
- Ne créez pas d'ordre si vous n'avez pas tous les ingrédients

### Suivre le statut d'un ordre

**Statuts possibles :**
- **En attente** : Ordre créé mais production pas encore commencée
- **En cours** : Production en cours
- **Terminé** : Production complétée

**Pour mettre à jour le statut :**
- Cliquez sur l'ordre
- Changez le statut selon l'avancement
- Sauvegardez

### Consulter l'historique

- Tous les ordres passés sont archivés
- Filtrez par date si nécessaire
- Consultez les détails (produit, quantité, coût, date)

---

## Demandes de stock

**Accès :** Menu principal > **Demandes**

Lorsque vous manquez d'ingrédients dans l'atelier, vous devez créer une demande pour obtenir un transfert depuis le stock principal.

### Vue des demandes

**Deux onglets :**
1. **Demandes en attente** : Vos demandes non encore traitées
2. **Demandes traitées** : Historique des demandes approuvées, rejetées ou annulées

### Créer une nouvelle demande

#### Procédure

1. Cliquez sur **+ Nouvelle demande**

2. **Sélectionnez les produits** :
   - Cliquez sur **Ajouter un produit**
   - Sélectionnez l'ingrédient dans la liste déroulante
   - Entrez la **quantité souhaitée**
   - Répétez pour tous les ingrédients nécessaires

3. **Choisissez la destination** :
   - Normalement : **Atelier** (votre zone de production)

4. **Ajoutez un commentaire** (optionnel mais recommandé) :
   - Exemple : "Pour production de croissants de demain"
   - Aide l'administrateur à comprendre l'urgence

5. Cliquez sur **Envoyer la demande**

**Résultat :**
- Votre demande est envoyée à l'administrateur
- Statut initial : **En attente**
- Vous recevez une notification de création

### Suivre une demande en attente

1. Allez dans l'onglet **Demandes en attente**
2. Vous voyez toutes vos demandes non traitées
3. Informations affichées :
   - Numéro de demande
   - Date de création
   - Produits demandés avec quantités
   - Destination
   - Statut actuel (en_attente, en_traitement)
   - Commentaires (vos commentaires + réponses de l'admin)

**Statuts possibles :**
- **en_attente** : La demande attend d'être vue par l'admin
- **en_traitement** : L'admin est en train de la traiter
- **approuvée** : Tous les articles ont été approuvés, le transfert est effectué
- **rejetée** : La demande a été refusée (voir commentaires de l'admin)
- **partiellement_approuvée** : Certains articles ont été approuvés, d'autres rejetés
- **annulée** : Vous avez annulé la demande

### Consulter les demandes traitées

**Onglet Demandes traitées :**
- Historique complet de toutes vos demandes passées
- Voir les raisons d'approbation ou de rejet
- Comprendre les décisions de l'admin

### Annuler une demande

Si vous n'avez finalement plus besoin d'une demande :

1. Trouvez la demande dans **Demandes en attente**
2. Cliquez sur **Annuler**
3. Confirmez l'annulation
4. Statut change en **annulée**

**Important :** Vous ne pouvez annuler que vos propres demandes, et seulement si elles ne sont pas encore traitées.

### Que faire si une demande est rejetée ?

1. Lisez les **commentaires de l'administrateur**
2. Comprenez la raison du rejet (stock insuffisant, urgence non justifiée, etc.)
3. Ajustez votre demande si nécessaire
4. Créez une nouvelle demande avec les modifications
5. Ou contactez l'administrateur pour discuter

### Approbation partielle

Parfois, l'admin peut approuver certains articles et en rejeter d'autres :

**Exemple :**
```
Votre demande :
- 5 kg de farine → Approuvé ✅
- 3 kg de beurre → Rejeté ❌ (stock insuffisant)
- 1 kg de sucre → Approuvé ✅

Statut : Partiellement approuvée
```

**Que faire :**
- Vous recevez les articles approuvés
- Créez une nouvelle demande pour les articles rejetés (ou trouvez une alternative)

---

## Bonnes pratiques

### Planification de la production

1. **Vérifiez le stock AVANT de créer un ordre**
   - Consultez le stock atelier
   - Utilisez le calculateur de recette
   - Identifiez les ingrédients manquants

2. **Anticipez vos besoins**
   - Créez vos demandes de stock **à l'avance**
   - Ne demandez pas à la dernière minute
   - Pensez aux délais d'approbation

3. **Soyez précis dans vos quantités**
   - Utilisez le calculateur pour éviter les erreurs
   - Ne surestimez pas les besoins (gaspillage)
   - Ne sous-estimez pas (risque de manquer)

### Gestion du stock atelier

1. **Surveillez les alertes**
   - Consultez le tableau de bord tous les jours
   - Agissez rapidement sur les stocks critiques

2. **Organisez votre espace**
   - Rangez les ingrédients reçus correctement
   - Respectez les dates de péremption (FIFO : First In, First Out)

3. **Transférez régulièrement**
   - Ne laissez pas les produits finis s'accumuler dans l'atelier
   - Transférez vers la boutique dès que prêt

### Communication avec l'administrateur

1. **Utilisez les commentaires**
   - Expliquez pourquoi vous demandez un stock
   - Mentionnez l'urgence si nécessaire
   - Soyez clair et concis

2. **Signalez les problèmes**
   - Recette incorrecte ? Signalez
   - Stock endommagé ? Informez
   - Erreur système ? Contactez l'admin

### Sécurité et qualité

1. **Respectez les recettes**
   - Ne modifiez jamais les quantités sans autorisation
   - La qualité du produit en dépend

2. **Vérifiez la qualité des ingrédients**
   - Avant d'utiliser un ingrédient, vérifiez son état
   - Si un ingrédient semble périmé, ne l'utilisez pas

3. **Déconnectez-vous**
   - Toujours se déconnecter après le travail
   - Ne partagez jamais votre mot de passe

### Optimisation du travail

1. **Groupez vos demandes**
   - Demandez tous les ingrédients nécessaires en une seule fois
   - Évitez les demandes multiples pour le même besoin

2. **Planifiez votre journée**
   - Consultez les recettes le matin
   - Vérifiez les stocks disponibles
   - Créez les ordres de production
   - Lancez les demandes si besoin

3. **Consultez l'historique**
   - Apprenez des productions passées
   - Identifiez les quantités habituelles
   - Optimisez vos processus

---

## Ce que vous POUVEZ et NE POUVEZ PAS faire

### ✅ Vous POUVEZ

- Consulter le stock principal (lecture seule)
- Consulter et gérer le stock atelier
- Transférer des produits finis vers la boutique
- Consulter toutes les recettes
- Utiliser le calculateur de recette
- Créer des ordres de production
- Créer des demandes de stock
- Suivre vos demandes
- Annuler vos propres demandes (si non traitées)
- Consulter l'historique de vos actions
- Voir les alertes de stock

### ❌ Vous NE POUVEZ PAS

- Ajouter, modifier ou supprimer du stock principal
- Créer ou modifier des recettes
- Approuver ou rejeter des demandes
- Voir les demandes des autres employés (sauf si admin)
- Accéder à la caisse (POS)
- Voir la comptabilité ou les rapports financiers
- Gérer les utilisateurs
- Modifier les prix de vente
- Accéder aux dépenses
- Gérer les unités de mesure
- Voir les ventes de la boutique
- Accéder au stock boutique directement (sauf pour transfert)

---

## Résolution de problèmes

### Problèmes courants

#### "Stock insuffisant" lors de la création d'un ordre

**Cause :** Les ingrédients ne sont pas disponibles en quantité suffisante dans le stock atelier.

**Solution :**
1. Utilisez le calculateur pour voir exactement ce qui manque
2. Créez une demande de stock pour les ingrédients manquants
3. Attendez l'approbation de la demande
4. Une fois le stock reçu, créez à nouveau votre ordre

#### "Demande en attente depuis longtemps"

**Cause :** L'administrateur n'a peut-être pas vu votre demande.

**Solution :**
1. Vérifiez que la demande est bien en statut "en_attente"
2. Relancez l'administrateur (par téléphone ou en personne)
3. Vérifiez vos commentaires : avez-vous bien expliqué l'urgence ?

#### "Impossible de se connecter"

**Cause :** Nom d'utilisateur ou mot de passe incorrect, ou compte désactivé.

**Solution :**
1. Vérifiez votre nom d'utilisateur (respectez minuscules/majuscules)
2. Vérifiez votre mot de passe
3. Si oublié, contactez l'administrateur pour réinitialisation
4. Si le compte est désactivé, contactez l'administrateur

#### "Page ou fonctionnalité non accessible"

**Cause :** Vous n'avez pas les permissions nécessaires pour cette page.

**Solution :**
1. Vérifiez que vous devriez avoir accès (consultez ce manuel)
2. Si oui, contactez l'administrateur pour vérifier vos permissions
3. Peut-être que cette fonctionnalité n'est pas pour votre rôle

---

## Raccourcis et astuces

### Navigation rapide

- **Tableau de bord** : Cliquez sur le logo en haut à gauche
- **Recherche** : Utilisez Ctrl+F dans les listes
- **Actualiser** : Appuyez sur F5 pour rafraîchir les données

### Astuces de productivité

1. **Commencez par le tableau de bord** chaque matin
2. **Notez vos productions** régulières pour anticiper les besoins
3. **Utilisez toujours le calculateur** avant de créer un ordre
4. **Commentez vos demandes** pour faciliter l'approbation
5. **Transférez régulièrement** vers la boutique pour éviter l'encombrement

---

## Support et assistance

### En cas de problème technique

1. **Actualisez la page** (F5)
2. **Vérifiez votre connexion internet**
3. **Déconnectez-vous et reconnectez-vous**
4. **Consultez ce manuel**
5. **Contactez l'administrateur** si le problème persiste

### Qui contacter ?

- **Questions sur les recettes** : Administrateur ou chef de production
- **Problèmes techniques** : Administrateur ou support IT
- **Demandes urgentes** : Administrateur (par téléphone)
- **Formation** : Administrateur ou collègue expérimenté

---

## Glossaire

- **Ordre de production** : Instruction de fabrication d'un produit selon une recette
- **Demande de stock** : Demande de transfert d'ingrédients du stock principal vers l'atelier
- **Calculateur de recette** : Outil pour calculer les ingrédients nécessaires selon la quantité à produire
- **Stock atelier** : Inventaire des ingrédients et produits dans la zone de production
- **Stock principal** : Inventaire de l'entrepôt principal
- **Transfert** : Mouvement de produits d'un emplacement à un autre
- **FIFO** : First In, First Out (premier entré, premier sorti - méthode de gestion de stock)
- **Alerte de stock** : Notification quand un produit atteint un niveau critique

---

**Version du manuel :** 1.0
**Date de dernière mise à jour :** 10 décembre 2025
**Rôle concerné :** Employé Production (`employe_production`)

---

**Bonne production et respectez toujours les standards de qualité !**
