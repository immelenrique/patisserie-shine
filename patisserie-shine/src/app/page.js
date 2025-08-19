"use client";

import { useState, useEffect } from 'react';
import { authService, statsService } from '../lib/supabase';

// Import des composants
import LoginForm from '../components/auth/LoginForm';
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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDashboardStats();
    }
  }, [currentUser]);

  const checkAuth = async () => {
    try {
      const { user, profile } = await authService.getCurrentUser();
      if (profile) {
        setCurrentUser(profile);
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
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  // Navigation tabs avec vérification des permissions (SUPPRESSION DE PRIX-VENTE)
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
        <div className="text-xl font-semibold text-gray-900">Chargement...</div>
      </div>
    );
  }

  // Si pas connecté, afficher le formulaire de connexion
  if (!currentUser) {
    return <LoginForm onLogin={setCurrentUser} />;
  }

  // Rendu du contenu selon l'onglet actif (SUPPRESSION DU CAS PRIX-VENTE)
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
        case 'referentiel': // ← NOUVEAU
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
          </div>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="btn-primary"
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

