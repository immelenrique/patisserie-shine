# Composants Cuisine - Instructions

## Pour créer rapidement les composants:

### 1. StockCuisineManager.js

Copiez `src/components/stock/StockAtelierManager.js` et modifiez:

**Rechercher/Remplacer:**
- `stockAtelierService` → `stockCuisineService`
- `Stock Atelier (Production)` → `Stock Cuisine`
- `Package` → `ChefHat` (pour l'icône principale)

**Supprimer:**
- Toute la section "transfert vers boutique" (lignes 130-171, fonction handleTransfer)
- Le bouton "Vider Tout le Stock" (lignes 244-253)
- La modal de transfert (lignes 327-396)

**Ajouter:**
- Fonction pour créer un nouveau produit cuisine (admin)
- Modal pour créer un produit
- Modal pour ajouter du stock

### 2. CaisseCuisineManager.js

Copiez `src/components/caisse/CaisseManager.js` et modifiez:

**Rechercher/Remplacer:**
- `caisseService` → `caisseCuisineService`
- `stockBoutiqueService` → `stockCuisineService`
- `Pâtisserie Shine` → `Pâtisserie Shine - Cuisine`
- `BOUT-` → `CUIS-` (format ticket)

**Supprimer:**
- Section "Affichage Client" (lignes 45-111 + 538-557)
- Section "Clôture" (lignes 448-491 + 548-555)
- Variable `clientDisplayWindow` et tout le code lié

**Garder:**
- Panier
- Calcul montant/monnaie
- Finalisation vente
- Liste ventes du jour
- Impression reçu (optionnel)

## Alternative: Code minimal

Si vous voulez juste tester rapidement, utilisez le code du guide MODULE_CUISINE.md section "Code minimal pour tester".

