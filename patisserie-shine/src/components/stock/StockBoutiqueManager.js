"use client";

import { useState, useEffect } from 'react';
import { stockBoutiqueService, productService, utils } from '../../lib/supabase';
import { Package, AlertTriangle, Clock, TrendingUp, TrendingDown, Store, ArrowRight, ShoppingBag } from 'lucide-react';
import { Card, StatCard } from '../ui';

export default function StockBoutiqueManager({ currentUser }) {
  const [stockBoutique, setStockBoutique] = useState([]);
  const [entrees, setEntrees] = useState([]);
  const [sorties, setSorties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('stock');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, entreesResult, sortiesResult] = await Promise.all([
        stockBoutiqueService.getStockBoutique(),
        stockBoutiqueService.getHistoriqueEntrees(),
        stockBoutiqueService.getHistoriqueSorties()
      ]);

      if (stockResult.error) throw new Error(stockResult.error);
      if (entreesResult.error) throw new Error(entreesResult.error);
      if (sortiesResult.error) throw new Error(sortiesResult.error);

      setStockBoutique(stockResult.stock);
      setEntrees(entreesResult.entrees);
      setSorties(sortiesResult.sorties);
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
        <span className="ml-2">Chargement du stock boutique...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Store className="w-8 h-8 text-orange-600 mr-3" />
            Stock Boutique
          </h1>
          <p className="text-gray-600">Produits disponibles à la vente - Alimenté par les productions et demandes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center text-blue-800">
            <ArrowRight className="w-5 h-5 mr-2" />
            <div className="text-sm">
              <p className="font-medium">Alimenté automatiquement par :</p>
              <p>1. Productions destinées à "Boutique"</p>
              <p>2. Demandes validées vers "Boutique"</p>
              <p>3. Transferts manuels vers boutique</p>
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
            Stock Boutique
          </button>
          <button
            onClick={() => setActiveTab('entrees')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'entrees'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Entrées (Réceptions)
          </button>
          <button
            onClick={() => setActiveTab('sorties')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sorties'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingDown className="w-4 h-4 inline mr-2" />
            Sorties (Ventes)
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Produits en boutique"
              value={stockBoutique.filter(s => (s.stock_reel || 0) > 0).length}
              icon={Package}
              color="blue"
            />
            <StatCard
              title="Stock critique"
              value={stockBoutique.filter(s => s.statut_stock === 'critique' || s.statut_stock === 'rupture').length}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              title="Valeur totale stock"
              value={utils.formatCFA(stockBoutique.reduce((sum, s) => sum + ((s.stock_reel || 0) * (s.prix_vente || 0)), 0))}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Produits vendus aujourd'hui"
              value={sorties.filter(s => s.created_at?.startsWith(new Date().toISOString().split('T')[0])).length}
              icon={ShoppingBag}
              color="orange"
            />
          </div>

          {/* Tableau du stock */}
          <Card>
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold">Produits Disponibles à la Vente</h3>
              <div className="text-sm text-gray-500">
                Stock boutique = Réceptions - Ventes
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Disponible</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière MAJ</th>
                  </tr>
                </thead>
                <tbody>
                  {stockBoutique.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        <Store className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun produit en boutique
                        <br />
                        <span className="text-sm">Les productions et demandes vers "Boutique" alimenteront ce stock</span>
                      </td>
                    </tr>
                  ) : (
                    stockBoutique.map((stock, index) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock || 'normal');
                      const valeurStock = (stock.stock_reel || 0) * (stock.prix_vente || 0);
                      
                      return (
                        <tr key={index} className={stock.stock_reel <= 0 ? 'opacity-50' : ''}>
                          <td className="px-6 py-4 font-medium">{stock.nom_produit || `Produit ${index + 1}`}</td>
                          <td className="px-6 py-4">
                            <span className={`font-bold text-lg ${stock.stock_reel <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {utils.formatNumber(stock.stock_reel || 0, 1)} {stock.unite || 'unité'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-green-600">
                            {stock.prix_vente ? utils.formatCFA(stock.prix_vente) : 'Non défini'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-purple-600">
                            {utils.formatCFA(valeurStock)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`badge ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {utils.formatDateTime(stock.derniere_maj || stock.created_at)}
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

      {activeTab === 'entrees' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center p-6 border-b">
            <TrendingUp className="w-5 h-5 mr-2" />
            Historique des Entrées en Boutique
          </h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type Entrée</th>
                </tr>
              </thead>
              <tbody>
                {entrees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      Aucune entrée enregistrée
                    </td>
                  </tr>
                ) : (
                  entrees.map((entree, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4">{utils.formatDateTime(entree.created_at)}</td>
                      <td className="px-6 py-4 font-medium">{entree.nom_produit}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">
                        +{utils.formatNumber(entree.quantite, 1)} {entree.unite}
                      </td>
                      <td className="px-6 py-4">{entree.source || 'Production'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {entree.type_entree || 'Production'}
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

      {activeTab === 'sorties' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center p-6 border-b">
            <TrendingDown className="w-5 h-5 mr-2" />
            Historique des Sorties (Ventes)
          </h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                </tr>
              </thead>
              <tbody>
                {sorties.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      <TrendingDown className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      Aucune vente enregistrée
                    </td>
                  </tr>
                ) : (
                  sorties.map((sortie, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4">{utils.formatDateTime(sortie.created_at)}</td>
                      <td className="px-6 py-4 font-medium">{sortie.nom_produit}</td>
                      <td className="px-6 py-4 font-semibold text-red-600">
                        -{utils.formatNumber(sortie.quantite, 1)} {sortie.unite}
                      </td>
                      <td className="px-6 py-4">{utils.formatCFA(sortie.prix_unitaire)}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">
                        {utils.formatCFA(sortie.total)}
                      </td>
                      <td className="px-6 py-4">{sortie.vendeur?.nom}</td>
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
