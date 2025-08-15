"use client";

import { useState, useEffect } from 'react';
import { stockAtelierService, productService, utils } from '../../lib/supabase';
import { Package, AlertTriangle, Clock, TrendingUp, TrendingDown, Warehouse, ArrowRight } from 'lucide-react';
import { Card, StatCard } from '../ui';

export default function StockAtelierManager({ currentUser }) {
  const [stockAtelier, setStockAtelier] = useState([]);
  const [produits, setProduits] = useState([]);
  const [transferts, setTransferts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('stock');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, produitsResult, transfertsResult] = await Promise.all([
        stockAtelierService.getStockAtelier(),
        productService.getAll(),
        stockAtelierService.getHistoriqueTransferts()
      ]);

      if (stockResult.error) throw new Error(stockResult.error);
      if (produitsResult.error) throw new Error(produitsResult.error);
      if (transfertsResult.error) throw new Error(transfertsResult.error);

      setStockAtelier(stockResult.stock);
      setProduits(produitsResult.products);
      setTransferts(transfertsResult.transferts);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusInfo = (statut) => {
    switch (statut) {
      case 'rupture':
        return { color: 'text-red-600', bg: 'bg-red-50', label: 'Rupture' };
      case 'critique':
        return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Critique' };
      case 'faible':
        return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Faible' };
      default:
        return { color: 'text-green-600', bg: 'bg-green-50', label: 'Normal' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Chargement du stock atelier...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Warehouse className="w-8 h-8 text-orange-600 mr-3" />
            Stock Atelier (Production)
          </h1>
          <p className="text-gray-600">Ingrédients disponibles pour la production - Alimenté par les demandes validées</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center text-blue-800">
            <ArrowRight className="w-5 h-5 mr-2" />
            <div className="text-sm">
              <p className="font-medium">Pour ajouter au stock atelier :</p>
              <p>1. Créez une demande (onglet Demandes)</p>
              <p>2. Faites-la valider par un admin/production</p>
              <p>3. Les produits validés s'ajoutent automatiquement ici</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('stock')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stock'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Stock Atelier Disponible
          </button>
          <button
            onClick={() => setActiveTab('transferts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transferts'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Historique des Ajouts
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Ingrédients disponibles"
              value={stockAtelier.filter(s => (s.stock_reel || 0) > 0).length}
              icon={Package}
              color="blue"
            />
            <StatCard
              title="Stock critique"
              value={stockAtelier.filter(s => s.statut_stock === 'critique' || s.statut_stock === 'rupture').length}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              title="Stock total disponible"
              value={utils.formatNumber(stockAtelier.reduce((sum, s) => sum + (s.quantite_disponible || 0), 0), 1)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Stock utilisé en production"
              value={utils.formatNumber(stockAtelier.reduce((sum, s) => sum + (s.quantite_reservee || 0), 0), 1)}
              icon={TrendingDown}
              color="orange"
            />
          </div>

          {/* Tableau du stock */}
          <Card>
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold">Ingrédients Disponibles pour Production</h3>
              <div className="text-sm text-gray-500">
                Stock réel = Stock reçu - Stock utilisé en production
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Reçu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisé Production</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Réel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAtelier.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun ingrédient dans l'atelier
                        <br />
                        <span className="text-sm">Les demandes validées alimenteront ce stock automatiquement</span>
                      </td>
                    </tr>
                  ) : (
                    stockAtelier.map((stock, index) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock || 'normal');
                      return (
                        <tr key={index} className={stock.stock_reel <= 0 ? 'opacity-50' : ''}>
                          <td className="px-6 py-4 font-medium">{stock.nom_produit || `Ingrédient ${index + 1}`}</td>
                          <td className="px-6 py-4 text-blue-600 font-semibold">
                            {utils.formatNumber(stock.quantite_disponible || 0, 1)}
                          </td>
                          <td className="px-6 py-4 text-orange-600">
                            {utils.formatNumber(stock.quantite_reservee || 0, 1)}
                          </td>
                          <td className="px-6 py-4 font-bold text-lg">
                            <span className={stock.stock_reel <= 0 ? 'text-red-600' : 'text-green-600'}>
                              {utils.formatNumber(stock.stock_reel || 0, 1)}
                            </span>
                          </td>
                          <td className="px-6 py-4">{stock.unite || 'unité'}</td>
                          <td className="px-6 py-4">
                            <span className={`badge ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'transferts' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center p-6 border-b">
            <Clock className="w-5 h-5 mr-2" />
            Historique des Ajouts (Demandes Validées)
          </h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandé par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validé par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                </tr>
              </thead>
              <tbody>
                {transferts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      Aucun ajout enregistré
                      <br />
                      <span className="text-sm">Les demandes validées apparaîtront ici</span>
                    </td>
                  </tr>
                ) : (
                  transferts.map((transfert, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4">{utils.formatDateTime(transfert.created_at)}</td>
                      <td className="px-6 py-4 font-medium">{transfert.produit?.nom || 'Ingrédient'}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-blue-600">
                          {utils.formatNumber(transfert.quantite_transferee || 0, 1)} {transfert.produit?.unite?.label || ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">{transfert.demandeur?.nom || 'Non spécifié'}</td>
                      <td className="px-6 py-4">{transfert.valideur?.nom || 'Auto'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Production
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
