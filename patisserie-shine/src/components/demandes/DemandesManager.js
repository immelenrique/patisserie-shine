"use client";

import { useState, useEffect } from 'react';
import { demandeService, productService, utils, supabase } from '../../lib/supabase';
import { Plus, ShoppingCart, Check, X, Clock, Package, ArrowRight, Warehouse, Store, DollarSign, Trash2, Search } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function DemandesManager({ currentUser }) {
  const [demandes, setDemandes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // État pour la demande multi-produits
  const [formData, setFormData] = useState({
    destination: 'Production',
    commentaire: ''
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

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

  // Ajouter un produit à la sélection
  const addProductToSelection = (product) => {
    const isAlreadySelected = selectedProducts.find(p => p.id === product.id);
    if (isAlreadySelected) {
      alert('Ce produit est déjà sélectionné');
      return;
    }

    const newProduct = {
      id: product.id,
      nom: product.nom,
      quantite_disponible: product.quantite_restante,
      unite: product.unite,
      quantite_demandee: 1
    };

    setSelectedProducts([...selectedProducts, newProduct]);
    setSearchTerm('');
    setShowProductSearch(false);
  };

  // Modifier la quantité d'un produit sélectionné
  const updateProductQuantity = (productId, newQuantity) => {
    setSelectedProducts(prev => 
      prev.map(p => 
        p.id === productId 
          ? { ...p, quantite_demandee: Math.max(0.01, parseFloat(newQuantity) || 0.01) }
          : p
      )
    );
  };

  // Supprimer un produit de la sélection
  const removeProductFromSelection = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Filtrer les produits disponibles pour la recherche
  const getAvailableProducts = () => {
    return products.filter(product => 
      product.quantite_restante > 0 && 
      product.nom.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedProducts.find(p => p.id === product.id)
    );
  };

  // Créer la demande multi-produits
  const handleCreateDemande = async (e) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      alert('Veuillez sélectionner au moins un produit');
      return;
    }

    // Vérifier que toutes les quantités sont valides
    const invalidProducts = selectedProducts.filter(p => 
      !p.quantite_demandee || p.quantite_demandee <= 0 || p.quantite_demandee > p.quantite_disponible
    );

    if (invalidProducts.length > 0) {
      alert(`Quantités invalides pour : ${invalidProducts.map(p => p.nom).join(', ')}`);
      return;
    }

    try {
      setError('');
      
      // Créer une demande groupée via une nouvelle API
      const demandeGroupee = {
        destination: formData.destination,
        commentaire: formData.commentaire,
        produits: selectedProducts.map(p => ({
          produit_id: p.id,
          quantite: p.quantite_demandee
        }))
      };

      const { demande, error } = await demandeService.createGrouped(demandeGroupee);

      if (error) {
        console.error('Erreur lors de la création:', error);
        setError('Erreur lors de la création de la demande: ' + error);
      } else {
        await loadData();
        resetForm();
        setShowAddModal(false);
        alert(`Demande groupée créée avec succès !\n\n${selectedProducts.length} produit(s) demandé(s) vers ${formData.destination}`);
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de la création de la demande');
    }
  };

  const resetForm = () => {
    setFormData({
      destination: 'Production',
      commentaire: ''
    });
    setSelectedProducts([]);
    setSearchTerm('');
    setShowProductSearch(false);
    setError('');
  };

  const handleValidateGroupedDemande = async (demandeGroupeeId) => {
    try {
      const { result, error, message } = await demandeService.validateGrouped(demandeGroupeeId);
      
      if (error) {
        console.error('Erreur lors de la validation groupée:', error);
        alert('Erreur lors de la validation de la demande groupée: ' + error);
      } else {
        await loadData();
        alert(message || 'Demande groupée traitée avec succès !');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la validation de la demande groupée');
    }
  };

  const handleRejectGroupedDemande = async (demandeGroupeeId) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser toute cette demande groupée ?')) return;
    
    try {
      // Marquer la demande groupée comme refusée
      const { error: groupError } = await supabase
        .from('demandes_groupees')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeGroupeeId);

      if (groupError) {
        console.error('Erreur refus demande groupée:', groupError);
        alert('Erreur lors du refus de la demande groupée: ' + groupError.message);
        return;
      }

      // Marquer toutes les lignes comme refusées
      const { error: lignesError } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('demande_groupee_id', demandeGroupeeId)
        .eq('statut', 'en_attente');

      if (lignesError) {
        console.error('Erreur refus lignes:', lignesError);
      }

      await loadData();
      alert('Demande groupée refusée');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du refus de la demande groupée');
    }
  };

  const handleValidateDemande = async (demandeId, destination) => {
    try {
      const { result, error, message } = await demandeService.validateWithBoutiqueCheck(demandeId);
      
      if (error) {
        console.error('Erreur lors de la validation:', error);
        alert('Erreur lors de la validation de la demande: ' + error);
      } else {
        await loadData();
        alert(message || 'Demande validée avec succès !');
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
      case 'Boutique': return <Store className="w-4 h-4" />;
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
          <p className="text-gray-600">Transfert du stock principal vers la production ou la boutique</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Demande Multi-produits</span>
        </button>
      </div>

      {/* Informations sur le processus amélioré */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2 flex items-center">
          <ArrowRight className="w-5 h-5 mr-2" />
          Processus de demande multi-produits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">1</span>
            <span>Sélectionner plusieurs ingrédients</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">2</span>
            <span>Validation groupée par admin/production</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded-full text-xs font-medium">3</span>
            <span>Traitement automatique de tous les produits</span>
          </div>
        </div>
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <Store className="w-4 h-4 inline mr-1" />
          <strong>Nouveau :</strong> Créez une demande avec plusieurs produits en une seule fois !
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produits</th>
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
                    <span className="text-sm">Créez votre première demande multi-produits</span>
                  </td>
                </tr>
              ) : (
                demandes.map((demande) => {
                  const produit = demande.produit;
                  const peutValider = currentUser.role === 'admin' || currentUser.role === 'employe_production';
                  
                  return (
                    <tr key={demande.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">#{demande.id}</div>
                        {demande.commentaire && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">{demande.commentaire}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            {demande.type === 'groupee' ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  📦 Demande groupée ({demande.nombre_produits} produits)
                                </div>
                                <div className="text-xs text-gray-500 space-y-1 mt-1">
                                  {demande.lignes && demande.lignes.slice(0, 3).map((ligne, idx) => (
                                    <div key={idx}>
                                      • {ligne.produit?.nom}: {utils.formatNumber(ligne.quantite, 2)} {ligne.produit?.unite?.label}
                                    </div>
                                  ))}
                                  {demande.lignes && demande.lignes.length > 3 && (
                                    <div className="text-blue-600">
                                      ... et {demande.lignes.length - 3} autre(s)
                                    </div>
                                  )}
                                </div>
                                {demande.commentaire && (
                                  <div className="text-xs text-blue-600 mt-1 italic">
                                    💬 {demande.commentaire}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="text-sm font-medium text-gray-900">{produit?.nom || 'Ingrédient inconnu'}</div>
                                <div className="text-xs text-gray-500">
                                  {utils.formatNumber(demande.quantite, 2)} {produit?.unite?.label || ''} demandé(s)
                                </div>
                                <div className="text-xs text-gray-500">
                                  Stock: {produit?.quantite_restante || 0} {produit?.unite?.label || ''}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {demande.type !== 'groupee' && produit && demande.quantite > produit.quantite_restante && (
                          <div className="text-xs text-red-600 mt-1">⚠ Quantité supérieure au stock</div>
                        )}
                        {demande.type === 'groupee' && demande.lignes && demande.lignes.some(l => l.quantite > (l.produit?.quantite_restante || 0)) && (
                          <div className="text-xs text-red-600 mt-1">⚠ Certains produits dépassent le stock</div>
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
                        {demande.destination === 'Boutique' && (
                          <div className="text-xs text-green-600 mt-1">→ Stock Boutique</div>
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
                        {demande.statut === 'validee' && (
                          <div className="text-xs text-green-600 mt-1">
                            ✓ {demande.destination === 'Production' ? 'Ajouté au stock atelier' : 'Ajouté au stock boutique'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {demande.statut === 'en_attente' && peutValider && (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => demande.type === 'groupee' 
                                ? handleValidateGroupedDemande(demande.demande_groupee_id)
                                : handleValidateDemande(demande.id, demande.destination)
                              }
                              className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                              title={demande.type === 'groupee' 
                                ? 'Valider toute la demande groupée'
                                : demande.destination === 'Boutique' ? 'Valider et ajouter à la boutique' : 'Valider et transférer à l\'atelier'
                              }
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => demande.type === 'groupee'
                                ? handleRejectGroupedDemande(demande.demande_groupee_id)
                                : handleRejectDemande(demande.id)
                              }
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              title={demande.type === 'groupee' ? 'Refuser toute la demande groupée' : 'Refuser'}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {demande.statut !== 'en_attente' && (
                          <div className="text-xs text-gray-500">
                            {demande.statut === 'validee' && demande.valideur && `Par ${demande.valideur.nom}`}
                            {demande.statut === 'refusee' && 'Refusée'}
                            {demande.statut === 'partiellement_validee' && (
                              <span className="text-yellow-600">Partiellement validée</span>
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

      {/* Modal Nouvelle Demande Multi-produits */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => {setShowAddModal(false); resetForm();}} 
        title="Nouvelle Demande Multi-produits" 
        size="lg"
      >
        <form onSubmit={handleCreateDemande} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Sélection de la destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Production">Production (→ Stock Atelier)</option>
              <option value="Boutique">Boutique (→ Vente directe)</option>
              <option value="Commande">Commande spéciale</option>
              <option value="Échantillon">Échantillon/Test</option>
              <option value="Perte">Perte/Casse</option>
            </select>
          </div>

          {/* Commentaire optionnel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
            <textarea
              value={formData.commentaire}
              onChange={(e) => setFormData({...formData, commentaire: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Description de la demande..."
            />
          </div>

          {/* Section de recherche et sélection des produits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner les produits ({selectedProducts.length} sélectionné{selectedProducts.length > 1 ? 's' : ''})
            </label>
            
            {/* Barre de recherche */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowProductSearch(e.target.value.length > 0);
                }}
                onFocus={() => setShowProductSearch(searchTerm.length > 0)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Rechercher un produit à ajouter..."
              />
              
              {/* Liste des produits trouvés */}
              {showProductSearch && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {getAvailableProducts().map(product => (
                    <div
                      key={product.id}
                      onClick={() => addProductToSelection(product)}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.nom}</div>
                          <div className="text-xs text-gray-500">
                            Stock: {product.quantite_restante} {product.unite?.label}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-orange-500" />
                      </div>
                    </div>
                  ))}
                  {getAvailableProducts().length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      Aucun produit trouvé ou tous déjà sélectionnés
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Liste des produits sélectionnés */}
            {selectedProducts.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Produits sélectionnés :</h4>
                {selectedProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{product.nom}</div>
                      <div className="text-xs text-gray-500">
                        Stock disponible: {product.quantite_disponible} {product.unite?.label}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-600">Quantité:</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={product.quantite_disponible}
                          value={product.quantite_demandee}
                          onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        <span className="text-xs text-gray-500">{product.unite?.label}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeProductFromSelection(product.id)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        title="Retirer de la sélection"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Résumé */}
                <div className="border-t pt-3 text-sm text-gray-600">
                  <strong>Résumé:</strong> {selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''} sélectionné{selectedProducts.length > 1 ? 's' : ''} pour {formData.destination}
                </div>
              </div>
            )}
          </div>

          {/* Information sur le processus */}
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">🔄 Processus de validation</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Votre demande groupée sera soumise à validation</p>
              <p>• Les administrateurs et employés de production peuvent valider</p>
              <p>• Une fois validée, tous les produits seront traités automatiquement</p>
              {formData.destination === 'Production' && (
                <p>• <strong>Pour la production :</strong> tous les ingrédients seront ajoutés au stock atelier</p>
              )}
              {formData.destination === 'Boutique' && (
                <p>• <strong>Pour la boutique :</strong> tous les produits seront ajoutés au stock boutique avec leurs prix</p>
              )}
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={selectedProducts.length === 0}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Créer la demande ({selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''})
            </button>
            <button 
              type="button" 
              onClick={() => {setShowAddModal(false); resetForm();}}
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

// Composant pour afficher le prix boutique d'un produit
function PrixBoutiqueCell({ produitId }) {
  const [prix, setPrix] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (produitId) {
      loadPrix();
    }
  }, [produitId]);

  const loadPrix = async () => {
    try {
      const { data, error } = await supabase
        .from('prix_vente_produits')
        .select('prix, actif')
        .eq('produit_id', produitId);
      
      if (error) {
        setPrix(null);
      } else if (data && data.length > 0) {
        const prixActif = data.find(p => p.actif === true) || data[0];
        setPrix(prixActif?.prix || null);
      } else {
        setPrix(null);
      }
    } catch (err) {
      setPrix(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-400">Chargement...</div>;
  }

  return (
    <div className="text-xs">
      {prix ? (
        <>
          <div className="flex items-center text-green-600">
            <DollarSign className="w-3 h-3 mr-1" />
            {utils.formatCFA(prix)}
          </div>
          <div className="text-gray-500">Prix défini ✓</div>
        </>
      ) : (
        <>
          <div className="flex items-center text-yellow-600">
            <DollarSign className="w-3 h-3 mr-1" />
            Non défini
          </div>
          <div className="text-gray-500">À définir</div>
        </>
      )}
    </div>
  );
}
