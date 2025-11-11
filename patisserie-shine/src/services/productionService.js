// src/services/productionService.js
// Service de gestion des productions (transformation)
import { supabase } from '../lib/supabase-client'
// Imports pour les services interdépendants
// TODO: Attention aux imports circulaires, vérifier après extraction complète
import { prixService } from './prixService'
import { stockBoutiqueService } from './stockBoutiqueService'

/**
 * Service pour gérer les productions (transformation des matières en produits finis)
 */
export const productionService = {
  /**
   * Récupère toutes les productions avec les détails producteur
   * @returns {Object} { productions, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .order('date_production', { ascending: false })

      if (error) {
        console.error('Erreur getAll productions:', error)
        return { productions: [], error: error.message }
      }

      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll productions:', error)
      return { productions: [], error: error.message }
    }
  },

  /**
   * Crée une nouvelle production
   * Si destination = Boutique, transfère automatiquement vers le stock boutique
   * @param {Object} productionData - Données de production
   * @returns {Object} { production, error }
   */
  async createProduction(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('productions')
        .insert({
          produit: productionData.produit,
          quantite: productionData.quantite,
          destination: productionData.destination || 'Boutique',
          date_production: productionData.date_production || new Date().toISOString().split('T')[0],
          statut: 'termine',
          producteur_id: user?.id,
          cout_ingredients: productionData.cout_ingredients || 0
        })
        .select()
        .single()

      if (error) {
        return { production: null, error: error.message }
      }

      // Si production destinée à la boutique et prix de vente fourni
      if (productionData.destination === 'Boutique' && productionData.prix_vente) {
        // Définir le prix de vente pour la recette
        await prixService.setPrixVenteRecette(productionData.produit, productionData.prix_vente)

        // Transférer vers le stock boutique
        // Note: Cette méthode doit exister dans stockBoutiqueService
        await stockBoutiqueService.transferer(
          productionData.produit,
          productionData.quantite,
          productionData.prix_vente
        )
      }

      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans createProduction:', error)
      return { production: null, error: error.message }
    }
  },

  /**
   * Alias pour createProduction (compatibilité)
   */
  async create(productData) {
    return this.createProduction(productData)
  }
}
