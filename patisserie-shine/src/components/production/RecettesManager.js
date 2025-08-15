"use client";

import { useState, useEffect } from 'react';
import { Plus, ChefHat, Calculator, Trash2, Package } from 'lucide-react';
import { Card, Modal } from '../ui';
import { recetteService, productService, utils } from '../../lib/supabase';

export default function RecettesManager({ currentUser }) {
  const [recettes, setRecettes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalculModal, setShowCalculModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [calculData, setCalculData] = useState({
    nom_produit: '',
    quantite: ''
  });
  const [besoins, setBesoins] = useState([]);

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

  // Ajouter un ingrédient à la liste temporaire
  const ajouterIngredient = () => {
    setIngredients([...ingredients, {
      id: Date.now(),
      produit_ingredient_id: '',
      quantite_necessaire: ''
    }]);
  };

  // Supprimer un ingrédient de la liste
  const supprimerIngredient = (id) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  // Mettre à jour un ingrédient
  const updateIngredient = (id, field, value) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  // Sauvegarder la recette complète
  const handleSaveRecette = async () => {
    if (!selectedProduit || ingredients.length === 0) {
      alert('Veuillez sélectionner un produit et ajouter au moins un ingrédient');
      return;
    }

    try {
      // Sauvegarder chaque ingrédient
      for (const ingredient of ingredients) {
        if (ingredient.produit_ingredient_id && ingredient.quantite_necessaire) {
          const { error } = await recetteService.create({
            nom_produit: selectedProduit,
            produit_ingredient_id: parseInt(ingredient.produit_ingredient_id),
            quantite_necessaire: parseFloat(ingredient.quantite_necessaire)
          });

          if (error) {
            console.error('Erreur ajout ingrédient:', error);
          }
        }
      }

      // Recharger les données et fermer le modal
      await loadData();
      setShowAddModal(false);
      setSelectedProduit('');
      setIngredients([]);
      alert('Recette créée avec succès !');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la recette');
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
          <p className="text-gray-600">Gérez les ingrédients nécessaires pour chaque produit fini</p>
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
            <span>Nouvelle Recette</span>
          </button>
        </div>
      </div>

      {/* Liste des recettes par produit */}
      <div className="space-y-6">
        {Object.keys(recettesGroupees).length === 0 ? (
          <Card className="p-8 text-center">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune recette créée</h3>
            <p className="text-gray-500 mb-4">Commencez par créer une recette pour vos produits finis</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
            >
              Créer ma première recette
            </button>
          </Card>
        ) : (
          Object.entries(recettesGroupees).map(([nomProduit, ingredients]) => {
            const coutTotal = ingredients.reduce((sum, ing) => sum + (ing.cout_ingredient || 0), 0);
            const peutProduire = ingredients.every(ing => ing.ingredient_disponible);
            
            return (
              <Card key={nomProduit} className="overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <ChefHat className="h-6 w-6 mr-2 text-orange-500" />
                        {nomProduit}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Coût de production: <span className="font-semibold text-orange-600">{utils.formatCFA(coutTotal)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        peutProduire ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''}
                      </span>
                      <p className={`text-sm mt-1 ${peutProduire ? 'text-green-600' : 'text-red-600'}`}>
                        {peutProduire ? '✓ Peut être produit' : '✗ Stock insuffisant'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ingredients.map((ingredient) => (
                      <div 
                        key={ingredient.recette_id} 
                        className={`p-4 rounded-lg border-2 ${
                          ingredient.ingredient_disponible 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center">
                            <Package className="w-5 h-5 text-gray-500 mr-2" />
                            <div>
                              <h4 className="font-medium text-gray-900">{ingredient.ingredient_nom}</h4>
                              <p className="text-sm text-gray-600">
                                {ingredient.quantite_necessaire} {ingredient.unite}
                              </p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ingredient.ingredient_disponible 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ingredient.ingredient_disponible ? '✓' : '✗'}
                          </span>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Stock atelier:</span>
                            <span>{ingredient.stock_atelier_disponible || 0} {ingredient.unite}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Coût:</span>
                            <span>{utils.formatCFA(ingredient.cout_ingredient || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal Nouvelle Recette */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => {
          setShowAddModal(false);
          setSelectedProduit('');
          setIngredients([]);
        }} 
        title="Créer une Nouvelle Recette" 
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du produit fini *
            </label>
            <input
              type="text"
              value={selectedProduit}
              onChange={(e) => setSelectedProduit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Le nom du produit que vous fabriquez
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Ingrédients nécessaires *
              </label>
              <button
                type="button"
                onClick={ajouterIngredient}
                className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {ingredients.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun ingrédient ajouté</p>
                  <p className="text-sm">Cliquez sur "Ajouter" pour commencer</p>
                </div>
              ) : (
                ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <select
                        value={ingredient.produit_ingredient_id}
                        onChange={(e) => updateIngredient(ingredient.id, 'produit_ingredient_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
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
                      <input
                        type="number"
                        step="0.01"
                        value={ingredient.quantite_necessaire}
                        onChange={(e) => updateIngredient(ingredient.id, 'quantite_necessaire', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        placeholder="Quantité"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {ingredient.produit_ingredient_id ? 
                          products.find(p => p.id === parseInt(ingredient.produit_ingredient_id))?.unite?.value || 'unité'
                          : 'unité'
                        }
                      </span>
                      <button
                        type="button"
                        onClick={() => supprimerIngredient(ingredient.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">💡 Conseils</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ajoutez tous les ingrédients nécessaires pour produire 1 unité</li>
              <li>• Les quantités doivent être précises pour un calcul de coût exact</li>
              <li>• Vous pourrez modifier la recette plus tard si besoin</li>
            </ul>
          </div>

          <div className="flex space-x-4 pt-4">
            <button 
              onClick={handleSaveRecette}
              disabled={!selectedProduit || ingredients.length === 0}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Créer la recette
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setSelectedProduit('');
                setIngredients([]);
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Calcul Besoins */}
      <Modal 
        isOpen={showCalculModal} 
        onClose={() => {
          setShowCalculModal(false);
          setBesoins([]);
        }} 
        title="Calculer les Besoins de Production" 
        size="lg"
      >
        <form onSubmit={handleCalculBesoins} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Produit à fabriquer *</label>
              <select
                value={calculData.nom_produit}
                onChange={(e) => setCalculData({...calculData, nom_produit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Choisir un produit</option>
                {Object.keys(recettesGroupees).map((produit) => (
                  <option key={produit} value={produit}>
                    {produit}
                  </option>
                ))}
              </select>
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
            <div className="space-y-3">
              {besoins.map((besoin, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-2 ${
                    besoin.quantite_manquante > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="font-medium text-gray-900">{besoin.ingredient_nom}</h5>
                      <p className="text-sm text-gray-600">
                        Nécessaire: {besoin.quantite_necessaire} {besoin.unite}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Disponible: {besoin.quantite_disponible} {besoin.unite}
                      </p>
                      {besoin.quantite_manquante > 0 && (
                        <p className="text-sm font-medium text-red-600">
                          Manque: {besoin.quantite_manquante} {besoin.unite}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
