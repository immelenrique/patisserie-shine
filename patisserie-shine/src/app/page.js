// src/app/page.js
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTS CORRIGÉS avec les bons noms
import Dashboard from '../components/dashboard/Dashboard';
import LoginForm from '../components/auth/LoginForm';
import StockManager from '../components/stock/StockManager';
import ReferentielManager from '../components/referentiel/ReferentielManager';
import StockAtelierManager from '../components/stock/StockAtelierManager';
import StockBoutiqueManager from '../components/stock/StockBoutiqueManager';
import RecettesManager from '../components/production/RecettesManager';
import DemandesManager from '../components/demandes/DemandesManager';
import ProductionManager from '../components/production/ProductionManager';
import CaisseManager from '../components/caisse/CaisseManager';
import ComptabiliteManager from '../components/comptabilite/ComptabiliteManager';
import UnitesManager from '../components/admin/UnitesManager';
import TeamManager from '../components/admin/TeamManager';
import UserManagement from '../components/admin/UserManagement';
import PermissionsManager from '../components/admin/PermissionsManager';
import { Modal } from '../components/ui';
import { statsService } from '../lib/supabase';
import { supabase, authService, userService } from '../lib/supabase';
import { permissionsService } from '../services/permissionsService';

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
  const [sessionError, setSessionError] = useState(false);
  
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

  // useEffect DOIT être APRÈS tous les useState
  useEffect(() => {
  let mounted = true;
  
  const initializeAuth = async () => {
    try {
      // AJOUT : Nettoyer les sessions corrompues
      if (authService.cleanupSession) {
        await authService.cleanupSession();
      }
      
      if (!mounted) return;
      
      const { user, profile, error } = await authService.getCurrentUser();
      
      if (user && profile) {
        setCurrentUser({ ...user, profile });
      } else {
        setSessionError(true);
      }
    } catch (error) {
      console.error('Erreur initialisation auth:', error);
      setSessionError(true);
    } finally {
      if (mounted) setLoading(false);
    }
  };

  initializeAuth();
  
  // Écouter les changements d'état d'authentification
  const authListener = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state change:', event);
      
      if (event === 'SIGNED_IN' && session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setCurrentUser({ ...session.user, profile });
        setSessionError(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    }
  );

  return () => {
    mounted = false;
    authListener.data.subscription?.unsubscribe();
  };
}, []);

 

  // Chargement des permissions quand l'utilisateur se connecte
  useEffect(() => {
  if (currentUser?.id && !permissionsLoading) {
    loadUserPermissions();
  }
}, [currentUser?.id]);


  // Vérifier l'authentification
  const checkAuth = async () => {
    try {
      const { user, profile } = await authService.getCurrentUser();
      
      if (profile) {
       setCurrentUser(prev => ({ ...prev, ...profile }));

        
        // Vérifier si le changement de mot de passe est requis
        const { required } = await authService.checkPasswordChangeRequired(profile.id);
        if (required) {
          setPasswordChangeRequired(true);
          setShowPasswordModal(true);
        } else {
          // Charger les stats du dashboard
          loadDashboardStats();
        }
      }
    } catch (err) {
      console.error('Erreur auth:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les permissions de l'utilisateur
  const loadUserPermissions = async () => {
  if (!currentUser?.id) return;
  
  // Empêcher les appels multiples
  if (permissionsLoading) return;
  
  setPermissionsLoading(true);
  try {
    const { data, error } = await permissionsService.getUserPermissions(currentUser.id);
    if (!error && data) {
      setUserPermissions(data);
    }
  } catch (err) {
    console.error('Erreur chargement permissions:', err);
  } finally {
    setPermissionsLoading(false);
  }
};

  // Vérifier si l'utilisateur a une permission
  const hasPermission = (permissionCode) => {
    if (currentUser?.role === 'admin' || currentUser?.username === 'proprietaire') {
      return true;
    }
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
    // Pour le changement initial, utiliser changeInitialPassword
    if (passwordChangeRequired) {
      const result = await authService.changeInitialPassword(
        passwordData.newPassword,
        currentUser?.id
      );
      
      if (result.error) {
        setPasswordError(result.error);
      } else {
        alert('Mot de passe modifié avec succès !');
        setShowPasswordModal(false);
        setPasswordChangeRequired(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        loadDashboardStats();
      }
    } else {
      // Pour un changement normal (pas implémenté pour l'instant)
      setPasswordError('Changement de mot de passe normal non disponible');
    }
  } catch (err) {
    setPasswordError('Erreur lors du changement de mot de passe');
    console.error('Erreur:', err);
  } finally {
    setChangingPassword(false);
  }
};
  // Configuration des onglets
  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'view_dashboard' },
    { id: 'stock', label: 'Stock Principal', icon: Package, permission: 'view_stock' },
    { id: 'referentiel', label: 'Référentiel Produits', icon: Database, permission: 'view_referentiel' },
    { id: 'stock-atelier', label: 'Stock Atelier', icon: Factory, permission: 'view_stock_atelier' },
    { id: 'stock-boutique', label: 'Stock Boutique', icon: Store, permission: 'view_stock_boutique' },
    { id: 'recettes', label: 'Recettes', icon: BookOpen, permission: 'view_recettes' },
    { id: 'demandes', label: 'Demandes', icon: FileText, permission: 'view_demandes' },
    { id: 'production', label: 'Production', icon: ChefHat, permission: 'view_production' },
    { id: 'caisse', label: 'Caisse', icon: CreditCard, permission: 'view_caisse' },
    { id: 'comptabilite', label: 'Comptabilité', icon: Calculator, permission: 'view_comptabilite' },
    { id: 'unites', label: 'Unités', icon: Ruler, permission: 'manage_units', adminOnly: true },
    { id: 'equipe', label: 'Équipe', icon: Users, permission: 'manage_team', adminOnly: true },
    { id: 'users', label: 'Utilisateurs', icon: UserCog, permission: 'manage_users', adminOnly: true },
    { id: 'permissions', label: 'Permissions', icon: Shield, permission: 'manage_permissions', superAdminOnly: true }
  ];

  // Filtrer les onglets selon les permissions
  const availableTabs = tabs.filter(tab => {
    if (tab.superAdminOnly) {
      return currentUser?.username === 'proprietaire';
    }
    if (tab.adminOnly) {
      return currentUser?.role === 'admin' || currentUser?.username === 'proprietaire';
    }
    return hasPermission(tab.permission);
  });

  // Si chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si non connecté
  if (!currentUser) {
    return <LoginForm onLogin={(user) => {
      setCurrentUser(user);
      checkAuth();
    }} />;
  }

  // Interface principale
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
                Pâtisserie Shine
              </h1>
              {currentUser?.username === 'proprietaire' && (
                <Crown className="w-5 h-5 text-yellow-500 ml-2" />
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{currentUser.nom || currentUser.username}</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                  {currentUser.role}
                </span>
              </div>
              
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-500 hover:text-orange-600 transition-colors"
                title="Changer le mot de passe"
              >
                <KeyRound className="w-5 h-5" />
              </button>
              
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Content - CORRIGÉ avec les bons noms de composants */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'dashboard' && (
          <Dashboard 
            user={currentUser} 
            stats={stats}
            loading={statsLoading}
            onRefresh={loadDashboardStats}
          />
        )}
        {activeTab === 'stock' && <StockManager currentUser={currentUser} />}
        {activeTab === 'referentiel' && <ReferentielManager currentUser={currentUser} />}
        {activeTab === 'stock-atelier' && <StockAtelierManager currentUser={currentUser} />}
        {activeTab === 'stock-boutique' && <StockBoutiqueManager currentUser={currentUser} />}
        {activeTab === 'recettes' && <RecettesManager currentUser={currentUser} />}
        {activeTab === 'demandes' && <DemandesManager currentUser={currentUser} />}
        {activeTab === 'production' && <ProductionManager currentUser={currentUser} />}
        {activeTab === 'caisse' && <CaisseManager currentUser={currentUser} />}
        {activeTab === 'comptabilite' && <ComptabiliteManager currentUser={currentUser} />}
        {activeTab === 'unites' && <UnitesManager currentUser={currentUser} />}
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
        title={passwordChangeRequired ? 
          "Changement de mot de passe requis" : 
          "Changer le mot de passe"
        }
      >
        {passwordChangeRequired && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
              <p className="text-sm text-yellow-800">
                Vous devez changer votre mot de passe avant de pouvoir continuer.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe actuel
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={changingPassword}
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
              disabled={changingPassword}
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
              disabled={changingPassword}
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}

          <div className="flex justify-end space-x-3">
            {!passwordChangeRequired && (
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={changingPassword}
              >
                Annuler
              </button>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? 'Changement...' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}










