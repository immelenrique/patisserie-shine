// src/services/arretCaisseService.js
// Service de gestion des arrêts de caisse (clôtures journalières)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les arrêts de caisse (clôtures en fin de journée)
 */
export const arretCaisseService = {
  /**
   * Crée un nouvel arrêt de caisse
   * @param {Object} arretData - Données de l'arrêt de caisse
   * @returns {Object} { arret, error }
   */
  async create(arretData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('arrets_caisse')
        .insert({
          ...arretData,
          vendeur_id: user?.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { arret: null, error: error.message }
      }

      return { arret: data, error: null }
    } catch (error) {
      console.error('Erreur dans create arret caisse:', error)
      return { arret: null, error: error.message }
    }
  },

  /**
   * Récupère les arrêts de caisse pour une date donnée
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Object} { arrets, error }
   */
  async getByDate(date) {
    try {
      const { data, error } = await supabase
        .from('arrets_caisse')
        .select(`
          *,
          vendeur:profiles!arrets_caisse_vendeur_id_fkey(nom)
        `)
        .eq('date_arret', date)
        .order('created_at', { ascending: false })

      if (error) {
        return { arrets: [], error: error.message }
      }

      return { arrets: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getByDate arret caisse:', error)
      return { arrets: [], error: error.message }
    }
  }
}
