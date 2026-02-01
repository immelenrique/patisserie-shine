// src/services/index.js
// Barrel export - Point d'entrée centralisé pour tous les services

// ========== Services Utilisateurs & Permissions ==========
export { authService } from './authService'
export { userService } from './userService'
export { permissionService } from './permissionService'
export { permissionsService } from './permissionsService'

// ========== Services Produits & Stock ==========
export { productService } from './productService'
export { stockAtelierService } from './stockAtelierService'
export { stockBoutiqueService } from './stockBoutiqueService'
export { stockCuisineService } from './stockCuisineService'
export { mouvementStockService } from './mouvementStockService'

// ========== Services Demandes ==========
export { demandeService } from './demandeService'

// ========== Services Production & Recettes ==========
export { productionService } from './productionService'
export { recetteService } from './recetteService'

// ========== Services Prix & Caisse ==========
export { prixService } from './prixService'
export { caisseService } from './caisseService'
export { caisseCuisineService } from './caisseCuisineService'
export { arretCaisseService } from './arretCaisseService'
export { cashierDashboardService } from './cashierDashboardService'

// ========== Services Comptabilité ==========
export { comptabiliteService } from './comptabiliteService'

// ========== Services Ventes & Historique ==========
export { historiqueVentesService } from './historiqueVentesService'

// ========== Services Statistiques ==========
export { statsService } from './statsService'

// ========== Services Référentiel & Unités ==========
export { referentielService } from './referentielService'
export { uniteService } from './uniteService'

// ========== Services Notifications ==========
export { notificationService } from './notificationService'
