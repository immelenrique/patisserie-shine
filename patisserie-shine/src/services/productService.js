// src/services/productService.js
// Service de gestion des produits (matières premières)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les produits/matières premières
 */
export const productService = {
  /**
   * Récupère tous les produits avec leurs unités
   * @returns {Object} { products, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message }
      }

      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
      return { products: [], error: error.message }
    }
  },

  /**
   * Crée un produit à partir d'un référentiel existant
   * @param {string} referentielId - ID du référentiel produit
   * @param {number} quantite - Quantité achetée
   * @param {string} dateAchat - Date d'achat (ISO format)
   * @returns {Object} { product, error }
   */
  async createFromReferentiel(referentielId, quantite, dateAchat) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Récupérer le référentiel
      const { data: referentiel, error: refError } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('id', referentielId)
        .single()

      if (refError || !referentiel) {
        return { product: null, error: 'Référentiel non trouvé' }
      }

      // 2. Trouver l'unité correspondante
      const { data: unite, error: uniteError } = await supabase
        .from('unites')
        .select('id')
        .eq('value', referentiel.unite_mesure)
        .single()

      if (uniteError || !unite) {
        return { product: null, error: `Unité "${referentiel.unite_mesure}" non trouvée. Créez-la d'abord.` }
      }

      // 3. Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: referentiel.nom,
          date_achat: dateAchat || new Date().toISOString().split('T')[0],
          prix_achat: referentiel.prix_unitaire,
          quantite: parseFloat(quantite),
          quantite_restante: parseFloat(quantite),
          unite_id: unite.id,
          created_by: user?.id
        })
        .select('*, unite:unites(id, value, label)')
        .single()

      if (produitError) {
        console.error('Erreur création produit:', produitError)
        return { product: null, error: produitError.message }
      }

      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans createFromReferentiel:', error)
      return { product: null, error: error.message }
    }
  },

  /**
   * Crée un produit avec option de définir le prix de vente
   * @param {Object} productData - Données du produit
   * @returns {Object} { product, error }
   */
  async createWithPriceOption(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user?.id
        })
        .select('*, unite:unites(id, value, label)')
        .single()

      if (produitError) {
        return { product: null, error: produitError.message }
      }

      // Si prix de vente défini
      if (productData.definir_prix_vente && productData.prix_vente) {
        await supabase
          .from('prix_vente_produits')
          .insert({
            produit_id: produit.id,
            prix: productData.prix_vente,
            marge_pourcentage: ((productData.prix_vente - productData.prix_achat) / productData.prix_achat) * 100,
            actif: true
          })
      }

      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans createWithPriceOption:', error)
      return { product: null, error: error.message }
    }
  },

  /**
   * Met à jour un produit existant
   * @param {string} productId - ID du produit
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Object} { product, error }
   */
  async update(productId, updates) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: updates.nom,
          date_achat: updates.date_achat,
          prix_achat: updates.prix_achat,
          quantite: updates.quantite,
          quantite_restante: updates.quantite_restante,
          unite_id: updates.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select('*, unite:unites(id, value, label)')
        .single()

      if (error) {
        return { product: null, error: error.message }
      }

      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update:', error)
      return { product: null, error: error.message }
    }
  },

  /**
   * Réapprovisionne un produit existant (ajoute du stock)
   * @param {string} productId - ID du produit à réapprovisionner
   * @param {Object} reapproData - Données du réapprovisionnement
   * @param {number} reapproData.quantite_ajoutee - Quantité à ajouter
   * @param {number} reapproData.prix_achat_total - Prix total de ce réapprovisionnement
   * @param {string} reapproData.date_achat - Date de cet achat
   * @returns {Object} { product, error }
   */
  async reapprovisionner(productId, reapproData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Récupérer le produit actuel
      const { data: produitActuel, error: fetchError } = await supabase
        .from('produits')
        .select('*, unite:unites(id, value, label)')
        .eq('id', productId)
        .single()

      if (fetchError || !produitActuel) {
        return { product: null, error: 'Produit non trouvé' }
      }

      // 2. Calculer le nouveau prix d'achat moyen pondéré
      const quantiteAjoutee = parseFloat(reapproData.quantite_ajoutee)
      const prixAchatNouveauTotal = parseFloat(reapproData.prix_achat_total)
      const prixAchatNouveauUnitaire = prixAchatNouveauTotal / quantiteAjoutee

      const quantiteAncienne = parseFloat(produitActuel.quantite)
      const prixAchatAncien = parseFloat(produitActuel.prix_achat || 0)

      // Prix moyen pondéré
      const quantiteTotale = quantiteAncienne + quantiteAjoutee
      const valeurTotaleAncienne = quantiteAncienne * prixAchatAncien
      const valeurTotaleNouvelle = quantiteAjoutee * prixAchatNouveauUnitaire
      const prixMoyenPondere = (valeurTotaleAncienne + valeurTotaleNouvelle) / quantiteTotale

      // 3. Mettre à jour le produit
      const { data: produitMisAJour, error: updateError } = await supabase
        .from('produits')
        .update({
          quantite: quantiteTotale,
          quantite_restante: parseFloat(produitActuel.quantite_restante) + quantiteAjoutee,
          prix_achat: prixMoyenPondere,
          date_achat: reapproData.date_achat || produitActuel.date_achat,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select('*, unite:unites(id, value, label)')
        .single()

      if (updateError) {
        return { product: null, error: updateError.message }
      }

      // 4. Enregistrer le mouvement de stock
      await supabase
        .from('mouvements_stock')
        .insert({
          produit_id: productId,
          type_mouvement: 'entree',
          quantite: quantiteAjoutee,
          prix_unitaire: prixAchatNouveauUnitaire,
          motif: `Réapprovisionnement - ${quantiteAjoutee} ${produitActuel.unite?.value || ''}`,
          utilisateur_id: user?.id,
          created_at: new Date().toISOString()
        })

      return { product: produitMisAJour, error: null }
    } catch (error) {
      console.error('Erreur dans reapprovisionner:', error)
      return { product: null, error: error.message }
    }
  }
}
