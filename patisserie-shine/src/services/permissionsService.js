import { supabase } from '@/lib/supabase';

export const permissionsService = {
  // Récupérer tous les modules
  async getModules() {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .order('ordre');
    
    return { data, error };
  },

  // Récupérer toutes les permissions d'un module
  async getModulePermissions(moduleId) {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('module_id', moduleId)
      .order('type');
    
    return { data, error };
  },

  // Récupérer tous les rôles
  async getRoles() {
    const { data, error } = await supabase
      .from('roles_custom')
      .select(`
        *,
        role_permissions (
          permission_id,
          permissions (
            id,
            code,
            nom,
            type,
            module_id
          )
        )
      `)
      .order('is_system', { ascending: false })
      .order('nom');
    
    return { data, error };
  },

  // Créer un nouveau rôle
  async createRole(roleData) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const { data, error } = await supabase
      .from('roles_custom')
      .insert({
        nom: roleData.nom,
        description: roleData.description,
        created_by: profile.id
      })
      .select()
      .single();
    
    return { data, error };
  },

  // Assigner des permissions à un rôle
  async assignPermissionsToRole(roleId, permissionIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const assignments = permissionIds.map(permissionId => ({
      role_id: roleId,
      permission_id: permissionId,
      accorded_by: profile.id
    }));

    const { data, error } = await supabase
      .from('role_permissions')
      .insert(assignments);
    
    return { data, error };
  },

  // Révoquer des permissions d'un rôle
  async revokePermissionsFromRole(roleId, permissionIds) {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .in('permission_id', permissionIds);
    
    return { error };
  },

  // Récupérer les permissions d'un utilisateur
  async getUserPermissions(userId) {
    const { data, error } = await supabase
      .rpc('get_user_permissions', { p_user_id: userId });
    
    return { data, error };
  },

  // Accorder une permission directe à un utilisateur
  async grantUserPermission(userId, permissionId, reason, expiresAt = null) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const { data, error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        permission_id: permissionId,
        granted: true,
        accorded_by: profile.id,
        reason: reason,
        expires_at: expiresAt
      });
    
    return { data, error };
  },

  // Révoquer une permission d'un utilisateur
  async revokeUserPermission(userId, permissionId, reason) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const { data, error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        permission_id: permissionId,
        granted: false,
        accorded_by: profile.id,
        reason: reason
      });
    
    return { data, error };
  },

  // Vérifier si un utilisateur a une permission
  async checkPermission(permissionCode) {
    const { data: user } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.user.id,
        p_permission_code: permissionCode
      });
    
    return data === true;
  },

  // Assigner un rôle à un utilisateur
  async assignRoleToUser(userId, roleId) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ custom_role_id: roleId })
      .eq('id', userId);
    
    return { data, error };
  },

  // Promouvoir un utilisateur en super admin
  async promoteToSuperAdmin(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_super_admin: true })
      .eq('id', userId);
    
    return { data, error };
  },

  // Rétrograder un super admin
  async demoteFromSuperAdmin(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_super_admin: false })
      .eq('id', userId);
    
    return { data, error };
  }
};
