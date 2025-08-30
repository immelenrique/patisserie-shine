// Dans src/components/stock/StockAtelierManager.js - VERSION CORRIGÉE

"use client";

import { useState, useEffect } from 'react';
import { stockAtelierService, productService, utils } from '../../lib/supabase';
import { Package, Plus, Search, ArrowRight, AlertTriangle, History } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function StockAtelierManager({ currentUser }) {
  // États - TOUJOURS initialiser avec des tableaux vides
  const [stocks, setStocks] = useState([]);
  const [produits, setProduits] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        loadStocks(),
        loadProduits(),
        loadHistorique()
      ]);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadStocks = async () => {
    try {
      const result = await stockAtelierService.getAll();
      
      // Vérifier et logger le résultat
      console.log('Résultat stockAtelierService.getAll():', result);
      
      if (result.error) {
        console.error('Erreur chargement stocks:', result.error);
        setError(result.error);
        setStocks([]); // Toujours un tableau vide en cas d'erreur
      } else {
        // S'assurer que c'est un tableau
        const stocksData = result.stocks || result.stock || [];
        setStocks(Array.isArray(stocksData) ? stocksData : []);
        console.log('Stocks chargés:', stocksData.length);
      }
    } catch (err) {
      console.error('Exception loadStocks:', err);
      setStocks([]); // Toujours un tableau vide
      setError('Erreur lors du chargement du stock atelier');
    }
  };

  const loadProduits = async () => {
    try {
      const result = await productService.getAll();
      
      if (result.error) {
        console.error('Erreur chargement produits:', result.error);
        setProduits([]);
      } else {
        // Gérer les différents noms possibles de la propriété
        const produitsData = result.products || result.produits || [];
        setProduits(Array.isArray(produitsData) ? produitsData : []);
      }
    } catch (err) {
      console.error('Exception loadProduits:', err);
      setProduits([]);
    }
  };

  const loadHistorique = async () => {
    try {
      const result = await stockAtelierService.getHistoriqueTransferts();
      
      if (result.error) {
        console.error('Erreur chargement historique:', result.error);
        setHistorique([]);
      } else {
        const historiqueData = result.historique || [];
        setHistorique(Array.isArray(historiqueData) ? historiqueData : []);
      }
    } catch (err) {
      console.error('Exception loadHistorique:', err);
      setHistorique([]);
    }
  };

  // Filtrage SÉCURISÉ - Protection contre undefined
  const getFilteredStocks = () => {
    // Vérifier que stocks est un tableau
    if (!Array.isArray(stocks)) {
      console.warn('stocks n\'est pas un tableau:', stocks);
      return [];
    }

    // Si pas de terme de recherche, retourner tous les stocks
    if (!searchTerm || searchTerm.trim() === '') {
      return stocks;
    }

    // Filtrer de manière sécurisée
    return stocks.filter(stock => {
      // Vérifier que stock existe et a les propriétés nécessaires
      if (!stock || !stock.produit) return false;
      
      const nomProduit = stock.produit.nom || '';
      const searchLower = searchTerm.toLowerCase();
      
      return nomProduit.toLowerCase().includes(searchLower);
    });
  };

  // Utiliser la fonction de filtrage sécurisée
  const filteredStocks = getFilteredStocks();

  // Fonction pour gérer le transfert vers boutique
  const handleTransfer = async () => {
    if (!selectedStock || !transferQuantity) return;

    const quantity = parseFloat(transferQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      setError('Quantité invalide');
      return;
    }

    if (quantity > selectedStock.quantite_disponible) {
      setError('Quantité insuffisante dans le stock atelier');
      return;
    }

    setTransferring(true);
    setError('');

    try {
      const result = await stockAtelierService.transfererVersBoutique(
        selectedStock.produit_id,
        quantity
      );

      if (result.error) {
        setError(result.error);
      } else {
        alert('Transfert effectué avec succès !');
        setShowTransferModal(false);
        setSelectedStock(null);
        setTransferQuantity('');
        await loadData(); // Recharger les données
      }
    } catch (err) {
      console.error('Erreur transfert:', err);
      setError('Erreur lors du transfert');
    } finally {
      setTransferring(false);
    }
  };

  // États de chargement et d'erreur
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Stock Atelier (Production)</h2>
        <div className="text-sm text-gray-500">
          {filteredStocks.length} produit{filteredStocks.length > 1 ? 's' : ''} en stock
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Alerte stock faible */}
      {filteredStocks.some(s => s.quantite_disponible < 5) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Certains produits ont un stock faible (moins de 5 unités)
        </div>
      )}

      {/* Liste des stocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStocks.length > 0 ? (
          filteredStocks.map(stock => (
            <Card key={stock.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {stock.produit?.nom || 'Produit inconnu'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ID: {stock.produit_id}
                  </p>
                </div>
                {stock.quantite_disponible < 5 && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    Stock faible
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Quantité disponible:</span>
                  <span className="font-bold">
                    {stock.quantite_disponible} {stock.produit?.unite?.label || 'unité'}
                  </span>
                </div>

                {stock.quantite_reservee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Quantité réservée:</span>
                    <span className="text-orange-600">
                      {stock.quantite_reservee} {stock.produit?.unite?.label}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <button
                    onClick={() => {
                      setSelectedStock(stock);
                      setShowTransferModal(true);
                    }}
                    disabled={stock.quantite_disponible === 0}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Transférer vers Boutique
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm 
                ? `Aucun produit trouvé pour "${searchTerm}"`
                : 'Aucun produit dans le stock atelier'}
            </p>
          </div>
        )}
      </div>

      {/* Historique des transferts */}
      {Array.isArray(historique) && historique.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <History className="w-5 h-5 mr-2" />
            Historique récent des transferts
          </h3>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantité</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Demandeur</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {historique.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm">{utils.formatDate(item.created_at)}</td>
                    <td className="px-4 py-2 text-sm">{item.produit?.nom || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm">
                      {item.quantite} {item.produit?.unite?.label || ''}
                    </td>
                    <td className="px-4 py-2 text-sm">{item.demandeur?.nom || 'N/A'}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {item.statut || 'Validé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de transfert */}
      {showTransferModal && selectedStock && (
        <Modal
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedStock(null);
            setTransferQuantity('');
            setError('');
          }}
          title="Transférer vers Boutique"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Produit</p>
              <p className="font-semibold">{selectedStock.produit?.nom}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Quantité disponible</p>
              <p className="font-semibold">
                {selectedStock.quantite_disponible} {selectedStock.produit?.unite?.label}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité à transférer
              </label>
              <input
                type="number"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                max={selectedStock.quantite_disponible}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleTransfer}
                disabled={transferring || !transferQuantity}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                {transferring ? 'Transfert...' : 'Confirmer le transfert'}
              </button>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedStock(null);
                  setTransferQuantity('');
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
