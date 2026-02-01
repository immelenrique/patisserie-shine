// src/components/cuisine/StockCuisineManager.js

"use client";

import { useState, useEffect } from 'react';
import { stockCuisineService, uniteService } from '../../services';
import { utils } from '../../utils/formatters';
import { ChefHat, Plus, Search, AlertTriangle, History, Trash2, Package } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function StockCuisineManager({ currentUser }) {
  // États - TOUJOURS initialiser avec des tableaux vides
  const [stocks, setStocks] = useState([]);
  const [produits, setProduits] = useState([]);
  const [unites, setUnites] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  // Form states
  const [newProduct, setNewProduct] = useState({
    nom: '',
    description: '',
    prix_vente: '',
    unite_id: '',
    categorie: ''
  });
  const [newStock, setNewStock] = useState({
    produit_cuisine_id: '',
    quantite_disponible: '',
    prix_vente: ''
  });
  const [submitting, setSubmitting] = useState(false);

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
        loadUnites(),
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
      const result = await stockCuisineService.getAll();

      console.log('Résultat stockCuisineService.getAll():', result);

      if (result.error) {
        console.error('Erreur chargement stocks:', result.error);
        setError(result.error);
        setStocks([]);
      } else {
        const stocksData = result.stocks || [];
        setStocks(Array.isArray(stocksData) ? stocksData : []);
        console.log('Stocks chargés:', stocksData.length);
      }
    } catch (err) {
      console.error('Exception loadStocks:', err);
      setStocks([]);
      setError('Erreur lors du chargement du stock cuisine');
    }
  };

  const loadProduits = async () => {
    try {
      const result = await stockCuisineService.getProduitsCuisine();

      if (result.error) {
        console.error('Erreur chargement produits:', result.error);
        setProduits([]);
      } else {
        const produitsData = result.produits || [];
        setProduits(Array.isArray(produitsData) ? produitsData : []);
      }
    } catch (err) {
      console.error('Exception loadProduits:', err);
      setProduits([]);
    }
  };

  const loadUnites = async () => {
    try {
      const result = await uniteService.getAll();

      if (result.error) {
        console.error('Erreur chargement unités:', result.error);
        setUnites([]);
      } else {
        const unitesData = result.unites || [];
        setUnites(Array.isArray(unitesData) ? unitesData : []);
      }
    } catch (err) {
      console.error('Exception loadUnites:', err);
      setUnites([]);
    }
  };

  const loadHistorique = async () => {
    try {
      const result = await stockCuisineService.getHistoriqueMouvements();

      if (result.error) {
        console.error('Erreur chargement historique:', result.error);
        setHistorique([]);
      } else {
        const historiqueData = result.mouvements || [];
        setHistorique(Array.isArray(historiqueData) ? historiqueData : []);
      }
    } catch (err) {
      console.error('Exception loadHistorique:', err);
      setHistorique([]);
    }
  };

  // Filtrage SÉCURISÉ
  const getFilteredStocks = () => {
    if (!Array.isArray(stocks)) {
      console.warn('stocks n\'est pas un tableau:', stocks);
      return [];
    }

    if (!searchTerm || searchTerm.trim() === '') {
      return stocks;
    }

    return stocks.filter(stock => {
      if (!stock || !stock.produit) return false;

      const nomProduit = stock.produit.nom || '';
      const searchLower = searchTerm.toLowerCase();

      return nomProduit.toLowerCase().includes(searchLower);
    });
  };

  const filteredStocks = getFilteredStocks();

  // Créer un nouveau produit cuisine (admin uniquement)
  const handleCreateProduct = async (e) => {
    e.preventDefault();

    if (!newProduct.nom || !newProduct.prix_vente) {
      setError('Le nom et le prix de vente sont obligatoires');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await stockCuisineService.createProduitCuisine({
        nom: newProduct.nom,
        description: newProduct.description || null,
        prix_vente: parseFloat(newProduct.prix_vente),
        unite_id: newProduct.unite_id ? parseInt(newProduct.unite_id) : null,
        categorie: newProduct.categorie || null,
        actif: true
      });

      if (result.error) {
        setError(result.error);
      } else {
        alert('Produit créé avec succès !');
        setShowCreateProductModal(false);
        setNewProduct({
          nom: '',
          description: '',
          prix_vente: '',
          unite_id: '',
          categorie: ''
        });
        await loadData();
      }
    } catch (err) {
      console.error('Erreur création produit:', err);
      setError('Erreur lors de la création du produit');
    } finally {
      setSubmitting(false);
    }
  };

  // Ajouter du stock (admin uniquement)
  const handleAddStock = async (e) => {
    e.preventDefault();

    if (!newStock.produit_cuisine_id || !newStock.quantite_disponible) {
      setError('Le produit et la quantité sont obligatoires');
      return;
    }

    const quantity = parseFloat(newStock.quantite_disponible);
    if (isNaN(quantity) || quantity <= 0) {
      setError('Quantité invalide');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await stockCuisineService.createOrUpdateStock({
        produit_cuisine_id: parseInt(newStock.produit_cuisine_id),
        quantite_disponible: quantity,
        prix_vente: newStock.prix_vente ? parseFloat(newStock.prix_vente) : null
      });

      if (result.error) {
        setError(result.error);
      } else {
        alert('Stock ajouté avec succès !');
        setShowAddStockModal(false);
        setNewStock({
          produit_cuisine_id: '',
          quantite_disponible: '',
          prix_vente: ''
        });
        await loadData();
      }
    } catch (err) {
      console.error('Erreur ajout stock:', err);
      setError('Erreur lors de l\'ajout du stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Vider tout le stock cuisine (admin uniquement)
  const handleViderToutLeStock = async () => {
    if (currentUser?.role !== 'admin') {
      alert('Action réservée aux administrateurs');
      return;
    }

    const confirmation = window.confirm(
      '⚠️ ATTENTION ⚠️\n\n' +
      'Vous êtes sur le point de VIDER TOUT LE STOCK CUISINE.\n' +
      'Toutes les quantités seront mises à 0.\n\n' +
      'Cette action est irréversible.\n\n' +
      'Voulez-vous vraiment continuer ?'
    );

    if (!confirmation) return;

    const doubleConfirmation = window.confirm(
      'Confirmation finale:\n\n' +
      'Êtes-vous ABSOLUMENT SÛR de vouloir vider tout le stock cuisine ?\n\n' +
      'Tapez OK pour confirmer.'
    );

    if (!doubleConfirmation) return;

    setLoading(true);
    setError('');

    try {
      // Récupérer tous les stocks
      const { stocks: allStocks } = await stockCuisineService.getAll();

      if (!allStocks || allStocks.length === 0) {
        alert('Aucun stock à vider');
        setLoading(false);
        return;
      }

      let compteur = 0;
      for (const stock of allStocks) {
        if (stock.quantite_disponible > 0) {
          await stockCuisineService.ajusterQuantite(stock.produit_cuisine_id, 0);
          compteur++;
        }
      }

      alert(
        `✅ Stock cuisine vidé avec succès!\n\n` +
        `${compteur} produit(s) ont été vidés.`
      );
      await loadData();
    } catch (err) {
      console.error('Erreur vidage stock:', err);
      alert('Erreur lors du vidage du stock: ' + err.message);
      setError('Erreur lors du vidage du stock');
    } finally {
      setLoading(false);
    }
  };

  // États de chargement
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
        <div className="flex items-center">
          <ChefHat className="w-8 h-8 text-orange-600 mr-3" />
          <h2 className="text-2xl font-bold">Stock Cuisine</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {filteredStocks.length} produit{filteredStocks.length > 1 ? 's' : ''} en stock
          </div>
          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => setShowCreateProductModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Produit
              </button>
              <button
                onClick={() => setShowAddStockModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                Ajouter Stock
              </button>
              <button
                onClick={handleViderToutLeStock}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center transition-colors"
                title="Vider tout le stock cuisine (Admin uniquement)"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Vider Tout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre de recherche et bouton historique */}
      <div className="bg-white p-4 rounded-lg shadow flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          onClick={() => setShowHistoryModal(true)}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center transition-colors"
        >
          <History className="w-4 h-4 mr-2" />
          Historique
        </button>
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
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {stock.produit?.nom || 'Produit inconnu'}
                  </h3>
                  {stock.produit?.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {stock.produit.description}
                    </p>
                  )}
                  {stock.produit?.categorie && (
                    <span className="inline-block mt-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {stock.produit.categorie}
                    </span>
                  )}
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

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Prix de vente:</span>
                  <span className="font-bold text-green-600">
                    {utils.formatMontant(stock.prix_vente || stock.produit?.prix_vente || 0)}
                  </span>
                </div>

                {stock.quantite_vendue > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Quantité vendue:</span>
                    <span className="text-gray-700">
                      {stock.quantite_vendue} {stock.produit?.unite?.label}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm
                ? `Aucun produit trouvé pour "${searchTerm}"`
                : 'Aucun produit dans le stock cuisine'}
            </p>
            {currentUser?.role === 'admin' && !searchTerm && (
              <button
                onClick={() => setShowCreateProductModal(true)}
                className="mt-4 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
              >
                Créer votre premier produit cuisine
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: Créer un nouveau produit */}
      {showCreateProductModal && (
        <Modal
          isOpen={showCreateProductModal}
          onClose={() => {
            setShowCreateProductModal(false);
            setNewProduct({
              nom: '',
              description: '',
              prix_vente: '',
              unite_id: '',
              categorie: ''
            });
            setError('');
          }}
          title="Créer un nouveau produit cuisine"
        >
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du produit *
              </label>
              <input
                type="text"
                value={newProduct.nom}
                onChange={(e) => setNewProduct({ ...newProduct, nom: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: Menu du jour, Plat poulet braisé..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Description du produit..."
                rows="2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prix de vente (FCFA) *
                </label>
                <input
                  type="number"
                  value={newProduct.prix_vente}
                  onChange={(e) => setNewProduct({ ...newProduct, prix_vente: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="0"
                  min="0"
                  step="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unité de mesure
                </label>
                <select
                  value={newProduct.unite_id}
                  onChange={(e) => setNewProduct({ ...newProduct, unite_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Sélectionner...</option>
                  {unites.map(unite => (
                    <option key={unite.id} value={unite.id}>
                      {unite.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catégorie
              </label>
              <input
                type="text"
                value={newProduct.categorie}
                onChange={(e) => setNewProduct({ ...newProduct, categorie: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: Plat, Boisson, Dessert..."
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
              >
                {submitting ? 'Création...' : 'Créer le produit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateProductModal(false);
                  setNewProduct({
                    nom: '',
                    description: '',
                    prix_vente: '',
                    unite_id: '',
                    categorie: ''
                  });
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Ajouter du stock */}
      {showAddStockModal && (
        <Modal
          isOpen={showAddStockModal}
          onClose={() => {
            setShowAddStockModal(false);
            setNewStock({
              produit_cuisine_id: '',
              quantite_disponible: '',
              prix_vente: ''
            });
            setError('');
          }}
          title="Ajouter du stock"
        >
          <form onSubmit={handleAddStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produit *
              </label>
              <select
                value={newStock.produit_cuisine_id}
                onChange={(e) => setNewStock({ ...newStock, produit_cuisine_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                <option value="">Sélectionner un produit...</option>
                {produits.map(produit => (
                  <option key={produit.id} value={produit.id}>
                    {produit.nom} - {utils.formatMontant(produit.prix_vente)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité à ajouter *
              </label>
              <input
                type="number"
                value={newStock.quantite_disponible}
                onChange={(e) => setNewStock({ ...newStock, quantite_disponible: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix de vente (optionnel)
              </label>
              <input
                type="number"
                value={newStock.prix_vente}
                onChange={(e) => setNewStock({ ...newStock, prix_vente: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Laisser vide pour utiliser le prix du produit"
                min="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si vide, le prix du produit sera utilisé
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                {submitting ? 'Ajout...' : 'Ajouter le stock'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddStockModal(false);
                  setNewStock({
                    produit_cuisine_id: '',
                    quantite_disponible: '',
                    prix_vente: ''
                  });
                  setError('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Historique des mouvements */}
      {showHistoryModal && (
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title="Historique des mouvements de stock"
        >
          <div className="space-y-4">
            {historique.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantité</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Utilisateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {historique.map((mouvement) => (
                      <tr key={mouvement.id}>
                        <td className="px-4 py-2 text-sm">{utils.formatDate(mouvement.created_at)}</td>
                        <td className="px-4 py-2 text-sm">{mouvement.produit?.nom || 'N/A'}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${
                            mouvement.type_mouvement === 'entree' ? 'bg-green-100 text-green-800' :
                            mouvement.type_mouvement === 'vente' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {mouvement.type_mouvement}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {mouvement.quantite} {mouvement.produit?.unite?.label || ''}
                        </td>
                        <td className="px-4 py-2 text-sm">{mouvement.utilisateur?.nom || 'Système'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>Aucun mouvement de stock enregistré</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
