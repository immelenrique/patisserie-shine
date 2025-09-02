import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

// Dans /patisserie-shine/src/lib/supabase.js
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        // ✅ AJOUT: Vérifier qu'on est côté client
        if (typeof window === 'undefined') {
          return null;
        }
        try {
          const item = localStorage.getItem(key);
          if (item === 'undefined' || item === 'null' || item === '') {
            localStorage.removeItem(key);
            return null;
          }
          return item;
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        // ✅ AJOUT: Vérifier qu'on est côté client
        if (typeof window === 'undefined') {
          return;
        }
        try {
          if (value !== 'undefined' && value !== 'null') {
            localStorage.setItem(key, value);
          }
        } catch {
          console.warn('localStorage non disponible');
        }
      },
      removeItem: (key) => {
        // ✅ AJOUT: Vérifier qu'on est côté client
        if (typeof window === 'undefined') {
          return;
        }
        try {
          localStorage.removeItem(key);
        } catch {
          console.warn('localStorage non disponible');
        }
      }
    }
  }
})

// ===================== UTILS =====================
export const utils = {
  formatCFA(montant) {
    if (montant === null || montant === undefined) return '0 CFA'
    const nombre = parseFloat(montant)
    if (isNaN(nombre)) return '0 CFA'
    return new Intl.NumberFormat('fr-FR').format(Math.round(nombre)) + ' CFA'
  },

  formatDate(date) {
    if (!date) return ''
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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
,
  formatDateTime(date) {
    if (!date) return ''
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  async signInWithUsername(usernameOrEmail, password) {
    try {
      // Déterminer si c'est un email ou un username
      let email = usernameOrEmail;
      
      // Si ce n'est pas un email (pas de @), ajouter le domaine
      if (!usernameOrEmail.includes('@')) {
        email = `${usernameOrEmail}@shine.local`; // CORRECTION: Un seul @
      }
      
      console.log('Tentative de connexion avec:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('Erreur d\'authentification:', error)
        
        // Messages d'erreur plus clairs
        if (error.message.includes('Invalid login credentials')) {
          return { 
            user: null, 
            error: 'Email ou mot de passe incorrect. Vérifiez vos identifiants.' 
          }
        }
        if (error.message.includes('Email not confirmed')) {
          return { 
            user: null, 
            error: 'Email non confirmé. Vérifiez votre boîte mail.' 
          }
        }
        return { user: null, error: error.message }
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur profil:', profileError)
        
        // Si le profil n'existe pas, le créer
        if (profileError.code === 'PGRST116') {
          const username = email.split('@')[0];
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              username: username,
              nom: username,
              role: 'employe_boutique',
              actif: true,
              force_password_change: true
            })
            .select()
            .single()
          
          if (createError) {
            console.error('Erreur création profil:', createError)
            return { user: data.user, error: 'Profil non créé - contactez l\'admin' }
          }
          
          return { user: { ...data.user, ...newProfile }, error: null }
        }
        
        // Pour les autres erreurs de profil
        return { user: data.user, error: 'Profil non chargé - contactez l\'admin' }
      }
      
      // Vérifier si le compte est actif
      if (!profile.actif) {
        await supabase.auth.signOut()
        return { user: null, error: 'Compte désactivé. Contactez l\'administrateur.' }
      }
      
      // Retourner l'utilisateur avec son profil complet
      return { user: { ...data.user, ...profile }, error: null }
      
    } catch (error) {
      console.error('Erreur dans signInWithUsername:', error)
      return { user: null, error: 'Erreur de connexion. Réessayez plus tard.' }
    }
  },
  
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        return { user: null, profile: null, error: error?.message || 'Pas d\'utilisateur connecté' }
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur récupération profil:', profileError)
        return { user, profile: null, error: null }
      }
      
      return { user, profile, error: null }
    } catch (error) {
      console.error('Erreur getCurrentUser:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Erreur déconnexion:', error)
      return { error: error.message }
    }
  },

  async changeInitialPassword(newPassword, userId) {
    try {
      let userIdToUse = userId
      
      if (!userIdToUse) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userIdToUse = user.id
        }
      }
      
      if (!userIdToUse) {
        return { success: false, error: 'Utilisateur non identifié' }
      }

      const response = await fetch('/api/auth/change-initial-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userIdToUse,
          newPassword: newPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Erreur lors du changement de mot de passe' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('Erreur dans changeInitialPassword:', error)
      return { success: false, error: error.message }
    }
  },

  async checkPasswordChangeRequired(userId) {
    try {
      let userIdToCheck = userId
      
      if (!userIdToCheck) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userIdToCheck = user.id
        }
      }
      
      if (!userIdToCheck) {
        return { required: false, error: 'Utilisateur non connecté' }
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('force_password_change, last_password_change')
        .eq('id', userIdToCheck)
        .single()

      if (error) {
        console.error('Erreur vérification changement mot de passe:', error)
        return { required: false, error: error.message }
      }

      const isRequired = profile.force_password_change === true || 
                        profile.last_password_change === null

      return { required: isRequired, error: null }
    } catch (error) {
      console.error('Erreur dans checkPasswordChangeRequired:', error)
      return { required: false, error: error.message }
    }
  },

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        return { session: null, error: error.message }
      }
      return { session, error: null }
    } catch (error) {
      return { session: null, error: error.message }
    }
  }
}

// ===================== SERVICES UTILISATEURS =====================
export const userService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', true)
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

  async getAllIncludingInactive() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('actif', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAllIncludingInactive:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAllIncludingInactive:', error)
      return { users: [], error: error.message }
    }
  },

  async getDeactivatedUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', false)
        .order('updated_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getDeactivatedUsers:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getDeactivatedUsers:', error)
      return { users: [], error: error.message }
    }
  },

async createUser(userData) {
  try {
    // 1. Récupérer la session de l'utilisateur connecté
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Pas de session:', sessionError);
      // Essayer de récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { 
          user: null, 
          error: 'Vous devez être connecté pour créer un utilisateur' 
        };
      }
    }

    // 2. Vérifier que nous avons bien un token
    const token = session?.access_token;
    if (!token) {
      console.error('Pas de token dans la session');
      return { 
        user: null, 
        error: 'Token d\'authentification manquant. Reconnectez-vous.' 
      };
    }

    console.log('Token présent, longueur:', token.length);

    // 3. Appeler votre route API avec le token
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        username: userData.username,
        nom: userData.nom,
        telephone: userData.telephone || '',
        role: userData.role,
        password: userData.password,
        force_password_change: true
      })
    });

    // 4. Traiter la réponse
    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur HTTP:', response.status, data.error);
      
      if (response.status === 401) {
        // Token invalide, forcer reconnexion
        await supabase.auth.signOut();
        window.location.href = '/';
        return { 
          user: null, 
          error: 'Session expirée. Reconnexion en cours...' 
        };
      }
      
      return { 
        user: null, 
        error: data.error || `Erreur ${response.status}` 
      };
    }

    // 5. Succès
    console.log('Utilisateur créé avec succès');
    return { 
      user: data.user, 
      error: null 
    };
    
  } catch (error) {
    console.error('Erreur exception:', error);
    return { 
      user: null, 
      error: 'Erreur de connexion au serveur' 
    };
  }
},
  async updateUser(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return { user: null, error: error.message }
      }

      return { user: data, error: null }
    } catch (error) {
      console.error('Erreur updateUser:', error)
      return { user: null, error: error.message }
    }
  },

