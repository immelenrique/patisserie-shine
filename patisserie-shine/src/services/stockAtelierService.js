// src/services/stockAtelierService.js
// Service de gestion du stock atelier (production)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer le stock de l'atelier (matières premières et produits en production)
 */
export const stockAtelierService = {
  /**
   * Récupère tout le stock atelier avec les détails produits
   * @returns {Object} { stocks, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          *,
          produit:produits(
            id,
            nom,
            prix_achat,
            quantite_restante,
            unite:unites(id, value, label)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getAll stock atelier:', error)
        return { stocks: [], error: error.message }
      }

      return { stocks: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll stock atelier:', error)
      return { stocks: [], error: error.message }
    }
  },

  /**
   * Alias pour compatibilité
   */
  async getStockAtelier() {
    return this.getAll()
  },

  /**
   * Récupère un stock spécifique par produit
   * @param {string} produitId - ID du produit
   * @returns {Object} { stock, error }
   */
  async getByProduitId(produitId) {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          *,
          produit:produits(
            id,
            nom,
            prix_achat,
            unite:unites(label)
          )
        `)
        .eq('produit_id', produitId)
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
   * Crée ou ajoute du stock (si existe déjà, ajoute à la quantité)
   * @param {Object} stockData - Données du stock
   * @returns {Object} { stock, error }
   */
  async create(stockData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Vérifier si le stock existe déjà
      const { data: existing } = await supabase
        .from('stock_atelier')
        .select('id, quantite_disponible')
        .eq('produit_id', stockData.produit_id)
        .single()

      if (existing) {
        // Mettre à jour la quantité existante
        const nouvelleQuantite = (existing.quantite_disponible || 0) + (stockData.quantite_disponible || 0)

        const { data, error } = await supabase
          .from('stock_atelier')
          .update({
            quantite_disponible: nouvelleQuantite,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) return { stock: null, error: error.message }
        return { stock: data, error: null }

      } else {
        // Créer un nouveau stock
        const { data, error } = await supabase
          .from('stock_atelier')
          .insert({
            ...stockData,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) return { stock: null, error: error.message }
        return { stock: data, error: null }
      }

    } catch (error) {
      console.error('Erreur dans create stock atelier:', error)
      return { stock: null, error: error.message }
    }
  },

  /**
   * Met à jour un stock existant
   * @param {string} id - ID du stock
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Object} { stock, error }
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { stock: null, error: error.message }
      }

      return { stock: data, error: null }
    } catch (error) {
      console.error('Erreur dans update stock atelier:', error)
      return { stock: null, error: error.message }
    }
  },

  /**
   * Supprime un stock
   * @param {string} id - ID du stock
   * @returns {Object} { success, error }
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('stock_atelier')
        .delete()
        .eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans delete stock atelier:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Récupère l'historique des transferts vers la production
   * @param {string} produitId - ID du produit (optionnel)
   * @returns {Object} { historique, error }
   */
  async getHistoriqueTransferts(produitId = null) {
    try {
      // Utiliser la table demandes pour l'historique
      let query = supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(
            id,
            nom,
            unite:unites(label)
          ),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
        `)
        .eq('destination', 'Production')
        .in('statut', ['validee', 'partiellement_validee'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (produitId) {
        query = query.eq('produit_id', produitId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { historique: [], error: error.message }
      }

      return { historique: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { historique: [], error: error.message }
    }
  },

  /**
   * Envoie du stock de l'atelier vers la boutique, en une seule opération côté base.
   * La marchandise part « en transit » : la boutique n'est créditée qu'à la réception,
   * faite par une autre personne que l'expéditeur.
   * @param {number} produitId - ID du produit
   * @param {number} quantite - Quantité à envoyer
   * @param {string} cle - Identifiant du formulaire : un nouvel essai ne crée pas un second envoi
   * @returns {Object} { success, envoiId, error }
   */
  async transfererVersBoutique(produitId, quantite, cle = null) {
    try {
      const { data, error } = await supabase.rpc('envoyer_atelier_vers_boutique', {
        p_lignes: [{ produit_id: produitId, quantite }],
        p_cle: cle
      })

      if (error) throw error

      return { success: true, envoiId: data?.envoi_id, error: null }
    } catch (error) {
      console.error('Erreur dans transfererVersBoutique:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Calcule les statistiques du stock atelier
   * @returns {Object} { stats, error }
   */
  async getStatistiques() {
    try {
      const { data: stocks, error } = await supabase
        .from('stock_atelier')
        .select(`
          quantite_disponible,
          produit:produits(
            nom,
            prix_achat
          )
        `)

      if (error) {
        return { stats: null, error: error.message }
      }

      const stats = {
        totalProduits: stocks?.length || 0,
        stockFaible: stocks?.filter(s => s.quantite_disponible < 5).length || 0,
        // Utiliser prix_achat pour calculer la valeur
        valeurTotale: stocks?.reduce((sum, s) => {
          const prix = s.produit?.prix_achat || 0
          return sum + (s.quantite_disponible * prix)
        }, 0) || 0
      }

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getStatistiques:', error)
      return { stats: null, error: error.message }
    }
  },

  /**
   * Vide tout le stock atelier (met toutes les quantités à 0)
   * Fonction réservée aux administrateurs
   * @returns {Object} { success, error, nombreProduitsVides }
   */
  async viderToutLeStock() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Récupérer tous les stocks avant de les vider (pour le log)
      const { data: stocksAvant, error: errorSelect } = await supabase
        .from('stock_atelier')
        .select('id, produit_id, quantite_disponible')
        .gt('quantite_disponible', 0)

      if (errorSelect) {
        return { success: false, error: errorSelect.message, nombreProduitsVides: 0 }
      }

      if (!stocksAvant || stocksAvant.length === 0) {
        return { success: true, error: null, nombreProduitsVides: 0 }
      }

      // Mettre à jour tous les stocks à 0
      const { error: updateError } = await supabase
        .from('stock_atelier')
        .update({
          quantite_disponible: 0,
          quantite_reservee: 0,
          updated_at: new Date().toISOString()
        })
        .gt('quantite_disponible', 0)

      if (updateError) {
        return { success: false, error: updateError.message, nombreProduitsVides: 0 }
      }

      // Enregistrer dans mouvements_stock pour chaque produit
      const mouvements = stocksAvant.map(stock => ({
        produit_id: stock.produit_id,
        type_mouvement: 'ajustement',
        quantite: stock.quantite_disponible,
        quantite_avant: stock.quantite_disponible,
        quantite_apres: 0,
        source: 'Atelier',
        destination: 'Vidage stock',
        utilisateur_id: user?.id,
        commentaire: 'Vidage complet du stock atelier - Consommation totale',
        raison: 'Vidage administratif du stock atelier',
        created_at: new Date().toISOString()
      }))

      await supabase
        .from('mouvements_stock')
        .insert(mouvements)

      return {
        success: true,
        error: null,
        nombreProduitsVides: stocksAvant.length
      }

    } catch (error) {
      console.error('Erreur dans viderToutLeStock:', error)
      return { success: false, error: error.message, nombreProduitsVides: 0 }
    }
  }
}
