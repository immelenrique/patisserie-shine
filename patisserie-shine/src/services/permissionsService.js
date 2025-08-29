// src/services/permissionsService.js
import { supabase } from '@/lib/supabase'

export const permissionsService = {
  // Récupérer toutes les permissions
  async getAllPermissions() {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur récupération permissions:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Erreur dans getAllPermissions:', err)
      return { data: null, error: err.message }
    }
  },

  // Récupérer les permissions d'un utilisateur
  async getUserPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*, permissions(*)')
        .eq('user_id', userId)
      
      if (error) {
        console.error('Erreur récupération permissions utilisateur:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Erreur dans getUserPermissions:', err)
      return { data: null, error: err.message }
    }
  },

  // Ajouter une permission à un utilisateur
  async addUserPermission(userId, permissionId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .insert({ 
          user_id: userId, 
          permission_id: permissionId 
        })
        .select()
      
      if (error) {
        console.error('Erreur ajout permission:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Erreur dans addUserPermission:', err)
      return { data: null, error: err.message }
    }
  },

  // Supprimer une permission d'un utilisateur
  async removeUserPermission(userId, permissionId) {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId)
      
      if (error) {
        console.error('Erreur suppression permission:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, error: null }
    } catch (err) {
      console.error('Erreur dans removeUserPermission:', err)
      return { success: false, error: err.message }
    }
  },

  // Créer une nouvelle permission
  async createPermission(permission) {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .insert(permission)
        .select()
      
      if (error) {
        console.error('Erreur création permission:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Erreur dans createPermission:', err)
      return { data: null, error: err.message }
    }
  },

  // Mettre à jour une permission
  async updatePermission(permissionId, updates) {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .update(updates)
        .eq('id', permissionId)
        .select()
      
      if (error) {
        console.error('Erreur mise à jour permission:', error)
        return { data: null, error: error.message }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('Erreur dans updatePermission:', err)
      return { data: null, error: err.message }
    }
  },

  // Supprimer une permission
  async deletePermission(permissionId) {
    try {
      const { error } = await supabase
        .from('permissions')
        .delete()
        .eq('id', permissionId)
      
      if (error) {
        console.error('Erreur suppression permission:', error)
        return { success: false, error: error.message }
      }
      
      return { success: true, error: null }
    } catch (err) {
      console.error('Erreur dans deletePermission:', err)
      return { success: false, error: err.message }
    }
  },

  // Vérifier si un utilisateur a une permission spécifique
  async userHasPermission(userId, permissionName) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          permissions!inner(
            name,
            code
          )
        `)
        .eq('user_id', userId)
        .eq('permissions.name', permissionName)
        .single()
      
      if (error) {
        // Si erreur PGRST116, c'est que la permission n'existe pas
        if (error.code === 'PGRST116') {
          return { hasPermission: false, error: null }
        }
        console.error('Erreur vérification permission:', error)
        return { hasPermission: false, error: error.message }
      }
      
      return { hasPermission: !!data, error: null }
    } catch (err) {
      console.error('Erreur dans userHasPermission:', err)
      return { hasPermission: false, error: err.message }
    }
  }
}

export default permissionsService
