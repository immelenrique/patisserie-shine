// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine (VERSION FINALE)
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
  // Connexion par email
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
        .eq('id', data.user.id)
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
          unite:unites(id, value, label),
          created_by_profile:profiles!produits_created_by_fkey(nom)
        `)
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
          nom: productData.nom,
          date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user?.id
        })
        .select(`
          *,
          unite:unites(id, value, label)
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

  // Mettre à jour un produit
  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite_restante,
          unite_id: productData.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Obtenir les produits en stock faible
  async getLowStock() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .lt('quantite_restante', 10)
        .order('quantite_restante')
      
      if (error) {
        console.error('Erreur getLowStock:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getLowStock:', error)
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
          produit:produits(id, nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
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
          produit_id: demandeData.produit_id,
          quantite: demandeData.quantite,
          destination: demandeData.destination,
          demandeur_id: user?.id
        })
        .select(`
          *,
          produit:produits(nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom)
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

  // Valider une demande (CORRIGÉ)
  async validate(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('valider_demande', {
        demande_id_input: demandeId.toString(),
        p_valideur_id: user.id
      })
      
      if (error) {
        console.error('Erreur RPC valider_demande:', error)
        return { result: null, error: error.message }
      }
      
      return { result: data, error: null }
    } catch (error) {
      console.error('Erreur dans validate demande:', error)
      return { result: null, error: error.message }
    }
  },

  // Refuser une demande
  async reject(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: user?.id,
          date_validation: new Date().toISOString()
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
          producteur:profiles!productions_producteur_id_fkey(nom)
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

  // Créer une nouvelle production avec déduction automatique du stock atelier
  async create(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { production: null, error: 'Utilisateur non connecté' }
      }

      console.log('Création production:', productionData)

      // Utiliser la fonction PostgreSQL qui gère la déduction automatique
      const { data, error } = await supabase.rpc('creer_production_avec_deduction', {
        p_produit: productionData.produit,
        p_quantite: productionData.quantite,
        p_destination: productionData.destination || 'Boutique',
        p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
        p_producteur_id: user.id
      })
      
      if (error) {
        console.error('Erreur RPC create production:', error)
        return { production: null, error: error.message }
      }

      // Vérifier le résultat de la fonction
      if (!data || !data.success) {
        const errorMessage = data?.error || 'Erreur inconnue lors de la création'
        console.error('Erreur création production:', errorMessage)
        return { production: null, error: errorMessage }
      }

      console.log('Production créée avec succès:', data)

      // Récupérer les données complètes de la production créée
      const { data: productionData, error: fetchError } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .eq('id', data.production_id)
        .single()

      if (fetchError) {
        console.warn('Erreur récupération production créée:', fetchError)
        // Retourner quand même le succès avec les données minimales
        return { 
          production: { 
            id: data.production_id, 
            cout_ingredients: data.cout_ingredients,
            message: data.message 
          }, 
          error: null 
        }
      }
      
      return { 
        production: {
          ...productionData,
          message: data.message
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans create production:', error)
      return { production: null, error: error.message }
    }
  },

  // Annuler une production et restaurer le stock atelier
  async cancel(productionId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('annuler_production', {
        p_production_id: productionId,
        p_utilisateur_id: user.id
      })
      
      if (error) {
        console.error('Erreur annulation production:', error)
        return { success: false, error: error.message }
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Erreur lors de l\'annulation' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('Erreur dans cancel production:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour une production (statut uniquement)
  async update(productionId, updates) {
    try {
      const { data, error } = await supabase
        .from('productions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionId)
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
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
  },

  // Obtenir les productions du jour avec consommation d'ingrédients
  async getProductionsDuJour() {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .eq('date_production', today)
        .neq('statut', 'annule')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getProductionsDuJour:', error)
        return { productions: [], error: error.message }
      }
      
      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProductionsDuJour:', error)
      return { productions: [], error: error.message }
    }
  },

  // Obtenir l'historique d'utilisation des ingrédients
  async getHistoriqueUtilisation(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom, unite:unites(label)),
          utilisateur:profiles(nom)
        `)
        .in('type_mouvement', ['utilisation_production', 'restauration_annulation'])
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueUtilisation:', error)
        return { mouvements: [], error: error.message }
      }
      
      return { mouvements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueUtilisation:', error)
      return { mouvements: [], error: error.message }
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

// ===================== SERVICES UNITÉS =====================
export const uniteService = {
  // Récupérer toutes les unités
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
  }
}

