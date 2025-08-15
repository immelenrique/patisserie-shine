"use client";

import { useState, useEffect } from 'react';
import { Plus, ChefHat, Calculator } from 'lucide-react';
import { Card, Modal } from '../ui';
import { recetteService, productService, utils } from '../../lib/supabase';

const RecettesManager = ({ currentUser }) => {
  const [recettes, setRecettes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalculModal, setShowCalculModal] = useState(false);
  const [calculData, setCalculData] = useState({
    nom_produit: '',
    quantite: ''
  });
  const [besoins, setBesoins] = useState([]);
  const [formData, setFormData] = useState({
    nom_produit: '',
    produit_ingredient_id: '',
    quantite_necessaire: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recettesResult, productsResult] = await Promise.all([
        recetteService.getAll(),
        productService.getAll()
      ]);

      if (recettesResult.error) {
        console.error('Erreur recettes:', recettesResult.error);
      } else {
        setRecettes(recettesResult.recettes);
      }

      if (productsResult.error) {
        console.error('Erreur produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecette = async (e) => {
    e.preventDefault();
    try {
      const { recette, error } = await recetteService.create({
        nom_produit: formData.nom_produit,
        produit_ingredient_id: parseInt(formData.produit_ingredient_id),
        quantite_necessaire: parseFloat(formData.quantite_necessaire)
      });

      if (error) {
        alert('Erreur lors de la création: ' + error);
      } else {
        await loadData();
        setFormData({ nom_produit: '', produit_ingredient_id: '', quantite_necessaire: '' });
        setShowAddModal(false);
        alert('Ingrédient ajouté à la recette');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création');
    }
  };

  const handleCalculBesoins = async (e) => {
    e.preventDefault();
    try {
      const { besoins, error } = await recetteService.calculerStockNecessaire(
        calculData.nom_produit,
        parseFloat(calculData.quantite)
      );

      if (error) {
        alert('Erreur lors du calcul: ' + error);
      } else {
        setBesoins(besoins);
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du calcul');
    }
  };

  // Grouper les recettes par produit
  const recettesGroupees = recettes.reduce((acc, recette) => {
    if (!acc[recette.nom_produit]) {
      acc[recette.nom_produit] = [];
    }
    acc[recette.nom_produit].push(recette);
    return acc;
  }, {});

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recettes de Production</h2>
          <p className="text-gray-600">Gestion des ingrédients nécessaires pour chaque produit</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowCalculModal(true)}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Calculator className="h-5 w-5" />
            <span>Calculer Besoins</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvel Ingrédient</span>
          </button>
        </div>
      </div>

      {/* Liste des recettes par produit */}
      <div className="space-y-6">
        {Object.entries(recettesGroupees).map(([nomProduit, ingredients]) => {
          const coutTotal = ingredients.reduce((sum, ing) => sum + (ing.cout_ingredient || 0), 0);
          const peutProduire = ingredients.every(ing => ing.ingredient_disponible);
          
          return (
            <Card key={nomProduit} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <ChefHat className="h-6 w-6 mr-2 text-orange-500" />
                    {nomProduit}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Coût total: {utils.formatCFA(coutTotal)} • 
                    <span className={peutProduire ? 'text-green-600' : 'text-red-600'}>
                      {peutProduire ? ' ✓ Peut être produit' : ' ✗ Ingrédients manquants'}
                    </span>
                  </p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  peutProduire ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock Atelier</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ingredients.map((ingredient) => (
                      <tr key={ingredient.recette_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {ingredient.ingredient_nom}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {ingredient.quantite_necessaire} {ingredient.unite}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {ingredient.stock_atelier_disponible || 0} {ingredient.unite}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {utils.formatCFA(ingredient.cout_ingredient || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ingredient.ingredient_disponible 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ingredient.ingredient_disponible ? '✓ Disponible' : '✗ Insuffisant'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal Nouvel Ingrédient */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Ajouter un Ingrédient à la Recette" 
        size="md"
      >
        <form onSubmit={handleAddRecette} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit fini *</label>
            <input
              type="text"
              value={formData.nom_produit}
              onChange={(e) => setFormData({...formData, nom_produit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ingrédient *</label>
            <select
              value={formData.produit_ingredient_id}
              onChange={(e) => setFormData({...formData, produit_ingredient_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un ingrédient</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nom} ({product.unite?.label})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité nécessaire *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite_necessaire}
              onChange={(e) => setFormData({...formData, quantite_necessaire: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.5"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Quantité nécessaire pour produire 1 unité du produit fini</p>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Ajouter l'ingrédient
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Calcul Besoins */}
      <Modal 
        isOpen={showCalculModal} 
        onClose={() => setShowCalculModal(false)} 
        title="Calculer les Besoins de Production" 
        size="lg"
      >
        <form onSubmit={handleCalculBesoins} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Produit à fabriquer *</label>
              <input
                type="text"
                value={calculData.nom_produit}
                onChange={(e) => setCalculData({...calculData, nom_produit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Croissants au Beurre"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité à produire *</label>
              <input
                type="number"
                step="0.01"
                value={calculData.quantite}
                onChange={(e) => setCalculData({...calculData, quantite: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="50"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200">
            Calculer les besoins
          </button>
        </form>

        {besoins.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-4">Besoins calculés :</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nécessaire</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Disponible</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Manquant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {besoins.map((besoin, index) => (
                    <tr key={index} className={besoin.quantite_manquante > 0 ? 'bg-red-50' : 'bg-green-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {besoin.ingredient_nom}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_necessaire} {besoin.unite}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_disponible} {besoin.unite}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_manquante} {besoin.unite}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          besoin.quantite_manquante === 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {besoin.quantite_manquante === 0 ? '✓ OK' : '✗ Insuffisant'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RecettesManager;