// Remplacez UNIQUEMENT la fonction deleteUser existante par celle-ci :
async deleteUser(userId, permanentDelete = false) {
  try {
    if (permanentDelete) {
      // Suppression définitive avec la fonction SQL sécurisée
      const { data, error } = await supabase
        .rpc('safe_delete_user', { p_user_id: userId });

      if (error) {
        console.error('Erreur suppression définitive:', error);
        
        if (error.message.includes('foreign key constraint')) {
          return {
            success: false,
            error: 'Impossible de supprimer : cet utilisateur a des données liées dans le système.'
          };
        }
        
        return {
          success: false,
          error: error.message || 'Erreur lors de la suppression définitive'
        };
      }

      if (data && !data.success) {
        return {
          success: false,
          error: data.error || data.message || 'Erreur lors de la suppression'
        };
      }

      return {
        success: true,
        message: data?.message || 'Utilisateur supprimé définitivement',
        deletionType: 'permanent'
      };

    } else {
      // Désactivation simple (soft delete)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          actif: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Erreur désactivation:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la désactivation'
        };
      }

      return {
        success: true,
        message: 'Utilisateur désactivé avec succès',
        deletionType: 'soft'
      };
    }
  } catch (err) {
    console.error('Erreur générale deleteUser:', err);
    return {
      success: false,
      error: err.message || 'Erreur lors de l\'opération'
    };
  }
},
  async reactivateUser(userId) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ actif: true })
        .eq('id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur reactivateUser:', error)
      return { success: false, error: error.message }
    }
  },

  async changePassword(userId, newPassword) {
    try {
      const { error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      )

      if (error) {
        return { success: false, error: error.message }
      }

      await supabase
        .from('profiles')
        .update({ 
          force_password_change: false,
          last_password_change: new Date().toISOString()
        })
        .eq('id', userId)

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur changePassword:', error)
      return { success: false, error: error.message }
    }
  }
}

// ===================== SERVICES STATISTIQUES =====================
export const statsService = {
  async getDashboardStats() {
    try {
      console.log('📊 Chargement des statistiques du dashboard...')
      
      const { data: produitsData } = await supabase
        .from('produits')
        .select('id, nom, quantite_restante')
        .lt('quantite_restante', 10)
      
      const { data: demandesData } = await supabase
        .from('demandes')
        .select('id')
        .eq('statut', 'en_attente')
      
      const today = new Date().toISOString().split('T')[0]
      const { data: productionsData } = await supabase
        .from('productions')
        .select('id, quantite')
        .eq('date_production', today)
        .eq('statut', 'termine')
      
      const { data: stockAtelierData } = await supabase
        .from('stock_atelier')
        .select('id, quantite_disponible, produit_id')
        .lt('quantite_disponible', 5)
      
      const { count: totalProduits } = await supabase
        .from('produits')
        .select('*', { count: 'exact', head: true })
      
      const totalProductionsQuantite = productionsData?.reduce((sum, p) => sum + (parseFloat(p.quantite) || 0), 0) || 0
      const efficacite = totalProductionsQuantite > 0 ? Math.min(100, Math.round((totalProductionsQuantite / 50) * 100)) : 0
      
      const stats = {
        total_produits: totalProduits || 0,
        produits_stock_critique: produitsData?.length || 0,
        demandes_en_attente: demandesData?.length || 0,
        productions_jour: productionsData?.length || 0,
        stock_atelier_critique: stockAtelierData?.length || 0,
        efficacite_production: efficacite,
        utilisateurs_actifs: 0
      }
      
      console.log('✅ Stats chargées:', stats)
      return { stats, error: null }
      
    } catch (error) {
      console.error('❌ Erreur dans getDashboardStats:', error)
      
      return { 
        stats: {
          total_produits: 0,
          produits_stock_critique: 0,
          demandes_en_attente: 0,
          productions_jour: 0,
          stock_atelier_critique: 0,
          efficacite_production: 0,
          utilisateurs_actifs: 0
        }, 
        error: error.message 
      }
    }
  }
}

