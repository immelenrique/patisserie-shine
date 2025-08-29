"use client";

import { useState, useEffect } from 'react';
import { authService, statsService } from '../lib/supabase';

// Import des composants
import LoginForm from '../components/auth/LoginForm';
import PasswordChangeModal from '../components/auth/PasswordChangeModal';
import { Header, Navigation, Footer } from '../components/layout';
import Dashboard from '../components/dashboard/Dashboard';

// Import des gestionnaires
import StockManager from '../components/stock/StockManager';
import StockAtelierManager from '../components/stock/StockAtelierManager';
import StockBoutiqueManager from '../components/stock/StockBoutiqueManager';
import DemandesManager from '../components/demandes/DemandesManager';
import ProductionManager from '../components/production/ProductionManager';
import RecettesManager from '../components/production/RecettesManager';
import CaisseManager from '../components/caisse/CaisseManager';
import ComptabiliteManager from '../components/comptabilite/ComptabiliteManager';
import UnitesManager from '../components/admin/UnitesManager';
import TeamManager from '../components/admin/TeamManager';
import UserManagement from '../components/admin/UserManagement';
import ReferentielManager from '../components/referentiel/ReferentielManager';
import PermissionsManager from '@/components/admin/PermissionsManager';
import { permissionsService } from '@/services/permissionsService';
import { Shield, Crown } from 'lucide-react';

export default function PatisserieApp() {
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
  useEffect(() => {
  if (currentUser) {
    loadUserPermissions();
  }
}, [currentUser]);
  useEffect(() => {
    if (currentUser && !passwordChangeRequired) {
      loadDashboardStats();
    }
  }, [currentUser, passwordChangeRequired]);

  // Filtrer les onglets selon permissions personnalisées
const getVisibleTabs = (user) => {
  if (user.username === 'proprietaire') return tabs; // Accès total
  
  const customPermissions = user.permissions_onglets || {};
  return tabs.filter(tab => {
    // Vérifier d'abord les permissions personnalisées
    if (customPermissions.hasOwnProperty(tab.id)) {
      return customPermissions[tab.id];
    }
    // Sinon utiliser les permissions par rôle par défaut
    return !tab.adminOnly || user.role === 'admin';
  });
};

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
          }
        } catch (passwordError) {
          console.warn('⚠️ Erreur vérification mot de passe (non bloquant):', passwordError);
          // Ne pas bloquer si la vérification échoue
        }
      }
    } catch (err) {
      console.error('Erreur authentification:', err);
    } finally {
      setLoading(false);
    }
  };
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
  const hasPermission = (permissionCode) => {
  // Si super admin, toutes les permissions
  if (currentUser?.is_super_admin) return true;
  
  // Sinon vérifier dans la liste
  return userPermissions.some(p => p.permission_code === permissionCode);
};

  const loadDashboardStats = async () => {
    try {
      const { stats, error } = await statsService.getDashboardStats();
      if (!error) {
        setStats(stats);
      }
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  };

  const logout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setStats(null);
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  const handlePasswordChanged = async () => {
    try {
      // Marquer le changement comme terminé
      await authService.markPasswordChangeComplete();

      setPasswordChangeRequired(false);
      setShowPasswordModal(false);

      // Recharger les stats après changement de mot de passe
      loadDashboardStats();

      console.log('✅ Mot de passe changé avec succès');
    } catch (error) {
      console.error('Erreur marquage changement mot de passe:', error);
      // Continuer quand même
      setPasswordChangeRequired(false);
      setShowPasswordModal(false);
    }
  };

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

  // Navigation tabs avec vérification des permissions
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

  // Filtrer les onglets selon les permissions
 const getVisibleTabs = () => {
  // Si permissions en chargement, montrer seulement dashboard
  if (permissionsLoading) {
    return tabs.filter(tab => tab.id === 'dashboard');
  }

  return tabs.filter(tab => {
    // Toujours visible ?
    if (tab.alwaysVisible) return true;
    
    // Réservé super admin ?
    if (tab.superAdminOnly) {
      return currentUser?.is_super_admin === true;
    }
    
    // Vérifier la permission
    return hasPermission(tab.permission);
  });
};

const visibleTabs = getVisibleTabs();

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
