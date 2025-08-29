import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Shield, Users, Key, Clock, Plus, Trash2, Edit, 
  Check, X, ChevronRight, AlertTriangle, Crown,
  Eye, EyeOff, Lock, Unlock, Calendar, Save
} from 'lucide-react';
import { permissionsService } from '../../services/permissionsService'


export default function PermissionsManager({ currentUser }) {
  const [activeTab, setActiveTab] = useState('roles');
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // État pour le nouveau rôle
  const [newRole, setNewRole] = useState({
    nom: '',
    description: '',
    permissions: []
  });

  // État pour les permissions utilisateur
  const [userPermissionForm, setUserPermissionForm] = useState({
    permissionId: '',
    reason: '',
    expiresAt: '',
    granted: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les modules
      const { data: modulesData } = await permissionsService.getModules();
      setModules(modulesData || []);

      // Charger toutes les permissions
      const allPermissions = [];
      for (const module of modulesData || []) {
        const { data: perms } = await permissionsService.getModulePermissions(module.id);
        allPermissions.push(...(perms || []));
      }
      setPermissions(allPermissions);

      // Charger les rôles
      const { data: rolesData } = await permissionsService.getRoles();
      setRoles(rolesData || []);

      // Charger les utilisateurs
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('username');
      setUsers(usersData || []);

    } catch (error) {
      console.error('Erreur chargement données:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.nom) {
      setMessage({ type: 'error', text: 'Le nom du rôle est obligatoire' });
      return;
    }

    try {
      const { data: roleData, error: roleError } = await permissionsService.createRole({
        nom: newRole.nom,
        description: newRole.description
      });

      if (roleError) throw roleError;

      if (newRole.permissions.length > 0) {
        const { error: permError } = await permissionsService.assignPermissionsToRole(
          roleData.id,
          newRole.permissions
        );
        if (permError) throw permError;
      }

      setMessage({ type: 'success', text: 'Rôle créé avec succès' });
      setShowCreateRole(false);
      setNewRole({ nom: '', description: '', permissions: [] });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    }
  };

  const handleToggleRolePermission = async (roleId, permissionId, hasPermission) => {
    try {
      if (hasPermission) {
        await permissionsService.revokePermissionsFromRole(roleId, [permissionId]);
      } else {
        await permissionsService.assignPermissionsToRole(roleId, [permissionId]);
      }
      loadData();
      setMessage({ type: 'success', text: 'Permission mise à jour' });
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    }
  };

  const handleUserPermission = async () => {
    if (!selectedUser || !userPermissionForm.permissionId || !userPermissionForm.reason) {
      setMessage({ type: 'error', text: 'Tous les champs sont obligatoires' });
      return;
    }

    try {
      if (userPermissionForm.granted) {
        await permissionsService.grantUserPermission(
          selectedUser.id,
          userPermissionForm.permissionId,
          userPermissionForm.reason,
          userPermissionForm.expiresAt || null
        );
      } else {
        await permissionsService.revokeUserPermission(
          selectedUser.id,
          userPermissionForm.permissionId,
          userPermissionForm.reason
        );
      }

      setMessage({ type: 'success', text: 'Permission utilisateur mise à jour' });
      setUserPermissionForm({ permissionId: '', reason: '', expiresAt: '', granted: true });
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    }
  };

  const handleAssignRole = async (userId, roleId) => {
    try {
      await permissionsService.assignRoleToUser(userId, roleId);
      setMessage({ type: 'success', text: 'Rôle assigné avec succès' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    }
  };

  const handleToggleSuperAdmin = async (userId, currentStatus) => {
    try {
      if (currentStatus) {
        await permissionsService.demoteFromSuperAdmin(userId);
      } else {
        await permissionsService.promoteToSuperAdmin(userId);
      }
      setMessage({ type: 'success', text: 'Statut super admin modifié' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur: ${error.message}` });
    }
  };

  // Vérifier si l'utilisateur actuel est super admin
  if (!currentUser?.is_super_admin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accès Refusé</h3>
        <p className="text-gray-500">Seuls les super administrateurs peuvent gérer les permissions.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <Shield className="w-8 h-8 mr-3" />
              Gestion des Permissions
            </h2>
            <p className="mt-2 opacity-90">
              Contrôle granulaire des accès et permissions
            </p>
          </div>
          <Crown className="w-12 h-12 opacity-50" />
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'roles', label: 'Rôles', icon: Users },
            { id: 'users', label: 'Utilisateurs', icon: Key },
            { id: 'modules', label: 'Modules', icon: Shield }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-4 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des tabs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Tab Rôles */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Gestion des Rôles</h3>
              <button
                onClick={() => setShowCreateRole(true)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Rôle
              </button>
            </div>

            {/* Modal création de rôle */}
            {showCreateRole && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4">Créer un nouveau rôle</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nom du rôle</label>
                      <input
                        type="text"
                        value={newRole.nom}
                        onChange={(e) => setNewRole({ ...newRole, nom: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Ex: Responsable Stock"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={newRole.description}
                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        rows="3"
                        placeholder="Description du rôle..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Permissions</label>
                      <div className="space-y-4 max-h-64 overflow-y-auto border rounded-lg p-3">
                        {modules.map(module => (
                          <div key={module.id} className="space-y-2">
                            <h4 className="font-medium text-gray-700">{module.nom}</h4>
                            <div className="grid grid-cols-3 gap-2 ml-4">
                              {permissions
                                .filter(p => p.module_id === module.id)
                                .map(permission => (
                                  <label key={permission.id} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={newRole.permissions.includes(permission.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setNewRole({
                                            ...newRole,
                                            permissions: [...newRole.permissions, permission.id]
                                          });
                                        } else {
                                          setNewRole({
                                            ...newRole,
                                            permissions: newRole.permissions.filter(id => id !== permission.id)
                                          });
                                        }
                                      }}
                                      className="mr-2"
                                    />
                                    <span className="text-sm">{permission.nom}</span>
                                  </label>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setShowCreateRole(false)}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCreateRole}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Créer le rôle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Liste des rôles */}
            <div className="grid gap-4">
              {roles.map(role => (
                <div key={role.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg flex items-center">
                        {role.nom}
                        {role.is_system && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            Système
                          </span>
                        )}
                        {role.is_super_admin && (
                          <Crown className="w-4 h-4 ml-2 text-yellow-500" />
                        )}
                      </h4>
                      <p className="text-gray-600 text-sm">{role.description}</p>
                    </div>
                    {!role.is_system && (
                      <button
                        onClick={() => setSelectedRole(role)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {selectedRole?.id === role.id && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="font-medium mb-3">Permissions du rôle</h5>
                      <div className="space-y-3">
                        {modules.map(module => (
                          <div key={module.id}>
                            <h6 className="text-sm font-medium text-gray-700 mb-2">
                              {module.nom}
                            </h6>
                            <div className="grid grid-cols-4 gap-2 ml-4">
                              {permissions
                                .filter(p => p.module_id === module.id)
                                .map(permission => {
                                  const hasPermission = role.role_permissions?.some(
                                    rp => rp.permission_id === permission.id
                                  );
                                  return (
                                    <label key={permission.id} className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={hasPermission}
                                        onChange={() => handleToggleRolePermission(
                                          role.id,
                                          permission.id,
                                          hasPermission
                                        )}
                                        disabled={role.is_super_admin}
                                        className="mr-2"
                                      />
                                      <span className="text-sm">{permission.nom}</span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Utilisateurs */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Permissions des Utilisateurs</h3>

            <div className="grid gap-4">
              {users.map(user => (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold flex items-center">
                        {user.nom || user.username}
                        {user.is_super_admin && (
                          <Crown className="w-4 h-4 ml-2 text-yellow-500" />
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">
                        @{user.username} - Rôle actuel: {user.role}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleToggleSuperAdmin(user.id, user.is_super_admin)}
                        className={`px-3 py-1 rounded text-sm ${
                          user.is_super_admin
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        disabled={user.id === currentUser.id}
                      >
                        {user.is_super_admin ? 'Retirer Super Admin' : 'Promouvoir Super Admin'}
                      </button>
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {selectedUser?.id === user.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Assigner un rôle */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Assigner un rôle personnalisé
                        </label>
                        <select
                          onChange={(e) => handleAssignRole(user.id, e.target.value)}
                          className="border rounded-lg px-3 py-2 w-full"
                          defaultValue=""
                        >
                          <option value="">Sélectionner un rôle...</option>
                          {roles.filter(r => !r.is_system).map(role => (
                            <option key={role.id} value={role.id}>
                              {role.nom}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Permissions directes */}
                      <div>
                        <h5 className="font-medium mb-2">Permissions directes</h5>
                        <div className="space-y-3 border rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={userPermissionForm.permissionId}
                              onChange={(e) => setUserPermissionForm({
                                ...userPermissionForm,
                                permissionId: e.target.value
                              })}
                              className="border rounded px-2 py-1"
                            >
                              <option value="">Sélectionner une permission...</option>
                              {modules.map(module => (
                                <optgroup key={module.id} label={module.nom}>
                                  {permissions
                                    .filter(p => p.module_id === module.id)
                                    .map(permission => (
                                      <option key={permission.id} value={permission.id}>
                                        {permission.nom}
                                      </option>
                                    ))}
                                </optgroup>
                              ))}
                            </select>

                            <select
                              value={userPermissionForm.granted ? 'grant' : 'revoke'}
                              onChange={(e) => setUserPermissionForm({
                                ...userPermissionForm,
                                granted: e.target.value === 'grant'
                              })}
                              className="border rounded px-2 py-1"
                            >
                              <option value="grant">Accorder</option>
                              <option value="revoke">Révoquer</option>
                            </select>
                          </div>

                          <input
                            type="text"
                            placeholder="Raison (obligatoire)"
                            value={userPermissionForm.reason}
                            onChange={(e) => setUserPermissionForm({
                              ...userPermissionForm,
                              reason: e.target.value
                            })}
                            className="w-full border rounded px-2 py-1"
                          />

                          <input
                            type="datetime-local"
                            placeholder="Expiration (optionnel)"
                            value={userPermissionForm.expiresAt}
                            onChange={(e) => setUserPermissionForm({
                              ...userPermissionForm,
                              expiresAt: e.target.value
                            })}
                            className="w-full border rounded px-2 py-1"
                          />

                          <button
                            onClick={handleUserPermission}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                          >
                            Appliquer
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Modules */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Vue d'ensemble des Modules</h3>

            <div className="grid gap-4">
              {modules.map(module => (
                <div key={module.id} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">{module.nom}</h4>
                  <p className="text-gray-600 text-sm mb-3">{module.description}</p>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {permissions
                      .filter(p => p.module_id === module.id)
                      .map(permission => (
                        <div
                          key={permission.id}
                          className={`px-3 py-1 rounded text-sm text-center ${
                            permission.type === 'view' ? 'bg-green-100 text-green-800' :
                            permission.type === 'create' ? 'bg-blue-100 text-blue-800' :
                            permission.type === 'update' ? 'bg-yellow-100 text-yellow-800' :
                            permission.type === 'delete' ? 'bg-red-100 text-red-800' :
                            permission.type === 'validate' ? 'bg-purple-100 text-purple-800' :
                            permission.type === 'export' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {permission.nom}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
