// src/services/prixService.js
// Service de gestion des prix de vente (produits et recettes)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les prix de vente des produits et recettes
 */
export const prixService = {
  /**
   * Récupère tous les prix de vente des produits avec détails
   * @returns {Object} { prix, error }
   */
  async getPrixVente() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_produits')
        .select(`
          *,
          produit:produits(nom, prix_achat, unite:unites(label))
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getPrixVente:', error)
        return { prix: [], error: error.message }
      }

      const prixFormates = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        prix_vente: item.prix,
        marge: item.prix - (item.produit?.prix_achat || 0),
        pourcentage_marge: item.marge_pourcentage || 0,
        produit: item.produit,
        created_at: item.created_at
      }))

      return { prix: prixFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVente:', error)
      return { prix: [], error: error.message }
    }
  },

  /**
   * Définit ou met à jour le prix de vente d'un produit
   * @param {string} produitId - ID du produit
   * @param {number} prix - Prix de vente
   * @returns {Object} { prix, error }
   */
  async setPrixVente(produitId, prix) {
    try {
      const { data: produit } = await supabase
        .from('produits')
        .select('prix_achat')
        .eq('id', produitId)
        .single()

      const marge = prix - (produit?.prix_achat || 0)
      const margePourcentage = produit?.prix_achat > 0
        ? ((marge / produit.prix_achat) * 100).toFixed(2)
        : 0

      const { data, error } = await supabase
        .from('prix_vente_produits')
        .upsert({
          produit_id: produitId,
          prix: prix,
          marge_pourcentage: margePourcentage,
          actif: true
        })
        .select()
        .single()

      if (error) {
        return { prix: null, error: error.message }
      }

      return { prix: data, error: null }
    } catch (error) {
      console.error('Erreur dans setPrixVente:', error)
      return { prix: null, error: error.message }
    }
  },

  /**
   * Récupère tous les prix de vente des recettes actifs
   * @returns {Object} { prix, error }
   */
  async getPrixVenteRecettes() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_recettes')
        .select('*')
        .eq('actif', true)
        .order('nom_produit')

      if (error) {
        return { prix: [], error: error.message }
      }

      return { prix: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVenteRecettes:', error)
      return { prix: [], error: error.message }
    }
  },

  /**
   * Définit ou met à jour le prix de vente d'une recette
   * @param {string} nomProduit - Nom du produit (recette)
   * @param {number} prixVente - Prix de vente
   * @returns {Object} { prix, error }
   */
  async setPrixVenteRecette(nomProduit, prixVente) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('prix_vente_recettes')
        .upsert({
          nom_produit: nomProduit,
          prix_vente: prixVente,
          defini_par: user?.id,
          actif: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'nom_produit'
        })
        .select()
        .single()

      if (error) {
        return { prix: null, error: error.message }
      }

      return { prix: data, error: null }
    } catch (error) {
      console.error('Erreur dans setPrixVenteRecette:', error)
      return { prix: null, error: error.message }
    }
  }
}
