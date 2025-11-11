// src/services/permissionsService.js
import { supabase } from '../lib/supabase-client'

export const permissionsService = {
  // Récupérer tous les modules
  async getModules() {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('ordre');
      
      if (error) {
        console.error('Erreur getModules:', error);
        return { modules: [], error: error.message };
      }
      
      return { modules: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getModules:', error);
      return { modules: [], error: error.message };
    }
  },

  // Récupérer tous les rôles
  async getRoles() {
    try {
      const { data, error } = await supabase
        .from('roles_custom')
        .select('*')
        .order('nom');
      
      if (error) {
        console.error('Erreur getRoles:', error);
        return { roles: [], error: error.message };
      }
      
      return { roles: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getRoles:', error);
      return { roles: [], error: error.message };
    }
  },

  // Récupérer les permissions d'un utilisateur
  async getUserPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          *,
          permissions(*)
        `)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Erreur getUserPermissions:', error);
        return { data: [], error: error.message };
      }
      
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getUserPermissions:', error);
      return { data: [], error: error.message };
    }
  },

  // Récupérer toutes les permissions
  async getPermissions() {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select(`
          *,
          modules(*)
        `)
        .order('nom');
      
      if (error) {
        console.error('Erreur getPermissions:', error);
        return { permissions: [], error: error.message };
      }
      
      return { permissions: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getPermissions:', error);
      return { permissions: [], error: error.message };
    }
  },

  // Créer un nouveau rôle
  async createRole(roleData) {
    try {
      const { data, error } = await supabase
        .from('roles_custom')
        .insert(roleData)
        .select()
        .single();
      
      if (error) {
        console.error('Erreur createRole:', error);
        return { role: null, error: error.message };
      }
      
      return { role: data, error: null };
    } catch (error) {
      console.error('Erreur dans createRole:', error);
      return { role: null, error: error.message };
    }
  },

  // Assigner une permission à un utilisateur
  async assignPermission(userId, permissionId) {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .insert({
          user_id: userId,
          permission_id: permissionId,
          granted: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erreur assignPermission:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true, data, error: null };
    } catch (error) {
      console.error('Erreur dans assignPermission:', error);
      return { success: false, error: error.message };
    }
  }
};

export default permissionsService;
