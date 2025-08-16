"use client";

import { useState, useEffect } from 'react';
import { authService, statsService } from '../lib/supabase';

// Import des composants
import LoginForm from '../components/auth/LoginForm';
import { Header, Navigation, Footer } from '../components/layout';
import Dashboard from '../components/dashboard/Dashboard';

// Import dynamique des gestionnaires
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
import PrixVenteManager from '../components/caisse/PrixVenteManager';


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

  // Navigation tabs avec les nouveaux onglets
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', adminOnly: false },
    { id: 'stock', label: 'Stock Principal', adminOnly: false },
    { id: 'stock-atelier', label: 'Stock Atelier', adminOnly: true },
    { id: 'stock-boutique', label: 'Stock Boutique', adminOnly: false },
    { id: 'recettes', label: 'Recettes', adminOnly: true },
    { id: 'demandes', label: 'Demandes', adminOnly: false },
    { id: 'production', label: 'Production', adminOnly: false },
    { id: 'caisse', label: 'Caisse', adminOnly: false },
    { id: 'prix-vente', label: 'Prix Vente', adminOnly: true, proprietaireOnly: true },
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
    if (tab.proprietaireOnly) {
      return currentUser?.role === 'admin' || currentUser?.username === 'proprietaire';
    }
    return !tab.adminOnly || currentUser?.role === 'admin';
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
      case 'prix-vente':
        return (currentUser.role === 'admin' || currentUser.username === 'proprietaire') ? 
          <PrixVenteManager currentUser={currentUser} /> : 
          <Dashboard stats={stats} loading={!stats} />;
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


