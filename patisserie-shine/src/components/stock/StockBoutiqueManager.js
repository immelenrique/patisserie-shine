"use client";

import { useState, useEffect } from 'react';
import { stockBoutiqueService, caisseService, utils, supabase } from '../../lib/supabase';
import { Store, Package, AlertTriangle, TrendingUp, TrendingDown, Edit, Check, X, DollarSign, ShoppingCart, Eye, EyeOff, Archive, Boxes } from 'lucide-react';
import { Card, StatCard, Modal } from '../ui';

export default function StockBoutiqueManager({ currentUser }) {
  const [stockBoutique, setStockBoutique] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('vendables');
  const [editingPrice, setEditingPrice] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [newType, setNewType] = useState('');
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

  // Commencer l'édition du type de produit
  const startEditType = (stockItem) => {
    setEditingType(stockItem.id);
    setNewType(stockItem.type_produit || 'vendable');
  };

  // Annuler l'édition
  const cancelEdit = () => {
    setEditingPrice(null);
    setEditingType(null);
    setNewPrice('');
    setNewType('');
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
       await loadData();
        
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

  // Sauvegarder le nouveau type de produit
  const saveType = async (stockId) => {
    if (!newType) {
      alert('Veuillez sélectionner un type');
      return;
    }

    setSavingPrice(true);
    try {
      const { error } = await supabase
        .from('stock_boutique')
        .update({
          type_produit: newType,
          // Si on passe en non-vendable, mettre le prix à null
          prix_vente: newType === 'vendable' ? null : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId);

      if (error) {
        console.error('Erreur mise à jour type:', error);
        alert('Erreur lors de la mise à jour du type: ' + error.message);
      } else {
        setStockBoutique(prev => 
          prev.map(item => 
            item.id === stockId 
              ? { 
                  ...item, 
                  type_produit: newType,
                  prix_vente: newType === 'vendable' ? item.prix_vente : null,
                  prix_defini: newType === 'vendable' ? item.prix_defini : false
                }
              : item
          )
        );
        
        const typeLabels = {
          'vendable': 'Produit vendable',
          'emballage': 'Emballage/Packaging',
          'fourniture': 'Fourniture de boutique',
          'materiel': 'Matériel/Équipement',
          'consommable': 'Consommable non-vendable'
        };
        
        alert(`Type mis à jour: ${typeLabels[newType]}`);
        setEditingType(null);
        setNewType('');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la mise à jour du type');
    } finally {
      setSavingPrice(false);
    }
  };

  // Marquer l'utilisation d'un produit non-vendable
  const markAsUsed = async (stockId, quantiteUtilisee) => {
    const quantite = parseFloat(quantiteUtilisee);
    if (!quantite || quantite <= 0) {
      alert('Veuillez entrer une quantité valide');
      return;
    }

    try {
      const stockItem = stockBoutique.find(s => s.id === stockId);
      if (!stockItem) return;

      if (quantite > stockItem.stock_reel) {
        alert('Quantité supérieure au stock disponible');
        return;
      }

      const { error } = await supabase
        .from('stock_boutique')
        .update({
          quantite_utilisee: (stockItem.quantite_utilisee || 0) + quantite,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId);

      if (error) {
        console.error('Erreur mise à jour utilisation:', error);
        alert('Erreur lors de la mise à jour: ' + error.message);
      } else {
        // Enregistrer le mouvement d'utilisation
        await supabase
          .from('utilisations_boutique')
          .insert({
            stock_boutique_id: stockId,
            quantite_utilisee: quantite,
            utilisateur_id: currentUser.id,
            raison: 'Utilisation en boutique',
            date_utilisation: new Date().toISOString()
          });

        await loadData(); // Recharger les données
        alert(`${quantite} unité(s) marquée(s) comme utilisée(s)`);
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de l\'enregistrement de l\'utilisation');
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'emballage': return <Package className="w-4 h-4" />;
      case 'fourniture': return <Archive className="w-4 h-4" />;
      case 'materiel': return <Boxes className="w-4 h-4" />;
      case 'consommable': return <Package className="w-4 h-4" />;
      default: return <ShoppingCart className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'emballage': return 'bg-purple-100 text-purple-800';
      case 'fourniture': return 'bg-blue-100 text-blue-800';
      case 'materiel': return 'bg-gray-100 text-gray-800';
      case 'consommable': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'vendable': 'Vendable',
      'emballage': 'Emballage',
      'fourniture': 'Fourniture',
      'materiel': 'Matériel',
      'consommable': 'Consommable'
    };
    return labels[type] || 'Vendable';
  };

  // Filtrer selon l'onglet actif
  const filteredStock = stockBoutique.filter(item => {
  const typeFilter = activeTab === 'vendables' 
    ? (item.type_produit === 'vendable' || item.type_produit === null || item.type_produit === undefined)
    : (item.type_produit && item.type_produit !== 'vendable' && item.type_produit !== null);
  
  const stockFilter = showZeroStock ? true : (item.stock_reel || 0) > 0;
  
  return typeFilter && stockFilter;
});

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
          <p className="text-gray-600">Gestion des produits vendables et des fournitures</p>
        </div>
        
        <div className="flex space-x-3">
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
            onClick={() => setActiveTab('vendables')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'vendables'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Produits Vendables ({stockBoutique.filter(s => !s.type_produit || s.type_produit === 'vendable').length})
          </button>
          <button
            onClick={() => setActiveTab('fournitures')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'fournitures'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Fournitures & Emballages ({stockBoutique.filter(s => s.type_produit && s.type_produit !== 'vendable').length})
          </button>
          <button
            onClick={() => setActiveTab('historique')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'historique'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Archive className="w-4 h-4 inline mr-2" />
            Historique des Entrées
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {(activeTab === 'vendables' || activeTab === 'fournitures') && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {activeTab === 'vendables' ? (
              <>
                <StatCard
                  title="Produits vendables"
                  value={stockBoutique.filter(s => (!s.type_produit || s.type_produit === 'vendable') && (s.stock_reel || 0) > 0).length}
                  icon={ShoppingCart}
                  color="green"
                />
                <StatCard
                  title="Prix non définis"
                  value={stockBoutique.filter(s => (!s.type_produit || s.type_produit === 'vendable') && !s.prix_defini && (s.stock_reel || 0) > 0).length}
                  icon={DollarSign}
                  color="yellow"
                />
                <StatCard
                  title="Valeur stock vendable"
                  value={utils.formatCFA(stockBoutique.filter(s => !s.type_produit || s.type_produit === 'vendable').reduce((sum, s) => sum + ((s.stock_reel || 0) * (s.prix_vente || 0)), 0))}
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  title="Stock critique"
                  value={stockBoutique.filter(s => (!s.type_produit || s.type_produit === 'vendable') && (s.statut_stock === 'critique' || s.statut_stock === 'rupture')).length}
                  icon={AlertTriangle}
                  color="red"
                />
              </>
            ) : (
              <>
                <StatCard
                  title="Fournitures disponibles"
                  value={stockBoutique.filter(s => s.type_produit && s.type_produit !== 'vendable' && (s.stock_reel || 0) > 0).length}
                  icon={Package}
                  color="blue"
                />
                <StatCard
                  title="Emballages"
                  value={stockBoutique.filter(s => s.type_produit === 'emballage').length}
                  icon={Package}
                  color="purple"
                />
                <StatCard
                  title="Total utilisé"
                  value={utils.formatNumber(stockBoutique.filter(s => s.type_produit && s.type_produit !== 'vendable').reduce((sum, s) => sum + (s.quantite_utilisee || 0), 0), 1)}
                  icon={TrendingDown}
                  color="orange"
                />
                <StatCard
                  title="Stock critique"
                  value={stockBoutique.filter(s => s.type_produit && s.type_produit !== 'vendable' && (s.statut_stock === 'critique' || s.statut_stock === 'rupture')).length}
                  icon={AlertTriangle}
                  color="red"
                />
              </>
            )}
          </div>

          {/* Information sur l'affichage */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center text-blue-800">
              <div className="text-sm">
                <strong>Affichage:</strong> {activeTab === 'vendables' ? 'Produits vendables' : 'Fournitures et emballages'} 
                {showZeroStock ? ' (tous)' : ' (avec stock > 0)'} ({filteredStock.length} élément{filteredStock.length > 1 ? 's' : ''})
              </div>
              <div className="text-xs">
                💡 Cliquez sur l'icône ✏️ pour modifier le prix ou le type
              </div>
            </div>
          </div>

          {/* Tableau du stock */}
          <Card>
            <div className="flex justify-between items-center mb-4 p-6 border-b">
              <h3 className="text-lg font-semibold">
                {activeTab === 'vendables' ? 'Produits Vendables' : 'Fournitures & Emballages'}
              </h3>
              <div className="text-sm text-gray-500">
                Stock réel = Stock reçu - {activeTab === 'vendables' ? 'Stock vendu' : 'Stock utilisé'}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Reçu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {activeTab === 'vendables' ? 'Stock Vendu' : 'Stock Utilisé'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Réel</th>
                    {activeTab === 'vendables' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valeur Stock</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'vendables' ? "9" : "7"} className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        {showZeroStock ? 
                          `Aucun ${activeTab === 'vendables' ? 'produit vendable' : 'fourniture'} en boutique` : 
                          `Aucun ${activeTab === 'vendables' ? 'produit vendable' : 'fourniture'} avec stock disponible`
                        }
                        <br />
                        <span className="text-sm">
                          {showZeroStock ? 
                            'Les demandes validées vers "Boutique" alimenteront ce stock' : 
                            'Activez "Afficher vides" pour voir tous les produits'
                          }
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((stock) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock || 'normal');
                      const isEditingPrice = editingPrice === stock.id;
                      const isEditingType = editingType === stock.id;
                      const stockUtilise = activeTab === 'vendables' ? stock.quantite_vendue : stock.quantite_utilisee;
                      
                      return (
                        <tr key={stock.id} className={stock.stock_reel <= 0 ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 font-medium">
                            {stock.nom_produit || 'Produit sans nom'}
                            <div className="text-xs text-gray-500">{stock.unite}</div>
                          </td>
                          <td className="px-6 py-4">
                            {isEditingType ? (
                              <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                                autoFocus
                              >
                                <option value="vendable">Vendable</option>
                                <option value="emballage">Emballage</option>
                                <option value="fourniture">Fourniture</option>
                                <option value="materiel">Matériel</option>
                                <option value="consommable">Consommable</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(stock.type_produit || 'vendable')}`}>
                                {getTypeIcon(stock.type_produit || 'vendable')}
                                <span className="ml-1">{getTypeLabel(stock.type_produit || 'vendable')}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-blue-600 font-semibold">
                            {utils.formatNumber(stock.quantite_disponible || 0, 1)}
                          </td>
                          <td className="px-6 py-4 text-orange-600">
                            {utils.formatNumber(stockUtilise || 0, 1)}
                          </td>
                          <td className="px-6 py-4 font-bold text-lg">
                            <span className={stock.stock_reel <= 0 ? 'text-red-600' : 'text-green-600'}>
                              {utils.formatNumber(stock.stock_reel || 0, 1)}
                            </span>
                          </td>
                          {activeTab === 'vendables' && (
                            <>
                              <td className="px-6 py-4">
                                {isEditingPrice ? (
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
                            </>
                          )}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isEditingPrice ? (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => savePrice(stock.id)}
                                  disabled={savingPrice}
                                  className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="Sauvegarder le prix"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={savingPrice}
                                  className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : isEditingType ? (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => saveType(stock.id)}
                                  disabled={savingPrice}
                                  className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="Sauvegarder le type"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={savingPrice}
                                  className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex space-x-1">
                                {activeTab === 'vendables' && (
                                  <button
                                    onClick={() => startEditPrice(stock)}
                                    className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                                    title="Modifier le prix"
                                  >
                                    <DollarSign className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => startEditType(stock)}
                                  className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded transition-colors"
                                  title="Modifier le type"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                {activeTab === 'fournitures' && stock.stock_reel > 0 && (
                                  <button
                                    onClick={() => {
                                      const quantite = prompt(`Quantité utilisée de "${stock.nom_produit}" (max: ${stock.stock_reel}):`);
                                      if (quantite) markAsUsed(stock.id, quantite);
                                    }}
                                    className="text-orange-600 hover:text-orange-900 p-1 hover:bg-orange-50 rounded transition-colors"
                                    title="Marquer comme utilisé"
                                  >
                                    <Package className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
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
            <Archive className="w-5 h-5 mr-2" />
            Historique des Entrées en Boutique
          </h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix Vente</th>
                </tr>
              </thead>
              <tbody>
                {historique.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      <Archive className="w-12 h-12 mx-auto mb-2 text-gray-300" />
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entree.type_produit || 'vendable')}`}>
                          {getTypeIcon(entree.type_produit || 'vendable')}
                          <span className="ml-1">{getTypeLabel(entree.type_produit || 'vendable')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">
                          +{utils.formatNumber(entree.quantite || 0, 1)} {entree.unite}
                        </span>
                      </td>
                      <td className="px-6 py-4">{entree.source || 'Non spécifié'}</td>
                      <td className="px-6 py-4">
                        {entree.prix_vente && entree.type_produit === 'vendable' ? 
                          <span className="font-semibold text-green-600">
                            {utils.formatCFA(entree.prix_vente)}
                          </span> : 
                          <span className="text-gray-400">-</span>
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
