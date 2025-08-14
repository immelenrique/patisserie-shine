// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables d\'environnement Supabase manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  // Connexion par username
  async signInWithUsername(username, password) {
    try {
      // Conversion username vers email pour Supabase
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()
      
      return { user: data.user, profile, error: null }
    } catch (error) {
      return { user: null, profile: null, error: error.message }
    }
  },

  // Déconnexion
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      return { user, profile, error }
    }
    
    return { user: null, profile: null, error }
  }
}

// ===================== SERVICES PRODUITS =====================
export const productService = {
  // Récupérer tous les produits
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, code, libelle),
          created_by_profile:profiles!produits_created_by_fkey(nom_complet)
        `)
        .eq('actif', true)
        .order('nom')
      
      if (error) throw error
      return { products: data || [], error: null }
    } catch (error) {
      return { products: [], error: error.message }
    }
  },

  // Créer un nouveau produit
  async create(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('produits')
        .insert({
          ...productData,
          created_by: user?.id
        })
        .select(`
          *,
          unite:unites(id, code, libelle)
        `)
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  // Mettre à jour le stock
  async updateStock(productId, newStock) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({ 
          stock_actuel: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          unite:unites(id, code, libelle)
        `)
        .single()
      
      if (error) throw error
      return { product: data, error: null }
    } catch (error) {
      return { product: null, error: error.message }
    }
  },

  // Obtenir les produits en stock critique
  async getCriticalStock() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_critique')
        .select('*')
        .order('niveau_alerte')
      
      if (error) throw error
      return { products: data || [], error: null }
    } catch (error) {
      return { products: [], error: error.message }
    }
  }
}

// ===================== SERVICES DEMANDES =====================
export const demandeService = {
  // Récupérer toutes les demandes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, stock_actuel, unite:unites(libelle)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom_complet, role),
          approbateur:profiles!demandes_approbateur_id_fkey(nom_complet)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { demandes: data || [], error: null }
    } catch (error) {
      return { demandes: [], error: error.message }
    }
  },

  // Créer une nouvelle demande
  async create(demandeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .insert({
          ...demandeData,
          demandeur_id: user?.id
        })
        .select(`
          *,
          produit:produits(nom, stock_actuel, unite:unites(libelle)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom_complet)
        `)
        .single()
      
      if (error) throw error
      return { demande: data, error: null }
    } catch (error) {
      return { demande: null, error: error.message }
    }
  },

  // Approuver une demande
  async approve(demandeId, quantiteAccordee) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase.rpc('approuver_demande', {
        p_demande_id: demandeId,
        p_quantite_accordee: quantiteAccordee,
        p_approbateur_id: user?.id
      })
      
      if (error) throw error
      return { result: data, error: null }
    } catch (error) {
      return { result: null, error: error.message }
    }
  },

  // Refuser une demande
  async reject(demandeId, motifRefus) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          motif_refus: motifRefus,
          approbateur_id: user?.id,
          date_approbation: new Date().toISOString()
        })
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .select()
        .single()
      
      if (error) throw error
      return { demande: data, error: null }
    } catch (error) {
      return { demande: null, error: error.message }
    }
  }
}

// ===================== SERVICES PRODUCTION =====================
export const productionService = {
  // Récupérer toutes les productions
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          chef:profiles!productions_chef_patissier_id_fkey(nom_complet)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { productions: data || [], error: null }
    } catch (error) {
      return { productions: [], error: error.message }
    }
  },

  // Créer une nouvelle production
  async create(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('productions')
        .insert({
          ...productionData,
          chef_patissier_id: user?.id,
          date_production: new Date().toISOString().split('T')[0]
        })
        .select(`
          *,
          chef:profiles!productions_chef_patissier_id_fkey(nom_complet)
        `)
        .single()
      
      if (error) throw error
      return { production: data, error: null }
    } catch (error) {
      return { production: null, error: error.message }
    }
  },

  // Mettre à jour une production
  async update(productionId, updates) {
    try {
      const { data, error } = await supabase
        .from('productions')
        .update(updates)
        .eq('id', productionId)
        .select(`
          *,
          chef:profiles!productions_chef_patissier_id_fkey(nom_complet)
        `)
        .single()
      
      if (error) throw error
      return { production: data, error: null }
    } catch (error) {
      return { production: null, error: error.message }
    }
  }
}

// ===================== SERVICES UTILISATEURS =====================
export const userService = {
  // Récupérer tous les utilisateurs
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { users: data || [], error: null }
    } catch (error) {
      return { users: [], error: error.message }
    }
  },

  // Créer un nouvel utilisateur
  async create(userData) {
    try {
      // Créer l'utilisateur dans auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: `${userData.username}@shine.local`,
        password: userData.password,
        email_confirm: true
      })
      
      if (authError) throw authError
      
      // Mettre à jour le profil avec les données complètes
      const { data, error } = await supabase
        .from('profiles')
        .update({
          nom_complet: userData.nom_complet,
          telephone: userData.telephone,
          role: userData.role
        })
        .eq('id', authData.user.id)
        .select()
        .single()
      
      if (error) throw error
      return { user: data, error: null }
    } catch (error) {
      return { user: null, error: error.message }
    }
  }
}

// ===================== SERVICES STATISTIQUES =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      const { data, error } = await supabase
        .from('vue_statistiques_globales')
        .select('*')
        .single()
      
      if (error) throw error
      return { stats: data, error: null }
    } catch (error) {
      return { stats: null, error: error.message }
    }
  },

  // Obtenir les mouvements de stock récents
  async getRecentMovements(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom),
          utilisateur:profiles(nom_complet)
        `)
        .order('date_mouvement', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return { movements: data || [], error: null }
    } catch (error) {
      return { movements: [], error: error.message }
    }
  }
}

// ===================== UTILITAIRES =====================
export const utils = {
  // Formatage de la monnaie CFA
  formatCFA(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount || 0)
  },

  // Formatage de la date
  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  // Formatage de la date et heure
  formatDateTime(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  // Calculer le pourcentage de stock
  calculateStockPercentage(current, minimum) {
    if (minimum === 0) return 100
    return Math.round((current / minimum) * 100)
  },

  // Déterminer le niveau d'alerte stock
  getStockAlertLevel(current, minimum) {
    if (current <= 0) return 'rupture'
    if (current <= minimum) return 'critique'
    if (current <= minimum * 1.5) return 'faible'
    return 'normal'
  }
}

export default supabase
