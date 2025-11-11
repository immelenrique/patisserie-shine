// src/services/demandeService.js
// Service de gestion des demandes de produits (individuelles et groupées)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les demandes de produits
 * Gère à la fois les demandes individuelles et les demandes groupées
 */
export const demandeService = {
  /**
   * Récupère toutes les demandes (individuelles et groupées)
   * @returns {Object} { demandes, error }
   */
  async getAll() {
    try {
      // Récupérer les demandes individuelles
      const { data: demandesIndividuelles, error: erreurIndividuelles } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom, username),
          valideur:profiles!demandes_valideur_id_fkey(nom, username)
        `)
        .is('demande_groupee_id', null)
        .order('created_at', { ascending: false })

      // Récupérer les demandes groupées AVEC TOUS LES DÉTAILS
      const { data: demandesGroupees, error: erreurGroupees } = await supabase
        .from('demandes_groupees')
        .select(`
          *,
          demandeur:profiles!demandes_groupees_demandeur_id_fkey(nom, username),
          valideur:profiles!demandes_groupees_valideur_id_fkey(nom, username),
          lignes:demandes!demandes_demande_groupee_id_fkey(
            *,
            produit:produits(
              id,
              nom,
              quantite_restante,
              prix_achat,
              unite:unites(label, value)
            ),
            valideur:profiles!demandes_valideur_id_fkey(nom, username)
          )
        `)
        .order('created_at', { ascending: false })

      if (erreurIndividuelles) {
        console.error('Erreur demandes individuelles:', erreurIndividuelles)
      }
      if (erreurGroupees) {
        console.error('Erreur demandes groupées:', erreurGroupees)
      }

      // Formater toutes les demandes
      const toutes = [
        ...(demandesIndividuelles || []).map(d => ({
          ...d,
          type: 'individuelle'
        })),
        ...(demandesGroupees || []).map(d => ({
          ...d,
          type: 'groupee',
          // Calculer le nombre de produits validés/refusés
          stats: {
            total: d.lignes?.length || 0,
            validees: d.lignes?.filter(l => l.statut === 'validee').length || 0,
            refusees: d.lignes?.filter(l => l.statut === 'refusee').length || 0,
            en_attente: d.lignes?.filter(l => l.statut === 'en_attente').length || 0
          }
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      return { demandes: toutes, error: null }
    } catch (error) {
      console.error('Erreur dans getAll demandes:', error)
      return { demandes: [], error: error.message }
    }
  },

  /**
   * Récupère les détails d'une demande groupée avec toutes ses lignes
   * @param {string} demandeGroupeeId - ID de la demande groupée
   * @returns {Object} { details, error }
   */
  async getGroupedDetails(demandeGroupeeId) {
    try {
      const { data, error } = await supabase
        .from('demandes_groupees')
        .select(`
          *,
          demandeur:profiles!demandes_groupees_demandeur_id_fkey(nom, username, telephone),
          valideur:profiles!demandes_groupees_valideur_id_fkey(nom, username),
          lignes:demandes!demandes_demande_groupee_id_fkey(
            *,
            produit:produits(
              id,
              nom,
              quantite_restante,
              prix_achat,
              unite:unites(label, value)
            ),
            valideur_ligne:profiles!demandes_valideur_id_fkey(nom, username)
          )
        `)
        .eq('id', demandeGroupeeId)
        .single()

      if (error) {
        return { details: null, error: error.message }
      }

      // Calculer les totaux
      const valeurTotale = data.lignes?.reduce((sum, ligne) => {
        const prix = ligne.produit?.prix_achat || 0
        const quantite = ligne.quantite || 0
        return sum + (prix * quantite)
      }, 0) || 0

      return {
        details: {
          ...data,
          valeur_totale: valeurTotale,
          stats: {
            total: data.lignes?.length || 0,
            validees: data.lignes?.filter(l => l.statut === 'validee').length || 0,
            refusees: data.lignes?.filter(l => l.statut === 'refusee').length || 0,
            en_attente: data.lignes?.filter(l => l.statut === 'en_attente').length || 0
          }
        },
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getGroupedDetails:', error)
      return { details: null, error: error.message }
    }
  }
}
