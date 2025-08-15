"use client";

import { useState, useEffect } from 'react';
import { authService, statsService } from '../lib/supabase';

// Import des composants avec chemins relatifs corrects
import LoginForm from '../components/auth/LoginForm';
import { Header, Navigation, Footer } from '../components/layout';
import Dashboard from '../components/dashboard/Dashboard';

// Import dynamique des gestionnaires
import StockManager from '../components/stock/StockManager';
import StockAtelierManager from '../components/stock/StockAtelierManager';
import DemandesManager from '../components/demandes/DemandesManager';
import ProductionManager from '../components/production/ProductionManager';
import RecettesManager from '../components/production/RecettesManager';
import UnitesManager from '../components/admin/UnitesManager';
import TeamManager from '../components/admin/TeamManager';

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

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', adminOnly: false },
    { id: 'stock', label: 'Stock Principal', adminOnly: false },
    { id: 'stock-atelier', label: 'Stock Atelier', adminOnly: true },
    { id: 'recettes', label: 'Recettes', adminOnly: true },
    { id: 'demandes', label: 'Demandes', adminOnly: false },
    { id: 'production', label: 'Produit par atelier', adminOnly: false },
    { id: 'unites', label: 'Unités', adminOnly: true },
    { id: 'equipe', label: 'Équipe', adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => 
    !tab.adminOnly || currentUser?.role === 'admin'
  );

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

  // Rendu du contenu selon l'onglet actif
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={stats} loading={!stats} />;
      case 'stock':
        return <StockManager currentUser={currentUser} />;
      case 'stock-atelier':
        return currentUser.role === 'admin' ? 
          <StockAtelierManager currentUser={currentUser} /> : 
          <Dashboard stats={stats} loading={!stats} />;
      case 'recettes':
        return currentUser.role === 'admin' ? 
          <RecettesManager currentUser={currentUser} /> : 
          <Dashboard stats={stats} loading={!stats} />;
      case 'demandes':
        return <DemandesManager currentUser={currentUser} />;
      case 'production':
        return <ProductionManager currentUser={currentUser} />;
      case 'unites':
        return currentUser.role === 'admin' ? 
          <UnitesManager currentUser={currentUser} /> : 
          <Dashboard stats={stats} loading={!stats} />;
      case 'equipe':
        return currentUser.role === 'admin' ? 
          <TeamManager currentUser={currentUser} /> : 
          <Dashboard stats={stats} loading={!stats} />;
      default:
        return <Dashboard stats={stats} loading={!stats} />;
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