// ===================== SERVICES PRODUITS =====================
// ===================== SERVICES PRODUITS =====================
export const productService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message } // Utiliser 'products' partout
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
      return { products: [], error: error.message }
    }
  },

  async createFromReferentiel(referentielId, quantite, dateAchat) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // 1. Récupérer le référentiel
      const { data: referentiel, error: refError } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('id', referentielId)
        .single()
      
      if (refError || !referentiel) {
        return { product: null, error: 'Référentiel non trouvé' }
      }

      // 2. Trouver l'unité correspondante
      const { data: unite, error: uniteError } = await supabase
        .from('unites')
        .select('id')
        .eq('value', referentiel.unite_mesure)
        .single()
      
      if (uniteError || !unite) {
        return { product: null, error: `Unité "${referentiel.unite_mesure}" non trouvée. Créez-la d'abord.` }
      }

      // 3. Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: referentiel.nom,
          date_achat: dateAchat || new Date().toISOString().split('T')[0],
          prix_achat: referentiel.prix_unitaire,
          quantite: parseFloat(quantite),
          quantite_restante: parseFloat(quantite),
          unite_id: unite.id,
          created_by: user?.id
        })
        .select('*, unite:unites(id, value, label)')
        .single()

      if (produitError) {
        console.error('Erreur création produit:', produitError)
        return { product: null, error: produitError.message }
      }

      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans createFromReferentiel:', error)
      return { product: null, error: error.message }
    }
  },

  async createWithPriceOption(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user?.id
        })
        .select('*, unite:unites(id, value, label)')
        .single()

      if (produitError) {
        return { product: null, error: produitError.message }
      }

      // Si prix de vente défini
      if (productData.definir_prix_vente && productData.prix_vente) {
        await supabase
          .from('prix_vente_produits')
          .insert({
            produit_id: produit.id,
            prix: productData.prix_vente,
            marge_pourcentage: ((productData.prix_vente - productData.prix_achat) / productData.prix_achat) * 100,
            actif: true
          })
      }

      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans createWithPriceOption:', error)
      return { product: null, error: error.message }
    }
  },

  async update(productId, updates) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: updates.nom,
          date_achat: updates.date_achat,
          prix_achat: updates.prix_achat,
          quantite: updates.quantite,
          quantite_restante: updates.quantite_restante,
          unite_id: updates.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select('*, unite:unites(id, value, label)')
        .single()

      if (error) {
        return { product: null, error: error.message }
      }

      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update:', error)
      return { product: null, error: error.message }
    }
  }
};
// ===================== SERVICES DEMANDES =====================
// ===================== SERVICES DEMANDES =====================
export const demandeService = {
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
// ===================== SERVICES STOCK ATELIER =====================
export const stockAtelierService = {
  // Récupérer tout le stock atelier SANS prix_vente de produits
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          *,
          produit:produits(
            id, 
            nom,
            prix_achat,
            quantite_restante,
            unite:unites(id, value, label)
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll stock atelier:', error)
        return { stocks: [], error: error.message }
      }
      
      return { stocks: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll stock atelier:', error)
      return { stocks: [], error: error.message }
    }
  },

  // Alias pour compatibilité
  async getStockAtelier() {
    return this.getAll();
  },

  // Récupérer un stock spécifique par produit
  async getByProduitId(produitId) {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          *,
          produit:produits(
            id, 
            nom,
            prix_achat,
            unite:unites(label)
          )
        `)
        .eq('produit_id', produitId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return { stock: null, error: null }
        }
        return { stock: null, error: error.message }
      }
      
      return { stock: data, error: null }
    } catch (error) {
      console.error('Erreur dans getByProduitId:', error)
      return { stock: null, error: error.message }
    }
  },

  // Créer ou ajouter du stock
  async create(stockData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Vérifier si le stock existe déjà
      const { data: existing } = await supabase
        .from('stock_atelier')
        .select('id, quantite_disponible')
        .eq('produit_id', stockData.produit_id)
        .single()
      
      if (existing) {
        // Mettre à jour la quantité existante
        const nouvelleQuantite = (existing.quantite_disponible || 0) + (stockData.quantite_disponible || 0)
        
        const { data, error } = await supabase
          .from('stock_atelier')
          .update({
            quantite_disponible: nouvelleQuantite,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()
        
        if (error) return { stock: null, error: error.message }
        return { stock: data, error: null }
        
      } else {
        // Créer un nouveau stock
        const { data, error } = await supabase
          .from('stock_atelier')
          .insert({
            ...stockData,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (error) return { stock: null, error: error.message }
        return { stock: data, error: null }
      }
      
    } catch (error) {
      console.error('Erreur dans create stock atelier:', error)
      return { stock: null, error: error.message }
    }
  },

  // Mettre à jour le stock
  async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        return { stock: null, error: error.message }
      }
      
      return { stock: data, error: null }
    } catch (error) {
      console.error('Erreur dans update stock atelier:', error)
      return { stock: null, error: error.message }
    }
  },

  // Supprimer un stock
  async delete(id) {
    try {
      const { error } = await supabase
        .from('stock_atelier')
        .delete()
        .eq('id', id)
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans delete stock atelier:', error)
      return { success: false, error: error.message }
    }
  },

  // Historique des transferts - utiliser les demandes
  async getHistoriqueTransferts(produitId = null) {
    try {
      // Utiliser la table demandes pour l'historique
      let query = supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(
            id,
            nom,
            unite:unites(label)
          ),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
        `)
        .eq('destination', 'Production')
        .in('statut', ['validee', 'partiellement_validee'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (produitId) {
        query = query.eq('produit_id', produitId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { historique: [], error: error.message }
      }

      return { historique: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { historique: [], error: error.message }
    }
  },

  // Transférer du stock vers la boutique
  async transfererVersBoutique(produitId, quantite, prixVente = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Vérifier le stock disponible
      const { data: stockAtelier } = await supabase
        .from('stock_atelier')
        .select('id, quantite_disponible')
        .eq('produit_id', produitId)
        .single()
      
      if (!stockAtelier || stockAtelier.quantite_disponible < quantite) {
        return { 
          success: false, 
          error: 'Stock insuffisant dans l\'atelier' 
        }
      }
      
      // Réduire le stock atelier
      const { error: updateError } = await supabase
        .from('stock_atelier')
        .update({
          quantite_disponible: stockAtelier.quantite_disponible - quantite,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockAtelier.id)
      
      if (updateError) {
        return { success: false, error: updateError.message }
      }
      
      // Ajouter au stock boutique
      const { data: stockBoutique } = await supabase
        .from('stock_boutique')
        .select('id, quantite_disponible')
        .eq('produit_id', produitId)
        .single()
      
      if (stockBoutique) {
        // Mettre à jour le stock existant
        const updateData = {
          quantite_disponible: (stockBoutique.quantite_disponible || 0) + quantite,
          updated_at: new Date().toISOString()
        }
        
        // Ajouter le prix_vente si fourni
        if (prixVente !== null) {
          updateData.prix_vente = prixVente
        }
        
        await supabase
          .from('stock_boutique')
          .update(updateData)
          .eq('id', stockBoutique.id)
      } else {
        // Créer un nouveau stock boutique
        const insertData = {
          produit_id: produitId,
          quantite_disponible: quantite,
          transfere_par: user?.id,
          created_at: new Date().toISOString()
        }
        
        // Ajouter le prix_vente si fourni
        if (prixVente !== null) {
          insertData.prix_vente = prixVente
        }
        
        await supabase
          .from('stock_boutique')
          .insert(insertData)
      }
      
      // Enregistrer dans mouvements_stock si la table existe
      await supabase
        .from('mouvements_stock')
        .insert({
          produit_id: produitId,
          type_mouvement: 'transfert',
          quantite: quantite,
          source: 'Atelier',
          destination: 'Boutique',
          utilisateur_id: user?.id,
          created_at: new Date().toISOString()
        })
      
      return { success: true, error: null }
      
    } catch (error) {
      console.error('Erreur dans transfererVersBoutique:', error)
      return { success: false, error: error.message }
    }
  },

  // Calculer les statistiques (sans prix_vente)
  async getStatistiques() {
    try {
      const { data: stocks, error } = await supabase
        .from('stock_atelier')
        .select(`
          quantite_disponible,
          produit:produits(
            nom,
            prix_achat
          )
        `)
      
      if (error) {
        return { stats: null, error: error.message }
      }
      
      const stats = {
        totalProduits: stocks?.length || 0,
        stockFaible: stocks?.filter(s => s.quantite_disponible < 5).length || 0,
        // Utiliser prix_achat pour calculer la valeur
        valeurTotale: stocks?.reduce((sum, s) => {
          const prix = s.produit?.prix_achat || 0
          return sum + (s.quantite_disponible * prix)
        }, 0) || 0
      }
      
      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getStatistiques:', error)
      return { stats: null, error: error.message }
    }
  }
}
// ===================== SERVICES STOCK BOUTIQUE =====================
export const stockBoutiqueService = {
  // Récupérer l'état du stock boutique (VERSION CORRIGÉE)
  async getStockBoutique() {
    try {
      console.log('🔄 Récupération stock boutique avec type_produit...');
      
      // Requête directe pour s'assurer d'avoir type_produit
      const { data, error } = await supabase
        .from('stock_boutique')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          quantite_vendue,
          quantite_utilisee,
          prix_vente,
          type_produit,
          nom_produit,
          transfere_par,
          created_at,
          updated_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erreur récupération stock_boutique:', error);
        return { stock: [], error: error.message };
      }
      
      // Formater les données en s'assurant d'inclure type_produit
      const stockFormate = (data || []).map(item => {
        const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0) - (item.quantite_utilisee || 0);
        return {
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.nom_produit || item.produits?.nom || `Produit ${item.produit_id}`,
          unite: item.produits?.unites?.label || 'unité',
          quantite_disponible: item.quantite_disponible || 0,
          quantite_vendue: item.quantite_vendue || 0,
          quantite_utilisee: item.quantite_utilisee || 0,
          stock_reel: stockReel,
          prix_vente: item.prix_vente || 0,
          valeur_stock: stockReel * (item.prix_vente || 0),
          statut_stock: this.calculateStockStatus(stockReel),
          prix_defini: (item.prix_vente && item.prix_vente > 0),
          type_produit: item.type_produit, // IMPORTANT : Inclure type_produit
          transfere_par: item.transfere_par,
          created_at: item.created_at,
          updated_at: item.updated_at,
          derniere_maj: item.updated_at
        };
      });
      
      console.log('✅ Stock formaté avec types:', stockFormate.map(s => ({ 
        nom: s.nom_produit, 
        type: s.type_produit 
      })));
      
      return { stock: stockFormate, error: null };
      
    } catch (error) {
      console.error('Erreur dans getStockBoutique:', error);
      return { stock: [], error: error.message };
    }
  },

  // Fonction utilitaire pour calculer le statut du stock
  calculateStockStatus(stockReel) {
    if (stockReel <= 0) return 'rupture'
    if (stockReel <= 5) return 'critique'
    if (stockReel <= 10) return 'faible'
    return 'normal'
  },

  // Synchroniser les prix avec les prix de recettes (VERSION CORRIGÉE - pas de duplication)
  async synchroniserPrixRecettes() {
    try {
      console.log('🔄 Synchronisation forcée des prix recettes...');

      // Récupérer tous les prix de recettes actifs
      const { data: prixRecettes, error: prixError } = await supabase
        .from('prix_vente_recettes')
        .select('nom_produit, prix_vente')
        .eq('actif', true);

      if (prixError || !prixRecettes) {
        return { success: false, error: 'Erreur récupération prix recettes' };
      }

      let corrections = 0;

      // Mettre à jour chaque produit en boutique
      for (const prixRecette of prixRecettes) {
        const { data: stockBoutique } = await supabase
          .from('stock_boutique')
          .select('id, prix_vente')
          .eq('nom_produit', prixRecette.nom_produit)
          .single();

        if (stockBoutique && stockBoutique.prix_vente !== prixRecette.prix_vente) {
          // Corriger le prix
          const { error: updateError } = await supabase
            .from('stock_boutique')
            .update({ 
              prix_vente: prixRecette.prix_vente,
              updated_at: new Date().toISOString()
            })
            .eq('id', stockBoutique.id);

          if (!updateError) {
            console.log(`✅ Prix corrigé pour ${prixRecette.nom_produit}: ${utils.formatCFA(stockBoutique.prix_vente)} → ${utils.formatCFA(prixRecette.prix_vente)}`);
            corrections++;
          }
        }
      }

      console.log(`🎉 ${corrections} prix synchronisés`);
      return { success: true, corrections };
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      return { success: false, error: error.message };
    }
  },

  // Obtenir l'historique des entrées
  async getHistoriqueEntrees(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('entrees_boutique')
        .select(`
          id,
          produit_id,
          quantite,
          source,
          type_entree,
          created_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Erreur getHistoriqueEntrees:', error)
        return { entrees: [], error: error.message }
      }

      const entreesFormatees = (data || []).map(item => ({
        ...item,
        nom_produit: item.produits?.nom || 'Produit inconnu',
        unite: item.produits?.unites?.label || 'unité'
      }))

      return { entrees: entreesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueEntrees:', error)
      return { entrees: [], error: error.message }
    }
  },

  // Obtenir l'historique des sorties
  async getHistoriqueSorties(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('sorties_boutique')
        .select(`
          id,
          vente_id,
          produit_id,
          quantite,
          prix_unitaire,
          total,
          created_at,
          ventes (
            vendeur:profiles (
              nom
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Erreur getHistoriqueSorties:', error)
        return { sorties: [], error: error.message }
      }

      const sortiesFormatees = (data || []).map(item => ({
        ...item,
        vendeur: item.ventes?.vendeur
      }))

      return { sorties: sortiesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueSorties:', error)
      return { sorties: [], error: error.message }
    }
  },

  async updatePrixVente(stockId, nouveauPrix) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      if (!nouveauPrix || parseFloat(nouveauPrix) < 0) {
        return { success: false, error: 'Prix invalide' };
      }

      // Mettre à jour le prix dans stock_boutique
      const { data: stockMisAJour, error: stockError } = await supabase
        .from('stock_boutique')
        .update({
          prix_vente: parseFloat(nouveauPrix),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId)
        .select()
        .single();

      if (stockError) {
        console.error('Erreur mise à jour prix stock_boutique:', stockError);
        return { success: false, error: stockError.message };
      }

      // Synchroniser avec prix_vente_produits si le produit a un produit_id
      if (stockMisAJour.produit_id) {
        try {
          const { error: syncError } = await supabase
            .from('prix_vente_produits')
            .upsert({
              produit_id: stockMisAJour.produit_id,
              prix: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            });

          if (syncError) {
            console.warn('Erreur synchronisation prix_vente_produits:', syncError);
          }
        } catch (syncException) {
          console.warn('Exception synchronisation prix_vente_produits:', syncException);
        }
      }

      // Synchroniser avec prix_vente_recettes si c'est un produit de recette
      if (stockMisAJour.nom_produit) {
        try {
          const { error: recetteError } = await supabase
            .from('prix_vente_recettes')
            .upsert({
              nom_produit: stockMisAJour.nom_produit,
              prix_vente: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            });

          if (recetteError) {
            console.warn('Erreur synchronisation prix_vente_recettes:', recetteError);
          }
        } catch (recetteException) {
          console.warn('Exception synchronisation prix_vente_recettes:', recetteException);
        }
      }

      return { 
        success: true, 
        message: `Prix mis à jour: ${utils.formatCFA(parseFloat(nouveauPrix))}`,
        data: stockMisAJour
      };
    } catch (error) {
      console.error('Erreur dans updatePrixVente:', error);
      return { success: false, error: error.message };
    }
  },

  // Obtenir les produits sans prix défini
  async getProduitsEtsSansPrix() {
    try {
      const { data, error } = await supabase
        .from('stock_boutique')
        .select('*')
        .or('prix_vente.is.null,prix_vente.eq.0')
        .gt('quantite_disponible', 0)
        .order('nom_produit');

      if (error) {
        return { produits: [], error: error.message };
      }

      return { produits: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getProduitsEtsSansPrix:', error);
      return { produits: [], error: error.message };
    }
  }
}


// ===================== SERVICES PRIX =====================
export const prixService = {
  async getPrixVente() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_produits')
        .select(`
          *,
          produit:produits(nom, prix_achat, unite:unites(label))
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getPrixVente:', error)
        return { prix: [], error: error.message }
      }
      
      const prixFormates = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        prix_vente: item.prix,
        marge: item.prix - (item.produit?.prix_achat || 0),
        pourcentage_marge: item.marge_pourcentage || 0,
        produit: item.produit,
        created_at: item.created_at
      }))
      
      return { prix: prixFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVente:', error)
      return { prix: [], error: error.message }
    }
  },

  async setPrixVente(produitId, prix) {
    try {
      const { data: produit } = await supabase
        .from('produits')
        .select('prix_achat')
        .eq('id', produitId)
        .single()

      const marge = prix - (produit?.prix_achat || 0)
      const margePourcentage = produit?.prix_achat > 0 
        ? ((marge / produit.prix_achat) * 100).toFixed(2)
        : 0

      const { data, error } = await supabase
        .from('prix_vente_produits')
        .upsert({
          produit_id: produitId,
          prix: prix,
          marge_pourcentage: margePourcentage,
          actif: true
        })
        .select()
        .single()

      if (error) {
        return { prix: null, error: error.message }
      }

      return { prix: data, error: null }
    } catch (error) {
      console.error('Erreur dans setPrixVente:', error)
      return { prix: null, error: error.message }
    }
  },

  async getPrixVenteRecettes() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_recettes')
        .select('*')
        .eq('actif', true)
        .order('nom_produit')

      if (error) {
        return { prix: [], error: error.message }
      }

      return { prix: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVenteRecettes:', error)
      return { prix: [], error: error.message }
    }
  },

  async setPrixVenteRecette(nomProduit, prixVente) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('prix_vente_recettes')
        .upsert({
          nom_produit: nomProduit,
          prix_vente: prixVente,
          defini_par: user?.id,
          actif: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'nom_produit'
        })
        .select()
        .single()

      if (error) {
        return { prix: null, error: error.message }
      }

      return { prix: data, error: null }
    } catch (error) {
      console.error('Erreur dans setPrixVenteRecette:', error)
      return { prix: null, error: error.message }
    }
  }
}
// ===================== SERVICES CAISSE (VERSION CORRIGÉE - UNE SEULE DÉFINITION) =====================
export const caisseService = {
  // Vérifier la disponibilité des produits avec prix
  async getProduitsDisponiblesCaisse() {
    try {
      const { data: stockBoutique, error } = await supabase
        .from('stock_boutique')
        .select(`
          produit_id,
          nom_produit,
          quantite_disponible,
          quantite_vendue,
          prix_vente,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .gt('quantite_disponible', 0)
        .not('prix_vente', 'is', null)
        .gt('prix_vente', 0)

      if (error) {
        return { produits: [], error: error.message }
      }

      const produitsFormates = (stockBoutique || []).map(item => {
        const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0)
        return {
          id: item.produit_id,
          nom_produit: item.nom_produit || item.produits?.nom || 'Produit',
          unite: item.produits?.unites?.label || 'unité',
          stock_reel: stockReel,
          prix_vente: item.prix_vente,
          prix_defini: true
        }
      }).filter(p => p.stock_reel > 0)

      return { produits: produitsFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsDisponiblesCaisse:', error)
      return { produits: [], error: error.message }
    }
  },

  // Enregistrer une vente
  async enregistrerVente(venteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { vente: null, error: 'Utilisateur non connecté' }
      }

      const numeroTicket = 'V-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)

      // Créer la vente
      const { data: vente, error: venteError } = await supabase
        .from('ventes')
        .insert({
          numero_ticket: numeroTicket,
          total: venteData.total,
          montant_donne: venteData.montant_donne,
          monnaie_rendue: venteData.monnaie_rendue,
          vendeur_id: venteData.vendeur_id || user.id,
          statut: 'validee'
        })
        .select()
        .single()

      if (venteError) throw venteError

      // Traiter chaque article
      for (const item of venteData.items) {
        // Insérer la ligne de vente
        await supabase
          .from('lignes_vente')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            nom_produit: item.nom,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })

        // Insérer dans les sorties boutique
        await supabase
          .from('sorties_boutique')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })

        // Mettre à jour le stock boutique
        const { data: stockActuel } = await supabase
          .from('stock_boutique')
          .select('quantite_vendue')
          .eq('produit_id', item.id)
          .single()

        if (stockActuel) {
          await supabase
            .from('stock_boutique')
            .update({
              quantite_vendue: (stockActuel.quantite_vendue || 0) + item.quantite,
              updated_at: new Date().toISOString()
            })
            .eq('produit_id', item.id)
        }
      }

      return { 
        vente: {
          ...vente,
          items: venteData.items
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur enregistrerVente:', error)
      return { vente: null, error: error.message }
    }
  },

  async getVentesPeriode(dateDebut, dateFin) {
    try {
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          id,
          numero_ticket,
          total,
          montant_donne,
          monnaie_rendue,
          created_at,
          vendeur:profiles!ventes_vendeur_id_fkey(nom)
        `)
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getVentesPeriode:', error)
        return { ventes: [], error: error.message }
      }

      // Récupérer les items pour chaque vente
      const ventesAvecItems = await Promise.all(
        (ventes || []).map(async (vente) => {
          try {
            const { data: items } = await supabase
              .from('lignes_vente')
              .select('*')
              .eq('vente_id', vente.id)

            return { ...vente, items: items || [] }
          } catch (err) {
            return { ...vente, items: [] }
          }
        })
      )

      return { ventes: ventesAvecItems, error: null }
    } catch (error) {
      console.error('Erreur dans getVentesPeriode:', error)
      return { ventes: [], error: error.message }
    }
  },

  // Obtenir les ventes du jour
  async getVentesJour(date = null) {
    try {
      const dateRecherche = date || new Date().toISOString().split('T')[0]

      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          id,
          numero_ticket,
          total,
          montant_donne,
          monnaie_rendue,
          created_at,
          vendeur:profiles!ventes_vendeur_id_fkey(nom)
        `)
        .gte('created_at', dateRecherche + 'T00:00:00.000Z')
        .lt('created_at', dateRecherche + 'T23:59:59.999Z')
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getVentesJour:', error)
        return { ventes: [], error: error.message }
      }

      // Récupérer les items pour chaque vente
      const ventesAvecItems = await Promise.all(
        (ventes || []).map(async (vente) => {
          try {
            const { data: items } = await supabase
              .from('lignes_vente')
              .select('*')
              .eq('vente_id', vente.id)

            return { ...vente, items: items || [] }
          } catch (err) {
            return { ...vente, items: [] }
          }
        })
      )

      return { ventes: ventesAvecItems, error: null }
    } catch (error) {
      console.error('Erreur dans getVentesJour:', error)
      return { ventes: [], error: error.message }
    }
  },

  // Obtenir les produits les plus vendus
  async getProduitsTopVentes(limit = 10, periode = 'mois') {
    try {
      let dateDebut = '';
      const aujourdhui = new Date();

      // Calculer la période selon le paramètre
      if (periode === 'semaine') {
        const semaineDerniere = new Date(aujourdhui.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateDebut = semaineDerniere.toISOString().split('T')[0];
      } else if (periode === 'mois') {
        const moisDernier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
        dateDebut = moisDernier.toISOString().split('T')[0];
      } else if (periode === 'annee') {
        const anneeDerniere = new Date(aujourdhui.getFullYear(), 0, 1);
        dateDebut = anneeDerniere.toISOString().split('T')[0];
      } else {
        // Par défaut, derniers 30 jours
        const trenteDerniers = new Date(aujourdhui.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateDebut = trenteDerniers.toISOString().split('T')[0];
      }

      const dateFin = aujourdhui.toISOString().split('T')[0];

      // Récupérer les lignes de vente pour la période
      const { data: lignesVente, error } = await supabase
        .from('lignes_vente')
        .select(`
          nom_produit,
          quantite,
          prix_unitaire,
          total,
          created_at
        `)
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erreur getProduitsTopVentes:', error)
        return { produits: [], error: error.message }
      }

      // Grouper par produit et calculer les totaux
      const produitsGroupes = {}

      lignesVente.forEach(ligne => {
        const nom = ligne.nom_produit
        if (!produitsGroupes[nom]) {
          produitsGroupes[nom] = {
            nom_produit: nom,
            quantite_vendue: 0,
            chiffre_affaires: 0,
            nombre_ventes: 0
          }
        }

        produitsGroupes[nom].quantite_vendue += ligne.quantite || 0
        produitsGroupes[nom].chiffre_affaires += ligne.total || 0
        produitsGroupes[nom].nombre_ventes += 1
      })

      // Convertir en tableau et trier par chiffre d'affaires
      const produitsArray = Object.values(produitsGroupes)
        .sort((a, b) => b.chiffre_affaires - a.chiffre_affaires)
        .slice(0, limit)

      return { produits: produitsArray, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsTopVentes:', error)
      return { produits: [], error: error.message }
    }
  }
} 



// ===================== SERVICES COMPTABILITÉ (VERSION CORRIGÉE - UNE SEULE DÉFINITION) =====================
export const comptabiliteService = {
  // Calculer les vraies dépenses depuis la base de données
  async getDepensesReelles(dateDebut, dateFin) {
    try {
      let depensesStock = 0
      let detailsDepensesStock = []

      // 1. Dépenses d'achat de matières premières (achats de produits)
      try {
        const { data: produits, error: produitsError } = await supabase
          .from('produits')
          .select('nom, prix_achat, quantite, date_achat, created_at')
          .gte('date_achat', dateDebut)
          .lte('date_achat', dateFin)

        if (!produitsError && produits) {
          depensesStock = produits.reduce((sum, p) => 
            sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0
          )
          detailsDepensesStock = produits.map(p => ({
            date: p.date_achat || p.created_at,
            type: 'achat_matiere_premiere',
            description: `Achat ${p.nom} - ${p.quantite} unités`,
            montant: (p.prix_achat || 0) * (p.quantite || 0)
          }))
        }
      } catch (stockErr) {
        console.warn('Erreur calcul dépenses stock:', stockErr)
      }

      // 2. Coût des ingrédients utilisés en production (consommations réelles)
      let coutIngredients = 0
      let detailsIngredients = []

      try {
        // Calculer le coût basé sur les productions ET les prix d'achat des ingrédients
        const { data: productions, error: prodError } = await supabase
          .from('productions')
          .select(`
            id,
            produit,
            quantite,
            date_production,
            cout_ingredients
          `)
          .gte('date_production', dateDebut)
          .lte('date_production', dateFin)

        if (!prodError && productions) {
          for (const production of productions) {
            let coutProduction = 0

            // Si le coût est déjà calculé, l'utiliser
            if (production.cout_ingredients) {
              coutProduction = production.cout_ingredients
            } else {
              // Sinon, calculer à partir des recettes
              try {
                const { data: recettes } = await supabase
                  .from('recettes')
                  .select(`
                    quantite_necessaire,
                    produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
                      nom, prix_achat, quantite
                    )
                  `)
                  .eq('nom_produit', production.produit)

                if (recettes && recettes.length > 0) {
                  coutProduction = recettes.reduce((sum, recette) => {
                    const produit = recette.produit_ingredient
                    if (produit && produit.prix_achat && produit.quantite) {
                      const coutUnitaire = produit.prix_achat / produit.quantite
                      return sum + (coutUnitaire * recette.quantite_necessaire * production.quantite)
                    }
                    return sum
                  }, 0)
                }
              } catch (recetteError) {
                console.warn('Erreur calcul coût recette:', recetteError)
              }
            }

            coutIngredients += coutProduction

            if (coutProduction > 0) {
              detailsIngredients.push({
                date: production.date_production,
                type: 'cout_production',
                description: `Production ${production.produit} (${production.quantite} unités)`,
                montant: coutProduction
              })
            }
          }
        }
      } catch (err) {
        console.warn('Erreur calcul coût ingrédients:', err)
      }

      // 3. Autres dépenses depuis la table depenses_comptables si elle existe
      let autresDepenses = 0
      let detailsAutres = []

      try {
        const { data: depenses, error: depensesError } = await supabase
          .from('depenses_comptables')
          .select('*')
          .gte('date_depense', dateDebut)
          .lte('date_depense', dateFin)

        if (!depensesError && depenses) {
          autresDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0)
          detailsAutres = depenses.map(d => ({
            date: d.date_depense,
            type: d.type_depense || 'autre',
            description: d.description || 'Dépense',
            montant: d.montant || 0
          }))
        }
      } catch (depensesErr) {
        // Table peut ne pas exister, ce n'est pas grave
        console.info('Table depenses_comptables non disponible')
      }

      const totalDepenses = depensesStock + coutIngredients + autresDepenses

      const details = [
        ...detailsDepensesStock,
        ...detailsIngredients,
        ...detailsAutres
      ].filter(d => d.montant > 0).sort((a, b) => new Date(b.date) - new Date(a.date))

      return { 
        depenses: totalDepenses, 
        details, 
        repartition: {
          depenses_achat_matieres: depensesStock,
          cout_ingredients_production: coutIngredients,
          autres_depenses: autresDepenses
        },
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans getDepensesReelles:', error)
      return { 
        depenses: 0, 
        details: [], 
        repartition: { 
          depenses_achat_matieres: 0, 
          cout_ingredients_production: 0, 
          autres_depenses: 0 
        },
        error: error.message 
      }
    }
  },

  // Calculer les vraies recettes (chiffre d'affaires)
  async getRecettesReelles(dateDebut, dateFin) {
    try {
      const ventesResult = await caisseService.getVentesPeriode(dateDebut, dateFin)
      const ventes = ventesResult.ventes || []

      const chiffreAffaires = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
      const nombreVentes = ventes.length
      const ticketMoyen = nombreVentes > 0 ? chiffreAffaires / nombreVentes : 0

      // Calculer les articles vendus
      const articlesVendus = ventes.reduce((sum, v) => 
        sum + (v.items?.reduce((s, i) => s + (i.quantite || 0), 0) || 0), 0)

      return {
        chiffre_affaires: chiffreAffaires,
        nombre_transactions: nombreVentes,
        ticket_moyen: ticketMoyen,
        articles_vendus: articlesVendus,
        ventes_details: ventes,
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRecettesReelles:', error)
      return {
        chiffre_affaires: 0,
        nombre_transactions: 0,
        ticket_moyen: 0,
        articles_vendus: 0,
        ventes_details: [],
        error: error.message
      }
    }
  },

  async enregistrerDepenseStock(productData, userId) {
    try {
      // Calculer le montant total de la dépense
      const montantTotal = (productData.prix_achat || 0) * (productData.quantite || 0)

      if (montantTotal <= 0) {
        return { depense: null, error: 'Montant de dépense invalide' }
      }

      const { data: depense, error } = await supabase
        .from('depenses_comptables')
        .insert({
          type_depense: 'achat_matiere_premiere',
          description: `Achat ${productData.nom} - ${productData.quantite} ${productData.unite?.label || 'unités'}`,
          montant: montantTotal,
          date_depense: productData.date_achat || new Date().toISOString().split('T')[0],
          utilisateur_id: userId,
          details: {
            produit_nom: productData.nom,
            quantite: productData.quantite,
            prix_unitaire: productData.prix_achat / productData.quantite,
            unite: productData.unite?.label
          }
        })
        .select()
        .single()

      if (error) {
        console.error('Erreur enregistrement dépense stock:', error)
        return { depense: null, error: error.message }
      }

      return { depense, error: null }
    } catch (error) {
      console.error('Erreur dans enregistrerDepenseStock:', error)
      return { depense: null, error: error.message }
    }
  },

  // Rapport comptable avec calculs corrects
  async getRapportComptable(dateDebut, dateFin) {
    try {
      // 1. Récupérer les vraies recettes
      const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)
      if (recettesResult.error) {
        console.error('Erreur recettes:', recettesResult.error)
      }

      // 2. Récupérer les vraies dépenses
      const depensesResult = await this.getDepensesReelles(dateDebut, dateFin)
      if (depensesResult.error) {
        console.error('Erreur dépenses:', depensesResult.error)
      }

      const chiffreAffaires = recettesResult.chiffre_affaires || 0
      const totalDepenses = depensesResult.depenses || 0

      // 3. Calculer la marge correctement
      const margeBrute = chiffreAffaires - totalDepenses
      const pourcentageMarge = chiffreAffaires > 0 ? (margeBrute / chiffreAffaires) * 100 : 0

      // 4. Vérification des calculs
      console.log('📊 Calculs comptables:', {
        periode: `${dateDebut} → ${dateFin}`,
        chiffreAffaires: chiffreAffaires,
        totalDepenses: totalDepenses,
        margeBrute: margeBrute,
        pourcentageMarge: pourcentageMarge.toFixed(2) + '%'
      })

      return {
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: Math.round(chiffreAffaires * 100) / 100,
          depenses: Math.round(totalDepenses * 100) / 100,
          marge_brute: Math.round(margeBrute * 100) / 100,
          pourcentage_marge: Math.round(pourcentageMarge * 100) / 100
        },
        ventes: {
          nombre_transactions: recettesResult.nombre_transactions || 0,
          ticket_moyen: Math.round((recettesResult.ticket_moyen || 0) * 100) / 100,
          articles_vendus: recettesResult.articles_vendus || 0
        },
        depenses_details: depensesResult.details || [],
        repartition_depenses: depensesResult.repartition || {},
        ventes_details: recettesResult.ventes_details || [],
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRapportComptable:', error)
      return { 
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: 0,
          depenses: 0,
          marge_brute: 0,
          pourcentage_marge: 0
        },
        ventes: {
          nombre_transactions: 0,
          ticket_moyen: 0,
          articles_vendus: 0
        },
        depenses_details: [],
        repartition_depenses: {},
        ventes_details: [],
        error: error.message 
      }
    }
  },

  // Test des données - méthode utilitaire pour debug
  async testDonneesComptables(dateDebut, dateFin) {
    try {
      console.log('🔍 Test des données comptables pour:', dateDebut, '→', dateFin)

      // Test ventes
      const { data: ventes } = await supabase
        .from('ventes')
        .select('*')
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')

      console.log('💰 Ventes trouvées:', ventes?.length || 0)
      if (ventes && ventes.length > 0) {
        const totalVentes = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
        console.log('💰 Total ventes:', totalVentes, 'CFA')
      }

      // Test produits (achats)
      const { data: produits } = await supabase
        .from('produits')
        .select('*')
        .gte('date_achat', dateDebut)
        .lte('date_achat', dateFin)

      console.log('📦 Achats de produits:', produits?.length || 0)
      if (produits && produits.length > 0) {
        const totalAchats = produits.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0)
        console.log('📦 Total achats:', totalAchats, 'CFA')
      }

      // Test productions
      const { data: productions } = await supabase
        .from('productions')
        .select('*')
        .gte('date_production', dateDebut)
        .lte('date_production', dateFin)

      console.log('🏭 Productions:', productions?.length || 0)

      return {
        ventes: ventes || [],
        produits: produits || [],
        productions: productions || []
      }
    } catch (error) {
      console.error('Erreur test données:', error)
      return null
    }
  },

  // Evolution mensuelle
  async getEvolutionMensuelle(annee) {
    try {
      const evolution = []

      for (let mois = 1; mois <= 12; mois++) {
        const dateDebut = `${annee}-${mois.toString().padStart(2, '0')}-01`
        const dateFin = `${annee}-${mois.toString().padStart(2, '0')}-${new Date(annee, mois, 0).getDate()}`

        const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)

        evolution.push({
          mois: mois,
          chiffre_affaires: recettesResult.chiffre_affaires || 0,
          nb_ventes: recettesResult.nombre_transactions || 0
        })
      }

      return { evolution, error: null }
    } catch (error) {
      console.error('Erreur dans getEvolutionMensuelle:', error)
      return { evolution: [], error: error.message }
    }
  },

  // Export des données comptables
  async exporterDonneesComptables(dateDebut, dateFin, format = 'csv') {
    try {
      const rapport = await this.getRapportComptable(dateDebut, dateFin)

      if (rapport.error) {
        return { success: false, error: rapport.error }
      }

      const donnees = { rapport }

      if (format === 'csv') {
        const csvContent = this.genererCSV(donnees)
        return { 
          success: true, 
          content: csvContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.csv` 
        }
      } else {
        const jsonContent = JSON.stringify(donnees, null, 2)
        return { 
          success: true, 
          content: jsonContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.json` 
        }
      }
    } catch (error) {
      console.error('Erreur dans exporterDonneesComptables:', error)
      return { success: false, error: error.message }
    }
  },

  // Générer CSV
  genererCSV(donnees) {
    const lignes = []
    const rapport = donnees.rapport

    lignes.push('RAPPORT COMPTABLE PATISSERIE SHINE')
    lignes.push(`Période: ${rapport.periode.debut} - ${rapport.periode.fin}`)
    lignes.push(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`)
    lignes.push('')
    lignes.push('RESUME FINANCIER')
    lignes.push('Indicateur,Montant CFA')
    lignes.push(`Chiffre d'affaires,${rapport.finances.chiffre_affaires}`)
    lignes.push(`Dépenses totales,${rapport.finances.depenses}`)
    lignes.push(`Marge brute,${rapport.finances.marge_brute}`)
    lignes.push(`Pourcentage marge,${rapport.finances.pourcentage_marge}%`)
    lignes.push('')
    lignes.push('REPARTITION DES DEPENSES')
    lignes.push('Type,Montant CFA')
    if (rapport.repartition_depenses) {
      Object.entries(rapport.repartition_depenses).forEach(([type, montant]) => {
        lignes.push(`${type},${montant}`)
      })
    }
    lignes.push('')
    lignes.push('ACTIVITE COMMERCIALE')
    lignes.push('Indicateur,Valeur')
    lignes.push(`Nombre de transactions,${rapport.ventes.nombre_transactions}`)
    lignes.push(`Ticket moyen,${rapport.ventes.ticket_moyen}`)
    lignes.push(`Articles vendus,${rapport.ventes.articles_vendus}`)

    if (rapport.depenses_details && rapport.depenses_details.length > 0) {
      lignes.push('')
      lignes.push('DETAILS DES DEPENSES')
      lignes.push('Date,Type,Description,Montant CFA')
      rapport.depenses_details.forEach(depense => {
        lignes.push(`${depense.date},${depense.type},${depense.description.replace(/,/g, ';')},${depense.montant}`)
      })
    }

    return lignes.join('\n')
  }
}
// ===================== SERVICES PRODUCTION =====================
export const productionService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .order('date_production', { ascending: false })
      
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

  async createProduction(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('productions')
        .insert({
          produit: productionData.produit,
          quantite: productionData.quantite,
          destination: productionData.destination || 'Boutique',
          date_production: productionData.date_production || new Date().toISOString().split('T')[0],
          statut: 'termine',
          producteur_id: user?.id,
          cout_ingredients: productionData.cout_ingredients || 0
        })
        .select()
        .single()

      if (error) {
        return { production: null, error: error.message }
      }

      if (productionData.destination === 'Boutique' && productionData.prix_vente) {
        await prixService.setPrixVenteRecette(productionData.produit, productionData.prix_vente)
        await stockBoutiqueService.transferer(
          productionData.produit,
          productionData.quantite,
          productionData.prix_vente
        )
      }

      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans createProduction:', error)
      return { production: null, error: error.message }
    }
  },

  async create(productData) {
    return this.createProduction(productData)
  }
}
// ===================== SERVICES RECETTES =====================
export const recetteService = {
  async getAll() {
    try {
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
      
      const recettesFormatees = (data || []).map(recette => ({
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
        created_at: recette.created_at,
        updated_at: recette.updated_at
      }))
      
      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

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

  async calculerBesoins(nomProduit, quantite) {
    try {
      const { data: recettes } = await supabase
        .from('recettes')
        .select(`
          *,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, quantite_restante, unite:unites(label)
          )
        `)
        .eq('nom_produit', nomProduit)

      if (!recettes || recettes.length === 0) {
        return { besoins: [], error: 'Aucune recette trouvée pour ce produit' }
      }

      const besoins = recettes.map(ingredient => ({
        ingredient: ingredient.produit_ingredient.nom,
        quantite_necessaire: ingredient.quantite_necessaire * quantite,
        quantite_disponible: ingredient.produit_ingredient.quantite_restante,
        unite: ingredient.produit_ingredient.unite?.label || '',
        suffisant: ingredient.produit_ingredient.quantite_restante >= (ingredient.quantite_necessaire * quantite)
      }))

      return { besoins, error: null }
    } catch (error) {
      console.error('Erreur dans calculerBesoins:', error)
      return { besoins: [], error: error.message }
    }
  }
}     
// ===================== SERVICES RÉFÉRENTIEL =====================
// ===================== SERVICES RÉFÉRENTIEL =====================
export const referentielService = {
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

  async create(referentielData) {
    try {
      const dataToInsert = {
        reference: referentielData.reference,
        nom: referentielData.nom,
        type_conditionnement: referentielData.type_conditionnement,
        unite_mesure: referentielData.unite_mesure,
        quantite_par_conditionnement: parseFloat(referentielData.quantite_par_conditionnement),
        prix_achat_total: parseFloat(referentielData.prix_achat_total)
      };

      console.log('Données à insérer dans référentiel:', dataToInsert);

      const { data, error } = await supabase
        .from('referentiel_produits')
        .insert(dataToInsert)
        .select()
        .single();

      if (error) {
        console.error('Erreur SQL création référentiel:', error);
        return { success: false, error: error.message };
      }

      return { success: true, referentiel: data, error: null };
    } catch (error) {
      console.error('Exception dans create référentiel:', error);
      return { success: false, error: error.message };
    }
  },

  async update(id, updates) {
    try {
      const dataToUpdate = {
        reference: updates.reference,
        nom: updates.nom,
        type_conditionnement: updates.type_conditionnement,
        unite_mesure: updates.unite_mesure,
        quantite_par_conditionnement: parseFloat(updates.quantite_par_conditionnement),
        prix_achat_total: parseFloat(updates.prix_achat_total)
      };

      const { data, error } = await supabase
        .from('referentiel_produits')
        .update(dataToUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erreur SQL update référentiel:', error);
        return { success: false, error: error.message };
      }

      return { success: true, referentiel: data, error: null };
    } catch (error) {
      console.error('Exception dans update référentiel:', error);
      return { success: false, error: error.message };
    }
  },

  async delete(id) {
    try {
      const { error } = await supabase
        .from('referentiel_produits')
        .update({
          actif: false
        })
        .eq('id', id);

      if (error) {
        console.error('Erreur SQL delete référentiel:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Exception dans delete référentiel:', error);
      return { success: false, error: error.message };
    }
  },

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
};
// ===================== SERVICES UNITÉS =====================
export const uniteService = {
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
  },  // ← VIRGULE IMPORTANTE ICI

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
      
      // Créer les unités de base - CORRECTION ICI
      const unitesDeBase = [  // ← FIX: c'était "supabase.js" par erreur
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
// ===================== SERVICES MOUVEMENTS STOCK =====================
export const mouvementStockService = {
  async getAll(produitId = null) {
    try {
      let query = supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom, unite:unites(label)),
          utilisateur:profiles!mouvements_stock_utilisateur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (produitId) {
        query = query.eq('produit_id', produitId)
      }

      const { data, error } = await query

      if (error) {
        return { mouvements: [], error: error.message }
      }

      return { mouvements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll mouvements:', error)
      return { mouvements: [], error: error.message }
    }
  },

  async create(mouvementData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('mouvements_stock')
        .insert({
          ...mouvementData,
          utilisateur_id: user?.id
        })
        .select()
        .single()

      if (error) {
        return { mouvement: null, error: error.message }
      }

      return { mouvement: data, error: null }
    } catch (error) {
      console.error('Erreur dans create mouvement:', error)
      return { mouvement: null, error: error.message }
    }
  }
}
// ===================== SERVICES ARRÊTS CAISSE =====================
export const arretCaisseService = {
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
// ===================== SERVICES PERMISSIONS =====================
export const permissionService = {
  async getModules() {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('actif', true)
        .order('ordre')

      if (error) {
        return { modules: [], error: error.message }
      }

      return { modules: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getModules:', error)
      return { modules: [], error: error.message }
    }
  },

  async getPermissions() {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select(`
          *,
          module:modules(nom, code)
        `)
        .order('nom')

      if (error) {
        return { permissions: [], error: error.message }
      }

      return { permissions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getPermissions:', error)
      return { permissions: [], error: error.message }
    }
  },

  async getUserPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          *,
          permission:permissions(*, module:modules(*))
        `)
        .eq('user_id', userId)
        .eq('granted', true)

      if (error) {
        return { permissions: [], error: error.message }
      }

      return { permissions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getUserPermissions:', error)
      return { permissions: [], error: error.message }
    }
  },

  async assignPermission(userId, permissionId, accordedBy) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_id: permissionId,
          granted: true,
          accorded_by: accordedBy,
          accorded_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { permission: null, error: error.message }
      }

      return { permission: data, error: null }
    } catch (error) {
      console.error('Erreur dans assignPermission:', error)
      return { permission: null, error: error.message }
    }
  },

  async revokePermission(userId, permissionId) {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .update({
          granted: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('permission_id', permissionId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error('Erreur dans revokePermission:', error)
      return { success: false, error: error.message }
    }
  }
   }
  export default supabase





































