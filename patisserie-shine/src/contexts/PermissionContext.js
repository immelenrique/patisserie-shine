// src/contexts/PermissionContext.js
"use client";

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase-client';

const PermissionContext = createContext();

/**
 * Permissions par défaut selon le rôle
 */
const DEFAULT_PERMISSIONS = {
  employe_production: [
    'view_dashboard',
    'view_stock',
    'view_stock_atelier',
    'view_recettes',
    'view_demandes',
    'view_production'
  ],
  employe_boutique: [
    'view_dashboard',
    'view_stock_boutique',
    'view_demandes',
    'view_caisse'
  ],
  admin: [] // Admin géré séparément
};

/**
 * Configuration des onglets disponibles
 */
const ALL_TABS = [
  { id: 'dashboard', label: 'Tableau de Bord', permission: 'view_dashboard' },
  { id: 'stock', label: 'Stock Magasin', permission: 'view_stock' },
  { id: 'stock_atelier', label: 'Stock Atelier', permission: 'view_stock_atelier' },
  { id: 'stock_boutique', label: 'Stock Boutique', permission: 'view_stock_boutique' },
  { id: 'demandes', label: 'Demandes', permission: 'view_demandes' },
  { id: 'production', label: 'Production', permission: 'view_production' },
  { id: 'caisse', label: 'Caisse', permission: 'view_caisse' },
  { id: 'recettes', label: 'Recettes', permission: 'view_recettes' },
  { id: 'referentiel', label: 'Référentiel Produits', permission: 'view_referentiel' },
  { id: 'comptabilite', label: 'Comptabilité', permission: 'view_comptabilite' },
  { id: 'equipe', label: 'Équipe', permission: 'view_equipe' },
  { id: 'permissions', label: 'Permissions', permission: 'manage_permissions' },
];

/**
 * Provider pour gérer les permissions
 */
export function PermissionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les permissions utilisateur depuis la base
  useEffect(() => {
    if (!user?.id) {
      setUserPermissions([]);
      setLoading(false);
      return;
    }

    async function loadUserPermissions() {
      try {
        // Charger les permissions personnalisées de l'utilisateur
        const { data, error } = await supabase
          .from('user_permissions')
          .select(`
            permission:permissions(
              id,
              code,
              nom,
              type
            )
          `)
          .eq('user_id', user.id)
          .eq('granted', true);

        if (!error && data) {
          const permissions = data
            .filter(p => p.permission)
            .map(p => p.permission);
          setUserPermissions(permissions);
        }
      } catch (error) {
        console.error('Erreur chargement permissions:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserPermissions();
  }, [user?.id]);

  /**
   * Vérifier si l'utilisateur a une permission
   */
  const hasPermission = useMemo(() => {
    return (permission) => {
      if (!user) return false;

      // Propriétaire a tous les droits
      if (user.username === 'proprietaire') {
        return true;
      }

      // Admin : vérifier d'abord les permissions personnalisées
      if (user.role === 'admin') {
        // Si l'admin a des permissions personnalisées
        if (userPermissions && userPermissions.length > 0) {
          // Vérifier si manage_permissions lui a été spécifiquement accordée
          const hasManagePermissions = userPermissions.some(p => 
            p.code === 'manage_permissions' || p.code === 'view_permissions'
          );

          if (permission === 'manage_permissions') {
            return hasManagePermissions;
          }
        } else {
          // Admin sans permissions personnalisées : tout sauf manage_permissions
          if (permission === 'manage_permissions') {
            return false;
          }
        }

        // Pour toutes les autres permissions, admin a accès
        return true;
      }

      // Pour les employés, vérifier les permissions personnalisées
      if (userPermissions && userPermissions.length > 0) {
        const hasDirectPermission = userPermissions.some(p => p.code === permission);

        const hasManagePermission = userPermissions.some(p => {
          if (permission.startsWith('view_') && p.code.startsWith('manage_')) {
            const module = permission.replace('view_', '');
            return p.code === `manage_${module}`;
          }
          return false;
        });

        if (hasDirectPermission || hasManagePermission) {
          return true;
        }
      }

      // Permissions par défaut si pas de permissions personnalisées
      if (!userPermissions || userPermissions.length === 0) {
        const defaultPerms = DEFAULT_PERMISSIONS[user.role] || [];
        return defaultPerms.includes(permission);
      }

      return false;
    };
  }, [user, userPermissions]);

  /**
   * Calculer les onglets disponibles selon les permissions
   */
  const availableTabs = useMemo(() => {
    if (!isAuthenticated) return [];

    return ALL_TABS.filter(tab => hasPermission(tab.permission));
  }, [isAuthenticated, hasPermission]);

  /**
   * Rafraîchir les permissions
   */
  const refreshPermissions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          permission:permissions(
            id,
            code,
            nom,
            type
          )
        `)
        .eq('user_id', user.id)
        .eq('granted', true);

      if (!error && data) {
        const permissions = data
          .filter(p => p.permission)
          .map(p => p.permission);
        setUserPermissions(permissions);
      }
    } catch (error) {
      console.error('Erreur rafraîchissement permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    userPermissions,
    hasPermission,
    availableTabs,
    loading,
    refreshPermissions,
    // Helpers
    isProprietaire: user?.username === 'proprietaire',
    isAdmin: user?.role === 'admin',
    canManagePermissions: hasPermission('manage_permissions'),
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte de permissions
 */
export function usePermissions() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }

  return context;
}

export default PermissionContext;
