"use client";

import { useState, useEffect } from 'react';
import { demandeService, productService, utils } from '../../lib/supabase';
import { Plus, ShoppingCart, Check, X, Clock, Package, ArrowRight, Warehouse } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function DemandesManager({ currentUser }) {
  const [demandes, setDemandes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    produit_id: '',
    quantite: '',
    destination: 'Production'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [demandesResult, productsResult] = await Promise.all([
        demandeService.getAll(),
        productService.getAll()
      ]);

      if (demandesResult.error) {
        console.error('Erreur lors du chargement des demandes:', demandesResult.error);
      } else {
        setDemandes(demandesResult.demandes);
      }

      if (productsResult.error) {
        console.error('Erreur lors du chargement des produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDemande = async (e) => {
    e.preventDefault();
    try {
      const { demande, error } = await demandeService.create({
        produit_id: parseInt(formData.produit_id),
        quantite: parseFloat(formData.quantite),
        destination: formData.destination
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la demande: ' + error);
      } else {
        await loadData();
        setFormData({
          produit_id: '', quantite: '', destination: 'Production'
        });
        setShowAddModal(false);
        alert('Demande créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la demande');
    }
  };

  const handleValidateDemande = async (demandeId) => {
    try {
      const { result, error } = await demandeService.validate(demandeId);
      
      if (error) {
        console.error('Erreur lors de la validation:', error);
        alert('Erreur lors de la validation de la demande: ' + error);
      } else {
        await loadData();
        alert('Demande validée avec succès ! Les ingrédients ont été ajoutés au stock atelier.');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la validation de la demande');
    }
  };

  const handleRejectDemande = async (demandeId) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser cette demande ?')) return;
    
    try {
      const { demande, error } = await demandeService.reject(demandeId);
      
      if (error) {
        console.error('Erreur lors du refus:', error);
        alert('Erreur lors du refus de la demande: ' + error);
      } else {
        await loadData();
        alert('Demande refusée');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du refus de la demande');
    }
  };

  const getDestinationIcon = (destination) => {
    switch (destination) {
      case 'Production': return <Warehouse className="w-4 h-4" />;
      case 'Boutique': return <ShoppingCart className="w-4 h-4" />;
      case 'Commande': return <Package className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getDestinationColor = (destination) => {
    switch (destination) {
      case 'Production': return 'bg-blue-100 text-blue-800';
      case 'Boutique': return 'bg-green-100 text-green-800';
      case 'Commande': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="w-8 h-8 text-orange-600 mr-3" />
            Demandes de Matières Premières
          </h2>
          <p className="text-gray-600">Sortie du stock principal vers la production ou autres destinations</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Demande</span>
        </button>
      </div>

      {/* Informations sur le processus */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2 flex items-center">
          <ArrowRight className="w-5 h-5 mr-2" />
          Processus de demande
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">1</span>
            <span>Créer une demande d'ingrédients</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">2</span>
            <span>Validation par admin/production</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">3</span>
            <span>Auto-ajout au stock atelier</span>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingrédient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demandeur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {demandes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucune demande enregistrée
                    <br />
                    <span className="text-sm">Créez votre première demande pour transférer des ingrédients</span>
                  </td>
                </tr>
              ) : (
                demandes.map((demande) => (
                  <tr key={demande.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{demande.produit?.nom || 'Ingrédient inconnu'}</div>
                          <div className="text-xs text-gray-500">
                            Stock disponible: {demande.produit?.quantite_restante || 0} {demande.produit?.unite?.label || ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {utils.formatNumber(demande.quantite, 2)} {demande.produit?.unite?.label || ''}
                      </div>
                      {demande.produit && demande.quantite > demande.produit.quantite_restante && (
                        <div className="text-xs text-red-600">⚠ Quantité supérieure au stock</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDestinationColor(demande.destination)}`}>
                        {getDestinationIcon(demande.destination)}
                        <span className="ml-1">{demande.destination}</span>
                      </span>
                      {demande.destination === 'Production' && (
                        <div className="text-xs text-blue-600 mt-1">→ Stock Atelier</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {demande.demandeur?.nom || 'Non spécifié'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {utils.formatDate(demande.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={demande.statut} />
                      {demande.statut === 'validee' && demande.destination === 'Production' && (
                        <div className="text-xs text-green-600 mt-1">✓ Ajouté au stock atelier</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {demande.statut === 'en_attente' && (currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleValidateDemande(demande.id)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                            title="Valider et transférer"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleRejectDemande(demande.id)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                            title="Refuser"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {demande.statut !== 'en_attente' && (
                        <div className="text-xs text-gray-500">
                          {demande.statut === 'validee' && demande.valideur && `Par ${demande.valideur.nom}`}
                          {demande.statut === 'refusee' && 'Refusée'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nouvelle Demande */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Nouvelle Demande d'Ingrédients" 
        size="md"
      >
        <form onSubmit={handleAddDemande} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ingrédient demandé *</label>
            <select
              value={formData.produit_id}
              onChange={(e) => setFormData({...formData, produit_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un ingrédient</option>
              {products.filter(p => (p.quantite_restante || 0) > 0).map(product => (
                <option key={product.id} value={product.id}>
                  {product.nom} (Stock: {utils.formatNumber(product.quantite_restante || 0, 1)} {product.unite?.label})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Seuls les produits en stock sont disponibles
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité demandée *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantite}
              onChange={(e) => setFormData({...formData, quantite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.0"
              required
            />
            {formData.produit_id && (
              <p className="text-xs text-gray-500 mt-1">
                Stock disponible: {utils.formatNumber(products.find(p => p.id === parseInt(formData.produit_id))?.quantite_restante || 0, 1)} {products.find(p => p.id === parseInt(formData.produit_id))?.unite?.label}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Production">Production (→ Stock Atelier)</option>
              <option value="Boutique">Boutique (vente directe)</option>
              <option value="Commande">Commande spéciale</option>
              <option value="Échantillon">Échantillon/Test</option>
              <option value="Perte">Perte/Casse</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.destination === 'Production' && 'Les ingrédients validés seront automatiquement ajoutés au stock atelier'}
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">🔄 Processus de validation</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Votre demande sera soumise à validation</p>
              <p>• Les administrateurs et employés de production peuvent valider</p>
              <p>• Une fois validée, le stock principal sera automatiquement décrémenté</p>
              {formData.destination === 'Production' && (
                <p>• <strong>Pour la production :</strong> les ingrédients seront ajoutés au stock atelier</p>
              )}
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Créer la demande
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
    </div>
  );
}
