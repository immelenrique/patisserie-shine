"use client";

import { useState, useEffect } from 'react';
import { userService } from '../../lib/supabase';
import { Plus, Users, User, Crown, ChefHat, ShoppingBag, Trash2, Edit, UserPlus, AlertTriangle, CheckCircle, Key, Shield, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    nom: '',
    telephone: '',
    role: 'employe_boutique',
    password: ''
  });
  const [editFormData, setEditFormData] = useState({
    nom: '',
    telephone: '',
    role: 'employe_boutique'
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.username === 'proprietaire') {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Charger les utilisateurs actifs
      const { users: activeUsers, error: activeError } = await userService.getAll();
      if (activeError) {
        setMessage({ type: 'error', text: activeError });
      } else {
        setUsers(activeUsers);
      }

      // Charger les utilisateurs inactifs
      const { users: deactivatedUsers, error: inactiveError } = await userService.getDeactivatedUsers();
      if (!inactiveError) {
        setInactiveUsers(deactivatedUsers || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du chargement des utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
  e.preventDefault();
  setCreating(true);
  setMessage({ type: '', text: '' });

  try {
    // S'assurer que la session est bien récupérée AVANT d'appeler createUser
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Si pas de session, essayer de se reconnecter
      console.error('❌ Pas de session trouvée, reconnexion nécessaire');
      setMessage({ type: 'error', text: 'Session expirée. Veuillez rafraîchir la page.' });
      setCreating(false);
      
      // Optionnel : recharger la page pour forcer une nouvelle connexion
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    console.log('✅ Session trouvée, appel de createUser...');
    
    // Maintenant appeler createUser qui va utiliser cette session
    const { user, error } = await userService.createUser({
      username: formData.username,
      nom: formData.nom,
      telephone: formData.telephone,
      role: formData.role,
      password: formData.password
    });

    if (error) {
      console.error('❌ Erreur retournée:', error);
      setMessage({ type: 'error', text: error });
    } else {
      console.log('✅ Utilisateur créé:', user);
      setMessage({ type: 'success', text: `Utilisateur ${formData.username} créé avec succès !` });
      setShowAddModal(false);
      resetForm();
      loadUsers();
    }
  } catch (err) {
    console.error('❌ Exception:', err);
    setMessage({ type: 'error', text: 'Erreur lors de la création de l\'utilisateur' });
  } finally {
    setCreating(false);
  }
};

  const handleEditUser = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage({ type: '', text: '' });

    try {
      const { user, error } = await userService.updateUser(selectedUser.id, {
        nom: editFormData.nom,
        telephone: editFormData.telephone,
        role: editFormData.role
      });

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: `Utilisateur ${selectedUser.nom || selectedUser.username} modifié avec succès !` });
        setShowEditModal(false);
        setSelectedUser(null);
        loadUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la modification de l\'utilisateur' });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setDeleting(true);
    setMessage({ type: '', text: '' });

    try {
      const { success, error, deletionType } = await userService.deleteUser(
        selectedUser.id, 
        permanentDelete
      );

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        const action = permanentDelete ? 'supprimé définitivement' : 'désactivé';
        setMessage({ 
          type: 'success', 
          text: `Utilisateur ${selectedUser.nom || selectedUser.username} ${action} avec succès !` 
        });
        setShowDeleteModal(false);
        setSelectedUser(null);
        setPermanentDelete(false);
        loadUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression de l\'utilisateur' });
    } finally {
      setDeleting(false);
    }
  };

  const handleReactivateUser = async (userId, username) => {
    try {
      const { success, error } = await userService.reactivateUser(userId);
      
      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: `Utilisateur ${username} réactivé avec succès !` });
        loadUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la réactivation' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }

    setChangingPassword(true);
    setMessage({ type: '', text: '' });

    try {
      const { success, error } = await userService.changePassword(selectedUser.id, passwordData.newPassword);

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: `Mot de passe modifié avec succès pour ${selectedUser.nom || selectedUser.username} !` });
        setShowPasswordModal(false);
        setSelectedUser(null);
        setPasswordData({ newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du changement de mot de passe' });
    } finally {
      setChangingPassword(false);
    }
  };

  const startEdit = (user) => {
    setSelectedUser(user);
    setEditFormData({
      nom: user.nom || '',
      telephone: user.telephone || '',
      role: user.role || 'employe_boutique'
    });
    setShowEditModal(true);
    setMessage({ type: '', text: '' });
  };

  const startPasswordChange = (user) => {
    setSelectedUser(user);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
    setMessage({ type: '', text: '' });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      nom: '',
      telephone: '',
      role: 'employe_boutique',
      password: ''
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return Crown;
      case 'employe_production':
        return ChefHat;
      case 'employe_boutique':
        return ShoppingBag;
      default:
        return User;
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return '👑 Administrateur';
      case 'employe_production':
        return '👩‍🍳 Employé Production';
      case 'employe_boutique':
        return '🛒 Employé Boutique';
      default:
        return '👤 Utilisateur';
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'employe_production':
        return 'bg-orange-100 text-orange-800';
      case 'employe_boutique':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageUsers = currentUser?.role === 'admin' || currentUser?.username === 'proprietaire';

  if (!canManageUsers) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-500">Seuls les administrateurs et le propriétaire peuvent gérer les utilisateurs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 h-48 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentUsers = showInactiveUsers ? inactiveUsers : users;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <UserPlus className="w-8 h-8 text-orange-600 mr-3" />
            Gestion des Utilisateurs
          </h2>
          <p className="text-gray-600">Créer, modifier et supprimer les comptes utilisateurs</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowInactiveUsers(!showInactiveUsers)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
              showInactiveUsers 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showInactiveUsers ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            <span>{showInactiveUsers ? 'Utilisateurs supprimés' : 'Voir supprimés'}</span>
            {inactiveUsers.length > 0 && (
              <span className="bg-white text-red-500 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                {inactiveUsers.length}
              </span>
            )}
          </button>
          
          {!showInactiveUsers && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouvel Utilisateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages de notification */}
      {message.text && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertTriangle className="w-5 h-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Statistiques */}
      {!showInactiveUsers && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Utilisateurs actifs</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <Crown className="w-8 h-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Administrateurs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <ChefHat className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Employés Production</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'employe_production').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center">
              <ShoppingBag className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Employés Boutique</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'employe_boutique').length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Liste des utilisateurs */}
      {currentUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {showInactiveUsers ? 'Aucun utilisateur supprimé' : 'Aucun utilisateur trouvé'}
          </h3>
          <p className="text-gray-500 mb-4">
            {showInactiveUsers 
              ? 'Tous vos utilisateurs sont actifs' 
              : 'Commencez par créer votre premier utilisateur'
            }
          </p>
          {!showInactiveUsers && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
            >
              Créer un utilisateur
            </button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentUsers.map((user) => {
            const RoleIcon = getRoleIcon(user.role);
            const isCurrentUser = user.id === currentUser.id;
            const canDelete = !isCurrentUser && user.username !== 'proprietaire';
            const isInactive = !user.actif;
            
            return (
              <Card key={user.id} className={`p-6 ${isInactive ? 'bg-red-50 border-red-200' : ''}`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-r ${isInactive ? 'from-red-400 to-red-500' : 'from-green-400 to-blue-500'} rounded-xl flex items-center justify-center`}>
                    <span className="text-white text-lg font-semibold">
                      {user.nom?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {user.nom || 'Nom non défini'}
                      {isCurrentUser && <span className="text-xs text-blue-600 ml-2">(Vous)</span>}
                      {isInactive && <span className="text-xs text-red-600 ml-2">(Supprimé)</span>}
                    </h3>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${isInactive ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      <span className="text-sm text-gray-500">{isInactive ? 'Inactif' : 'Actif'}</span>
                    </div>
                  </div>

                  {user.telephone && (
                    <div className="text-sm text-gray-600">
                      📞 {user.telephone}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Créé le {new Date(user.created_at || Date.now()).toLocaleDateString('fr-FR')}
                    {isInactive && user.updated_at && (
                      <>
                        <br />Supprimé le {new Date(user.updated_at).toLocaleDateString('fr-FR')}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t">
                    {isInactive ? (
                      // Actions pour utilisateurs supprimés
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleReactivateUser(user.id, user.nom || user.username)}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg text-sm font-medium transition-colors"
                          title="Réactiver"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Réactiver
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setPermanentDelete(true);
                            setShowDeleteModal(true);
                          }}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      // Actions pour utilisateurs actifs
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="flex items-center justify-center px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => startPasswordChange(user)}
                          className="flex items-center justify-center px-3 py-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg text-sm font-medium transition-colors"
                          title="Changer mot de passe"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        
                        {canDelete && (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setPermanentDelete(false);
                              setShowDeleteModal(true);
                            }}
                            className="flex items-center justify-center px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                            title="Désactiver"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Création Utilisateur */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => {
          setShowAddModal(false);
          resetForm();
          setMessage({ type: '', text: '' });
        }} 
        title="Créer un Nouvel Utilisateur" 
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom d'utilisateur * <span className="text-xs text-gray-500">(pour se connecter)</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: marie, jean, sarah"
              required
              maxLength="50"
              pattern="[a-z0-9_]+"
              title="Lettres minuscules, chiffres et underscore uniquement"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sera utilisé pour se connecter (ex: marie → marie@shine.local)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Marie Dupont"
              required
              maxLength="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
            <input
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({...formData, telephone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: +226 70 00 01 02 03"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="employe_boutique">🛒 Employé Boutique</option>
              <option value="employe_production">👩‍🍳 Employé Production</option>
              <option value="admin">👑 Administrateur</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">
              <strong>Boutique:</strong> Consultation et demandes uniquement<br/>
              <strong>Production:</strong> Gestion stock et production<br/>
              <strong>Admin:</strong> Accès complet à toutes les fonctionnalités
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe temporaire *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Au moins 6 caractères"
              required
              minLength="6"
            />
            <p className="text-xs text-yellow-600 mt-1 flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              L'utilisateur devra changer ce mot de passe lors de sa première connexion
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">📝 Récapitulatif</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Connexion:</strong> {formData.username || '[nom_utilisateur]'}@shine.local</p>
              <p><strong>Nom affiché:</strong> {formData.nom || '[Nom complet]'}</p>
              <p><strong>Accès:</strong> {getRoleLabel(formData.role)}</p>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={creating}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {creating ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  Création...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 inline mr-2" />
                  Créer l'utilisateur
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                resetForm();
                setMessage({ type: '', text: '' });
              }}
              disabled={creating}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 font-medium"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Modification Utilisateur */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
          setMessage({ type: '', text: '' });
        }} 
        title="Modifier l'Utilisateur" 
        size="md"
      >
        {selectedUser && (
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl mb-4">
              <h4 className="font-medium text-blue-900 mb-2">Utilisateur: @{selectedUser.username}</h4>
              <p className="text-sm text-blue-800">Modification des informations du profil</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
              <input
                type="text"
                value={editFormData.nom}
                onChange={(e) => setEditFormData({...editFormData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Marie Dupont"
                required
                maxLength="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={editFormData.telephone}
                onChange={(e) => setEditFormData({...editFormData, telephone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: +226 70 00 01 02 03"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rôle *</label>
              <select
                value={editFormData.role}
                onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={selectedUser.username === 'proprietaire'}
              >
                <option value="employe_boutique">🛒 Employé Boutique</option>
                <option value="employe_production">👩‍🍳 Employé Production</option>
                <option value="admin">👑 Administrateur</option>
              </select>
              {selectedUser.username === 'proprietaire' && (
                <p className="text-xs text-yellow-600 mt-1">
                  Le rôle du propriétaire ne peut pas être modifié
                </p>
              )}
            </div>
            
            <div className="flex space-x-4 pt-4">
              <button 
                type="submit" 
                disabled={updating}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {updating ? (
                  <>
                    <div className="spinner w-4 h-4 inline mr-2"></div>
                    Modification...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 inline mr-2" />
                    Modifier l'utilisateur
                  </>
                )}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setMessage({ type: '', text: '' });
                }}
                disabled={updating}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 font-medium"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Changement de Mot de Passe */}
      <Modal 
        isOpen={showPasswordModal} 
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedUser(null);
          setPasswordData({ newPassword: '', confirmPassword: '' });
          setMessage({ type: '', text: '' });
        }} 
        title="Changer le Mot de Passe" 
        size="md"
      >
        {selectedUser && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-xl mb-4">
              <h4 className="font-medium text-purple-900 mb-2">
                <Key className="w-5 h-5 inline mr-2" />
                Changement de mot de passe pour: {selectedUser.nom || selectedUser.username}
              </h4>
              <p className="text-sm text-purple-800">
                L'utilisateur recevra un nouveau mot de passe temporaire
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe *</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Au moins 6 caractères"
                required
                minLength="6"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe *</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ressaisissez le mot de passe"
                required
                minLength="6"
              />
              {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <div className="bg-yellow-50 p-4 rounded-xl">
              <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>L'utilisateur devra utiliser ce nouveau mot de passe</li>
                <li>Il sera invité à le changer lors de sa prochaine connexion</li>
                <li>Assurez-vous de communiquer ce mot de passe de manière sécurisée</li>
              </ul>
            </div>
            
            <div className="flex space-x-4 pt-4">
              <button 
                type="submit" 
                disabled={changingPassword || passwordData.newPassword !== passwordData.confirmPassword}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {changingPassword ? (
                  <>
                    <div className="spinner w-4 h-4 inline mr-2"></div>
                    Modification...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 inline mr-2" />
                    Changer le mot de passe
                  </>
                )}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedUser(null);
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                  setMessage({ type: '', text: '' });
                }}
                disabled={changingPassword}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 font-medium"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Suppression/Désactivation */}
      <Modal 
        isOpen={showDeleteModal} 
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
          setPermanentDelete(false);
          setMessage({ type: '', text: '' });
        }} 
        title="Confirmer la Suppression" 
        size="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${permanentDelete ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center mb-3">
                <AlertTriangle className={`w-6 h-6 mr-3 ${permanentDelete ? 'text-red-600' : 'text-yellow-600'}`} />
                <h4 className={`font-medium ${permanentDelete ? 'text-red-900' : 'text-yellow-900'}`}>
                  {permanentDelete ? 'Attention : Suppression définitive !' : 'Désactivation de l\'utilisateur'}
                </h4>
              </div>
              <p className={`text-sm ${permanentDelete ? 'text-red-800' : 'text-yellow-800'}`}>
                {permanentDelete 
                  ? 'Vous êtes sur le point de supprimer définitivement l\'utilisateur. Cette action est IRRÉVERSIBLE !'
                  : 'L\'utilisateur sera désactivé et ne pourra plus se connecter, mais ses données seront conservées.'
                }
              </p>
              <div className="mt-3 p-3 bg-white rounded border">
                <p><strong>Nom:</strong> {selectedUser.nom}</p>
                <p><strong>Username:</strong> @{selectedUser.username}</p>
                <p><strong>Rôle:</strong> {getRoleLabel(selectedUser.role)}</p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Conséquences :</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                {permanentDelete ? (
                  <>
                    <li>L'utilisateur sera supprimé de la base de données</li>
                    <li>Toutes ses données personnelles seront effacées</li>
                    <li>Ses actions passées (demandes, productions) resteront pour l'historique</li>
                    <li>Cette action ne peut PAS être annulée</li>
                  </>
                ) : (
                  <>
                    <li>L'utilisateur ne pourra plus se connecter</li>
                    <li>Ses données et historique sont conservés</li>
                    <li>Il peut être réactivé à tout moment</li>
                    <li>Action recommandée et réversible</li>
                  </>
                )}
              </ul>
            </div>

            {!permanentDelete && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="permanentDelete"
                  checked={permanentDelete}
                  onChange={(e) => setPermanentDelete(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="permanentDelete" className="text-sm text-gray-700">
                  Supprimer définitivement au lieu de désactiver (non recommandé)
                </label>
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button 
                onClick={handleDeleteUser}
                disabled={deleting}
                className={`flex-1 py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-white ${
                  permanentDelete 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {deleting ? (
                  <>
                    <div className="spinner w-4 h-4 inline mr-2"></div>
                    {permanentDelete ? 'Suppression...' : 'Désactivation...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    {permanentDelete ? 'Supprimer définitivement' : 'Désactiver l\'utilisateur'}
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                  setPermanentDelete(false);
                  setMessage({ type: '', text: '' });
                }}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
