// src/lib/supabase.js
// ⚠️ FICHIER LEGACY - Pour compatibilité ascendante uniquement
//
// Ce fichier était le monolithe original de 3,564 lignes contenant tous les services.
// Il a été refactoré en modules séparés pour une meilleure maintenabilité.
//
// MIGRATION COMPLÉTÉE :
// - Phase 1 ✅ : Corrections critiques (sécurité, duplications)
// - Phase 2 ✅ : Extraction de 18 services dans src/services/
// - Phase 3 ✅ : Migration de 22 composants vers nouveaux services
// - Phase 4 ✅ : Nettoyage de ce fichier (3564 → ~100 lignes)
//
// NOUVEAU CODE : Utilisez les imports directs depuis les modules appropriés :
//   - Services    : import { authService } from '@/services'
//   - Utils       : import { utils } from '@/utils/formatters'
//   - Client      : import { supabase } from '@/lib/supabase-client'
//
// Ce fichier contient maintenant uniquement des re-exports pour la compatibilité
// avec du code legacy qui n'a pas encore été migré.

// ==================== CLIENT SUPABASE ====================
// Re-export du client Supabase depuis le module dédié
export { supabase } from './supabase-client'

// ==================== SERVICES (RE-EXPORTS) ====================
// Tous les services sont maintenant dans src/services/
// Ces re-exports permettent la compatibilité avec l'ancien code

// Services Utilisateurs & Auth
export { authService } from '../services/authService'
export { userService } from '../services/userService'
export { permissionService } from '../services/permissionService'
export { permissionsService } from '../services/permissionsService'

// Services Produits & Stock
export { productService } from '../services/productService'
export { stockAtelierService } from '../services/stockAtelierService'
export { stockBoutiqueService } from '../services/stockBoutiqueService'
export { mouvementStockService } from '../services/mouvementStockService'

// Services Demandes
export { demandeService } from '../services/demandeService'

// Services Production & Recettes
export { productionService } from '../services/productionService'
export { recetteService } from '../services/recetteService'

// Services Prix & Caisse
export { prixService } from '../services/prixService'
export { caisseService } from '../services/caisseService'
export { arretCaisseService } from '../services/arretCaisseService'
export { cashierDashboardService } from '../services/cashierDashboardService'

// Services Comptabilité
export { comptabiliteService } from '../services/comptabiliteService'

// Services Ventes & Historique
export { historiqueVentesService } from '../services/historiqueVentesService'

// Services Statistiques
export { statsService } from '../services/statsService'

// Services Référentiel & Unités
export { referentielService } from '../services/referentielService'
export { uniteService } from '../services/uniteService'

// Services Notifications
export { notificationService } from '../services/notificationService'

// ==================== UTILITAIRES (RE-EXPORT) ====================
// Les utilitaires sont maintenant dans src/utils/formatters.js
// Ce re-export permet la compatibilité avec l'ancien code
export { utils } from '../utils/formatters'

// ==================== NOTES DE MIGRATION ====================
//
// ANCIEN CODE (avant refactoring) :
//   import { authService, utils, supabase } from '../../lib/supabase'
//
// NOUVEAU CODE (recommandé) :
//   import { supabase } from '../../lib/supabase-client'
//   import { authService } from '../../services'
//   import { utils } from '../../utils/formatters'
//
// AVANTAGES DE LA NOUVELLE STRUCTURE :
//   1. Modules séparés plus faciles à tester
//   2. Imports explicites (on sait d'où vient chaque fonction)
//   3. Meilleure organisation du code (services, utils, client séparés)
//   4. Réduction de la taille du bundle (tree-shaking possible)
//   5. Pas de fichier monolithique difficile à maintenir
//
// FICHIER ORIGINAL SAUVEGARDÉ :
//   Le fichier original de 3,564 lignes est sauvegardé dans :
//   → src/lib/supabase.js.backup (pour référence historique)
//
// PROCHAINES ÉTAPES (optionnel) :
//   - Phase 5 : Tests et validation
//   - Supprimer ce fichier legacy quand tous les imports sont migrés
//   - Mettre à jour les alias de chemins dans jsconfig.json/tsconfig.json
