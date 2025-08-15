"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';
import { productService, uniteService, utils } from '../../lib/supabase';

export default function StockManager({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
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
      const [productsResult, unitesResult] = await Promise.all([
        productService.getAll(),
        uniteService.getAll()
      ]);

      if (productsResult.error) {
        console.error('Erreur lors du chargement des produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }

      if (unitesResult.error) {
        console.error('Erreur lors du chargement des unités:', unitesResult.error);
      } else {
        setUnites(unitesResult.unites);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const { product, error } = await productService.create({
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: parseFloat(formData.prix_achat),
        quantite: parseFloat(formData.quantite),
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création du produit: ' + error);
      } else {
        await loadData();
        resetForm();
        setShowAddModal(false);
        alert('Produit créé avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création du produit');
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
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
        console.error('Erreur lors de la modification:', error);
        alert('Erreur lors de la modification du produit: ' + error);
      } else {
        await loadData();
        resetForm();
        setEditingProduct(null);
        alert('Produit modifié avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la modification du produit');
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
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau Produit</span>
            </button>
          )}
        </div>
      </div>
      
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
              {filteredProducts.map((product) => {
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
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Ajout/Edition Produit */}
      <Modal 
        isOpen={showAddModal || editingProduct} 
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
          resetForm();
        }} 
        title={editingProduct ? "Modifier le Produit" : "Ajouter un Produit"} 
        size="lg"
      >
        <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} className="space-y-4">
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
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unité *</label>
              <select
                value={formData.unite_id}
                onChange={(e) => setFormData({...formData, unite_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Choisir une unité</option>
                {unites.map(unite => (
                  <option key={unite.id} value={unite.id}>
                    {unite.label} ({unite.value})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              {editingProduct ? 'Modifier le produit' : 'Ajouter le produit'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setEditingProduct(null);
                resetForm();
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
