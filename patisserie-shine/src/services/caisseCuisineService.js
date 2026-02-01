// src/services/caisseCuisineService.js
// Service de gestion de la caisse cuisine
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les ventes de la cuisine
 */
export const caisseCuisineService = {
  /**
   * Génère un numéro de ticket unique pour les ventes cuisine
   * Format: CUIS-YYYYMMDD-XXXX
   * @returns {string} Numéro de ticket
   */
  async genererNumeroTicket() {
    try {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')

      // Compter le nombre de ventes du jour
      const { count } = await supabase
        .from('ventes_cuisine')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today.toISOString().split('T')[0]}T00:00:00`)
        .lte('created_at', `${today.toISOString().split('T')[0]}T23:59:59`)

      const numero = String((count || 0) + 1).padStart(4, '0')
      return `CUIS-${dateStr}-${numero}`
    } catch (error) {
      console.error('Erreur génération numéro ticket:', error)
      // Fallback avec timestamp
      return `CUIS-${Date.now()}`
    }
  },

  /**
   * Enregistre une vente cuisine
   * @param {Object} venteData - Données de la vente
   * @returns {Object} { vente, error }
   */
  async enregistrerVente(venteData) {
    try {
      const { items, total, montant_donne, monnaie_rendue, vendeur_id } = venteData

      // Générer le numéro de ticket
      const numeroTicket = await this.genererNumeroTicket()

      // Créer la vente
      const { data: vente, error: venteError } = await supabase
        .from('ventes_cuisine')
        .insert({
          numero_ticket: numeroTicket,
          vendeur_id,
          total,
          montant_donne,
          monnaie_rendue,
          statut: 'validee',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (venteError) {
        console.error('Erreur création vente:', venteError)
        return { vente: null, error: venteError.message }
      }

      // Créer les lignes de vente et mettre à jour le stock
      for (const item of items) {
        // Créer la ligne de vente
        const { error: ligneError } = await supabase
          .from('lignes_vente_cuisine')
          .insert({
            vente_cuisine_id: vente.id,
            produit_cuisine_id: item.id,
            nom_produit: item.nom,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            sous_total: item.prix * item.quantite,
            created_at: new Date().toISOString()
          })

        if (ligneError) {
          console.error('Erreur création ligne vente:', ligneError)
          // Continuer malgré l'erreur pour ne pas bloquer la vente
        }

        // Mettre à jour le stock cuisine
        const { data: stock } = await supabase
          .from('stock_cuisine')
          .select('id, quantite_disponible, quantite_vendue')
          .eq('produit_cuisine_id', item.id)
          .single()

        if (stock) {
          const nouvelleQuantiteDisponible = (stock.quantite_disponible || 0) - item.quantite
          const nouvelleQuantiteVendue = (stock.quantite_vendue || 0) + item.quantite

          await supabase
            .from('stock_cuisine')
            .update({
              quantite_disponible: Math.max(0, nouvelleQuantiteDisponible),
              quantite_vendue: nouvelleQuantiteVendue,
              updated_at: new Date().toISOString()
            })
            .eq('id', stock.id)

          // Enregistrer le mouvement de stock
          await supabase
            .from('mouvements_stock_cuisine')
            .insert({
              produit_cuisine_id: item.id,
              type_mouvement: 'vente',
              quantite: item.quantite,
              quantite_avant: stock.quantite_disponible,
              quantite_apres: nouvelleQuantiteDisponible,
              utilisateur_id: vendeur_id,
              reference_id: vente.id,
              commentaire: `Vente - Ticket ${numeroTicket}`,
              created_at: new Date().toISOString()
            })
        }
      }

      return { vente, error: null }

    } catch (error) {
      console.error('Erreur dans enregistrerVente:', error)
      return { vente: null, error: error.message }
    }
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
