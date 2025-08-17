"use client";

import { useState, useEffect } from 'react';
import { productionService, recetteService, utils } from '../../lib/supabase';
import { Plus, ChefHat, Calendar, MapPin, User, AlertTriangle, CheckCircle, Clock, Package, Info, Store } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function ProductionManager({ currentUser }) {
  const [productions, setProductions] = useState([]);
  const [produitsRecettes, setProduitsRecettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    produit: '',
    quantite: '',
    destination: 'Boutique',
    date_production: new Date().toISOString().split('T')[0],
    // Nouveau champ pour le prix de vente si destination = Boutique
    prix_vente: ''
  });
  const [recetteInfo, setRecetteInfo] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.produit) {
      loadRecetteInfo();
    } else {
      setRecetteInfo(null);
    }
  }, [formData.produit]);

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

  const loadRecetteInfo = async () => {
    try {
      const { recettes, error } = await recetteService.getRecettesProduit(formData.produit);
      
      if (error) {
        console.error('Erreur chargement recette:', error);
        return;
      }

      if (recettes && recettes.length > 0) {
        const coutTotal = recettes.reduce((sum, r) => {
          const produit = r.produit_ingredient;
          if (produit && produit.prix_achat && produit.quantite) {
            return sum + ((produit.prix_achat / produit.quantite) * r.quantite_necessaire);
          }
          return sum;
        }, 0);

        setRecetteInfo({
          ingredients: recettes,
          coutUnitaire: coutTotal,
          nombreIngredients: recettes.length
        });
      }
    } catch (err) {
      console.error('Erreur dans loadRecetteInfo:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      const result = await productionService.createProduction({
        ...formData,
        quantite: parseFloat(formData.quantite),
        prix_vente: formData.destination === 'Boutique' && formData.prix_vente ? parseFloat(formData.prix_vente) : null
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      let message = `✅ Production créée avec succès !\n\n${result.production?.message || ''}`;
      
      if (formData.destination === 'Boutique') {
        if (formData.prix_vente) {
          message += `\n\n🏪 Produit ajouté au stock boutique avec prix de vente: ${utils.formatCFA(parseFloat(formData.prix_vente))}`;
        } else {
          message += `\n\n⚠️ ATTENTION: Le produit a été ajouté au stock boutique mais SANS prix de vente.\nIl ne sera pas disponible en caisse tant que le prix n'est pas défini dans l'onglet "Prix Vente".`;
        }
      } else {
        message += `\n\n📦 Produit stocké pour: ${formData.destination}`;
      }
      
      alert(message);

      // Réinitialiser le formulaire
      setShowAddModal(false);
      setFormData({
        produit: '',
        quantite: '',
        destination: 'Boutique',
        date_production: new Date().toISOString().split('T')[0],
        prix_vente: ''
      });
      setRecetteInfo(null);
      
      // Recharger les données
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          <p className="text-gray-600">Création de produits finis - Ajout direct au stock boutique</p>
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

      {/* Message d'information sur le nouveau processus */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-blue-800">
            <h4 className="font-medium mb-1">🔄 Nouveau processus de production</h4>
            <p className="text-sm">
              <strong>Important :</strong><br/>
              ✅ <strong>Les productions n'ajoutent PLUS au stock principal</strong><br/>
              🏪 <strong>Ajout direct au stock boutique</strong> selon la destination<br/>
              💰 <strong>Définissez le prix de vente</strong> pour la destination "Boutique"<br/>
              📦 <strong>Les ingrédients sont déduits</strong> automatiquement du stock atelier
            </p>
          </div>
        </div>
      </div>

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
            <Store className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Vers Boutique</p>
              <p className="text-2xl font-bold text-gray-900">
                {productions.filter(p => p.destination === 'Boutique').length}
              </p>
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
                        {production.destination === 'Boutique' ? (
                          <Store className="w-4 h-4 text-green-600 mr-1" />
                        ) : (
                          <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                        )}
                        <span className={production.destination === 'Boutique' ? 'text-green-600 font-medium' : ''}>
                          {production.destination}
                        </span>
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
                    disabled={submitting}
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
                    Quantité à produire *
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
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Multiplicateur de la recette (ex: 2 = double portion)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination *
                  </label>
                  <select
                    value={formData.destination}
                    onChange={(e) => setFormData({
                      ...formData, 
                      destination: e.target.value,
                      prix_vente: e.target.value !== 'Boutique' ? '' : formData.prix_vente
                    })}
                    className="form-input w-full"
                    disabled={submitting}
                  >
                    <option value="Boutique">🏪 Boutique (vente directe)</option>
                    <option value="Commande">📦 Commande client</option>
                    <option value="Stock">📋 Stock (réserve)</option>
                    <option value="Événement">🎉 Événement spécial</option>
                    <option value="Test">🧪 Test/Échantillon</option>
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
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Champ prix de vente si destination = Boutique */}
              {formData.destination === 'Boutique' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-3 flex items-center">
                    <Store className="w-5 h-5 mr-2" />
                    Configuration Boutique
                  </h4>
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Prix de vente unitaire (CFA)
                      <span className="text-xs text-green-600 block">Optionnel - peut être défini plus tard dans "Prix Vente"</span>
                    </label>
                    <input
                      type="number"
                      step="25"
                      min="0"
                      value={formData.prix_vente}
                      onChange={(e) => setFormData({...formData, prix_vente: e.target.value})}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="2500"
                      disabled={submitting}
                    />
                    {recetteInfo && formData.prix_vente && (
                      <div className="mt-2 p-2 bg-white border border-green-300 rounded text-xs">
                        <div className="flex justify-between">
                          <span>Coût production unitaire:</span>
                          <span className="font-semibold">{utils.formatCFA(recetteInfo.coutUnitaire)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Prix de vente:</span>
                          <span className="font-semibold text-green-600">{utils.formatCFA(parseFloat(formData.prix_vente))}</span>
                        </div>
                        <div className="border-t pt-1 mt-1">
                          <div className="flex justify-between">
                            <span>Marge unitaire:</span>
                            <span className={`font-semibold ${(parseFloat(formData.prix_vente) - recetteInfo.coutUnitaire) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {utils.formatCFA(parseFloat(formData.prix_vente) - recetteInfo.coutUnitaire)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>% Marge:</span>
                            <span className="font-semibold text-blue-600">
                              {recetteInfo.coutUnitaire > 0 ? Math.round(((parseFloat(formData.prix_vente) - recetteInfo.coutUnitaire) / recetteInfo.coutUnitaire) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-green-700">
                    ✓ Le produit sera ajouté directement au stock boutique
                    {formData.prix_vente ? 
                      <><br />✓ Disponible immédiatement pour la vente en caisse</> :
                      <><br />⚠️ Prix à définir pour être vendable en caisse</>
                    }
                  </div>
                </div>
              )}

              {/* Informations sur la recette sélectionnée */}
              {recetteInfo && formData.quantite && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3 flex items-center">
                    <Package className="w-5 h-5 text-blue-600 mr-2" />
                    Aperçu de la production
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white p-3 rounded border">
                      <p className="text-gray-600">Ingrédients nécessaires</p>
                      <p className="font-semibold text-lg">{recetteInfo.nombreIngredients}</p>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <p className="text-gray-600">Coût unitaire estimé</p>
                      <p className="font-semibold text-lg text-green-600">
                        {utils.formatCFA(recetteInfo.coutUnitaire)}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded border">
                      <p className="text-gray-600">Coût total estimé</p>
                      <p className="font-semibold text-lg text-blue-600">
                        {utils.formatCFA(recetteInfo.coutUnitaire * parseFloat(formData.quantite || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-orange-700 text-sm">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Les ingrédients seront automatiquement déduits du stock atelier.
                      <br />
                      <Store className="w-4 h-4 inline mr-1" />
                      Le produit fini sera ajouté au stock boutique (plus de stock principal).
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setRecetteInfo(null);
                    setError('');
                  }}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <div className="spinner w-4 h-4"></div>
                      Création...
                    </>
                  ) : (
                    <>
                      <ChefHat className="w-4 h-4" />
                      Enregistrer Production
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
