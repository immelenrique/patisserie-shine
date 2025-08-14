'use client';

import { useState, useEffect } from 'react';
import { stockAtelierService, productService, utils } from '@/lib/supabase';
import { Package, ArrowRight, AlertTriangle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export default function StockAtelierView() {
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
      const result = await stockAtelierService.transfererVersAtelier(
        parseInt(selectedProduit),
        parseFloat(quantiteTransfert)
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setShowTransferModal(false);
      setSelectedProduit('');
      setQuantiteTransfert('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStockStatus = (stockReel, quantiteDisponible) => {
    if (stockReel <= 0) return { status: 'rupture', color: 'text-red-600', bg: 'bg-red-50' };
    if (stockReel <= quantiteDisponible * 0.2) return { status: 'critique', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (stockReel <= quantiteDisponible * 0.5) return { status: 'faible', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'normal', color: 'text-green-600', bg: 'bg-green-50' };
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Atelier</h1>
          <p className="text-gray-600">Gestion du stock disponible dans l'atelier de production</p>
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
            Historique Transferts
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center">
                <Package className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Articles en stock</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stockAtelier.filter(s => s.stock_reel > 0).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Stock critique</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stockAtelier.filter(s => getStockStatus(s.stock_reel, s.quantite_disponible).status === 'critique').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Stock total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {utils.formatNumber(stockAtelier.reduce((sum, s) => sum + s.quantite_disponible, 0), 1)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center">
                <TrendingDown className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Stock réservé</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {utils.formatNumber(stockAtelier.reduce((sum, s) => sum + s.quantite_reservee, 0), 1)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau du stock */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Stock Disponible</th>
                    <th>Stock Réservé</th>
                    <th>Stock Réel</th>
                    <th>Unité</th>
                    <th>Statut</th>
                    <th>Dernière MAJ</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAtelier.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        Aucun stock dans l'atelier
                      </td>
                    </tr>
                  ) : (
                    stockAtelier.map((stock) => {
                      const statusInfo = getStockStatus(stock.stock_reel, stock.quantite_disponible);
                      return (
                        <tr key={stock.id}>
                          <td className="font-medium">{stock.produit?.nom}</td>
                          <td>{utils.formatNumber(stock.quantite_disponible, 1)}</td>
                          <td>{utils.formatNumber(stock.quantite_reservee, 1)}</td>
                          <td className="font-semibold">{utils.formatNumber(stock.stock_reel, 1)}</td>
                          <td>{stock.produit?.unite?.label}</td>
                          <td>
                            <span className={`badge ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.status}
                            </span>
                          </td>
                          <td>{utils.formatDateTime(stock.derniere_maj)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transferts' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Historique des Transferts</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Transféré par</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {transferts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      Aucun transfert enregistré
                    </td>
                  </tr>
                ) : (
                  transferts.map((transfert) => (
                    <tr key={transfert.id}>
                      <td>{utils.formatDateTime(transfert.created_at)}</td>
                      <td className="font-medium">{transfert.produit?.nom}</td>
                      <td>
                        {utils.formatNumber(transfert.quantite_transferee, 1)} {transfert.produit?.unite?.label}
                      </td>
                      <td>{transfert.transfere_par_profile?.nom}</td>
                      <td>
                        <span className={`badge ${
                          transfert.statut === 'effectue' ? 'badge-success' : 'badge-error'
                        }`}>
                          {transfert.statut}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de transfert */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Transférer vers l'atelier</h3>
            <form onSubmit={handleTransfert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit
                </label>
                <select
                  value={selectedProduit}
                  onChange={(e) => setSelectedProduit(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {produits
                    .filter(p => p.quantite_restante > 0)
                    .map((produit) => (
                      <option key={produit.id} value={produit.id}>
                        {produit.nom} (Stock: {utils.formatNumber(produit.quantite_restante, 1)} {produit.unite?.label})
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
                  className="form-input"
                  placeholder="0.0"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
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