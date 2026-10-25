// src/services/boulangerieService.js
// Boulangerie de la personne connectée (partie 12) : chaque compte voit la sienne ; la propriétaire choisit celle
// qu'elle affiche, ou « toutes » pour lire l'ensemble (sans saisie possible).
import { supabase } from '../lib/supabase-client'

let cache = null

export const boulangerieService = {
  // { courante: { id, nom, adresse, telephones } | null, toutes, peut_choisir, liste }, ou null si indisponible
  async charger() {
    const { data, error } = await supabase.rpc('ma_boulangerie')
    if (error) {
      console.warn('Boulangerie indisponible:', error.message)
      return null
    }
    cache = data
    return data
  },

  // Dernière boulangerie lue (pour le ticket imprimé), sans nouvel appel
  enCache() {
    return cache
  },

  async choisir(id) {
    const { data, error } = await supabase.rpc('choisir_boulangerie', { p_boulangerie_id: id })
    if (error) return { error: error.message }
    cache = data
    return { data }
  },

  async modifierCoordonnees(id, adresse, telephones) {
    const { data, error } = await supabase.rpc('modifier_boulangerie', { p_boulangerie_id: id, p_adresse: adresse, p_telephones: telephones })
    if (error) return { error: error.message }
    return { data }
  }
}
