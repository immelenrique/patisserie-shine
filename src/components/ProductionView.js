'use client';

import { useState, useEffect } from 'react';
import { productionService, recetteService, utils } from '@/lib/supabase';
import { ChefHat, Plus, Calendar, MapPin, User, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function ProductionView() {
  const [productions, setProductions] = useState([]);
  const [produitsRecettes, setProduitsRecettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifierIngredients = async () => {
    if (!formData.produit || !formData.quantite) return;

    try {
      const result = await recetteService.verifierDisponibiliteIngredients(
        formData.produit,
        parseFloat(formData.quantite)
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setIngredientsVerification(result);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (formData.produit && formData.quantite) {
      verifierIngredients();
    } else {
      setIngredientsVerification(null);
    }
  }, [formData.produit, formData.quantite]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ingredientsVerification?.disponible) {
      setError('Impossible de créer la production : ingrédients insuffisants');
      return;
    }

    try {
      const result = await productionService.create({
        ...formData,
        quantite: parseFloat(formData.quantite)
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setShowModal(false);
      setFormData({
        produit: '',
        quantite: '',
        destination: 'Boutique',
        date_production: new Date().toISOString().split('T')[0]
      });
      setIngredientsVerification(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Production</h1>
          <p className="text-gray-600">Gestion de la production de l'atelier</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Production
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <ChefHat className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Productions totales</p>
              <p className="text-2xl font-bold text-gray-900">{productions.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Terminées</p>
              <p className="text-2xl font-bold text-gray-900">
                {productions.filter(p => p.statut === 'termine').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">En cours</p>
              <p className="text-2xl font-bold text-gray-900">
                {productions.filter(p => p.statut === 'en_cours').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">
                {productions.filter(p => p.date_production === new Date().toISOString().split('T')[0]).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des productions */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Quantité</th>
                <th>Destination</th>
                <th>Date</th>
                <th>Producteur</th>
                <th>Statut</th>
                <th>Coût Ingrédients</th>
              </tr>
            </thead>
            <tbody>
              {productions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    Aucune production enregistrée
                  </td>
                </tr>
              ) : (
                productions.map((production) => (
                  <tr key={production.id}>
                    <td className="font-medium">{production.produit}</td>
                    <td>{utils.formatNumber(production.quantite, 1)}</td>
                    <td>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                        {production.destination}
                      </div>
                    </td>
                    <td>{utils.formatDate(production.date_production)}</td>
                    <td>
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-1" />
                        {production.producteur?.nom}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatutColor(production.statut)}`}>
                        {production.statut}
                      </span>
                    </td>
                    <td>
                      {production.cout_ingredients ? 
                        utils.formatCFA(production.cout_ingredients) : 
                        '-'
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de création */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Nouvelle Production</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit à produire
                  </label>
                  <select
                    value={formData.produit}
                    onChange={(e) => setFormData({...formData, produit: e.target.value})}
                    className="form-input"
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {produitsRecettes.map((produit) => (
                      <option key={produit} value={produit}>
                        {produit}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.quantite}
                    onChange={(e) => setFormData({...formData, quantite: e.target.value})}
                    className="form-input"
                    placeholder="0.0"
                    required
                  />
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
                    className="form-input"
                  >
                    <option value="Boutique">Boutique</option>
                    <option value="Commande">Commande</option>
                    <option value="Stock">Stock</option>
                    <option value="Événement">Événement</option>
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
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {/* Vérification des ingrédients */}
              {ingredientsVerification && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center">
                    {ingredientsVerification.disponible ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                    )}
                    Vérification des ingrédients
                  </h4>
                  
                  <div className="space-y-2">
                    {ingredientsVerification.details.map((detail, index) => (
                      <div 
                        key={index}
                        className={`flex justify-between items-center p-2 rounded ${
                          detail.suffisant ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <span className="font-medium">{detail.ingredient}</span>
                        <div className="text-sm">
                          <span className={detail.suffisant ? 'text-green-700' : 'text-red-700'}>
                            Nécessaire: {utils.formatNumber(detail.quantite_necessaire, 1)} {detail.unite}
                          </span>
                          <br />
                          <span className="text-gray-600">
                            Disponible: {utils.formatNumber(detail.stock_disponible, 1)} {detail.unite}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setIngredientsVerification(null);
                  }}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!ingredientsVerification?.disponible}
                >
                  Créer Production
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}