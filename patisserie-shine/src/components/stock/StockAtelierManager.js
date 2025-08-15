"use client";

import { useState, useEffect } from 'react';
import { stockAtelierService, productService, utils } from '../../lib/supabase';
import { Package, ArrowRight, AlertTriangle, Clock, TrendingUp, TrendingDown, Warehouse } from 'lucide-react';
import { Card, StatCard } from '../ui';

export default function StockAtelierManager({ currentUser }) {
  const [stockAtelier, setStockAtelier] = useState([]);
  const [produits, setProduits] = useState([]);
  const [transferts, setTransferts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState('');
  const [quantiteTransfert, setQuantiteTransfert] = useState('');
  const [activeTab, setActiveTab] = useState('stock');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, produitsResult] = await Promise.all([
        stockAtelierService.getStockAtelier(),
        productService.getAll()
      ]);

      if (stockResult.error) throw new Error(stockResult.error);
      if (produitsResult.error) throw new Error(produitsResult.error);

      setStockAtelier(stockResult.stock);
      setProduits(produitsResult.products);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfert = async (e) => {
    e.preventDefault();
    if (!selectedProduit || !quantiteTransfert) return;

    try {
      // Simple mock transfer - in real app this would call an API
      setShowTransferModal(false);
      setSelectedProduit('');
      setQuantiteTransfert('');
      setError('');
      alert('Transfert effectué avec succès');
      loadData();
    } catch (err) {
      setError(err.message);
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
            Stock Atelier
          </h1>
          <p className="text-gray-600">Stock réel disponible dans l'atelier</p>
        </div>
        <button
          onClick={() => setShowTransferModal(true)}
          className="btn-primary"
        >
          <ArrowRight className="w-4 h-4" />
          Transférer vers atelier
        </button>
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
            Stock Disponible
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
            Historique Transferts
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Articles en stock"
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
              title="Stock disponible"
              value={utils.formatNumber(stockAtelier.reduce((sum, s) => sum + (s.quantite_disponible || 0), 0), 1)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Stock utilisé"
              value={utils.formatNumber(stockAtelier.reduce((sum, s) => sum + (s.quantite_reservee || 0), 0), 1)}
              icon={TrendingDown}
              color="orange"
            />
          </div>

          {/* Tableau du stock */}
          <Card>
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold">Stock Atelier Actuel</h3>
              <div className="text-sm text-gray-500">
                Stock réel = Stock disponible - Stock utilisé
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Disponible</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Utilisé</th>
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
                        Aucun stock dans l'atelier
                        <br />
                        <span className="text-sm">Transférez des produits depuis le stock principal</span>
                      </td>
                    </tr>
                  ) : (
                    stockAtelier.map((stock, index) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock || 'normal');
                      return (
                        <tr key={index}>
                          <td className="px-6 py-4 font-medium">{stock.nom_produit || `Produit ${index + 1}`}</td>
                          <td className="px-6 py-4 text-blue-600 font-semibold">
                            {utils.formatNumber(stock.quantite_disponible || 0, 1)}
                          </td>
                          <td className="px-6 py-4 text-orange-600">
                            {utils.formatNumber(stock.quantite_reservee || 0, 1)}
                          </td>
                          <td className="px-6 py-4 font-bold text-lg">
                            {utils.formatNumber(stock.stock_reel || 0, 1)}
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
            Historique des Transferts
          </h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transféré par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucun transfert enregistré
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de transfert */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <ArrowRight className="w-5 h-5 mr-2 text-orange-600" />
              Transférer vers l'atelier
            </h3>
            <form onSubmit={handleTransfert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit à transférer
                </label>
                <select
                  value={selectedProduit}
                  onChange={(e) => setSelectedProduit(e.target.value)}
                  className="form-input w-full"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {produits
                    .filter(p => (p.quantite_restante || 0) > 0)
                    .map((produit) => (
                      <option key={produit.id} value={produit.id}>
                        {produit.nom} (Stock: {utils.formatNumber(produit.quantite_restante || 0, 1)} {produit.unite?.label || ''})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité à transférer
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={quantiteTransfert}
                  onChange={(e) => setQuantiteTransfert(e.target.value)}
                  className="form-input w-full"
                  placeholder="0.0"
                  required
                />
                {selectedProduit && (
                  <p className="text-sm text-gray-500 mt-1">
                    Stock disponible: {utils.formatNumber(
                      produits.find(p => p.id === parseInt(selectedProduit))?.quantite_restante || 0, 1
                    )} {produits.find(p => p.id === parseInt(selectedProduit))?.unite?.label || ''}
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setError('');
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  <ArrowRight className="w-4 h-4" />
                  Transférer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
