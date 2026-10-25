// src/services/caisseCuisineService.js
// Service de gestion de la caisse cuisine
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les ventes de la cuisine
 */
export const caisseCuisineService = {
  /**
   * Enregistre une vente cuisine en une seule transaction côté base (fonction enregistrer_vente_cuisine) :
   * stock vérifié et verrouillé, prix et total calculés par la base, tout ou rien.
   * @param {Object} venteData - { items: [{ id, quantite }], montant_donne, cle }
   * @returns {Object} { vente, error, coupure } - vente.items : [{ id, nom, prix, quantite, total }]
   */
  async enregistrerVente(venteData) {
    try {
      // La clé identifie le panier : renvoyée lors d'un nouvel essai, elle évite d'enregistrer
      // deux fois une vente dont la réponse s'est perdue
      const { data, error } = await supabase.rpc('enregistrer_vente_cuisine', {
        p_items: venteData.items.map(item => ({ id: item.id, quantite: item.quantite })),
        p_montant_donne: venteData.montant_donne,
        p_cle: venteData.cle || null
      })

      if (error) throw error

      return { vente: data, error: null }
    } catch (error) {
      console.error('Erreur enregistrerVente cuisine:', error)
      // Sans code d'erreur, la base n'a pas répondu (coupure réseau) : la vente a pu être enregistrée
      return { vente: null, error: error.message, coupure: !error.code }
    }
  },

  /**
   * Annule une vente cuisine (propriétaire et gérants) : stock remis, annulation gardée avec son motif
   * @param {number} venteId
   * @param {string} motif - au moins 10 caractères
   * @returns {Object} { resultat, error }
   */
  async annulerVente(venteId, motif) {
    const { data, error } = await supabase.rpc('annuler_vente_cuisine', { p_vente_id: venteId, p_motif: motif })
    if (error) {
      console.error('Erreur annulerVente cuisine:', error)
      return { resultat: null, error: error.message }
    }
    return { resultat: data, error: null }
  },

  /**
   * Récupère les ventes du jour
   * @param {string} vendeurId - ID du vendeur (optionnel)
   * @returns {Object} { ventes, error }
   */
  async getVentesJour(vendeurId = null) {
    try {
      const aujourdhui = new Date().toISOString().split('T')[0]

      let query = supabase
        .from('ventes_cuisine')
        .select(`
          *,
          vendeur:profiles(id, nom, username),
          items:lignes_vente_cuisine(
            id,
            produit_cuisine_id,
            nom_produit,
            quantite,
            prix_unitaire,
            sous_total
          )
        `)
        .gte('created_at', `${aujourdhui}T00:00:00`)
        .lte('created_at', `${aujourdhui}T23:59:59`)
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })

      if (vendeurId) {
        query = query.eq('vendeur_id', vendeurId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erreur getVentesJour:', error)
        return { ventes: [], error: error.message }
      }

      return { ventes: data || [], error: null }

    } catch (error) {
      console.error('Erreur dans getVentesJour:', error)
      return { ventes: [], error: error.message }
    }
  },

  /**
   * Récupère une vente par son ID
   * @param {number} venteId - ID de la vente
   * @returns {Object} { vente, error }
   */
  async getVenteById(venteId) {
    try {
      const { data, error } = await supabase
        .from('ventes_cuisine')
        .select(`
          *,
          vendeur:profiles(id, nom, username),
          items:lignes_vente_cuisine(
            id,
            produit_cuisine_id,
            nom_produit,
            quantite,
            prix_unitaire,
            sous_total
          )
        `)
        .eq('id', venteId)
        .single()

      if (error) {
        console.error('Erreur getVenteById:', error)
        return { vente: null, error: error.message }
      }

      return { vente: data, error: null }

    } catch (error) {
      console.error('Erreur dans getVenteById:', error)
      return { vente: null, error: error.message }
    }
  },

  /**
   * Récupère les statistiques des ventes cuisine
   * @param {string} dateDebut - Date de début (optionnel)
   * @param {string} dateFin - Date de fin (optionnel)
   * @returns {Object} { stats, error }
   */
  async getStatistiques(dateDebut = null, dateFin = null) {
    try {
      let query = supabase
        .from('ventes_cuisine')
        .select('total, created_at')
        .eq('statut', 'validee')

      if (dateDebut) {
        query = query.gte('created_at', dateDebut)
      }
      if (dateFin) {
        query = query.lte('created_at', dateFin)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erreur getStatistiques:', error)
        return { stats: null, error: error.message }
      }

      const stats = {
        nombreVentes: data?.length || 0,
        totalVentes: data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ticketMoyen: data?.length > 0
          ? data.reduce((sum, v) => sum + (v.total || 0), 0) / data.length
          : 0
      }

      return { stats, error: null }

    } catch (error) {
      console.error('Erreur dans getStatistiques:', error)
      return { stats: null, error: error.message }
    }
  },

  /**
   * Récupère le stock disponible pour la caisse
   * @returns {Object} { produits, error }
   */
  async getProduitsDisponibles() {
    try {
      const { data, error } = await supabase
        .from('stock_cuisine')
        .select(`
          *,
          produit:produits_cuisine!inner(
            id,
            nom,
            description,
            prix_vente,
            unite:unites(id, value, label),
            actif
          )
        `)
        .gt('quantite_disponible', 0)
        .eq('produit.actif', true)
        .order('produit(nom)', { ascending: true })

      if (error) {
        console.error('Erreur getProduitsDisponibles:', error)
        return { produits: [], error: error.message }
      }

      // Transformer les données pour la caisse
      const produitsDisponibles = (data || []).map(stock => ({
        id: stock.produit.id,
        nom: stock.produit.nom,
        description: stock.produit.description,
        prix_vente: stock.prix_vente || stock.produit.prix_vente,
        stock_disponible: stock.quantite_disponible,
        unite: stock.produit.unite
      }))

      return { produits: produitsDisponibles, error: null }

    } catch (error) {
      console.error('Erreur dans getProduitsDisponibles:', error)
      return { produits: [], error: error.message }
    }
  }
}
