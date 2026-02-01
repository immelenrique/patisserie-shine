# Module Cuisine - Guide Complet

## 📋 Vue d'ensemble

Le module cuisine permet de gérer un stock et une caisse séparés pour la cuisine, avec des produits spécifiques (plats, menus, boissons, etc.) différents de ceux de la boutique.

## ✅ Ce qui a été créé

### 1. Base de données (`database/tables_cuisine.sql`)

#### Tables créées:
- **`produits_cuisine`** - Produits spécifiques à la cuisine
  - nom, description, prix_vente, unite_id, categorie

- **`stock_cuisine`** - Stock des produits cuisine
  - produit_cuisine_id, quantite_disponible, quantite_vendue, prix_vente

- **`ventes_cuisine`** - Ventes de la cuisine
  - numero_ticket (format: CUIS-YYYYMMDD-XXXX), vendeur_id, total, montant_donne, monnaie_rendue

- **`lignes_vente_cuisine`** - Détails des ventes
  - vente_cuisine_id, produit_cuisine_id, nom_produit, quantite, prix_unitaire, sous_total

- **`mouvements_stock_cuisine`** - Historique des mouvements
  - produit_cuisine_id, type_mouvement, quantite, quantite_avant, quantite_apres

#### Rôle ajouté:
- **`employe_cuisine`** - Nouveau rôle dans la table `profiles`
- Contrainte mise à jour pour accepter: admin, caissier, producteur, employe_cuisine

#### Sécurité (RLS):
- Politiques d'accès pour admins et employés cuisine
- Les admins peuvent tout faire
- Les employés cuisine peuvent voir et vendre, mais pas modifier les produits

### 2. Services Backend

#### `stockCuisineService.js`
Fonctions disponibles:
```javascript
// Gestion des produits
- getProduitsCuisine()          // Liste tous les produits actifs
- createProduitCuisine(data)    // Créer un nouveau produit (admin)
- updateProduitCuisine(id, data)// Modifier un produit (admin)
- deleteProduitCuisine(id)      // Désactiver un produit (admin)

// Gestion du stock
- getAll()                      // Liste tous les stocks avec détails
- getByProduitId(id)           // Stock d'un produit spécifique
- createOrUpdateStock(data)     // Ajouter au stock (admin)
- ajusterQuantite(id, qty)      // Ajuster la quantité (admin)

// Historique et stats
- getHistoriqueMouvements(id?)  // Historique des mouvements
- getStatistiques()             // Stats du stock cuisine
- enregistrerMouvement(data)    // Enregistrer un mouvement
```

#### `caisseCuisineService.js`
Fonctions disponibles:
```javascript
// Ventes
- enregistrerVente(data)        // Enregistrer une nouvelle vente
- getVentesJour(vendeurId?)     // Ventes du jour
- getVenteById(id)             // Détails d'une vente

// Stats et produits
- getStatistiques(debut, fin)   // Stats des ventes
- getProduitsDisponibles()      // Produits dispo pour la caisse
- genererNumeroTicket()         // Génère un numéro unique
```

## 🔧 Installation

### Étape 1: Exécuter le script SQL

Connectez-vous à votre base Supabase et exécutez:
```bash
database/tables_cuisine.sql
```

Cela créera:
- Toutes les tables cuisine
- Les index pour optimiser les performances
- Les politiques RLS pour la sécurité
- Le nouveau rôle employe_cuisine

### Étape 2: Vérifier que les services sont exportés

Le fichier `src/services/index.js` doit exporter:
```javascript
export { stockCuisineService } from './stockCuisineService'
export { caisseCuisineService } from './caisseCuisineService'
```

✅ **Déjà fait!**

## 📱 Composants React à créer

### 1. StockCuisineManager

**Emplacement**: `src/components/cuisine/StockCuisineManager.js`

**Fonctionnalités**:
- Liste des produits cuisine avec leur stock
- Formulaire pour créer un nouveau produit (admin uniquement)
- Formulaire pour ajouter du stock (admin uniquement)
- Affichage de l'historique des mouvements
- Alertes pour stock faible

**À copier depuis**: `src/components/stock/StockAtelierManager.js`

**Modifications à faire**:
- Remplacer `stockAtelierService` par `stockCuisineService`
- Utiliser `produits_cuisine` au lieu de `produits`
- Ajouter icône `ChefHat` au lieu de `Package`
- Permettre la création de produits cuisine

### 2. CaisseCuisineManager

**Emplacement**: `src/components/cuisine/CaisseCuisineManager.js`

**Fonctionnalités**:
- Affichage des produits disponibles
- Panier de vente
- Calcul du total et de la monnaie
- Enregistrement des ventes
- Liste des ventes du jour
- Impression de reçus (optionnel, version simplifiée)

**À copier depuis**: `src/components/caisse/CaisseManager.js`

