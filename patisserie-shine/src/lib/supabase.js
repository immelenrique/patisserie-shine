// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  // Connexion par username
  async signInWithUsername(username, password) {
    try {
      // Conversion username vers email pour Supabase Auth
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('Erreur d\'authentification:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()
      
      if (profileError) {
        console.error('Erreur profil:', profileError)
        return { user: data.user, profile: null, error: profileError.message }
      }
      
      return { user: data.user, profile, error: null }
    } catch (error) {
      console.error('Erreur dans signInWithUsername:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Déconnexion
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      return { error: error.message }
    }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Erreur getCurrentUser:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          console.error('Erreur profil getCurrentUser:', profileError)
          return { user, profile: null, error: profileError.message }
        }
        
        return { user, profile, error: null }
      }
      
      return { user: null, profile: null, error: null }
    } catch (error) {
      console.error('Erreur dans getCurrentUser:', error)
      return { user: null, profile: null, error: error.message }
    }
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
      
      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
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
      
      if (error) {
        console.error('Erreur create produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans create produit:', error)
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
      
      if (error) {
        console.error('Erreur updateStock:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans updateStock:', error)
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
      
      if (error) {
        console.error('Erreur getCriticalStock:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getCriticalStock:', error)
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
      
      if (error) {
        console.error('Erreur getAll demandes:', error)
        return { demandes: [], error: error.message }
      }
      
      return { demandes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll demandes:', error)
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
      
      if (error) {
        console.error('Erreur create demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans create demande:', error)
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
      
      if (error) {
        console.error('Erreur approve demande:', error)
        return { result: null, error: error.message }
      }
      
      return { result: data, error: null }
    } catch (error) {
      console.error('Erreur dans approve demande:', error)
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
      
      if (error) {
        console.error('Erreur reject demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans reject demande:', error)
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
      
      if (error) {
        console.error('Erreur getAll productions:', error)
        return { productions: [], error: error.message }
      }
      
      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll productions:', error)
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
      
      if (error) {
        console.error('Erreur create production:', error)
        return { production: null, error: error.message }
      }
      
      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans create production:', error)
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
      
      if (error) {
        console.error('Erreur update production:', error)
        return { production: null, error: error.message }
      }
      
      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans update production:', error)
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
      
      if (error) {
        console.error('Erreur getAll users:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll users:', error)
      return { users: [], error: error.message }
    }
  },

  // Créer un nouvel utilisateur (nécessite des privilèges admin)
  async create(userData) {
    try {
      // Note: Cette fonction nécessite des privilèges admin sur Supabase
      // En production, cela devrait être fait via l'API Admin ou le dashboard
      console.warn('Création d\'utilisateur via l\'interface - à implémenter côté serveur')
      
      return { user: null, error: 'Fonctionnalité à implémenter côté serveur' }
    } catch (error) {
      console.error('Erreur dans create user:', error)
      return { user: null, error: error.message }
    }
  },

  // Mettre à jour un profil utilisateur
  async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Erreur updateProfile:', error)
        return { user: null, error: error.message }
      }
      
      return { user: data, error: null }
    } catch (error) {
      console.error('Erreur dans updateProfile:', error)
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
      
      if (error) {
        console.error('Erreur getDashboardStats:', error)
        return { stats: null, error: error.message }
      }
      
      return { stats: data, error: null }
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error)
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
      
      if (error) {
        console.error('Erreur getRecentMovements:', error)
        return { movements: [], error: error.message }
      }
      
      return { movements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getRecentMovements:', error)
      return { movements: [], error: error.message }
    }
  },

  // Obtenir les statistiques de production par période
  async getProductionStats(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          chef:profiles!productions_chef_patissier_id_fkey(nom_complet)
        `)
        .gte('date_production', startDate)
        .lte('date_production', endDate)
        .order('date_production', { ascending: false })
      
      if (error) {
        console.error('Erreur getProductionStats:', error)
        return { productions: [], error: error.message }
      }
      
      // Calculer les statistiques
      const productions = data || []
      const stats = {
        total_productions: productions.length,
        total_unites_produites: productions.reduce((sum, p) => sum + p.quantite_produite, 0),
        total_unites_vendues: productions.reduce((sum, p) => sum + (p.quantite_vendue || 0), 0),
        chiffre_affaires: productions.reduce((sum, p) => sum + ((p.quantite_vendue || 0) * (p.prix_vente_unitaire || 0)), 0),
        cout_total: productions.reduce((sum, p) => sum + (p.cout_production || 0), 0),
        taux_vente: productions.length > 0 ? 
          (productions.reduce((sum, p) => sum + (p.quantite_vendue || 0), 0) / 
           productions.reduce((sum, p) => sum + p.quantite_produite, 0)) * 100 : 0
      }
      
      return { stats, productions, error: null }
    } catch (error) {
      console.error('Erreur dans getProductionStats:', error)
      return { stats: null, productions: [], error: error.message }
    }
  }
}

// ===================== SERVICES RECETTES =====================
export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          *,
          created_by_profile:profiles!recettes_created_by_fkey(nom_complet),
          ingredients_recettes(
            *,
            produit:produits(nom, prix_unitaire),
            unite:unites(libelle, code)
          )
        `)
        .eq('actif', true)
        .order('nom')
      
      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }
      
      return { recettes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Créer une nouvelle recette
  async create(recetteData, ingredients = []) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Créer la recette
      const { data: recette, error: recetteError } = await supabase
        .from('recettes')
        .insert({
          ...recetteData,
          created_by: user?.id
        })
        .select()
        .single()
      
      if (recetteError) {
        console.error('Erreur create recette:', recetteError)
        return { recette: null, error: recetteError.message }
      }
      
      // Ajouter les ingrédients si fournis
      if (ingredients.length > 0) {
        const ingredientsData = ingredients.map(ing => ({
          ...ing,
          recette_id: recette.id
        }))
        
        const { error: ingredientsError } = await supabase
          .from('ingredients_recettes')
          .insert(ingredientsData)
        
        if (ingredientsError) {
          console.error('Erreur ingredients recette:', ingredientsError)
          // On continue même si les ingrédients échouent
        }
      }
      
      return { recette, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recette: null, error: error.message }
    }
  }
}

