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
   * Crée ou met à jour le stock cuisine (admin uniquement)
   * @param {Object} stockData - Données du stock
   * @returns {Object} { stock, error }
   */
  async createOrUpdateStock(stockData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Vérifier si le stock existe déjà
      const { data: existing } = await supabase
        .from('stock_cuisine')
        .select('id, quantite_disponible')
        .eq('produit_cuisine_id', stockData.produit_cuisine_id)
        .single()

      if (existing) {
        // Mettre à jour le stock existant
        const nouvelleQuantite = (existing.quantite_disponible || 0) + (stockData.quantite_disponible || 0)

        const { data, error } = await supabase
          .from('stock_cuisine')
          .update({
            quantite_disponible: nouvelleQuantite,
            prix_vente: stockData.prix_vente,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) return { stock: null, error: error.message }

        // Enregistrer le mouvement
        await this.enregistrerMouvement({
          produit_cuisine_id: stockData.produit_cuisine_id,
          type_mouvement: 'entree',
          quantite: stockData.quantite_disponible,
          quantite_avant: existing.quantite_disponible,
          quantite_apres: nouvelleQuantite,
          utilisateur_id: user?.id,
          commentaire: 'Ajout de stock par admin'
        })

        return { stock: data, error: null }

      } else {
        // Créer un nouveau stock
        const { data, error } = await supabase
          .from('stock_cuisine')
          .insert({
            ...stockData,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) return { stock: null, error: error.message }

        // Enregistrer le mouvement
        await this.enregistrerMouvement({
          produit_cuisine_id: stockData.produit_cuisine_id,
          type_mouvement: 'entree',
          quantite: stockData.quantite_disponible,
          quantite_avant: 0,
          quantite_apres: stockData.quantite_disponible,
          utilisateur_id: user?.id,
          commentaire: 'Création initiale du stock'
        })

        return { stock: data, error: null }
      }

    } catch (error) {
      console.error('Erreur dans createOrUpdateStock:', error)
      return { stock: null, error: error.message }
    }
  },

  /**
   * Ajuste la quantité d'un stock (admin uniquement)
   * @param {number} produitCuisineId - ID du produit cuisine
   * @param {number} nouvelleQuantite - Nouvelle quantité
   * @returns {Object} { success, error }
   */
  async ajusterQuantite(produitCuisineId, nouvelleQuantite) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Récupérer le stock actuel
      const { data: stock } = await supabase
        .from('stock_cuisine')
        .select('id, quantite_disponible')
        .eq('produit_cuisine_id', produitCuisineId)
        .single()

      if (!stock) {
        return { success: false, error: 'Stock non trouvé' }
      }

      const quantiteAvant = stock.quantite_disponible

      // Mettre à jour la quantité
      const { error: updateError } = await supabase
        .from('stock_cuisine')
        .update({
          quantite_disponible: nouvelleQuantite,
          updated_at: new Date().toISOString()
        })
        .eq('id', stock.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Enregistrer le mouvement
      await this.enregistrerMouvement({
        produit_cuisine_id: produitCuisineId,
        type_mouvement: 'ajustement',
        quantite: Math.abs(nouvelleQuantite - quantiteAvant),
        quantite_avant: quantiteAvant,
        quantite_apres: nouvelleQuantite,
        utilisateur_id: user?.id,
        commentaire: `Ajustement de stock: ${quantiteAvant} -> ${nouvelleQuantite}`
      })

      return { success: true, error: null }

    } catch (error) {
      console.error('Erreur dans ajusterQuantite:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Enregistre un mouvement de stock
   * @param {Object} mouvementData - Données du mouvement
   * @returns {Object} { success, error }
   */
  async enregistrerMouvement(mouvementData) {
    try {
      const { error } = await supabase
        .from('mouvements_stock_cuisine')
        .insert({
          ...mouvementData,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Erreur enregistrement mouvement:', error)
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans enregistrerMouvement:', error)
      return { success: false, error: error.message }
    }
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