// ===================== SERVICES STOCK ATELIER (CORRIGÉ) =====================
export const stockAtelierService = {
  // Récupérer l'état du stock atelier
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_atelier_usage')
        .select('*')
        
      if (error) {
        console.error('Erreur getStockAtelier:', error)
        return { stock: [], error: error.message }
      }
      
      return { stock: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des transferts
  async getHistoriqueTransferts() {
    try {
      // Essayer d'abord avec la vue, sinon utiliser la table directement
      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('vue_transferts_atelier')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50))
      } catch (viewError) {
        // Si la vue n'existe pas, utiliser la table stock_atelier directement
        ({ data, error } = await supabase
          .from('stock_atelier')
          .select(`
            id,
            produit_id,
            quantite_transferee,
            transfere_par,
            statut,
            created_at,
            produit:produits(nom, unite:unites(label)),
            transfere_par_profile:profiles!stock_atelier_transfere_par_fkey(nom)
          `)
          .eq('statut', 'effectue')
          .order('created_at', { ascending: false })
          .limit(50))
        
        // Reformater les données pour correspondre à l'interface attendue
        if (data) {
          data = data.map(transfert => ({
            id: transfert.id,
            produit_id: transfert.produit_id,
            nom_produit: transfert.produit?.nom || 'Produit inconnu',
            quantite_transferee: transfert.quantite_transferee,
            transfere_par: transfert.transfere_par,
            statut: transfert.statut,
            created_at: transfert.created_at,
            unite: transfert.produit?.unite?.label || '',
            transfere_par_nom: transfert.transfere_par_profile?.nom || 'Inconnu'
          }))
        }
      }
      
      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { transferts: [], error: error.message }
      }
      
      return { transferts: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { transferts: [], error: error.message }
    }
  },

  // Transférer vers l'atelier (optionnel - peut être fait via demandes)
  async transfererVersAtelier(produitId, quantite) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Vérifier le stock disponible
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .select('quantite_restante, nom')
        .eq('id', produitId)
        .single()
      
      if (produitError || !produit) {
        return { success: false, error: 'Produit introuvable' }
      }
      
      if (produit.quantite_restante < quantite) {
        return { success: false, error: 'Stock insuffisant dans le stock principal' }
      }
      
      // Créer le transfert direct
      const { data, error } = await supabase
        .from('stock_atelier')
        .insert({
          produit_id: produitId,
          quantite_transferee: quantite,
          transfere_par: user?.id,
          statut: 'effectue'
        })
        .select()
        .single()
      
      if (error) {
        console.error('Erreur transfert:', error)
        return { success: false, error: error.message }
      }
      
      // Décrémenter le stock principal
      const { error: updateError } = await supabase
        .from('produits')
        .update({
          quantite_restante: produit.quantite_restante - quantite
        })
        .eq('id', produitId)
      
      if (updateError) {
        console.error('Erreur mise à jour stock:', updateError)
        return { success: false, error: 'Erreur lors de la mise à jour du stock' }
      }
      
      return { success: true, transfert: data }
    } catch (error) {
      console.error('Erreur dans transfererVersAtelier:', error)
      return { success: false, error: error.message }
    }
  }
}

