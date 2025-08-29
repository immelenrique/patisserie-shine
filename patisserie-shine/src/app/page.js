// src/app/page.js - VERSION MODIFIÉE AVEC SYSTÈME DE PERMISSIONS

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import StockManager from '@/components/StockManager';
import ReferentielProduits from '@/components/ReferentielProduits';
import StockAtelier from '@/components/production/StockAtelier';
import StockBoutique from '@/components/boutique/StockBoutique';
import RecettesManager from '@/components/RecettesManager';
import DemandesManager from '@/components/DemandesManager';
import ProductionManager from '@/components/production/ProductionManager';
import Caisse from '@/components/Caisse';
import Comptabilite from '@/components/Comptabilite';
import UniteManager from '@/components/UniteManager';
import TeamManager from '@/components/admin/TeamManager';
import UserManagement from '@/components/admin/UserManagement';
// NOUVEAU : Import du composant PermissionsManager
import PermissionsManager from '@/components/admin/PermissionsManager';
import { authService } from '@/services/authService';
import { statsService } from '@/services/statsService';
// NOUVEAU : Import du service de permissions
import { permissionsService } from '@/services/permissionsService';
import { 
  LogOut, User, KeyRound, LayoutDashboard, Package, 
  ShoppingBag, Factory, ChefHat, FileText, Database, 
  Calculator, Ruler, Users, UserCog, Shield, Store,
  BookOpen, CreditCard, Crown
} from 'lucide-react';
import Modal from '@/components/Modal';

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // NOUVEAU : État pour stocker les permissions de l'utilisateur
  const [userPermissions, setUserPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // NOUVEAU : Charger les permissions quand l'utilisateur se connecte
  useEffect(() => {
    if (currentUser) {
      loadUserPermissions();
    }
  }, [currentUser]);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const passwordCheck = await authService.checkPasswordChangeRequired();
        if (passwordCheck.required) {
          setPasswordChangeRequired(true);
          setShowPasswordModal(true);
        } else {
          loadDashboardStats();
        }
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  // NOUVEAU : Fonction pour charger les permissions de l'utilisateur
  const loadUserPermissions = async () => {
    if (!currentUser) return;
    
    setPermissionsLoading(true);
    try {
      const { data, error } = await permissionsService.getUserPermissions(currentUser.id);
      if (!error && data) {
        setUserPermissions(data);
      }
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  // NOUVEAU : Fonction helper pour vérifier si l'utilisateur a une permission
  const hasPermission = (permissionCode) => {
    // Si l'utilisateur est super admin, il a toutes les permissions
    if (currentUser?.is_super_admin) return true;
    
    // Sinon, vérifier dans la liste des permissions
    return userPermissions.some(p => p.permission_code === permissionCode);
  };

  const loadDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const stats = await statsService.getDashboardStats();
      setDashboardStats(stats);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
    router.push('/');
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (result.error) {
        setPasswordError(result.error);
      } else {
        await authService.markPasswordAsChanged();
        alert('Mot de passe modifié avec succès !');
        setShowPasswordModal(false);
        setPasswordChangeRequired(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        loadDashboardStats();
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      setPasswordError('Une erreur est survenue');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleForcePasswordChange = async () => {
    try {
      await authService.markPasswordAsChanged();
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
    } catch (error) {
      console.error('Erreur marquage changement mot de passe:', error);
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
    }
  };

  const handleLogin = async (profile) => {
    setCurrentUser(profile);
    
    try {
      const passwordCheck = await authService.checkPasswordChangeRequired();
      if (passwordCheck.required) {
        setPasswordChangeRequired(true);
        setShowPasswordModal(true);
      } else {
        loadDashboardStats();
      }
    } catch (passwordError) {
      console.warn('Erreur vérification mot de passe à la connexion:', passwordError);
      loadDashboardStats();
    }
  };

  // MODIFICATION : Nouvelle structure des tabs avec permissions
  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Tableau de Bord',
      icon: LayoutDashboard,
      permission: 'dashboard_view', // Permission requise
      alwaysVisible: true // Toujours visible pour tous
    },
    { 
      id: 'stock', 
      label: 'Stock Principal',
      icon: Package,
      permission: 'stock_view'
    },
    { 
      id: 'referentiel', 
      label: 'Référentiel Produits',
      icon: Database,
      permission: 'referentiel_view'
    },
    { 
      id: 'stock-atelier', 
      label: 'Stock Atelier',
      icon: Factory,
      permission: 'stock_atelier_view'
    },
    { 
      id: 'stock-boutique', 
      label: 'Stock Boutique',
      icon: Store,
      permission: 'stock_boutique_view'
    },
    { 
      id: 'recettes', 
      label: 'Recettes',
      icon: BookOpen,
      permission: 'recettes_view'
    },
    { 
      id: 'demandes', 
      label: 'Demandes',
      icon: FileText,
      permission: 'demandes_view'
    },
    { 
      id: 'production', 
      label: 'Production',
      icon: ChefHat,
      permission: 'production_view'
    },
    { 
      id: 'caisse', 
      label: 'Caisse',
      icon: CreditCard,
      permission: 'caisse_view'
    },
    { 
      id: 'comptabilite', 
      label: 'Comptabilité',
      icon: Calculator,
      permission: 'comptabilite_view'
    },
    { 
      id: 'unites', 
      label: 'Unités',
      icon: Ruler,
      permission: 'unites_view'
    },
    { 
      id: 'equipe', 
      label: 'Équipe',
      icon: Users,
      permission: 'equipe_view'
    },
    { 
      id: 'users', 
      label: 'Utilisateurs',
      icon: UserCog,
      permission: 'users_view'
    },
    // NOUVEAU : Ajout de l'onglet Permissions
    { 
      id: 'permissions', 
      label: 'Permissions',
      icon: Shield,
      permission: 'permissions_manage_all',
      superAdminOnly: true // Réservé aux super admins
    }
  ];

  // MODIFICATION : Filtrer les tabs selon les permissions
  const getVisibleTabs = () => {
    // Si les permissions sont encore en chargement, afficher seulement le dashboard
    if (permissionsLoading) {
      return tabs.filter(tab => tab.id === 'dashboard');
    }

    // Filtrer selon les permissions
    return tabs.filter(tab => {
      // Toujours afficher les tabs marqués comme alwaysVisible
      if (tab.alwaysVisible) return true;
      
      // Vérifier si c'est réservé aux super admins
      if (tab.superAdminOnly) {
        return currentUser?.is_super_admin === true;
      }
      
      // Pour la rétrocompatibilité avec l'ancien système de rôles
      // Si pas de système de permissions, utiliser l'ancien système
      if (userPermissions.length === 0 && !permissionsLoading) {
        // Ancien système basé sur les rôles
        if (currentUser?.role === 'admin') return true;
        if (currentUser?.role === 'employe_production') {
          return ['dashboard', 'stock', 'stock-atelier', 'recettes', 'demandes', 'production'].includes(tab.id);
        }
        if (currentUser?.role === 'employe_boutique') {
          return ['dashboard', 'stock-boutique', 'demandes', 'caisse'].includes(tab.id);
        }
        return false;
      }
      
      // Nouveau système : vérifier la permission
      return hasPermission(tab.permission);
    });
  };

  const visibleTabs = getVisibleTabs();

  // Vérifier si l'onglet actif est toujours visible
  useEffect(() => {
    if (currentUser && !permissionsLoading) {
      const tabStillVisible = visibleTabs.some(tab => tab.id === activeTab);
      if (!tabStillVisible) {
        setActiveTab('dashboard');
      }
    }
  }, [visibleTabs, activeTab, currentUser, permissionsLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-orange-600">
                🍰 Pâtisserie Shine
              </h1>
              {/* NOUVEAU : Indicateur Super Admin */}
              {currentUser?.is_super_admin && (
                <span className="ml-3 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center">
                  <Crown className="w-3 h-3 mr-1" />
                  Super Admin
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser.nom || currentUser.username}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.role === 'admin' ? '👑 Administrateur' :
                   currentUser.role === 'employe_production' ? '👩‍🍳 Production' :
                   currentUser.role === 'employe_boutique' ? '🛒 Boutique' :
                   '👤 Utilisateur'}
                </p>
              </div>
              
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-500 hover:text-orange-600 transition-colors"
                title="Changer le mot de passe"
              >
                <KeyRound className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                  {/* NOUVEAU : Badge pour les onglets super admin */}
                  {tab.superAdminOnly && (
                    <Shield className="w-3 h-3 ml-1 text-yellow-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* NOUVEAU : Indicateur de chargement des permissions */}
        {permissionsLoading && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            Chargement des permissions...
          </div>
        )}
        
        {activeTab === 'dashboard' && (
          <Dashboard 
            user={currentUser} 
            stats={dashboardStats}
            loading={statsLoading}
            onRefresh={loadDashboardStats}
          />
        )}
        {activeTab === 'stock' && <StockManager currentUser={currentUser} />}
        {activeTab === 'referentiel' && <ReferentielProduits currentUser={currentUser} />}
        {activeTab === 'stock-atelier' && <StockAtelier currentUser={currentUser} />}
        {activeTab === 'stock-boutique' && <StockBoutique currentUser={currentUser} />}
        {activeTab === 'recettes' && <RecettesManager currentUser={currentUser} />}
        {activeTab === 'demandes' && <DemandesManager currentUser={currentUser} />}
        {activeTab === 'production' && <ProductionManager currentUser={currentUser} />}
        {activeTab === 'caisse' && <Caisse currentUser={currentUser} />}
        {activeTab === 'comptabilite' && <Comptabilite currentUser={currentUser} />}
        {activeTab === 'unites' && <UniteManager currentUser={currentUser} />}
        {activeTab === 'equipe' && <TeamManager currentUser={currentUser} />}
        {activeTab === 'users' && <UserManagement currentUser={currentUser} />}
        {/* NOUVEAU : Ajout du composant PermissionsManager */}
        {activeTab === 'permissions' && <PermissionsManager currentUser={currentUser} />}
      </main>

      {/* Modal changement mot de passe */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          if (!passwordChangeRequired) {
            setShowPasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordError('');
          }
        }}
        title={passwordChangeRequired ? "Changement de mot de passe obligatoire" : "Changer le mot de passe"}
      >
        <div className="space-y-4">
          {passwordChangeRequired && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Pour des raisons de sécurité, vous devez changer votre mot de passe avant de continuer.
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe actuel
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Entrez votre mot de passe actuel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Minimum 6 caractères"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Confirmez le nouveau mot de passe"
            />
          </div>

          {passwordError && (
            <div className="text-red-600 text-sm">{passwordError}</div>
          )}

          <div className="flex justify-end space-x-3">
            {!passwordChangeRequired && (
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
            )}
            
            {passwordChangeRequired && (
              <button
                onClick={handleForcePasswordChange}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Ignorer pour l'instant
              </button>
            )}
            
            <button
              onClick={handlePasswordChange}
              disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? 'Changement...' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