// ===================== SERVICES UNITÉS =====================
export const uniteService = {
  // Récupérer toutes les unités
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('unites')
        .select('*')
        .order('libelle')
      
      if (error) {
        console.error('Erreur getAll unites:', error)
        return { unites: [], error: error.message }
      }
      
      return { unites: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll unites:', error)
      return { unites: [], error: error.message }
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
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  // Formatage de la date et heure
  formatDateTime(dateString) {
    if (!dateString) return ''
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
  },

  // Formater un nombre avec séparateurs
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  },

  // Calculer l'âge d'un élément en jours
  calculateAge(dateString) {
    if (!dateString) return 0
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },

  // Valider un email
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // Générer une couleur aléatoire pour les avatars
  generateAvatarColor(string) {
    const colors = [
      'from-red-400 to-red-600',
      'from-blue-400 to-blue-600',
      'from-green-400 to-green-600',
      'from-yellow-400 to-yellow-600',
      'from-purple-400 to-purple-600',
      'from-pink-400 to-pink-600',
      'from-indigo-400 to-indigo-600',
      'from-orange-400 to-orange-600'
    ]
    
    let hash = 0
    for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  },

  // Debounce function pour les recherches
  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
}

// ===================== GESTION DES ERREURS =====================
export const errorHandler = {
  // Formater les erreurs Supabase
  formatSupabaseError(error) {
    if (!error) return 'Erreur inconnue'
    
    // Erreurs communes
    const errorMessages = {
      'invalid_credentials': 'Identifiants incorrects',
      'email_not_confirmed': 'Email non confirmé',
      'weak_password': 'Mot de passe trop faible',
      'user_not_found': 'Utilisateur introuvable',
      'email_address_invalid': 'Adresse email invalide',
      'signup_disabled': 'Inscription désactivée',
      'over_email_send_rate_limit': 'Trop d\'emails envoyés, veuillez patienter',
      'captcha_failed': 'Échec de la vérification captcha',
      'saml_provider_disabled': 'Fournisseur SAML désactivé',
      'email_address_not_authorized': 'Adresse email non autorisée',
      'manual_linking_disabled': 'Liaison manuelle désactivée',
      'same_password': 'Le nouveau mot de passe doit être différent',
      'session_not_found': 'Session introuvable',
      'flow_state_not_found': 'État de flux introuvable',
      'flow_state_expired': 'État de flux expiré',
      'signup_disabled': 'Inscription désactivée',
      'user_already_exists': 'Utilisateur existe déjà',
      'insufficient_aal': 'Niveau d\'authentification insuffisant'
    }
    
    return errorMessages[error.message] || error.message || 'Erreur inconnue'
  },

  // Logger les erreurs
  logError(error, context = '') {
    console.error(`[${context}] Erreur:`, error)
    
    // En production, vous pourriez envoyer les erreurs à un service de monitoring
    if (process.env.NODE_ENV === 'production') {
      // Exemple: Sentry, LogRocket, etc.
      // Sentry.captureException(error)
    }
  }
}

// ===================== HOOKS POUR REAL-TIME =====================
export const realtimeService = {
  // S'abonner aux changements de produits
  subscribeToProducts(callback) {
    return supabase
      .channel('products-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'produits' 
        }, 
        callback
      )
      .subscribe()
  },

  // S'abonner aux changements de demandes
  subscribeToDemandes(callback) {
    return supabase
      .channel('demandes-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'demandes' 
        }, 
        callback
      )
      .subscribe()
  },

  // S'abonner aux changements de productions
  subscribeToProductions(callback) {
    return supabase
      .channel('productions-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'productions' 
        }, 
        callback
      )
      .subscribe()
  },

  // Se désabonner d'un canal
  unsubscribe(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription)
    }
  }
}

export default supabase
