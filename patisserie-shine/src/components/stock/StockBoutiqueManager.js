"use client";

import { useState, useEffect } from 'react';
import { stockBoutiqueService, caisseService, utils, supabase } from '../../lib/supabase';
import { Store, Package, AlertTriangle, TrendingUp, TrendingDown, Edit, Check, X, DollarSign, ShoppingCart, Eye, EyeOff } from 'lucide-react';
import { Card, StatCard, Modal } from '../ui';

export default function StockBoutiqueManager({ currentUser }) {
  const [stockBoutique, setStockBoutique] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('stock');
  const [editingPrice, setEditingPrice] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [showZeroStock, setShowZeroStock] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, historiqueResult] = await Promise.all([
        stockBoutiqueService.getStockBoutique(),
        stockBoutiqueService.getHistoriqueEntrees()
      ]);

      if (stockResult.error) throw new Error(stockResult.error);
      if (historiqueResult.error) throw new Error(historiqueResult.error);

      setStockBoutique(stockResult.stock || []);
      setHistorique(historiqueResult.entrees || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Commencer l'édition d'un prix
  const startEditPrice = (stockItem) => {
    setEditingPrice(stockItem.id);
    setNewPrice(stockItem.prix_vente ? stockItem.prix_vente.toString() : '');
  };

  // Annuler l'édition
  const cancelEditPrice = () => {
    setEditingPrice(null);
    setNewPrice('');
  };

  // Sauvegarder le nouveau prix
  const savePrice = async (stockId) => {
    if (!newPrice || parseFloat(newPrice) < 0) {
      alert('Veuillez entrer un prix valide');
      return;
    }

    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from('stock_boutique')
        .update({
          prix_vente: parseFloat(newPrice),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId);

      if (error) {
        console.error('Erreur mise à jour prix:', error);
        alert('Erreur lors de la mise à jour du prix: ' + error.message);
      } else {
        // Mettre à jour l'état local
        setStockBoutique(prev => 
          prev.map(item => 
            item.id === stockId 
              ? { ...item, prix_vente: parseFloat(newPrice), prix_defini: true }
              : item
          )
        );
        
        // Synchroniser avec la table prix_vente_produits si le produit a un produit_id
        const stockItem = stockBoutique.find(s => s.id === stockId);
        if (stockItem && stockItem.produit_id) {
          try {
            await supabase
              .from('prix_vente_produits')
              .upsert({
                produit_id: stockItem.produit_id,
                prix: parseFloat(newPrice),
                actif: true
              });
          } catch (syncError) {
            console.warn('Erreur synchronisation prix_vente_produits:', syncError);
          }
        }
        
        alert(`Prix mis à jour avec succès: ${utils.formatCFA(parseFloat(newPrice))}`);
        setEditingPrice(null);
        setNewPrice('');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la mise à jour du prix');
    } finally {
      setSavingPrice(false);
    }
  };

  // Synchroniser tous les prix avec la table prix_vente_recettes
  const syncAllPrices = async () => {
    if (!confirm('Voulez-vous synchroniser tous les prix avec les prix de recettes définis ?')) {
      return;
    }

    setLoading(true);
    try {
      const { success, corrections, error } = await stockBoutiqueService.synchroniserPrixRecettes();
      
      if (error) {
        alert('Erreur lors de la synchronisation: ' + error);
      } else {
        alert(`Synchronisation terminée !\n${corrections} prix ont été corrigés.`);
        await loadData(); // Recharger les données
      }
    } catch (err) {
      console.error('Erreur synchronisation:', err);
      alert('Erreur lors de la synchronisation des prix');
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

  // Filtrer les produits selon l'affichage souhaité
  const filteredStock = showZeroStock 
    ? stockBoutique 
    : stockBoutique.filter(item => (item.stock_reel || 0) > 0);

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
            <Store className="w-8 h-8 text-green-600 mr-3" />
            Stock Boutique
          </h1>
          <p className="text-gray-600">Gestion des produits disponibles à la vente</p>
        </div>
        
        <div className="flex space-x-3">
          {/* Bouton de synchronisation des prix */}
          <button
            onClick={syncAllPrices}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2"
            title="Synchroniser avec les prix de recettes"
          >
            <DollarSign className="h-4 w-4" />
            <span>Sync Prix</span>
          </button>
          
          {/* Toggle affichage stock zéro */}
          <button
            onClick={() => setShowZeroStock(!showZeroStock)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
              showZeroStock 
                ? 'bg-gray-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={showZeroStock ? "Masquer les stocks vides" : "Afficher les stocks vides"}
          >
            {showZeroStock ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showZeroStock ? 'Masquer vides' : 'Afficher vides'}</span>
          </button>
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
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Stock Disponible
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'historique'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Historique des Entrées
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Produits en stock"
              value={stockBoutique.filter(s => (s.stock_reel || 0) > 0).length}
              icon={Package}
              color="green"
            />
            <StatCard
              title="Stock critique"
              value={stockBoutique.filter(s => s.statut_stock === 'critique' || s.statut_stock === 'rupture').length}
              icon={AlertTriangle}
              color="red"
            />
            <StatCard
              title="Valeur stock total"
              value={utils.formatCFA(stockBoutique.reduce((sum, s) => sum + ((s.stock_reel || 0) * (s.prix_vente || 0)), 0))}
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="Prix non définis"
              value={stockBoutique.filter(s => !s.prix_defini && (s.stock_reel || 0) > 0).length}
              icon={DollarSign}
              color="yellow"
            />
          </div>

          {/* Information sur l'affichage */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center text-blue-800">
              <div className="text-sm">
                <strong>Affichage actuel:</strong> {showZeroStock ? 'Tous les produits' : 'Produits avec stock > 0'} 
                ({filteredStock.length} produit{filteredStock.length > 1 ? 's' : ''})
              </div>
              <div className="text-xs">
                💡 Cliquez sur l'icône ✏️ pour modifier un prix de vente
              </div>
            </div>
          </div>

          {/* Tableau du stock */}
          <Card>
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold">Produits Disponibles en Boutique</h3>
              <div className="text-sm text-gray-500">
                Stock réel = Stock reçu - Stock vendu
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Reçu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Vendu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Réel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        {showZeroStock ? 'Aucun produit en boutique' : 'Aucun produit avec stock disponible'}
                        <br />
                        <span className="text-sm">
                          {showZeroStock 
                            ? 'Les demandes validées vers "Boutique" alimenteront ce stock'
                            : 'Activez "Afficher vides" pour voir tous les produits'
                          }
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((stock) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock || 'normal');
                      const isEditing = editingPrice === stock.id;
                      
                      return (
                        <tr key={stock.id} className={stock.stock_reel <= 0 ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 font-medium">
                            {stock.nom_produit || 'Produit sans nom'}
                            <div className="text-xs text-gray-500">{stock.unite}</div>
                          </td>
                          <td className="px-6 py-4 text-blue-600 font-semibold">
                            {utils.formatNumber(stock.quantite_disponible || 0, 1)}
                          </td>
                          <td className="px-6 py-4 text-orange-600">
                            {utils.formatNumber(stock.quantite_vendue || 0, 1)}
                          </td>
                          <td className="px-6 py-4 font-bold text-lg">
                            <span className={stock.stock_reel <= 0 ? 'text-red-600' : 'text-green-600'}>
                              {utils.formatNumber(stock.stock_reel || 0, 1)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={newPrice}
                                  onChange={(e) => setNewPrice(e.target.value)}
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  placeholder="Prix"
                                  autoFocus
                                />
                                <span className="text-xs text-gray-500">CFA</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                {stock.prix_defini ? (
                                  <span className="font-semibold text-green-600">
                                    {utils.formatCFA(stock.prix_vente || 0)}
                                  </span>
                                ) : (
                                  <span className="text-yellow-600 text-sm font-medium">
                                    Non défini
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-blue-600">
                            {stock.prix_defini ? 
                              utils.formatCFA((stock.stock_reel || 0) * (stock.prix_vente || 0)) : 
                              '-'
                            }
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => savePrice(stock.id)}
                                  disabled={savingPrice}
                                  className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="Sauvegarder"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEditPrice}
                                  disabled={savingPrice}
                                  className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditPrice(stock)}
                                className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                                title="Modifier le prix"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
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

      {activeTab === 'historique' && (
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center p-6 border-b">
            <ShoppingCart className="w-5 h-5 mr-2" />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                </tr>
              </thead>
              <tbody>
                {historique.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      Aucune entrée enregistrée
                      <br />
                      <span className="text-sm">Les ajouts en boutique apparaîtront ici</span>
                    </td>
                  </tr>
                ) : (
                  historique.map((entree, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{utils.formatDateTime(entree.created_at)}</td>
                      <td className="px-6 py-4 font-medium">
                        {entree.nom_produit || 'Produit'}
                        <div className="text-xs text-gray-500">{entree.unite}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">
                          +{utils.formatNumber(entree.quantite || 0, 1)} {entree.unite}
                        </span>
                      </td>
                      <td className="px-6 py-4">{entree.source || 'Non spécifié'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {entree.type_entree || 'Ajout'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {entree.prix_vente ? 
                          <span className="font-semibold text-green-600">
                            {utils.formatCFA(entree.prix_vente)}
                          </span> : 
                          <span className="text-gray-400">Non défini</span>
                        }
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
