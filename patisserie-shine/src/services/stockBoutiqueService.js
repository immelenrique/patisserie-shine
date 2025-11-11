// src/services/stockBoutiqueService.js
// Service de gestion du stock boutique (vente)
import { supabase } from '../lib/supabase-client'
import { utils } from '../utils/formatters'

/**
 * Service pour gérer le stock de la boutique (produits prêts à la vente)
 */
export const stockBoutiqueService = {
  /**
   * Récupère l'état complet du stock boutique avec type_produit
   * @returns {Object} { stock, error }
   */
  async getStockBoutique() {
    try {
      console.log('🔄 Récupération stock boutique avec type_produit...')

      // Requête directe pour s'assurer d'avoir type_produit
      const { data, error } = await supabase
        .from('stock_boutique')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          quantite_vendue,
          quantite_utilisee,
          prix_vente,
          type_produit,
          nom_produit,
          transfere_par,
          created_at,
          updated_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur récupération stock_boutique:', error)
        return { stock: [], error: error.message }
      }

      // Formater les données en s'assurant d'inclure type_produit
      const stockFormate = (data || []).map(item => {
        const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0) - (item.quantite_utilisee || 0)
        return {
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.nom_produit || item.produits?.nom || `Produit ${item.produit_id}`,
          unite: item.produits?.unites?.label || 'unité',
          quantite_disponible: item.quantite_disponible || 0,
          quantite_vendue: item.quantite_vendue || 0,
          quantite_utilisee: item.quantite_utilisee || 0,
          stock_reel: stockReel,
          prix_vente: item.prix_vente || 0,
          valeur_stock: stockReel * (item.prix_vente || 0),
          statut_stock: this.calculateStockStatus(stockReel),
          prix_defini: (item.prix_vente && item.prix_vente > 0),
          type_produit: item.type_produit, // IMPORTANT : Inclure type_produit
          transfere_par: item.transfere_par,
          created_at: item.created_at,
          updated_at: item.updated_at,
          derniere_maj: item.updated_at
        }
      })

      console.log('✅ Stock formaté avec types:', stockFormate.map(s => ({
        nom: s.nom_produit,
        type: s.type_produit
      })))

      return { stock: stockFormate, error: null }

    } catch (error) {
      console.error('Erreur dans getStockBoutique:', error)
      return { stock: [], error: error.message }
    }
  },

  /**
   * Fonction utilitaire pour calculer le statut du stock
   * @param {number} stockReel - Quantité en stock
   * @returns {string} 'rupture' | 'critique' | 'faible' | 'normal'
   */
  calculateStockStatus(stockReel) {
    if (stockReel <= 0) return 'rupture'
    if (stockReel <= 5) return 'critique'
    if (stockReel <= 10) return 'faible'
    return 'normal'
  },

  /**
   * Synchronise les prix avec les prix de recettes actifs
   * @returns {Object} { success, corrections, error }
   */
  async synchroniserPrixRecettes() {
    try {
      console.log('🔄 Synchronisation forcée des prix recettes...')

      // Récupérer tous les prix de recettes actifs
      const { data: prixRecettes, error: prixError } = await supabase
        .from('prix_vente_recettes')
        .select('nom_produit, prix_vente')
        .eq('actif', true)

      if (prixError || !prixRecettes) {
        return { success: false, error: 'Erreur récupération prix recettes' }
      }

      let corrections = 0

      // Mettre à jour chaque produit en boutique
      for (const prixRecette of prixRecettes) {
        const { data: stockBoutique } = await supabase
          .from('stock_boutique')
          .select('id, prix_vente')
          .eq('nom_produit', prixRecette.nom_produit)
          .single()

        if (stockBoutique && stockBoutique.prix_vente !== prixRecette.prix_vente) {
          // Corriger le prix
          const { error: updateError } = await supabase
            .from('stock_boutique')
            .update({
              prix_vente: prixRecette.prix_vente,
              updated_at: new Date().toISOString()
            })
            .eq('id', stockBoutique.id)

          if (!updateError) {
            console.log(`✅ Prix corrigé pour ${prixRecette.nom_produit}: ${utils.formatCFA(stockBoutique.prix_vente)} → ${utils.formatCFA(prixRecette.prix_vente)}`)
            corrections++
          }
        }
      }

      console.log(`🎉 ${corrections} prix synchronisés`)
      return { success: true, corrections }
    } catch (error) {
      console.error('Erreur synchronisation:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Obtient l'historique des entrées en boutique
   * @param {number} limit - Nombre max de résultats
   * @returns {Object} { entrees, error }
   */
  async getHistoriqueEntrees(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('entrees_boutique')
        .select(`
          id,
          produit_id,
          quantite,
          source,
          type_entree,
          created_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Erreur getHistoriqueEntrees:', error)
        return { entrees: [], error: error.message }
      }

      const entreesFormatees = (data || []).map(item => ({
        ...item,
        nom_produit: item.produits?.nom || 'Produit inconnu',
        unite: item.produits?.unites?.label || 'unité'
      }))

      return { entrees: entreesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueEntrees:', error)
      return { entrees: [], error: error.message }
    }
  },

  /**
   * Obtient l'historique des sorties (ventes)
   * @param {number} limit - Nombre max de résultats
   * @returns {Object} { sorties, error }
   */
  async getHistoriqueSorties(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('sorties_boutique')
        .select(`
          id,
          vente_id,
          produit_id,
          quantite,
          prix_unitaire,
          total,
          created_at,
          ventes (
            vendeur:profiles (
              nom
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Erreur getHistoriqueSorties:', error)
        return { sorties: [], error: error.message }
      }

      const sortiesFormatees = (data || []).map(item => ({
        ...item,
        vendeur: item.ventes?.vendeur
      }))

      return { sorties: sortiesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueSorties:', error)
      return { sorties: [], error: error.message }
    }
  },

  /**
   * Met à jour le prix de vente d'un produit en boutique
   * Synchronise avec prix_vente_produits et prix_vente_recettes
   * @param {string} stockId - ID du stock
   * @param {number} nouveauPrix - Nouveau prix de vente
   * @returns {Object} { success, message, data, error }
   */
  async updatePrixVente(stockId, nouveauPrix) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      if (!nouveauPrix || parseFloat(nouveauPrix) < 0) {
        return { success: false, error: 'Prix invalide' }
      }

      // Mettre à jour le prix dans stock_boutique
      const { data: stockMisAJour, error: stockError } = await supabase
        .from('stock_boutique')
        .update({
          prix_vente: parseFloat(nouveauPrix),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId)
        .select()
        .single()

      if (stockError) {
        console.error('Erreur mise à jour prix stock_boutique:', stockError)
        return { success: false, error: stockError.message }
      }

      // Synchroniser avec prix_vente_produits si le produit a un produit_id
      if (stockMisAJour.produit_id) {
        try {
          const { error: syncError } = await supabase
            .from('prix_vente_produits')
            .upsert({
              produit_id: stockMisAJour.produit_id,
              prix: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            })

          if (syncError) {
            console.warn('Erreur synchronisation prix_vente_produits:', syncError)
          }
        } catch (syncException) {
          console.warn('Exception synchronisation prix_vente_produits:', syncException)
        }
      }

      // Synchroniser avec prix_vente_recettes si c'est un produit de recette
      if (stockMisAJour.nom_produit) {
        try {
          const { error: recetteError } = await supabase
            .from('prix_vente_recettes')
            .upsert({
              nom_produit: stockMisAJour.nom_produit,
              prix_vente: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            })

          if (recetteError) {
            console.warn('Erreur synchronisation prix_vente_recettes:', recetteError)
          }
        } catch (recetteException) {
          console.warn('Exception synchronisation prix_vente_recettes:', recetteException)
        }
      }

      return {
        success: true,
        message: `Prix mis à jour: ${utils.formatCFA(parseFloat(nouveauPrix))}`,
        data: stockMisAJour
      }
    } catch (error) {
      console.error('Erreur dans updatePrixVente:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Obtient les produits sans prix défini (null ou 0) et en stock
   * @returns {Object} { produits, error }
   */
  async getProduitsEtsSansPrix() {
    try {
      const { data, error } = await supabase
        .from('stock_boutique')
        .select('*')
        .or('prix_vente.is.null,prix_vente.eq.0')
        .gt('quantite_disponible', 0)
        .order('nom_produit')

      if (error) {
        return { produits: [], error: error.message }
      }

      return { produits: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsEtsSansPrix:', error)
      return { produits: [], error: error.message }
    }
  }
}
