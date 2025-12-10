// src/services/recetteService.js
// Service de gestion des recettes (compositions de produits)
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les recettes (liste des ingrédients nécessaires pour produire un produit)
 */
export const recetteService = {
  /**
   * Récupère toutes les recettes avec les détails des ingrédients
   * IMPORTANT: Utilise le STOCK ATELIER car c'est là que se fait la production
   * @returns {Object} { recettes, error }
   */
  async getAll() {
    try {
      // 1. Charger les recettes avec les infos produits
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          id,
          nom_produit,
          produit_ingredient_id,
          quantite_necessaire,
          created_at,
          updated_at,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, prix_achat, quantite,
            unite:unites(id, value, label)
          )
        `)
        .order('nom_produit', { ascending: true })

      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }

      // 2. Charger le stock atelier séparément
      const { data: stockAtelierData, error: stockError } = await supabase
        .from('stock_atelier')
        .select('produit_id, quantite_disponible')

      if (stockError) {
        console.error('Erreur chargement stock atelier:', stockError)
      }

      // 3. Créer un map du stock atelier
      const stockAtelierMap = (stockAtelierData || []).reduce((acc, item) => {
        acc[item.produit_id] = item.quantite_disponible
        return acc
      }, {})

      // 4. Formater les recettes avec le stock atelier
      const recettesFormatees = (data || []).map(recette => {
        const stockAtelier = stockAtelierMap[recette.produit_ingredient_id] || 0
        const ingredientDisponible = stockAtelier >= recette.quantite_necessaire

        return {
          recette_id: `recette_${recette.id}`,
          nom_produit: recette.nom_produit,
          produit_ingredient_id: recette.produit_ingredient_id,
          ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
          quantite_necessaire: recette.quantite_necessaire,
          unite: recette.produit_ingredient?.unite?.label || '',
          prix_achat: recette.produit_ingredient?.prix_achat || 0,
          quantite_achat: recette.produit_ingredient?.quantite || 1,
          cout_ingredient: recette.produit_ingredient?.quantite > 0
            ? (recette.quantite_necessaire / recette.produit_ingredient.quantite) * recette.produit_ingredient.prix_achat
            : 0,
          // Stock ATELIER (pas stock principal)
          stock_atelier_disponible: stockAtelier,
          ingredient_disponible: ingredientDisponible,
          created_at: recette.created_at,
          updated_at: recette.updated_at
        }
      })

      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  /**
   * Crée une ou plusieurs recettes (ingrédients d'un produit)
   * @param {Object} recetteData - { nom_produit, ingredients: [{ produit_ingredient_id, quantite_necessaire }] }
   * @returns {Object} { recettes, error }
   */
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const ingredients = recetteData.ingredients.filter(ing =>
        ing.produit_ingredient_id && ing.quantite_necessaire > 0
      )

      const recettesAInserer = ingredients.map(ing => ({
        nom_produit: recetteData.nom_produit,
        produit_ingredient_id: ing.produit_ingredient_id,
        quantite_necessaire: ing.quantite_necessaire,
        created_by: user?.id
      }))

      const { data, error } = await supabase
        .from('recettes')
        .insert(recettesAInserer)
        .select()

      if (error) {
        return { recettes: null, error: error.message }
      }

      return { recettes: data, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recettes: null, error: error.message }
    }
  },

  /**
   * Supprime une recette (ligne d'ingrédient)
   * @param {string} recetteId - ID de la recette
   * @returns {Object} { success, error }
   */
  async delete(recetteId) {
    try {
      const { error } = await supabase
        .from('recettes')
        .delete()
        .eq('id', recetteId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans delete recette:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Récupère la liste unique des noms de produits ayant des recettes
   * @returns {Object} { produits, error }
   */
  async getProduitsRecettes() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select('nom_produit')
        .order('nom_produit')

      if (error) {
        console.error('Erreur getProduitsRecettes:', error)
        return { produits: [], error: error.message }
      }

      const nomsUniques = [...new Set((data || []).map(item => item.nom_produit))].sort()
      return { produits: nomsUniques, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error)
      return { produits: [], error: error.message }
    }
  },

  /**
   * Calcule les besoins en ingrédients pour produire une quantité donnée
   * IMPORTANT: Utilise le STOCK ATELIER car c'est là que se fait la production
   * @param {string} nomProduit - Nom du produit à produire
   * @param {number} quantite - Quantité à produire
   * @returns {Object} { besoins, error }
   */
  async calculerBesoins(nomProduit, quantite) {
    try {
      // 1. Charger les recettes
      const { data: recettes } = await supabase
        .from('recettes')
        .select(`
          *,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, unite:unites(label)
          )
        `)
        .eq('nom_produit', nomProduit)

      if (!recettes || recettes.length === 0) {
        return { besoins: [], error: 'Aucune recette trouvée pour ce produit' }
      }

      // 2. Charger le stock atelier
      const { data: stockAtelierData } = await supabase
        .from('stock_atelier')
        .select('produit_id, quantite_disponible')

      const stockAtelierMap = (stockAtelierData || []).reduce((acc, item) => {
        acc[item.produit_id] = item.quantite_disponible
        return acc
      }, {})

      // 3. Calculer les besoins avec le stock atelier
      const besoins = recettes.map(ingredient => {
        const quantiteNecessaire = ingredient.quantite_necessaire * quantite
        const quantiteDisponible = stockAtelierMap[ingredient.produit_ingredient.id] || 0
        const quantiteManquante = Math.max(0, quantiteNecessaire - quantiteDisponible)

        return {
          ingredient_nom: ingredient.produit_ingredient.nom,
          quantite_necessaire: quantiteNecessaire,
          quantite_disponible: quantiteDisponible,
          quantite_manquante: quantiteManquante,
          unite: ingredient.produit_ingredient.unite?.label || '',
          suffisant: quantiteDisponible >= quantiteNecessaire
        }
      })

      return { besoins, error: null }
    } catch (error) {
      console.error('Erreur dans calculerBesoins:', error)
      return { besoins: [], error: error.message }
    }
  }
}
