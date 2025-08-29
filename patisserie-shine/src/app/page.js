// src/app/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTS CORRIGÉS selon votre arborescence réelle
// Si Dashboard est dans components/dashboard/Dashboard.js
import Dashboard from '../components/dashboard/Dashboard';

// Si ces fichiers existent directement dans components/
// Sinon, ajustez le chemin selon votre structure réelle
import LoginForm from '../components/auth/LoginForm'
import StockManager from  '../components/stock/StockManager';
import ReferentielManager from '../components/referentiel/ReferentielManager';
import StockAtelierManager from '../components/stock/StockAtelierManager';
import StockBoutiqueManager from '../components/stock/StockBoutiqueManager';
import RecettesManager from '../components/production/RecettesManager';
import DemandesManager from '../components/demandes/DemandesManager';
import ProductionManager from '../components/production/ProductionManager';
import CaisseManager from '../components/caisse/CaisseManager';
import ComptabiliteManager from '../components/comptabilite/ComptabiliteManager';
import UnitesManager from '../components/admin/UnitesManager'
import TeamManager from '../components/admin/TeamManager';
import UserManagement from '../components/admin/UserManagement';
import PermissionsManager from '../components/admin/PermissionsManager';
import Modal from '../components/ui/Modal';

import { authService } from '@/services/authService';
import { statsService } from '@/services/statsService';
import { permissionsService } from '@/services/permissionsService';

import { 
  LogOut, User, KeyRound, LayoutDashboard, Package, 
  ShoppingBag, Factory, ChefHat, FileText, Database, 
  Calculator, Ruler, Users, UserCog, Shield, Store,
  BookOpen, CreditCard, Crown, AlertTriangle
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  
  // États utilisateur et authentification
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // État navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // États permissions
  const [userPermissions, setUserPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  
  // États mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ 
    currentPassword: '', 
    newPassword: '', 
    confirmPassword: '' 
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  
  // États dashboard
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Vérification initiale de l'authentification
  useEffect(() => {
    checkAuth();
  }, []);

  // Chargement des permissions quand l'utilisateur se connecte
  useEffect(() => {
    if (currentUser) {
      loadUserPermissions();
    }
  }, [currentUser]);

  // Vérifier l'authentification
  const checkAuth = async () => {
    try {
      const { user, profile } = await authService.getCurrentUser();
      
      if (profile) {
        setCurrentUser(profile);
        
        // Vérifier si le changement de mot de passe est requis
        try {
          const passwordCheck = await authService.checkPasswordChangeRequired();
          if (passwordCheck.required) {
            console.log('🔒 Changement de mot de passe requis pour:', profile.username);
            setPasswordChangeRequired(true);
            setShowPasswordModal(true);
          } else {
            console.log('✅ Mot de passe à jour pour:', profile.username);
            loadDashboardStats();
          }
        } catch (passwordError) {
          console.warn('⚠️ Erreur vérification mot de passe (non bloquant):', passwordError);
          // Ne pas bloquer si la vérification échoue
          loadDashboardStats();
        }
      }
    } catch (err) {
      console.error('Erreur authentification:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les permissions de l'utilisateur
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
      // En cas d'erreur, on continue avec le système de rôles classique
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Vérifier si l'utilisateur a une permission
  const hasPermission = (permissionCode) => {
    // Si super admin, toutes les permissions
    if (currentUser?.is_super_admin) return true;
    
    // Sinon vérifier dans la liste des permissions
    return userPermissions.some(p => p.permission_code === permissionCode);
  };

  // Charger les statistiques du dashboard
  const loadDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const { stats, error } = await statsService.getDashboardStats();
      if (!error) {
        setStats(stats);
      }
    } catch (err) {
      console.error('Erreur stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Déconnexion
  const logout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setStats(null);
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
      setUserPermissions([]);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  // Gérer le changement de mot de passe
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
        // Marquer le changement comme terminé
        await authService.markPasswordChangeComplete();
        
        alert('Mot de passe modifié avec succès !');
        setShowPasswordModal(false);
        setPasswordChangeRequired(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        
        // Recharger les stats après changement
        loadDashboardStats();
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      setPasswordError('Une erreur est survenue');
    } finally {
      setChangingPassword(false);
    }
  };

  // Ignorer temporairement le changement de mot de passe
  const handleSkipPasswordChange = async () => {
    try {
      await authService.markPasswordChangeComplete();
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
      loadDashboardStats();
    } catch (error) {
      console.error('Erreur marquage changement mot de passe:', error);
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
    }
  };

  // Gérer la connexion
  const handleLogin = async (profile) => {
    setCurrentUser(profile);
    
    // Vérifier immédiatement le changement de mot de passe
    try {
      const passwordCheck = await authService.checkPasswordChangeRequired();
      if (passwordCheck.required) {
        console.log('🔒 Changement de mot de passe requis à la connexion');
        setPasswordChangeRequired(true);
        setShowPasswordModal(true);
      } else {
        // Charger les stats seulement si pas de changement requis
        loadDashboardStats();
      }
    } catch (passwordError) {
      console.warn('⚠️ Erreur vérification mot de passe à la connexion:', passwordError);
      // Continuer sans bloquer
      loadDashboardStats();
    }
  };

  // Définition des tabs avec permissions
  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Tableau de Bord',
      icon: LayoutDashboard,
      permission: 'dashboard_view',
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
    { 
      id: 'permissions', 
      label: 'Permissions',
      icon: Shield,
      permission: 'permissions_manage_all',
      superAdminOnly: true // Réservé aux super admins
    }
  ];

  // Filtrer les tabs selon les permissions
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
        if (currentUser?.role === 'admin' || currentUser?.username === 'proprietaire') {
          return true;
        }
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

  // Écran de chargement
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

  // Écran de connexion
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Interface principale
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
              {/* Indicateur Super Admin */}
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
                  {currentUser.is_super_admin ? '⚡ Super Admin' :
                   currentUser.role === 'admin' ? '👑 Administrateur' :
                   currentUser.role === 'employe_production' ? '👩‍🍳 Production' :
                   currentUser.role === 'employe_boutique' ? '🛒 Boutique' :
                   '👤 Utilisateur'}
                </p>
              </div>
              
              <button
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordChangeRequired(false);
                }}
                className="p-2 text-gray-500 hover:text-orange-600 transition-colors"
                title="Changer le mot de passe"
              >
                <KeyRound className="h-5 w-5" />
              </button>
              
              <button
                onClick={logout}
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
        {/* Indicateur de chargement des permissions */}
        {permissionsLoading && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
            Chargement des permissions...
          </div>
        )}
        
        {/* Rendu conditionnel des composants selon l'onglet actif */}
        {activeTab === 'dashboard' && (
          <Dashboard 
            user={currentUser} 
            stats={stats}
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
                <AlertTriangle className="inline w-4 h-4 mr-1" />
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
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {passwordError}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            {!passwordChangeRequired && (
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
            )}
            
            {passwordChangeRequired && (
              <button
                onClick={handleSkipPasswordChange}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Plus tard
              </button>
            )}
            
            <button
              onClick={handlePasswordChange}
              disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {changingPassword ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Changement...
                </>
              ) : (
                'Changer le mot de passe'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}






