// src/services/authService.js
import { supabase } from '../lib/supabase-client'

/**
 * Service d'authentification
 * Gère la connexion, déconnexion et changement de mot de passe
 */
export const authService = {
  /**
   * Connexion avec username ou email
   * @param {string} usernameOrEmail - Username ou email
   * @param {string} password - Mot de passe
   * @returns {Promise<{user: Object|null, error: string|null}>}
   */
  async signInWithUsername(usernameOrEmail, password) {
    try {
      // Déterminer si c'est un email ou un username
      let email = usernameOrEmail;
      
      // Si ce n'est pas un email (pas de @), ajouter le domaine
      if (!usernameOrEmail.includes('@')) {
        email = `${usernameOrEmail}@shine.local`;
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
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
            return { user: data.user, error: 'Profil non créé - contactez l\'admin' }
          }
          
          return { user: { ...data.user, ...newProfile }, error: null }
        }
        
        return { user: data.user, error: 'Profil non chargé - contactez l\'admin' }
      }
      
      // Vérifier si le compte est actif
      if (!profile.actif) {
        await supabase.auth.signOut()
        return { user: null, error: 'Compte désactivé. Contactez l\'administrateur.' }
      }
      
      return { user: { ...data.user, ...profile }, error: null }
      
    } catch (error) {
      return { user: null, error: 'Erreur de connexion. Réessayez plus tard.' }
    }
  },
  
  /**
   * Récupérer l'utilisateur connecté et son profil
   * @returns {Promise<{user: Object|null, profile: Object|null, error: string|null}>}
   */
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
        return { user, profile: null, error: null }
      }
      
      return { user, profile, error: null }
    } catch (error) {
      return { user: null, profile: null, error: error.message }
    }
  },

  /**
   * Déconnexion
   * @returns {Promise<{error: string|null}>}
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  },

  /**
   * Changer le mot de passe initial
   * @param {string} newPassword - Nouveau mot de passe
   * @param {string} userId - ID utilisateur (optionnel)
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
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
      return { success: false, error: error.message }
    }
  },

  /**
   * Vérifier si un changement de mot de passe est requis
   * @param {string} userId - ID utilisateur (optionnel)
   * @returns {Promise<{required: boolean, error: string|null}>}
   */
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
        return { required: false, error: error.message }
      }

      const isRequired = profile.force_password_change === true || 
                        profile.last_password_change === null

      return { required: isRequired, error: null }
    } catch (error) {
      return { required: false, error: error.message }
    }
  },

  /**
   * Récupérer la session active
   * @returns {Promise<{session: Object|null, error: string|null}>}
   */
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

export default authService
