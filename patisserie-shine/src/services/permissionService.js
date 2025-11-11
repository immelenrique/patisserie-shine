// src/services/permissionService.js
import { supabase } from '../lib/supabase-client'

/**
 * Service de gestion des permissions
 * Gestion des modules, rôles et permissions utilisateur
 */
export const permissionService = {
  /**
   * Récupérer tous les modules disponibles
   */
  async getModules() {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })

      if (error) throw error
      return { modules: data || [], error: null }
    } catch (error) {
      return { modules: [], error: error.message }
    }
  },

  /**
   * Récupérer tous les rôles personnalisés
   */
  async getRoles() {
    try {
      const { data, error } = await supabase
        .from('roles_custom')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return { roles: data || [], error: null }
    } catch (error) {
      return { roles: [], error: error.message }
    }
  },

  /**
   * Récupérer les permissions d'un utilisateur
   */
  async getUserPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          id,
          granted,
          permission:permissions(
            id,
            code,
            nom,
            description,
            type,
            module:modules(nom, code)
          )
        `)
        .eq('user_id', userId)

      if (error) throw error
      return { permissions: data || [], error: null }
    } catch (error) {
      return { permissions: [], error: error.message }
    }
  },

  /**
   * Récupérer toutes les permissions disponibles
   */
  async getPermissions() {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select(`
          *,
          module:modules(nom, code)
        `)
        .order('module_id', { ascending: true })

      if (error) throw error
      return { permissions: data || [], error: null }
    } catch (error) {
      return { permissions: [], error: error.message }
    }
  },

  /**
   * Créer un nouveau rôle personnalisé
   */
  async createRole(roleData) {
    try {
      const { data, error } = await supabase
        .from('roles_custom')
        .insert(roleData)
        .select()
        .single()

      if (error) throw error
      return { role: data, error: null }
    } catch (error) {
      return { role: null, error: error.message }
    }
  },

  /**
   * Assigner une permission à un utilisateur
   */
  async assignPermission(userId, permissionId, granted = true) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          permission_id: permissionId,
          granted: granted
        })
        .select()

      if (error) throw error
      return { success: true, data, error: null }
    } catch (error) {
      return { success: false, data: null, error: error.message }
    }
  },

  /**
   * Retirer une permission d'un utilisateur
   */
  async revokePermission(userId, permissionId) {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId)

      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

export default permissionService
