"use client";

import { useState, useEffect } from 'react';
import { userService } from '../../lib/supabase';
import { Plus, Users, User, Crown, ChefHat, ShoppingBag, Trash2, Edit, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    nom: '',
    telephone: '',
    role: 'employe_boutique',
    password: ''
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
      const { users, error } = await userService.getAll();
      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setUsers(users);
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
      const { user, error } = await userService.createUser({
        username: formData.username,
        nom: formData.nom,
        telephone: formData.telephone,
        role: formData.role,
        password: formData.password
      });

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: `Utilisateur ${formData.username} créé avec succès !` });
        setShowAddModal(false);
        resetForm();
        loadUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la création de l\'utilisateur' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setDeleting(true);
    setMessage({ type: '', text: '' });

    try {
      const { success, error } = await userService.deleteUser(selectedUser.id);

      if (error) {
        setMessage({ type: 'error', text: error });
      } else {
        setMessage({ type: 'success', text: `Utilisateur ${selectedUser.nom || selectedUser.username} supprimé avec succès !` });
        setShowDeleteModal(false);
        setSelectedUser(null);
        loadUsers();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression de l\'utilisateur' });
    } finally {
      setDeleting(false);
    }
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
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvel Utilisateur</span>
        </button>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total utilisateurs</p>
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
      
      {/* Liste des utilisateurs */}
      {users.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
          <p className="text-gray-500 mb-4">Commencez par créer votre premier utilisateur</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
          >
            Créer un utilisateur
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => {
            const RoleIcon = getRoleIcon(user.role);
            const isCurrentUser = user.id === currentUser.id;
            const canDelete = !isCurrentUser && user.username !== 'proprietaire';
            
            return (
              <Card key={user.id} className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-lg font-semibold">
                      {user.nom?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {user.nom || 'Nom non défini'}
                      {isCurrentUser && <span className="text-xs text-blue-600 ml-2">(Vous)</span>}
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
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-500">Actif</span>
                    </div>
                  </div>

                  {user.telephone && (
                    <div className="text-sm text-gray-600">
                      📞 {user.telephone}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Créé le {new Date(user.created_at || Date.now()).toLocaleDateString('fr-FR')}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 pt-3 border-t">
                    <button
                      className="flex-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4 inline mr-1" />
                      Modifier
                    </button>
                    
                    {canDelete && (
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDeleteModal(true);
                        }}
                        className="flex-1 text-red-600 hover:text-red-800 text-sm font-medium"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" />
                        Supprimer
                      </button>
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
            <p className="text-xs text-gray-500 mt-1">
              L'utilisateur pourra le changer lors de sa première connexion
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

      {/* Modal Suppression */}
      <Modal 
        isOpen={showDeleteModal} 
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
          setMessage({ type: '', text: '' });
        }} 
        title="Confirmer la Suppression" 
        size="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
              <div className="flex items-center mb-3">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                <h4 className="font-medium text-red-900">Attention : Action irréversible</h4>
              </div>
              <p className="text-red-800 text-sm">
                Vous êtes sur le point de supprimer définitivement l'utilisateur :
              </p>
              <div className="mt-3 p-3 bg-white rounded border">
                <p><strong>Nom:</strong> {selectedUser.nom}</p>
                <p><strong>Username:</strong> @{selectedUser.username}</p>
                <p><strong>Rôle:</strong> {getRoleLabel(selectedUser.role)}</p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <h4 className="font-medium text-yellow-900 mb-2">Conséquences de la suppression :</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>L'utilisateur ne pourra plus se connecter</li>
                <li>Ses données (demandes, productions) resteront dans le système</li>
                <li>Cette action ne peut pas être annulée</li>
              </ul>
            </div>

            <div className="flex space-x-4 pt-4">
              <button 
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {deleting ? (
                  <>
                    <div className="spinner w-4 h-4 inline mr-2"></div>
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    Oui, supprimer définitivement
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
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
