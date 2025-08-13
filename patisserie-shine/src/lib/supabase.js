// src/lib/supabase.js - Services complets pour Pâtisserie Shine
import { createClient } from '@supabase/supabase-js'

// Configuration Supabase depuis variables d'environnement Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables Supabase manquantes. Vérifiez Vercel Environment Variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===================== AUTHENTIFICATION =====================
export const authService = {
  async signIn(username, password) {
    try {
      // Convention: username@shine.local pour l'email interne
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erreur connexion:', error)
      return { data: null, error: error.message || 'Identifiants incorrects' }
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: error.message }
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { user, error }
    } catch (error) {
      return { user: null, error: error.message }
    }
  },

  async getProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      return { profile: data, error }
    } catch (error) {
      return { profile: null, error: error.message }
    }
  }
}

// ===================== GESTION PRODUITS =====================
export const productService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
      
      if (error) throw error
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement produits:', error)
      return { products: [], error: error.message }
    }
  },

  async create(productData) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  async updateStock(productId, newStock) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ 
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({
          ...productData,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  async delete(productId) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
      
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  }
}

// ===================== GESTION ACHATS =====================
export const purchaseService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          items:purchase_items(*)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { purchases: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement achats:', error)
      return { purchases: [], error: error.message }
    }
  },

  async create(purchaseData, items) {
    try {
      // 1. Créer l'achat principal
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          ...purchaseData,
          purchase_number: `ACH-${Date.now()}` // Numérotation automatique
        })
        .select()
        .single()

      if (purchaseError) throw purchaseError

      // 2. Ajouter les items
      const itemsToInsert = items.map(item => ({
        ...item,
        purchase_id: purchase.id
      }))

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return { purchase, error: null }
    } catch (error) {
      console.error('Erreur création achat:', error)
      return { purchase: null, error: error.message }
    }
  },

  async receivePurchase(purchaseId, receivedItems, receivedBy, receivedByName) {
    try {
      // 1. Mettre à jour les quantités reçues
      for (const item of receivedItems) {
        await supabase
          .from('purchase_items')
          .update({ quantity_received: item.quantity_received })
          .eq('id', item.id)
      }

      // 2. Marquer l'achat comme reçu
      const { data, error } = await supabase
        .from('purchases')
        .update({ 
          status: 'received',
          delivery_date: new Date().toISOString().split('T')[0],
          received_by: receivedBy,
          received_by_name: receivedByName,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseId)
        .select()
        .single()

      if (error) throw error
      return { purchase: data, error: null }
    } catch (error) {
      return { purchase: null, error: error.message }
    }
  }
}

