# Prochaines Étapes - Module Cuisine

## ✅ Ce qui est fait

1. Base de données créée et fonctionnelle
2. Services backend créés (stockCuisineService, caisseCuisineService)
3. Documentation complète dans docs/MODULE_CUISINE.md

## 📝 Ce qui reste à faire

### 1. Copier et adapter les composants

Les composants cuisine sont très similaires aux composants boutique/atelier.
Vous pouvez les créer en copiant et adaptant les fichiers existants.

#### A. StockCuisineManager.js

**Commande:**
```bash
# Copier le fichier de base
cp src/components/stock/StockAtelierManager.js src/components/cuisine/StockCuisineManager.js
```

**Modifications à faire dans le nouveau fichier:**

1. Importer stockCuisineService au lieu de stockAtelierService
2. Remplacer tous les appels à stockAtelierService par stockCuisineService
3. Changer l'icône Package par ChefHat
4. Ajouter la possibilité de créer des produits cuisine (les admins)

**Lignes à modifier:**
- Ligne 6: `import { stockCuisineService } from '../../services';`
- Ligne 8: `import { ChefHat, ... } from 'lucide-react';`
- Partout où il y a stockAtelierService, remplacer par stockCuisineService

#### B. CaisseCuisineManager.js

**Commande:**
```bash
# Copier le fichier de base
cp src/components/caisse/CaisseManager.js src/components/cuisine/CaisseCuisineManager.js
```

**Modifications à faire:**

1. Importer caisseCuisineService au lieu de caisseService
2. Utiliser stockCuisineService.getProduitsDisponibles() pour les produits
3. Supprimer l'affichage client (pas nécessaire pour la cuisine)
4. Supprimer la clôture de caisse (version simplifiée)
5. Changer "Pâtisserie Shine" par "Pâtisserie Shine - Cuisine"

### 2. Ajouter à la navigation

Fichier: src/app/page.js ou votre fichier de navigation principal

Ajouter les liens pour les admins et employés cuisine:

```javascript
// Pour les admins et employés cuisine
{currentUser.role === 'admin' || currentUser.role === 'employe_cuisine' ? (
  <>
    <Link href="/stock-cuisine">
      <ChefHat /> Stock Cuisine
    </Link>
    <Link href="/caisse-cuisine">
      <CreditCard /> Caisse Cuisine
    </Link>
  </>
) : null}
```

### 3. Tester

1. Créer un compte avec rôle `employe_cuisine`
2. Se connecter et vérifier l'accès aux modules cuisine
3. Créer un produit cuisine (admin)
4. Ajouter du stock
5. Effectuer une vente test

## 🆘 Si vous préférez que je crée les composants

Faites-le moi savoir et je créerai les fichiers complets pour vous!
