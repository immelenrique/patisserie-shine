"use client";

import { useState, useEffect } from 'react';
import { productionService, recetteService, utils } from '../../lib/supabase';
import { Plus, ChefHat, Calendar, MapPin, User, AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function ProductionManager({ currentUser }) {
  const [productions, setProductions] = useState([]);
  const [produitsRecettes, setProduitsRecettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    produit: '',
    quantite: '',
    destination: 'Boutique',
    date_production: new Date().toISOString().split('T')[0]
  });
 const [ingredientsVerification, setIngredientsVerification] = useState(null);


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productionsResult, produitsResult] = await Promise.all([
        productionService.getAll(),
        recetteService.getProduitsRecettes()
      ]);

      if (productionsResult.error) throw new Error(productionsResult.error);
      if (produitsResult.error) throw new Error(produitsResult.error);

      setProductions(productionsResult.productions);
      setProduitsRecettes(produitsResult.produits);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifierIngredients = async () => {
  if (!formData.produit || !formData.quantite) {
    setIngredientsVerification(null);
    return;
  }

  try {
    const result = await recetteService.verifierDisponibiliteIngredients(
      formData.produit,
      parseFloat(formData.quantite)
    );

    if (result.error) {
      setError(result.error);
      setIngredientsVerification(null);
      return;
    }

    setIngredientsVerification(result);
    setError('');
  } catch (err) {
    setError(err.message);
    setIngredientsVerification(null);
  }
};


  

  const handleSubmit = async (e) => {
    e.preventDefault();
    
   

    try {
      const result = await productionService.create({
        ...formData,
        quantite: parseFloat(formData.quantite)
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setShowAddModal(false);
      setFormData({
        produit: '',
        quantite: '',
        destination: 'Boutique',
        date_production: new Date().toISOString().split('T')[0]
      });
      setIngredientsVerification(null);
      setError('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'termine': return 'badge-success';
      case 'en_cours': return 'badge-warning';
      case 'annule': return 'badge-error';
      default: return 'badge-info';
    }
  };

  const getStatutLabel = (statut) => {
    switch (statut) {
      case 'termine': return 'Terminé';
      case 'en_cours': return 'En cours';
      case 'annule': return 'Annulé';
      default: return statut;
    }
  };

  const calculatedStats = {
    totalProductions: productions.length,
    productionsJour: productions.filter(p => p.date_production === new Date().toISOString().split('T')[0]).length,
    productionsTerminees: productions.filter(p => p.statut === 'termine').length,
    productionsEnCours: productions.filter(p => p.statut === 'en_cours').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Chargement des productions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ChefHat className="w-8 h-8 text-orange-600 mr-3" />
            Production - Produits Finis
          </h1>
          <p className="text-gray-600">Enregistrement des produits finis créés à partir des recettes</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            disabled={produitsRecettes.length === 0}
          >
            <Plus className="w-4 h-4" />
            Nouvelle Production
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {produitsRecettes.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800">
              Aucune recette disponible. Créez des recettes dans l'onglet "Recettes" pour pouvoir enregistrer des productions.
            </span>
          </div>
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <ChefHat className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Productions totales</p>
              <p className="text-2xl font-bold text-gray-900">{calculatedStats.totalProductions}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Terminées</p>
              <p className="text-2xl font-bold text-gray-900">{calculatedStats.productionsTerminees}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">En cours</p>
              <p className="text-2xl font-bold text-gray-900">{calculatedStats.productionsEnCours}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">{calculatedStats.productionsJour}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Liste des productions */}
      <Card>
        <div className="flex justify-between items-center mb-4 p-6 border-b">
          <h3 className="text-lg font-semibold">Historique des Productions</h3>
          <div className="text-sm text-gray-500">
            {productions.length} production{productions.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producteur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coût Ingrédients</th>
              </tr>
            </thead>
            <tbody>
              {productions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    <ChefHat className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucune production enregistrée
                    <br />
                    <span className="text-sm">Créez votre première production</span>
                  </td>
                </tr>
              ) : (
                productions.map((production) => (
                  <tr key={production.id}>
                    <td className="px-6 py-4 font-medium">{production.produit}</td>
                    <td className="px-6 py-4 font-semibold text-blue-600">
                      {utils.formatNumber(production.quantite, 1)} unité{production.quantite > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                        {production.destination}
                      </div>
                    </td>
                    <td className="px-6 py-4">{utils.formatDate(production.date_production)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-1" />
                        {production.producteur?.nom || 'Non spécifié'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={production.statut || 'termine'} />
                    </td>
                    <td className="px-6 py-4">
                      {production.cout_ingredients ? 
                        <span className="font-semibold text-green-600">
                          {utils.formatCFA(production.cout_ingredients)}
                        </span> : 
                        <span className="text-gray-400">Calculé auto</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de création */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-orange-600" />
              Nouvelle Production
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit à produire *
                  </label>
                  <select
                    value={formData.produit}
                    onChange={(e) => setFormData({...formData, produit: e.target.value})}
                    className="form-input w-full"
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {produitsRecettes.map((produit) => (
                      <option key={produit} value={produit}>
                        {produit}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Seuls les produits avec recettes sont disponibles
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité produite *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.quantite}
                    onChange={(e) => setFormData({...formData, quantite: e.target.value})}
                    className="form-input w-full"
                    placeholder="1.0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Multiplicateur de la recette (ex: 2 = double portion)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination
                  </label>
                  <select
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    className="form-input w-full"
                  >
                    <option value="Boutique">Boutique</option>
                    <option value="Commande">Commande client</option>
                    <option value="Stock">Stock (réserve)</option>
                    <option value="Événement">Événement spécial</option>
                    <option value="Test">Test/Échantillon</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de production
                  </label>
                  <input
                    type="date"
                    value={formData.date_production}
                    onChange={(e) => setFormData({...formData, date_production: e.target.value})}
                    className="form-input w-full"
                    required
                  />
                </div>
              </div>

              {/* Vérification des ingrédients */}
              {ingredientsVerification && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    {ingredientsVerification?.disponible ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                    )}
                    Vérification des ingrédients dans l'atelier
                  </h4>
              
                  <div className="space-y-2">
                    {ingredientsVerification.details.map((detail, index) => (
                      <div 
                        key={index}
                        className={`flex justify-between items-center p-3 rounded ${
                          detail.suffisant ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}
                      >
                        <div className="flex items-center">
                          <Package className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="font-medium">{detail.ingredient}</span>
                        </div>
                        <div className="text-sm text-right">
                          <div className={detail.suffisant ? 'text-green-700' : 'text-red-700'}>
                            <strong>Requis:</strong> {utils.formatNumber(detail.quantite_necessaire, 2)} {detail.unite}
                          </div>
                          <div className="text-gray-600">
                            <strong>Disponible:</strong> {utils.formatNumber(detail.stock_disponible, 2)} {detail.unite}
                          </div>
                        </div>
                      </div>
                    ))}
              
                    {!ingredientsVerification.disponible && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-700 text-sm">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          Stock insuffisant dans l'atelier. Actions nécessaires :
                        </p>
                        <ul className="mt-2 text-sm text-red-700 space-y-1">
                          <li>• Créer des demandes pour les ingrédients manquants</li>
                          <li>• Faire valider les demandes par un admin/responsable production</li>
                          <li>• Les ingrédients validés s'ajouteront automatiquement au stock atelier</li>
                        </ul>
                      </div>
                    )}
              
                    {ingredientsVerification.disponible && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-green-700 text-sm">
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Enregistrer votre production.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIngredientsVerification(null);
                    setError('');
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  
                >
                  <ChefHat className="w-4 h-4" />
                  Enregistrer Production
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