// ===================== DEMANDES DE STOCK =====================
export const requestService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          items:stock_request_items(*)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { requests: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement demandes:', error)
      return { requests: [], error: error.message }
    }
  },

  async getByEmployee(employeeId) {
    try {
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          items:stock_request_items(*)
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { requests: data || [], error: null }
    } catch (error) {
      return { requests: [], error: error.message }
    }
  },

  async create(requestData, items) {
    try {
      // 1. Créer la demande principale (numéro auto-généré par trigger)
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .insert(requestData)
        .select()
        .single()

      if (requestError) throw requestError

      // 2. Ajouter les items
      const itemsToInsert = items.map(item => ({
        ...item,
        request_id: request.id
      }))

      const { error: itemsError } = await supabase
        .from('stock_request_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return { request, error: null }
    } catch (error) {
      console.error('Erreur création demande:', error)
      return { request: null, error: error.message }
    }
  },

  async validate(requestId, status, validatedBy, validatedByName, rejectionReason = null, approvedQuantities = {}) {
    try {
      // 1. Mettre à jour le statut de la demande
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .update({
          status,
          validated_by: validatedBy,
          validated_by_name: validatedByName,
          validated_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', requestId)
        .select()
        .single()

      if (requestError) throw requestError

      // 2. Si approuvé, mettre à jour les quantités approuvées
      if (status === 'approved' && Object.keys(approvedQuantities).length > 0) {
        for (const [itemId, approvedQty] of Object.entries(approvedQuantities)) {
          await supabase
            .from('stock_request_items')
            .update({ quantity_approved: approvedQty })
            .eq('id', itemId)
        }
      }

      return { request, error: null }
    } catch (error) {
      return { request: null, error: error.message }
    }
  },

  async delete(requestId) {
    try {
      const { error } = await supabase
        .from('stock_requests')
        .delete()
        .eq('id', requestId)
        .eq('status', 'pending') // Seulement les demandes en attente

      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  }
}

// ===================== GESTION RECETTES =====================
export const recipeService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          ingredients:recipe_ingredients(*)
        `)
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      return { recipes: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement recettes:', error)
      return { recipes: [], error: error.message }
    }
  },

  async create(recipeData, ingredients) {
    try {
      // 1. Créer la recette
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single()

      if (recipeError) throw recipeError

      // 2. Ajouter les ingrédients
      const ingredientsToInsert = ingredients.map(ing => ({
        ...ing,
        recipe_id: recipe.id
      }))

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientsToInsert)

      if (ingredientsError) throw ingredientsError

      return { recipe, error: null }
    } catch (error) {
      return { recipe: null, error: error.message }
    }
  }
}

// ===================== GESTION PRODUCTION =====================
export const productionService = {
  async getProductionBatches() {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { batches: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement lots:', error)
      return { batches: [], error: error.message }
    }
  },

  async createProductionBatch(batchData) {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .insert({
          ...batchData,
          batch_number: `LOT-${Date.now()}` // Numérotation automatique
        })
        .select()
        .single()
      
      if (error) throw error
      return { batch: data, error: null }
    } catch (error) {
      return { batch: null, error: error.message }
    }
  },

  async recordIngredientUsage(batchId, ingredientUsage) {
    try {
      const usageToInsert = ingredientUsage.map(usage => ({
        ...usage,
        batch_id: batchId
      }))

      const { data, error } = await supabase
        .from('production_ingredient_usage')
        .insert(usageToInsert)
      
      if (error) throw error
      return { usage: data, error: null }
    } catch (error) {
      return { usage: null, error: error.message }
    }
  }
}

// ===================== PRODUITS FINIS =====================
export const finishedProductService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('finished_products_journal')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur chargement produits finis:', error)
      return { products: [], error: error.message }
    }
  },

  async create(productData) {
    try {
      const { data, error } = await supabase
        .from('finished_products_journal')
        .insert(productData)
        .select()
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  async delete(productId) {
    try {
      const { error } = await supabase
        .from('finished_products_journal')
        .delete()
        .eq('id', productId)
      
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  }
}

// ===================== MOUVEMENTS DE STOCK =====================
export const movementService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { movements: data || [], error: null }
    } catch (error) {
      return { movements: [], error: error.message }
    }
  },

  async create(movementData) {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
        .single()
      
      if (error) throw error
      return { movement: data, error: null }
    } catch (error) {
      return { movement: null, error: error.message }
    }
  },

  async createFromApprovedRequest(requestId, items, validatedBy, validatedByName) {
    try {
      const movements = []
      
      for (const item of items) {
        if (item.quantity_approved > 0) {
          const movementData = {
            movement_type: 'request_out',
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity_approved,
            unit: item.unit,
            stock_before: 0, // À calculer côté client
            stock_after: 0,  // À calculer côté client
            reference_id: requestId,
            reference_type: 'stock_request',
            destination: 'Demande interne',
            validated_by: validatedBy,
            validated_by_name: validatedByName,
            notes: `Sortie suite à demande approuvée`
          }

          const { movement, error } = await this.create(movementData)
          if (error) throw new Error(error)
          movements.push(movement)
        }
      }

      return { movements, error: null }
    } catch (error) {
      return { movements: [], error: error.message }
    }
  }
}

// ===================== ANALYSES =====================
export const analyticsService = {
  async getStockAnalysis() {
    try {
      const { data, error } = await supabase
        .from('stock_analysis')
        .select('*')
        .order('name')
      
      if (error) throw error
      return { analysis: data || [], error: null }
    } catch (error) {
      console.error('Erreur analyse stocks:', error)
      return { analysis: [], error: error.message }
    }
  },

  async getVarianceReport(startDate, endDate) {
    try {
      // Calcul des écarts entre stock théorique et réel
      const { data, error } = await supabase
        .rpc('calculate_stock_variance', {
          start_date: startDate,
          end_date: endDate
        })
      
      if (error) throw error
      return { variance: data || [], error: null }
    } catch (error) {
      return { variance: [], error: error.message }
    }
  },

  async getDashboardStats() {
    try {
      // Statistiques pour le tableau de bord
      const [
        productsRes,
        purchasesRes,
        requestsRes,
        batchesRes
      ] = await Promise.all([
        this.productService.getAll(),
        this.purchaseService.getAll(),
        this.requestService.getAll(),
        this.productionService.getProductionBatches()
      ])

      const stats = {
        products: {
          total: productsRes.products?.length || 0,
          lowStock: productsRes.products?.filter(p => p.stock <= p.min_stock).length || 0
        },
        purchases: {
          total: purchasesRes.purchases?.length || 0,
          pending: purchasesRes.purchases?.filter(p => p.status === 'pending').length || 0,
          monthlyValue: purchasesRes.purchases
            ?.filter(p => new Date(p.created_at).getMonth() === new Date().getMonth())
            .reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
        },
        requests: {
          total: requestsRes.requests?.length || 0,
          pending: requestsRes.requests?.filter(r => r.status === 'pending').length || 0
        },
        production: {
          total: batchesRes.batches?.length || 0,
          active: batchesRes.batches?.filter(b => b.status === 'in_progress').length || 0
        }
      }

      return { stats, error: null }
    } catch (error) {
      return { stats: null, error: error.message }
    }
  }
}

// ===================== GESTION UTILISATEURS =====================
export const userService = {
  async getAllProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      return { users: data || [], error }
    } catch (error) {
      return { users: [], error: error.message }
    }
  },

  async updateProfile(userId, profileData) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()
      
      return { profile: data, error }
    } catch (error) {
      return { profile: null, error: error.message }
    }
  }
}

// ===================== UTILITAIRES =====================
export const utils = {
  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Date invalide'
    }
  },

  formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF', // Franc CFA
        minimumFractionDigits: 0
      }).format(amount)
    } catch {
      return `${amount} CFA`
    }
  },

  generateBatchNumber(prefix = 'LOT') {
    const now = new Date()
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0')
    const timeStr = now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0')
    return `${prefix}-${dateStr}-${timeStr}`
  },

  calculateStockVariance(expected, actual) {
    if (expected === 0) return 0
    return ((actual - expected) / expected) * 100
  }
}

// Export par défaut du client Supabase principal
export default supabase