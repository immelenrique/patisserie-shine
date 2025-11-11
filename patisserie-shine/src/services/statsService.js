// src/services/statsService.js
// Service de gestion des statistiques du dashboard
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les statistiques du dashboard
 */
export const statsService = {
  /**
   * Récupère toutes les statistiques pour le dashboard principal
   * @returns {Object} { stats, error }
   */
  async getDashboardStats() {
    try {
      console.log('📊 Chargement des statistiques du dashboard...')

      // Produits avec stock critique (< 10)
      const { data: produitsData } = await supabase
        .from('produits')
        .select('id, nom, quantite_restante')
        .lt('quantite_restante', 10)

      // Demandes en attente
      const { data: demandesData } = await supabase
        .from('demandes')
        .select('id')
        .eq('statut', 'en_attente')

      // Productions du jour terminées
      const today = new Date().toISOString().split('T')[0]
      const { data: productionsData } = await supabase
        .from('productions')
        .select('id, quantite')
        .eq('date_production', today)
        .eq('statut', 'termine')

      // Stock atelier critique (< 5)
      const { data: stockAtelierData } = await supabase
        .from('stock_atelier')
        .select('id, quantite_disponible, produit_id')
        .lt('quantite_disponible', 5)

      // Total produits
      const { count: totalProduits } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })

      // Calcul efficacité production
      const totalProductionsQuantite = productionsData?.reduce((sum, p) => sum + (parseFloat(p.quantite) || 0), 0) || 0
      const efficacite = totalProductionsQuantite > 0 ? Math.min(100, Math.round((totalProductionsQuantite / 50) * 100)) : 0

      const stats = {
        total_produits: totalProduits || 0,
        produits_stock_critique: produitsData?.length || 0,
        demandes_en_attente: demandesData?.length || 0,
        productions_jour: productionsData?.length || 0,
        stock_atelier_critique: stockAtelierData?.length || 0,
        efficacite_production: efficacite,
        utilisateurs_actifs: 0
      }

      console.log('✅ Stats chargées:', stats)
      return { stats, error: null }

    } catch (error) {
      console.error('❌ Erreur dans getDashboardStats:', error)

      return {
        stats: {
          total_produits: 0,
          produits_stock_critique: 0,
          demandes_en_attente: 0,
          productions_jour: 0,
          stock_atelier_critique: 0,
          efficacite_production: 0,
          utilisateurs_actifs: 0
        },
        error: error.message
      }
    }
  }
}