**Modifications à faire**:
- Remplacer `caisseService` par `caisseCuisineService`
- Utiliser `stockCuisineService.getProduitsDisponibles()`
- Pas besoin d'affichage client ni de clôture (version simplifiée)
- Format de ticket: CUIS-YYYYMMDD-XXXX

### 3. Mise à jour de la navigation

**Fichiers à modifier**:

#### a) `src/contexts/PermissionContext.js`
Ajouter les permissions pour employe_cuisine:
```javascript
const ROLE_PERMISSIONS = {
  // ... autres rôles
  employe_cuisine: {
    stock_cuisine: ['view'],
    caisse_cuisine: ['view', 'create']
  }
}
```

#### b) Menu de navigation principal
Ajouter les liens pour:
- Stock Cuisine (admins et employés cuisine)
- Caisse Cuisine (admins et employés cuisine)

## 🎯 Utilisation

### Pour les Administrateurs

1. **Créer des produits cuisine**:
   - Aller dans "Stock Cuisine"
   - Cliquer sur "Nouveau Produit"
   - Renseigner: nom, description, prix de vente, unité, catégorie
   - Exemples: "Menu du jour", "Plat poulet braisé", "Jus d'orange"

2. **Ajouter du stock**:
   - Cliquer sur "Ajouter Stock"
   - Sélectionner le produit
   - Indiquer la quantité disponible
   - Optionnel: modifier le prix de vente

3. **Créer des comptes employés**:
   - Aller dans "Gestion des utilisateurs"
   - Créer un compte avec rôle = `employe_cuisine`

### Pour les Employés Cuisine

1. **Utiliser la caisse**:
   - Aller dans "Caisse Cuisine"
   - Ajouter les produits au panier
   - Indiquer le montant donné
   - Finaliser la vente
   - Le stock est automatiquement décrémenté

2. **Voir les ventes du jour**:
   - Onglet "Ventes du Jour"
   - Statistiques: total, nombre de ventes, ticket moyen

## 🔒 Sécurité et Permissions

### Administrateurs
- ✅ Créer/modifier/supprimer produits cuisine
- ✅ Ajouter/ajuster le stock
- ✅ Voir tout l'historique
- ✅ Accéder à la caisse cuisine

### Employés Cuisine
- ✅ Voir les produits et le stock
- ✅ Utiliser la caisse cuisine
- ❌ Ne peuvent pas modifier les produits
- ❌ Ne peuvent pas ajuster le stock manuellement

## 📊 Traçabilité

Chaque action est tracée dans `mouvements_stock_cuisine`:
- **entree**: Ajout de stock par admin
- **vente**: Vente via la caisse
- **ajustement**: Modification manuelle de quantité

Chaque mouvement enregistre:
- Quantité avant/après
- Utilisateur responsable
- Date et heure
- Commentaire explicatif

## 🎨 Style et Icônes

Utiliser les icônes Lucide React:
- `ChefHat` - Pour le module cuisine
- `Package` - Pour le stock
- `CreditCard` - Pour la caisse
- `History` - Pour l'historique

Couleurs recommandées:
- Bouton principal: `bg-orange-600` (cohérent avec le reste)
- Bouton stock: `bg-green-600`
- Bouton historique: `bg-gray-600`
- Alerte stock faible: `bg-red-100 text-red-800`

## 🔄 Différences avec la Boutique

| Caractéristique | Boutique | Cuisine |
|----------------|----------|---------|
| Produits | Partagés (table produits) | Spécifiques (produits_cuisine) |
| Approvisionnement | Transfert depuis atelier | Saisie manuelle admin |
| Affichage client | Oui (second écran) | Non |
| Clôture caisse | Oui | Non (version simplifiée) |
| Format ticket | BOUT-YYYYMMDD-XXXX | CUIS-YYYYMMDD-XXXX |

## 📝 Notes Importantes

1. **Les produits cuisine sont indépendants** - Ils ne partagent pas la table `produits` avec la boutique
2. **Pas de transfert automatique** - Le stock est géré manuellement par les admins
3. **Version simplifiée de la caisse** - Pas besoin d'affichage client ni de clôture complexe
4. **Traçabilité complète** - Tous les mouvements sont enregistrés

## 🐛 Dépannage

### Les tables ne se créent pas
- Vérifier que vous avez les droits admin sur Supabase
- Exécuter le script SQL section par section si nécessaire
- Vérifier les logs d'erreur Supabase

### Les services ne fonctionnent pas
- Vérifier que les imports sont corrects dans `index.js`
- Vérifier que `supabase-client.js` est bien configuré
- Vérifier les permissions RLS dans Supabase

### Erreur "role check constraint"
- Le rôle `employe_cuisine` n'a pas été ajouté
- Exécuter la section "MISE À JOUR DU RÔLE" du script SQL

## 📞 Support

Pour toute question ou problème:
1. Vérifier ce guide
2. Consulter les logs de la console navigateur
3. Vérifier les logs Supabase
4. Comparer avec les modules boutique/atelier existants
