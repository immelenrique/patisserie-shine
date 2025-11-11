// src/services/uniteService.js
// Service de gestion des unités de mesure
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les unités de mesure (kg, L, pièces, etc.)
 */
export const uniteService = {
  /**
   * Récupère toutes les unités
   * @returns {Object} { unites, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('unites')
        .select('*')
        .order('label')

      if (error) {
        console.error('Erreur getAll unites:', error)
        return { unites: [], error: error.message }
      }

      return { unites: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll unites:', error)
      return { unites: [], error: error.message }
    }
  },

  /**
   * Crée une nouvelle unité
   * @param {Object} uniteData - { value, label }
   * @returns {Object} { unite, error }
   */
  async create(uniteData) {
    try {
      const { data: existingUnite } = await supabase
        .from('unites')
        .select('id')
        .eq('value', uniteData.value)
        .maybeSingle()

      if (existingUnite) {
        return { unite: null, error: 'Cette unité existe déjà' }
      }

      const { data, error } = await supabase
        .from('unites')
        .insert(uniteData)
        .select()
        .single()

      if (error) {
        return { unite: null, error: error.message }
      }

      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans create unite:', error)
      return { unite: null, error: error.message }
    }
  },

  /**
   * Met à jour une unité existante
   * @param {string} id - ID de l'unité
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Object} { unite, error }
   */
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('unites')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { unite: null, error: error.message }
      }

      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans update unite:', error)
      return { unite: null, error: error.message }
    }
  },

  /**
   * Supprime une unité si elle n'est pas utilisée
   * @param {string} id - ID de l'unité
   * @returns {Object} { success, error }
   */
  async delete(id) {
    try {
      const { count } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })
        .eq('unite_id', id)

      if (count > 0) {
        return {
          success: false,
          error: `Cette unité est utilisée par ${count} produit(s)`
        }
      }

      const { error } = await supabase
        .from('unites')
        .delete()
        .eq('id', id)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans delete unite:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Crée les unités de base si la table est vide
   * @returns {Object} { success, unites, message, error }
   */
  async createBasicUnitsIfEmpty() {
    try {
      // Vérifier s'il y a déjà des unités
      const { data: existingUnites, error: checkError } = await supabase
        .from('unites')
        .select('id')
        .limit(1)

      if (checkError) {
        console.error('Erreur vérification unités:', checkError)
        return { success: false, error: checkError.message }
      }

      // Si des unités existent déjà, ne rien faire
      if (existingUnites && existingUnites.length > 0) {
        return { success: true, message: 'Unités déjà existantes' }
      }

      // Créer les unités de base
      const unitesDeBase = [
        { value: 'kg', label: 'Kilogrammes' },
        { value: 'g', label: 'Grammes' },
        { value: 'L', label: 'Litres' },
        { value: 'ml', label: 'Millilitres' },
        { value: 'unite', label: 'Unité' },
        { value: 'pcs', label: 'Pièces' },
        { value: 'boite', label: 'Boîte' },
        { value: 'sac', label: 'Sac' }
      ]

      const { data, error } = await supabase
        .from('unites')
        .insert(unitesDeBase)
        .select()

      if (error) {
        console.error('Erreur création unités de base:', error)
        return { success: false, error: error.message }
      }

      console.log('Unités de base créées:', data?.length || 0)
      return { success: true, unites: data }

    } catch (error) {
      console.error('Erreur dans createBasicUnitsIfEmpty:', error)
      return { success: false, error: error.message }
    }
  }
}
