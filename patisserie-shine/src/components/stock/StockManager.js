"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';
import { productService, uniteService, utils } from '../../lib/supabase';

export default function StockManager({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unitesLoading, setUnitesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    date_achat: new Date().toISOString().split('T')[0],
    prix_achat: '',
    quantite: '',
    quantite_restante: '',
    unite_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadUnites()
      ]);
    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { products, error } = await productService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des produits:', error);
        setError(error);
      } else {
        setProducts(products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const loadUnites = async () => {
    setUnitesLoading(true);
    try {
      // Essayer de créer les unités de base si elles n'existent pas
      await uniteService.createBasicUnitsIfEmpty();
      
      const { unites, error } = await uniteService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des unités:', error);
        setError(error);
      } else {
        setUnites(unites);
        // Si aucune unité et que c'est un admin, proposer d'en créer
        if (unites.length === 0 && currentUser.role === 'admin') {
          console.log('Aucune unité trouvée, création automatique...');
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setUnitesLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { product, error } = await productService.create({
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: parseFloat(formData.prix_achat),
        quantite: parseFloat(formData.quantite),
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        setError(error);
      } else {
        await loadProducts();
        resetForm();
        setShowAddModal(false);
        alert('Produit créé avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de la création du produit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const { product, error } = await productService.update(editingProduct.id, {
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: parseFloat(formData.prix_achat),
        quantite: parseFloat(formData.quantite),
        quantite_restante: parseFloat(formData.quantite_restante),
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        setError(error);
      } else {
        await loadProducts();
        resetForm();
        setEditingProduct(null);
        alert('Produit modifié avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de la modification du produit');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      nom: product.nom,
      date_achat: product.date_achat,
      prix_achat: product.prix_achat.toString(),
      quantite: product.quantite.toString(),
      quantite_restante: product.quantite_restante.toString(),
      unite_id: product.unite_id.toString()
    });
    setError('');
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      date_achat: new Date().toISOString().split('T')[0],
      prix_achat: '',
      quantite: '',
      quantite_restante: '',
      unite_id: ''
    });
    setError('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingProduct(null);
    resetForm();
  };

  const filteredProducts = products.filter(product => 
    product.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Principal</h2>
          <p className="text-gray-600">Suivi des matières premières et inventaire</p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
              disabled={unites.length === 0}
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau Produit</span>
            </button>
          )}
        </div>
      </div>

      {/* Message d'erreur global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Message si aucune unité */}
      {unites.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-800">
            <strong>Aucune unité de mesure disponible !</strong>
            <br />
            Vous devez d'abord créer des unités dans l'onglet "Unités" avant de pouvoir ajouter des produits.
            {unitesLoading && <span className="ml-2">Chargement en cours...</span>}
          </div>
        </div>
      )}
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    {products.length === 0 ? (
                      <>
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun produit en stock
                        <br />
                        <span className="text-sm">Ajoutez votre premier produit</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun produit trouvé pour "{searchTerm}"
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const alertLevel = utils.getStockAlertLevel(product.quantite_restante, product.quantite);
                  const percentage = utils.calculateStockPercentage(product.quantite_restante, product.quantite);
                  
                  return (
                    <tr key={product.id} className={alertLevel === 'critique' || alertLevel === 'rupture' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${
                            alertLevel === 'rupture' ? 'bg-red-600' :
                            alertLevel === 'critique' ? 'bg-red-500' :
                            alertLevel === 'faible' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.nom}</div>
                            <div className="text-sm text-gray-500">{product.unite?.label}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className={`font-medium ${
                            alertLevel === 'critique' || alertLevel === 'rupture' ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {product.quantite_restante} / {product.quantite} {product.unite?.value}
                          </span>
                          <div className="text-xs text-gray-500">{percentage}% restant</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {utils.formatCFA(product.prix_achat)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {utils.formatDate(product.date_achat)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={alertLevel} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                            <button 
                              onClick={() => startEdit(product)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button className="text-red-600 hover:text-red-900">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Ajout/Edition Produit */}
      <Modal 
        isOpen={showAddModal || editingProduct !== null} 
        onClose={handleCloseModal} 
        title={editingProduct ? "Modifier le Produit" : "Ajouter un Produit"} 
        size="lg"
      >
        <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} className="space-y-4">
          {/* Message d'erreur dans le modal */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Vérification des unités */}
          {unites.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-yellow-800">
                <strong>⚠️ Aucune unité disponible</strong>
                <br />
                Vous devez d'abord créer des unités de mesure dans l'onglet "Unités".
                <br />
                <button 
                  type="button"
                  onClick={loadUnites}
                  className="mt-2 text-sm bg-yellow-200 hover:bg-yellow-300 px-3 py-1 rounded transition-colors"
                  disabled={unitesLoading}
                >
                  {unitesLoading ? 'Rechargement...' : 'Recharger les unités'}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Farine de Blé"
                required
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date d'achat *</label>
              <input
                type="date"
                value={formData.date_achat}
                onChange={(e) => setFormData({...formData, date_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix d'achat (CFA) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.prix_achat}
                onChange={(e) => setFormData({...formData, prix_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="18500"
                required
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité totale *</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantite}
                onChange={(e) => {
                  const newQuantite = e.target.value;
                  setFormData({
                    ...formData, 
                    quantite: newQuantite,
                    quantite_restante: editingProduct ? formData.quantite_restante : newQuantite
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="25"
                required
                disabled={submitting}
              />
            </div>
            {editingProduct && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantité restante *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantite_restante}
                  onChange={(e) => setFormData({...formData, quantite_restante: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="20"
                  required
                  disabled={submitting}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unité * 
                {unitesLoading && <span className="text-xs text-gray-500 ml-2">(Chargement...)</span>}
              </label>
              <select
                value={formData.unite_id}
                onChange={(e) => setFormData({...formData, unite_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={submitting || unitesLoading || unites.length === 0}
              >
                <option value="">
                  {unites.length === 0 ? 'Aucune unité disponible' : 'Choisir une unité'}
                </option>
                {unites.map(unite => (
                  <option key={unite.id} value={unite.id}>
                    {unite.label} ({unite.value})
                  </option>
                ))}
              </select>
              {unites.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Créez d'abord des unités dans l'onglet "Unités"
                </p>
              )}
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={submitting || unites.length === 0 || !formData.unite_id}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  {editingProduct ? 'Modification...' : 'Création...'}
                </>
              ) : (
                editingProduct ? 'Modifier le produit' : 'Ajouter le produit'
              )}
            </button>
            <button 
              type="button" 
              onClick={handleCloseModal}
              disabled={submitting}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
