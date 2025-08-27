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

export default function PatisserieApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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
    { id: 'dashboard', label: 'Tableau de Bord', adminOnly: false },
    { id: 'stock', label: 'Stock Principal', adminOnly: false },
    { id: 'referentiel', label: 'Référentiel Produits', adminOnly: true }, 
    { id: 'stock-atelier', label: 'Stock Atelier', adminOnly: true },
    { id: 'stock-boutique', label: 'Stock Boutique', adminOnly: false },
    { id: 'recettes', label: 'Recettes', adminOnly: true },
    { id: 'demandes', label: 'Demandes', adminOnly: false },
    { id: 'production', label: 'Production', adminOnly: false },
    { id: 'caisse', label: 'Caisse', adminOnly: false },
    { id: 'comptabilite', label: 'Comptabilité', adminOnly: true },
    { id: 'unites', label: 'Unités', adminOnly: true },
    { id: 'equipe', label: 'Équipe', adminOnly: true },
    { 
      id: 'users', 
      label: 'Utilisateurs', 
      adminOnly: true, 
      proprietaireOnly: true
    }
  ];

  // Filtrer les onglets selon les permissions
  const visibleTabs = tabs.filter(tab => {
    if (!currentUser) return false;
    
    if (tab.proprietaireOnly) {
      return currentUser.role === 'admin' || currentUser.username === 'proprietaire';
    }
    return !tab.adminOnly || currentUser.role === 'admin';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-900">Chargement...</div>
          <div className="text-sm text-gray-500 mt-2">Vérification de l'authentification...</div>
        </div>
      </div>
    );
  }

  // Si pas connecté, afficher le formulaire de connexion
  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Si changement de mot de passe requis, bloquer l'accès
  if (passwordChangeRequired) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md w-full text-center p-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Changement de mot de passe requis</h2>
              <p className="text-gray-600 mb-6">
                Pour des raisons de sécurité, vous devez changer votre mot de passe avant d'accéder à l'application.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Connecté en tant que :</strong> {currentUser.nom || currentUser.username}
                </p>
                <p className="text-sm text-blue-600">
                  Rôle : {currentUser.role}
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
              >
                Changer maintenant
              </button>
            </div>
          </div>
        </div>
        
        <PasswordChangeModal 
          isOpen={showPasswordModal}
          user={currentUser}
          onPasswordChanged={handlePasswordChanged}
          onLogout={logout}
        />
      </>
    );
  }

  // Rendu du contenu selon l'onglet actif
  const renderContent = () => {
    try {
      switch (activeTab) {
        case 'dashboard':
          return <Dashboard stats={stats} loading={!stats} />;
        case 'stock':
          return <StockManager currentUser={currentUser} />;
        case 'stock-atelier':
          return currentUser.role === 'admin' ? 
            <StockAtelierManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'referentiel':
          return currentUser.role === 'admin' ? 
            <ReferentielManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'stock-boutique':
          return <StockBoutiqueManager currentUser={currentUser} />;
        case 'recettes':
          return currentUser.role === 'admin' ? 
            <RecettesManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'demandes':
          return <DemandesManager currentUser={currentUser} />;
        case 'production':
          return <ProductionManager currentUser={currentUser} />;
        case 'caisse':
          return <CaisseManager currentUser={currentUser} />;
        case 'comptabilite':
          return currentUser.role === 'admin' ? 
            <ComptabiliteManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'unites':
          return currentUser.role === 'admin' ? 
            <UnitesManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'equipe':
          return currentUser.role === 'admin' ? 
            <TeamManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'users':
          return (currentUser.role === 'admin' || currentUser.username === 'proprietaire') ? 
            <UserManagement currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        default:
          return <Dashboard stats={stats} loading={!stats} />;
      }
    } catch (error) {
      console.error('Erreur lors du rendu du contenu:', error);
      return (
        <div className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <h3 className="text-lg font-medium">Erreur de chargement</h3>
            <p className="text-sm">Une erreur s'est produite lors du chargement de cette section.</p>
            <p className="text-xs text-gray-500 mt-2">{error.message}</p>
          </div>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
          >
            Retour au tableau de bord
          </button>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        currentUser={currentUser} 
        stats={stats} 
        onLogout={logout} 
      />
      
      <Navigation 
        tabs={visibleTabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        stats={stats}
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
      
      <Footer />
    </div>
  );
}