// ===================== SERVICES RECETTES (CORRIGÉ COMPLET) =====================
export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      // Essayer d'abord avec la vue, puis fallback sur la table
      let data, error;
      
      try {
        // Utiliser la vue qui agrège tout
        ({ data, error } = await supabase
          .from('vue_recettes_cout')
          .select('*')
          .order('nom_produit', { ascending: true }))
      } catch (viewError) {
        console.warn('Vue vue_recettes_cout indisponible, utilisation de la table:', viewError)
        
        // Fallback : requête directe sur la table avec jointures
        ({ data, error } = await supabase
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
          .order('nom_produit', { ascending: true }))
      }
      
      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }
      
      // Formatter les données selon la source
      let recettesFormatees = []
      
      if (data && data.length > 0) {
        recettesFormatees = data.map(recette => {
          // Si c'est de la vue vue_recettes_cout
          if (recette.ingredient_nom) {
            return {
              recette_id: `recette_${recette.recette_id}`,
              nom_produit: recette.nom_produit,
              produit_ingredient_id: recette.produit_ingredient_id,
              ingredient_nom: recette.ingredient_nom,
              quantite_necessaire: recette.quantite_necessaire,
              unite: recette.unite || '',
              prix_achat: recette.prix_achat || 0,
              quantite_achat: recette.quantite_achat || 1,
              cout_ingredient: recette.cout_ingredient || 0,
              stock_atelier_disponible: recette.stock_atelier_disponible || 0,
              ingredient_disponible: recette.ingredient_disponible || false,
              created_at: recette.created_at,
              updated_at: recette.updated_at
            }
          } else {
            // Si c'est de la table avec jointures
            return {
              recette_id: `recette_${recette.id}`,
              nom_produit: recette.nom_produit,
              produit_ingredient_id: recette.produit_ingredient_id,
              ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
              quantite_necessaire: recette.quantite_necessaire,
              unite: recette.produit_ingredient?.unite?.label || '',
              prix_achat: recette.produit_ingredient?.prix_achat || 0,
              quantite_achat: recette.produit_ingredient?.quantite || 1,
              cout_ingredient: recette.produit_ingredient?.quantite > 0 ? 
                Math.round((recette.produit_ingredient.prix_achat / recette.produit_ingredient.quantite) * recette.quantite_necessaire * 100) / 100 : 0,
              stock_atelier_disponible: 0,
              ingredient_disponible: true,
              created_at: recette.created_at,
              updated_at: recette.updated_at
            }
          }
        })
      }
      
      console.log('Recettes chargées:', recettesFormatees.length)
      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Obtenir les produits avec recettes
  async getProduitsRecettes() {
    try {
      // Essayer d'abord avec la fonction principale
      let data, error;
      
      try {
        ({ data, error } = await supabase.rpc('get_produits_avec_recettes'))
      } catch (firstError) {
        console.warn('Fonction get_produits_avec_recettes échouée, essai avec fallback:', firstError)
        
        // Essayer avec la fonction de fallback
        try {
          ({ data, error } = await supabase.rpc('get_produits_recettes_simple'))
        } catch (secondError) {
          console.warn('Fonction fallback échouée, requête directe:', secondError)
          
          // Dernière tentative : requête directe sur la table
          ({ data, error } = await supabase
            .from('recettes')
            .select('nom_produit')
            .order('nom_produit'))
          
          // Extraire les noms uniques
          if (data) {
            const nomsUniques = [...new Set(data.map(item => item.nom_produit))].sort()
            data = nomsUniques.map(nom => ({ nom_produit: nom }))
          }
        }
      }
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error)
        return { produits: [], error: error.message }
      }
      
      return { produits: data?.map(item => item.nom_produit) || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error)
      return { produits: [], error: error.message }
    }
  },

  // Vérifier disponibilité des ingrédients dans l'atelier
  async verifierDisponibiliteIngredients(nomProduit, quantite) {
    try {
      const { data, error } = await supabase.rpc('verifier_ingredients_atelier', {
        p_nom_produit: nomProduit,
        p_quantite_a_produire: quantite
      })

      if (error) {
        console.error('Erreur vérification ingrédients:', error)
        return { details: [], disponible: false, error: error.message }
      }

      const details = data || []
      const disponible = details.length > 0 && details.every(d => d.suffisant)

      return { 
        details, 
        disponible, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans verifierDisponibiliteIngredients:', error)
      return { details: [], disponible: false, error: error.message }
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { recette: null, error: 'Utilisateur non connecté' }
      }

      // Essayer d'abord l'insertion directe
      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('recettes')
          .insert({
            nom_produit: recetteData.nom_produit,
            produit_ingredient_id: recetteData.produit_ingredient_id,
            quantite_necessaire: recetteData.quantite_necessaire,
            created_by: user.id
          })
          .select()
          .single())
      } catch (directError) {
        console.warn('Insertion directe échouée, essai avec fonction sécurisée:', directError)
        
        // Utiliser la fonction sécurisée si l'insertion directe échoue
        try {
          const { data: recetteId, error: rpcError } = await supabase.rpc('creer_recette_secure', {
            p_nom_produit: recetteData.nom_produit,
            p_produit_ingredient_id: recetteData.produit_ingredient_id,
            p_quantite_necessaire: recetteData.quantite_necessaire,
            p_created_by: user.id
          })
          
          if (rpcError) {
            console.error('Erreur fonction sécurisée:', rpcError)
            return { recette: null, error: rpcError.message }
          }
          
          // Récupérer la recette créée
          ({ data, error } = await supabase
            .from('recettes')
            .select('*')
            .eq('id', recetteId)
            .single())
            
        } catch (secureError) {
          console.error('Fonction sécurisée échouée:', secureError)
          return { recette: null, error: 'Impossible de créer la recette. Vérifiez vos permissions.' }
        }
      }

      if (error) {
        console.error('Erreur create recette:', error)
        return { recette: null, error: error.message }
      }

      console.log('Recette créée avec succès:', data)
      return { recette: data, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recette: null, error: error.message }
    }
  },

  // Calculer stock nécessaire
  async calculerStockNecessaire(nomProduit, quantite) {
    try {
      const { data, error } = await supabase.rpc('calculer_stock_necessaire', {
        p_nom_produit: nomProduit,
        p_quantite_a_produire: quantite
      })

      if (error) {
        console.error('Erreur calcul stock:', error)
        return { besoins: [], error: error.message }
      }

      return { besoins: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans calculerStockNecessaire:', error)
      return { besoins: [], error: error.message }
    }
  }
}

