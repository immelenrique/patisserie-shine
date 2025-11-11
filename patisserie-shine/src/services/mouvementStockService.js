// src/services/mouvementStockService.js
// Service de gestion des mouvements de stock (historique des entrées/sorties)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer l'historique des mouvements de stock
 */
export const mouvementStockService = {
  /**
   * Récupère tous les mouvements de stock
   * @param {string} produitId - ID du produit (optionnel, filtre par produit)
   * @returns {Object} { mouvements, error }
   */
  async getAll(produitId = null) {
    try {
      let query = supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom, unite:unites(label)),
          utilisateur:profiles!mouvements_stock_utilisateur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (produitId) {
        query = query.eq('produit_id', produitId)
      }

      const { data, error } = await query

      if (error) {
        return { mouvements: [], error: error.message }
      }

      return { mouvements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll mouvements:', error)
      return { mouvements: [], error: error.message }
    }
  },

  /**
   * Crée un nouveau mouvement de stock
   * @param {Object} mouvementData - Données du mouvement
   * @returns {Object} { mouvement, error }
   */
  async create(mouvementData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('mouvements_stock')
        .insert({
          ...mouvementData,
          utilisateur_id: user?.id
        })
        .select()
        .single()

      if (error) {
        return { mouvement: null, error: error.message }
      }

      return { mouvement: data, error: null }
    } catch (error) {
      console.error('Erreur dans create mouvement:', error)
      return { mouvement: null, error: error.message }
    }
  }
}
