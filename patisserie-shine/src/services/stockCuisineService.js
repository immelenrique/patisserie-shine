// src/services/stockCuisineService.js
// Service de gestion du stock cuisine
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer le stock de la cuisine (produits cuisine et stock)
 */
export const stockCuisineService = {
  /**
   * Récupère tous les produits cuisine
   * @returns {Object} { produits, error }
   */
  async getProduitsCuisine() {
    try {
      const { data, error } = await supabase
        .from('produits_cuisine')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .eq('actif', true)
        .order('nom', { ascending: true })

      if (error) {
        console.error('Erreur getProduitsCuisine:', error)
        return { produits: [], error: error.message }
      }

      return { produits: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsCuisine:', error)
      return { produits: [], error: error.message }
    }
  },

  /**
   * Crée un nouveau produit cuisine (admin uniquement)
   * @param {Object} produitData - Données du produit
   * @returns {Object} { produit, error }
   */
  async createProduitCuisine(produitData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('produits_cuisine')
        .insert({
          ...produitData,
          created_by: user?.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { produit: null, error: error.message }
      }

      return { produit: data, error: null }
    } catch (error) {
      console.error('Erreur dans createProduitCuisine:', error)
      return { produit: null, error: error.message }
    }
  },

  /**
   * Met à jour un produit cuisine (admin uniquement)
   * @param {number} id - ID du produit
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Object} { produit, error }
   */
  async updateProduitCuisine(id, updates) {
    try {
      const { data, error } = await supabase
        .from('produits_cuisine')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { produit: null, error: error.message }
      }

      return { produit: data, error: null }
    } catch (error) {
      console.error('Erreur dans updateProduitCuisine:', error)
      return { produit: null, error: error.message }
    }
  },

  /**
   * Désactive un produit cuisine (soft delete)
   * @param {number} id - ID du produit
   * @returns {Object} { success, error }
   */
  async deleteProduitCuisine(id) {
    try {
      const { error } = await supabase
        .from('produits_cuisine')
        .update({ actif: false })
        .eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans deleteProduitCuisine:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Récupère tout le stock cuisine avec les détails produits
   * @returns {Object} { stocks, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('stock_cuisine')
        .select(`
          *,
          produit:produits_cuisine(
            id,
            nom,
            description,
            prix_vente,
            unite:unites(id, value, label)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getAll stock cuisine:', error)
        return { stocks: [], error: error.message }
      }

      return { stocks: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll stock cuisine:', error)
      return { stocks: [], error: error.message }
    }
  },

  /**
   * Récupère un stock spécifique par produit
   * @param {number} produitCuisineId - ID du produit cuisine
   * @returns {Object} { stock, error }
   */
  async getByProduitId(produitCuisineId) {
    try {
      const { data, error } = await supabase
        .from('stock_cuisine')
        .select(`
          *,
          produit:produits_cuisine(
            id,
            nom,
            prix_vente,
            unite:unites(label)
          )
        `)
        .eq('produit_cuisine_id', produitCuisineId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { stock: null, error: null }
        }
        return { stock: null, error: error.message }
      }

      return { stock: data, error: null }
    } catch (error) {
      console.error('Erreur dans getByProduitId:', error)
      return { stock: null, error: error.message }
    }
  },

  /**
   * Entrée en stock cuisine (propriétaire et gérants), par la base : quantité ajoutée, prix éventuel,
   * mouvement tracé ; la même entrée renvoyée avec la même clé n'est comptée qu'une fois
   * @param {Object} stockData - { produit_cuisine_id, quantite_disponible, prix_vente, commentaire, cle }
   * @returns {Object} { stock, error }
   */
  async createOrUpdateStock(stockData) {
    const { data, error } = await supabase.rpc('entree_stock_cuisine', {
      p_produit_cuisine_id: stockData.produit_cuisine_id,
      p_quantite: stockData.quantite_disponible,
      p_prix_vente: stockData.prix_vente ?? null,
      p_commentaire: stockData.commentaire || null,
      p_cle: stockData.cle || null
    })
    if (error) {
      console.error('Erreur entree_stock_cuisine:', error)
      return { stock: null, error: error.message }
    }
    return { stock: data, error: null }
  },

  /**
   * Correction de la quantité en stock (propriétaire et gérants), motif obligatoire, tracée
   * @param {number} produitCuisineId - ID du produit cuisine
   * @param {number} nouvelleQuantite - Quantité réellement présente
   * @param {string} motif - Raison de la correction
   * @returns {Object} { success, error }
   */
  async ajusterQuantite(produitCuisineId, nouvelleQuantite, motif) {
    const { error } = await supabase.rpc('ajuster_stock_cuisine', {
      p_produit_cuisine_id: produitCuisineId,
      p_nouvelle_quantite: nouvelleQuantite,
      p_motif: motif
    })
    if (error) {
      console.error('Erreur ajuster_stock_cuisine:', error)
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  },

  /**
   * Récupère l'historique des mouvements de stock
   * @param {number} produitCuisineId - ID du produit (optionnel)
   * @returns {Object} { mouvements, error }
   */
  async getHistoriqueMouvements(produitCuisineId = null) {
    try {
      let query = supabase
        .from('mouvements_stock_cuisine')
        .select(`
          *,
          produit:produits_cuisine(
            id,
            nom,
            unite:unites(label)
          ),
          utilisateur:profiles(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (produitCuisineId) {
        query = query.eq('produit_cuisine_id', produitCuisineId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erreur getHistoriqueMouvements:', error)
        return { mouvements: [], error: error.message }
      }

      return { mouvements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueMouvements:', error)
      return { mouvements: [], error: error.message }
    }
  },

  /**
   * Calcule les statistiques du stock cuisine
   * @returns {Object} { stats, error }
   */
  async getStatistiques() {
    try {
      const { data: stocks, error } = await supabase
        .from('stock_cuisine')
        .select(`
          quantite_disponible,
          prix_vente,
          produit:produits_cuisine(nom)
        `)

      if (error) {
        return { stats: null, error: error.message }
      }

      const stats = {
        totalProduits: stocks?.length || 0,
        stockFaible: stocks?.filter(s => s.quantite_disponible < 5).length || 0,
        valeurTotale: stocks?.reduce((sum, s) => {
          const prix = s.prix_vente || 0
          return sum + (s.quantite_disponible * prix)
        }, 0) || 0
      }

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getStatistiques:', error)
      return { stats: null, error: error.message }
    }
  }
}
