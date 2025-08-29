// src/components/admin/PermissionsManager.js
import { useState, useEffect } from 'react';
import { Shield, Plus, Users, Lock, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { permissionsService } from '../../services/permissionsService';

export default function PermissionsManager({ currentUser }) {
  const [activeTab, setActiveTab] = useState('modules');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);

  const loadUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('nom');
  
  if (!error) {
    setUsers(data || []);
  }
};
  const loadUserPermissions = async (userId) => {
    const { data } = await supabase
      .from('user_permissions')
      .select('permission_id')
      .eq('user_id', userId);
    
    setUserPermissions(data?.map(p => p.permission_id) || []);
    setSelectedUser(userId);
  };
  const togglePermission = async (userId, permissionId, granted) => {
    if (granted) {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission_id', permissionId);
    } else {
      await supabase
        .from('user_permissions')
        .insert({
          user_id: userId,
          permission_id: permissionId,
          granted: true,
          accorded_by: currentUser.id
        });
    }
    loadUserPermissions(userId);
  };
  useEffect(() => {
    loadData();
    loadUsers();
    
  }, []);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Charger directement depuis Supabase pour debug
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('ordre');
      
      if (modulesError) throw modulesError;
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles_custom')
        .select('*')
        .order('nom');
      
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('nom');

      console.log('Modules chargés:', modulesData);
      console.log('Rôles chargés:', rolesData);
      console.log('Permissions chargées:', permissionsData);
      
      setModules(modulesData || []);
      setRoles(rolesData || []);
      setPermissions(permissionsData || []);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Shield className="mr-3" />
              Gestion des Permissions
            </h1>
            <p className="mt-2 opacity-90">Contrôle granulaire des accès et permissions</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-2 px-4 ${activeTab === 'modules' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <Database className="inline-block w-4 h-4 mr-2" />
          Modules ({modules.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-2 px-4 ${activeTab === 'roles' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <Users className="inline-block w-4 h-4 mr-2" />
          Rôles ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-2 px-4 ${activeTab === 'permissions' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <Lock className="inline-block w-4 h-4 mr-2" />
          Permissions ({permissions.length})
        </button>
         
    <button
      onClick={() => setActiveTab('attribution')}
      className={`pb-2 px-4 ${activeTab === 'attribution' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
    >
      Attribution
    </button>
  </div>
      

      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === 'modules' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Vue d'ensemble des Modules</h2>
            {modules.length === 0 ? (
              <p className="text-gray-500">Aucun module trouvé</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modules.map(module => (
                  <div key={module.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{module.nom}</h3>
                    <p className="text-sm text-gray-600">{module.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Code: {module.code}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Gestion des Rôles</h2>
            {roles.length === 0 ? (
              <p className="text-gray-500">Aucun rôle personnalisé</p>
            ) : (
              <div className="space-y-2">
                {roles.map(role => (
                  <div key={role.id} className="border rounded p-3">
                    <h3 className="font-semibold">{role.nom}</h3>
                    <p className="text-sm text-gray-600">{role.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Liste des Permissions</h2>
            {permissions.length === 0 ? (
              <p className="text-gray-500">Aucune permission définie</p>
            ) : (
              <div className="space-y-2">
                {permissions.map(perm => (
                  <div key={perm.id} className="border rounded p-3">
                    <h3 className="font-semibold">{perm.nom}</h3>
                    <p className="text-sm text-gray-600">{perm.description}</p>
                    <p className="text-xs text-gray-500">Type: {perm.type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'attribution' && (
      <div>
        <h2 className="text-xl font-semibold mb-4">Attribution des Permissions</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3">Sélectionner un utilisateur</h3>
            <div className="space-y-2">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => loadUserPermissions(user.id)}
                  className={`w-full text-left p-3 rounded border ${
                    selectedUser === user.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{user.nom || user.username}</div>
                  <div className="text-sm text-gray-500">{user.role}</div>
                </button>
              ))}
            </div>
          </div>
          
          {selectedUser && (
            <div>
              <h3 className="font-medium mb-3">Permissions</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {permissions.map(perm => {
                  const hasPermission = userPermissions.includes(perm.id);
                  return (
                    <label key={perm.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={hasPermission}
                        onChange={() => togglePermission(selectedUser, perm.id, hasPermission)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">{perm.nom}</div>
                        <div className="text-xs text-gray-500">{perm.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
}  
    
