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

      // Les produits archivés (actif = false) gardent leur historique mais disparaissent des listes
      return { products: (data || []).filter(p => p.actif !== false), error: null }
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
      // Une seule opération côté base, inscrite au journal (auteur et heure fixés par la base)
      const { data, error } = await supabase.rpc('creer_produit', {
        p_nom: productData.nom,
        p_date_achat: productData.date_achat,
        p_quantite: productData.quantite,
        p_prix_total: productData.prix_achat_total,
        p_unite_id: productData.unite_id,
        p_prix_vente: productData.definir_prix_vente ? productData.prix_vente : null,
        p_cle: productData.cle || null
      })
      if (error) throw error

      return { product: { id: data.produit_id, depense_id: data.depense_id ?? null, deja_enregistre: data.deja_enregistre }, error: null }
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
      // Nom, date, prix d'achat et unité. Les quantités se corrigent avec ajusterStock (motif obligatoire).
      const { error } = await supabase.rpc('modifier_produit', {
        p_produit_id: productId,
        p_nom: updates.nom,
        p_date_achat: updates.date_achat,
        p_prix_achat: updates.prix_achat,
        p_unite_id: updates.unite_id
      })
      if (error) throw error

      return { product: { id: productId }, error: null }
    } catch (error) {
      console.error('Erreur dans update:', error)
      return { product: null, error: error.message }
    }
  },

  /**
   * Corrige la quantité restante du stock principal (recomptage, casse, erreur…)
   * @param {number} productId - ID du produit
   * @param {number} nouvelleQuantite - Quantité réellement présente
   * @param {string} motif - Motif obligatoire, inscrit au journal
   * @returns {Object} { ecart, error }
   */
  async ajusterStock(productId, nouvelleQuantite, motif) {
    try {
      const { data, error } = await supabase.rpc('ajuster_stock_principal', {
        p_produit_id: productId,
        p_nouvelle_quantite: nouvelleQuantite,
        p_motif: motif
      })
      if (error) throw error

      return { ecart: data.ecart, error: null }
    } catch (error) {
      console.error('Erreur dans ajusterStock:', error)
      return { ecart: null, error: error.message }
    }
  },

  /**
   * Archive un produit sans stock : il disparaît des listes, son historique est conservé
   * @param {number} productId - ID du produit
   * @param {string} motif - Motif obligatoire
   * @returns {Object} { error }
   */
  async archiver(productId, motif) {
    try {
      const { error } = await supabase.rpc('archiver_produit', { p_produit_id: productId, p_motif: motif })
      if (error) throw error

      return { error: null }
    } catch (error) {
      console.error('Erreur dans archiver:', error)
      return { error: error.message }
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
      // Prix moyen pondéré et quantités calculés par la base, en une opération ; la clé évite un double
      // réapprovisionnement en cas de double clic ou de nouvel essai après une coupure
      const { data, error } = await supabase.rpc('reapprovisionner_produit', {
        p_produit_id: productId,
        p_quantite: parseFloat(reapproData.quantite_ajoutee),
        p_prix_total: parseFloat(reapproData.prix_achat_total),
        p_date_achat: reapproData.date_achat || null,
        p_cle: reapproData.cle || null
      })
      if (error) throw error

      return { product: { id: productId, quantite_restante: data.quantite_restante, deja_enregistre: data.deja_enregistre, depense_id: data.depense_id ?? null }, error: null }
    } catch (error) {
      console.error('Erreur dans reapprovisionner:', error)
      return { product: null, error: error.message }
    }
  }
}