// ===================== SERVICES STATISTIQUES (CORRIGÉ) =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      // Récupérer les données de base
      const [
        { data: produits },
        { data: demandes },
        { data: productions },
        { data: profiles }
      ] = await Promise.all([
        supabase.from('produits').select('id'),
        supabase.from('demandes').select('id').eq('statut', 'en_attente'),
        supabase.from('productions').select('id').eq('date_production', new Date().toISOString().split('T')[0]),
        supabase.from('profiles').select('id')
      ])

      // Récupérer les stocks critiques séparément pour éviter les erreurs
      let stockFaible = []
      let stockAtelier = []
      
      try {
        const { data: stockFaibleData } = await supabase
          .from('produits')
          .select('id, quantite_restante, quantite')
          .lt('quantite_restante', 10)
        stockFaible = stockFaibleData || []
      } catch (err) {
        console.warn('Erreur stock faible:', err)
      }

      try {
        const { data: stockAtelierData } = await supabase
          .from('vue_stock_atelier_usage')
          .select('id, statut_stock')
          .in('statut_stock', ['critique', 'rupture'])
        stockAtelier = stockAtelierData || []
      } catch (err) {
        console.warn('Erreur stock atelier:', err)
      }

      const stats = {
        total_produits: produits?.length || 0,
        demandes_en_attente: demandes?.length || 0,
        productions_jour: productions?.length || 0,
        utilisateurs_actifs: profiles?.length || 0,
        produits_stock_critique: stockFaible.length,
        stock_atelier_critique: stockAtelier.length,
        efficacite_production: 95
      }

      return { stats, error: null }
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
          utilisateur:profiles(nom)
        `)
        .order('created_at', { ascending: false })
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
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  // Calculer le pourcentage de stock restant
  calculateStockPercentage(quantiteRestante, quantiteInitiale) {
    if (quantiteInitiale === 0) return 0
    return Math.round((quantiteRestante / quantiteInitiale) * 100)
  },

  // Déterminer le niveau d'alerte stock
  getStockAlertLevel(quantiteRestante, quantiteInitiale) {
    const percentage = this.calculateStockPercentage(quantiteRestante, quantiteInitiale)
    if (percentage <= 0) return 'rupture'
    if (percentage <= 20) return 'critique'
    if (percentage <= 50) return 'faible'
    return 'normal'
  },

  // Formater un nombre avec séparateurs
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  }
}

export default supabase


