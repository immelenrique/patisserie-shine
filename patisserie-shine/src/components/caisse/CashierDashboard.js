// src/components/caisse/CashierDashboard.js
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Clock, 
  Calendar,
  User,
  Users,
  Filter,
  Download,
  Receipt,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Eye,
  Loader2,
  Trophy
} from 'lucide-react';
import { Card, StatCard } from '../ui';
import { cashierDashboardService } from '../../services/cashierDashboardService';
import { authService } from '../../lib/supabase';
import { utils } from '../../lib/utils';

// Composant de graphique des ventes
const SalesChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.montant), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end space-x-2 min-w-[600px] h-48">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg relative transition-all hover:from-blue-600 hover:to-blue-500" 
              style={{ height: `${(item.montant / maxValue) * 100}%` }}
            >
              <div className="absolute -top-8 left-0 right-0 text-center">
                <span className="text-xs font-semibold text-gray-700">
                  {utils.formatCFA(item.montant)}
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-600 mt-2">{item.heure}</span>
            <span className="text-xs text-gray-500">{item.ventes} vente{item.ventes > 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant principal
export default function CashierDashboard() {
  // États
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCashier, setSelectedCashier] = useState('current');
  const [viewMode, setViewMode] = useState('day');
  const [salesData, setSalesData] = useState(null);
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Auto-refresh toutes les 30 secondes en production
  useEffect(() => {
    const interval = setInterval(() => {
      if (!exportLoading) {
        loadSalesData(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedDate, selectedCashier, viewMode, exportLoading]);

  // Chargement initial
  useEffect(() => {
    initializeDashboard();
  }, []);

  // Rechargement lors des changements de filtres
  useEffect(() => {
    if (currentUser) {
      loadSalesData();
    }
  }, [selectedDate, selectedCashier, viewMode, currentUser]);

  // Initialisation du dashboard
  const initializeDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer l'utilisateur actuel
      const { user, error: userError } = await authService.getCurrentUser();
      if (userError) {
        throw new Error(userError);
      }

      if (!user) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      setCurrentUser(user);

      // Si admin, charger la liste des caissiers
      if (user.role === 'admin') {
        await loadCashiers();
      }

      // Charger les données de vente
      await loadSalesData();
    } catch (err) {
      console.error('Erreur initialisation dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Charger la liste des caissiers
  const loadCashiers = async () => {
    try {
      const { success, data, error } = await cashierDashboardService.getActiveCashiers();
      
      if (!success) {
        console.error('Erreur chargement caissiers:', error);
        return;
      }

      setCashiers(data || []);
    } catch (err) {
      console.error('Erreur loadCashiers:', err);
    }
  };

  // Charger les données de vente
  const loadSalesData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Déterminer l'ID du caissier à utiliser
      let cashierId = null;
      if (currentUser?.role === 'admin' && selectedCashier !== 'current' && selectedCashier !== 'all') {
        cashierId = selectedCashier;
      } else if (currentUser?.role === 'employe_boutique' || selectedCashier === 'current') {
        cashierId = currentUser?.id;
      }

      const params = {
        date: selectedDate,
        cashierId: cashierId,
        viewMode: viewMode,
        currentUserId: currentUser?.id,
        userRole: currentUser?.role
      };

      const { success, data, error } = await cashierDashboardService.getSalesStats(params);

      if (!success) {
        throw new Error(error || 'Erreur lors du chargement des données');
      }

      setSalesData(data);
    } catch (err) {
      console.error('Erreur loadSalesData:', err);
      if (!isRefresh) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Export des données
  const handleExport = async (format = 'csv') => {
    try {
      setExportLoading(true);

      const params = {
        date: selectedDate,
        cashierId: selectedCashier === 'all' ? null : 
                   selectedCashier === 'current' ? currentUser?.id : 
                   selectedCashier,
        viewMode: viewMode,
        format: format
      };

      const { success, error } = await cashierDashboardService.exportSalesData(params);

      if (!success) {
        throw new Error(error || 'Erreur lors de l\'export');
      }

      // Message de succès
      alert(`Export ${format.toUpperCase()} réalisé avec succès !`);
    } catch (err) {
      console.error('Erreur export:', err);
      alert(`Erreur lors de l'export: ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Rafraîchir manuellement
  const handleRefresh = () => {
    loadSalesData(true);
  };

  // Calculs dérivés
  const isAdmin = currentUser?.role === 'admin';
  const canViewAllCashiers = isAdmin;

  // Formatage de la période affichée
  const getDisplayPeriod = useMemo(() => {
    const date = new Date(selectedDate);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    
    switch (viewMode) {
      case 'week':
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `Semaine du ${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${weekEnd.toLocaleDateString('fr-FR', options)}`;
      case 'month':
        return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
      default:
        return date.toLocaleDateString('fr-FR', options);
    }
  }, [selectedDate, viewMode]);

  // Gestion des erreurs
  if (error && !loading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={initializeDashboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Réessayer
          </button>
        </div>
      </Card>
    );
  }

  // Chargement initial
  if (loading && !salesData) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Chargement du tableau de bord...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isAdmin ? 'Tableau de Bord des Ventes' : 'Mes Ventes'}
              </h2>
              <p className="text-gray-600 mt-1">{getDisplayPeriod}</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Sélecteur de vue */}
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading || refreshing}
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>

              {/* Sélecteur de date */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading || refreshing}
              />

              {/* Sélecteur de caissier (admin uniquement) */}
              {canViewAllCashiers && (
                <select
                  value={selectedCashier}
                  onChange={(e) => setSelectedCashier(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading || refreshing}
                >
                  <option value="current">Mes ventes</option>
                  <option value="all">Tous les caissiers</option>
                  {cashiers.map(cashier => (
                    <option key={cashier.id} value={cashier.id}>
                      {cashier.nom}
                    </option>
                  ))}
                </select>
              )}

              {/* Bouton rafraîchir */}
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualisation...' : 'Actualiser'}
              </button>

              {/* Menu export */}
              <div className="relative group">
                <button
                  disabled={exportLoading || !salesData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {exportLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Exporter
                    </>
                  )}
                </button>
                {!exportLoading && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-t-lg"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-b-lg"
                    >
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d'Affaires"
          value={utils.formatCFA(salesData?.totalVentes || 0)}
          icon={DollarSign}
          color="green"
          change={`${salesData?.nombreVentes || 0} vente${(salesData?.nombreVentes || 0) > 1 ? 's' : ''}`}
          loading={refreshing}
        />
        <StatCard
          title="Ticket Moyen"
          value={utils.formatCFA(salesData?.ticketMoyen || 0)}
          icon={Receipt}
          color="blue"
          change="Par transaction"
          loading={refreshing}
        />
        <StatCard
          title="Articles Vendus"
          value={utils.formatNumber(salesData?.produitsVendus || 0)}
          icon={ShoppingCart}
          color="purple"
          change="Total produits"
          loading={refreshing}
        />
        <StatCard
          title="Paiements Cash"
          value={salesData?.totalVentes > 0 
            ? `${Math.round((salesData?.totalCash / salesData?.totalVentes) * 100)}%`
            : '0%'}
          icon={BarChart3}
          color="orange"
          change={utils.formatCFA(salesData?.totalCash || 0)}
          loading={refreshing}
        />
      </div>

      {/* Graphique des ventes */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Évolution des Ventes</h3>
          <SalesChart 
            data={salesData?.ventesParHeure || []} 
            loading={refreshing}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top produits */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top 10 Produits</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {salesData?.topProduits?.length > 0 ? (
                salesData.topProduits.map((produit, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 ${index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'} rounded-full flex items-center justify-center font-semibold text-sm`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{produit.nom}</p>
                        <p className="text-sm text-gray-500">
                          {utils.formatNumber(produit.quantite)} unité{produit.quantite > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-green-600">
                      {utils.formatCFA(produit.montant)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Aucune vente pour cette période</p>
              )}
            </div>
          </div>
        </Card>

        {/* Dernières ventes */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Dernières Transactions</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {salesData?.dernieresVentes?.length > 0 ? (
                salesData.dernieresVentes.map((vente, index) => (
                  <div key={vente.id || index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">#{vente.id}</p>
                        <p className="text-sm text-gray-500">
                          {vente.heure} - {utils.formatNumber(vente.articles)} article{vente.articles > 1 ? 's' : ''}
                        </p>
                        {isAdmin && vente.vendeur && (
                          <p className="text-xs text-gray-400">{vente.vendeur}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{utils.formatCFA(vente.montant)}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        vente.paiement === 'Exact' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {vente.paiement === 'Exact' ? 'Paiement exact' : 'Espèces'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Aucune transaction pour cette période</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Statistiques par caissier (admin uniquement) */}
      {isAdmin && selectedCashier === 'all' && (
        <CashierStatsTable 
          date={selectedDate} 
          viewMode={viewMode}
          loading={refreshing}
        />
      )}
    </div>
  );
}

// Composant tableau des statistiques par caissier
const CashierStatsTable = ({ date, viewMode, loading }) => {
  const [cashierStats, setCashierStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadCashierStats();
  }, [date, viewMode]);

  const loadCashierStats = async () => {
    try {
      setLoadingStats(true);
      const { success, data } = await cashierDashboardService.getSalesByCashier({ date, viewMode });
      
      if (success) {
        setCashierStats(data || []);
      }
    } catch (err) {
      console.error('Erreur chargement stats caissiers:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loadingStats || loading) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance par Caissier</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Caissier</th>
                <th className="text-right py-3 px-4">Nombre de Ventes</th>
                <th className="text-right py-3 px-4">Chiffre d'Affaires</th>
                <th className="text-right py-3 px-4">Ticket Moyen</th>
                <th className="text-right py-3 px-4">Première Vente</th>
                <th className="text-right py-3 px-4">Dernière Vente</th>
              </tr>
            </thead>
            <tbody>
              {cashierStats.length > 0 ? (
                cashierStats.map((stat) => (
                  <tr key={stat.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{stat.nom}</td>
                    <td className="text-right py-3 px-4">{stat.nombreVentes}</td>
                    <td className="text-right py-3 px-4 font-semibold">
                      {utils.formatCFA(stat.totalVentes)}
                    </td>
                    <td className="text-right py-3 px-4">
                      {utils.formatCFA(stat.ticketMoyen)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-500">
                      {stat.premiereVente ? new Date(stat.premiereVente).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-gray-500">
                      {stat.derniereVente ? new Date(stat.derniereVente).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    Aucune donnée disponible
                  </td>
                </tr>
              )}
            </tbody>
            {cashierStats.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-gray-50">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">
                    {cashierStats.reduce((sum, s) => sum + s.nombreVentes, 0)}
                  </td>
                  <td className="text-right py-3 px-4 text-green-600">
                    {utils.formatCFA(cashierStats.reduce((sum, s) => sum + s.totalVentes, 0))}
                  </td>
                  <td className="text-right py-3 px-4">
                    {utils.formatCFA(
                      cashierStats.reduce((sum, s) => sum + s.totalVentes, 0) / 
                      Math.max(cashierStats.reduce((sum, s) => sum + s.nombreVentes, 0), 1)
                    )}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Card>
  );
};
