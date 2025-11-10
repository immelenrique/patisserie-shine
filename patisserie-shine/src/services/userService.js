// src/services/userService.js
import { supabase } from '../lib/supabase-client'

/**
 * Service de gestion des utilisateurs
 * CRUD complet pour les profils utilisateurs
 */
export const userService = {
  /**
   * Récupérer tous les utilisateurs actifs
   */
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { users: data || [], error: null }
    } catch (error) {
      return { users: [], error: error.message }
    }
  },

  /**
   * Récupérer tous les utilisateurs (actifs + inactifs)
   */
  async getAllIncludingInactive() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('actif', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { users: data || [], error: null }
    } catch (error) {
      return { users: [], error: error.message }
    }
  },

  /**
   * Récupérer les utilisateurs désactivés uniquement
   */
  async getDeactivatedUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', false)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      return { users: data || [], error: null }
    } catch (error) {
      return { users: [], error: error.message }
    }
  },

  /**
   * Créer un nouvel utilisateur (via API admin)
   */
  async createUser(userData) {
    try {
      // Récupérer le token de session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        return { 
          user: null, 
          error: 'Vous devez être connecté en tant qu\'administrateur' 
        }
      }

      // Appel à l'API admin
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          username: userData.username.trim(),
          nom: userData.nom.trim(),
          telephone: userData.telephone?.trim() || '',
          role: userData.role,
          password: userData.password,
          force_password_change: userData.force_password_change !== false
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { user: null, error: data.error || 'Erreur lors de la création' }
      }

      return { user: data.user, error: null, message: data.message }
      
    } catch (error) {
      if (!navigator.onLine) {
        return { user: null, error: 'Pas de connexion internet' }
      }
      return { user: null, error: 'Erreur inattendue. Veuillez réessayer.' }
    }
  },

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return { user: data, error: null }
    } catch (error) {
      return { user: null, error: error.message }
    }
  },

  /**
   * Supprimer un utilisateur (soft ou hard delete)
   * @param {string} userId - ID de l'utilisateur
   * @param {boolean} permanentDelete - true pour suppression définitive
   */
  async deleteUser(userId, permanentDelete = false) {
    try {
      if (permanentDelete) {
        // Suppression définitive via fonction SQL
        const { data, error } = await supabase
          .rpc('safe_delete_user', { p_user_id: userId })

        if (error) {
          if (error.message.includes('foreign key constraint')) {
            return {
              success: false,
              error: 'Impossible de supprimer : utilisateur a des données liées'
            }
          }
          throw error
        }

        return {
          success: true,
          message: 'Utilisateur supprimé définitivement',
          deletionType: 'permanent'
        }
      } else {
        // Soft delete (désactivation)
        const { error } = await supabase
          .from('profiles')
          .update({ 
            actif: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) throw error

        return {
          success: true,
          message: 'Utilisateur désactivé',
          deletionType: 'soft'
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Réactiver un utilisateur désactivé
   */
  async reactivateUser(userId) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ actif: true })
        .eq('id', userId)

      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Changer le mot de passe d'un utilisateur
   */
  async changePassword(userId, newPassword) {
    try {
      const { error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      )

      if (error) throw error

      // Marquer comme changé
      await supabase
        .from('profiles')
        .update({ 
          force_password_change: false,
          last_password_change: new Date().toISOString()
        })
        .eq('id', userId)

      return { success: true, error: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

export default userService
