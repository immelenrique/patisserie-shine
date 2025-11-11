// src/services/index.js
// Barrel export - Point d'entrée centralisé pour tous les services

export { authService } from './authService'
export { userService } from './userService'
export { permissionService } from './permissionService'
export { historiqueVentesService } from './historiqueVentesService'

// Note: D'autres services seront ajoutés progressivement lors de la migration depuis lib/supabase.js  
// - statsService
// - productService
// - demandeService
// - stockAtelierService
// - stockBoutiqueService
// - prixService
// - caisseService
// - comptabiliteService
// - productionService
// - recetteService
// - referentielService
// - uniteService
// - mouvementStockService
// - arretCaisseService
