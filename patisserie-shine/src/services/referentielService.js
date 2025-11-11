// src/services/referentielService.js
// Service de gestion du référentiel produits (templates pour achats récurrents)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer le référentiel des produits
 * (templates de produits pour faciliter les achats récurrents)
 */
export const referentielService = {
  /**
   * Récupère tous les référentiels actifs
   * @returns {Object} { referentiels, error }
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('actif', true)
        .order('nom')

      if (error) {
        console.error('Erreur getAll référentiel:', error)
        return { referentiels: [], error: error.message }
      }

      return { referentiels: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll référentiel:', error)
      return { referentiels: [], error: error.message }
    }
  },

  /**
   * Crée un nouveau référentiel produit
   * @param {Object} referentielData - Données du référentiel
   * @returns {Object} { success, referentiel, error }
   */
  async create(referentielData) {
    try {
      const dataToInsert = {
        reference: referentielData.reference,
        nom: referentielData.nom,
        type_conditionnement: referentielData.type_conditionnement,
        unite_mesure: referentielData.unite_mesure,
        quantite_par_conditionnement: parseFloat(referentielData.quantite_par_conditionnement),
        prix_achat_total: parseFloat(referentielData.prix_achat_total)
      }

      console.log('Données à insérer dans référentiel:', dataToInsert)

      const { data, error } = await supabase
        .from('referentiel_produits')
        .insert(dataToInsert)
        .select()
        .single()

      if (error) {
        console.error('Erreur SQL création référentiel:', error)
        return { success: false, error: error.message }
      }

      return { success: true, referentiel: data, error: null }
    } catch (error) {
      console.error('Exception dans create référentiel:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Met à jour un référentiel existant
   * @param {string} id - ID du référentiel
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Object} { success, referentiel, error }
   */
  async update(id, updates) {
    try {
      const dataToUpdate = {
        reference: updates.reference,
        nom: updates.nom,
        type_conditionnement: updates.type_conditionnement,
        unite_mesure: updates.unite_mesure,
        quantite_par_conditionnement: parseFloat(updates.quantite_par_conditionnement),
        prix_achat_total: parseFloat(updates.prix_achat_total)
      }

      const { data, error } = await supabase
        .from('referentiel_produits')
        .update(dataToUpdate)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Erreur SQL update référentiel:', error)
        return { success: false, error: error.message }
      }

      return { success: true, referentiel: data, error: null }
    } catch (error) {
      console.error('Exception dans update référentiel:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Supprime (désactive) un référentiel
   * @param {string} id - ID du référentiel
   * @returns {Object} { success, error }
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('referentiel_produits')
        .update({
          actif: false
        })
        .eq('id', id)

      if (error) {
        console.error('Erreur SQL delete référentiel:', error)
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Exception dans delete référentiel:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Recherche des référentiels par nom (recherche partielle)
   * @param {string} searchTerm - Terme de recherche
   * @returns {Object} { referentiels, error }
   */
  async searchByName(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('actif', true)
        .ilike('nom', `%${searchTerm}%`)
        .limit(10)

      if (error) {
        return { referentiels: [], error: error.message }
      }

      return { referentiels: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans searchByName:', error)
      return { referentiels: [], error: error.message }
    }
  },

  /**
   * Récupère un référentiel par sa référence
   * @param {string} reference - Référence du produit
   * @returns {Object} { referentiel, error }
   */
  async getByReference(reference) {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('reference', reference)
        .eq('actif', true)
        .single()

      if (error) {
        return { referentiel: null, error: error.message }
      }

      return { referentiel: data, error: null }
    } catch (error) {
      console.error('Erreur dans getByReference:', error)
      return { referentiel: null, error: error.message }
    }
  },

  /**
   * Importe des référentiels depuis un fichier CSV
   * @param {File} file - Fichier CSV
   * @returns {Object} { success, imported, errors, error }
   */
  async importFromCSV(file) {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        return { success: false, error: 'Le fichier CSV est vide ou invalide' }
      }

      const headers = lines[0].split(',').map(h => h.trim())
      const requiredHeaders = ['reference', 'nom', 'type_conditionnement', 'unite_mesure', 'quantite_par_conditionnement', 'prix_achat_total']

      for (const header of requiredHeaders) {
        if (!headers.includes(header)) {
          return { success: false, error: `Colonne manquante: ${header}` }
        }
      }

      const dataToImport = []
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length !== headers.length) continue

        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })

        // Valider et convertir les données
        if (row.reference && row.nom) {
          dataToImport.push({
            reference: row.reference,
            nom: row.nom,
            type_conditionnement: row.type_conditionnement || 'sac',
            unite_mesure: row.unite_mesure || 'kg',
            quantite_par_conditionnement: parseFloat(row.quantite_par_conditionnement) || 1,
            prix_achat_total: parseFloat(row.prix_achat_total) || 0
          })
        } else {
          errors.push(`Ligne ${i + 1}: données manquantes`)
        }
      }

      if (dataToImport.length === 0) {
        return { success: false, error: 'Aucune donnée valide à importer' }
      }

      // Importer par batch
      const { error } = await supabase
        .from('referentiel_produits')
        .insert(dataToImport)

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        imported: dataToImport.length,
        errors: errors.length > 0 ? errors : null
      }
    } catch (error) {
      console.error('Erreur import CSV:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Exporte les référentiels vers un fichier CSV
   * @returns {Object} { success, url, filename, error }
   */
  async exportToCSV() {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('actif', true)
        .order('nom')

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data || data.length === 0) {
        return { success: false, error: 'Aucune donnée à exporter' }
      }

      // Créer le CSV
      const headers = ['reference', 'nom', 'type_conditionnement', 'unite_mesure', 'quantite_par_conditionnement', 'prix_achat_total', 'prix_unitaire']
      const csvLines = [headers.join(',')]

      data.forEach(item => {
        const line = [
          item.reference,
          `"${item.nom}"`,
          item.type_conditionnement,
          item.unite_mesure,
          item.quantite_par_conditionnement,
          item.prix_achat_total,
          item.prix_unitaire || ''
        ]
        csvLines.push(line.join(','))
      })

      const csvContent = csvLines.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      return { success: true, url, filename: `referentiel_${new Date().toISOString().split('T')[0]}.csv` }
    } catch (error) {
      console.error('Erreur export CSV:', error)
      return { success: false, error: error.message }
    }
  }
}
