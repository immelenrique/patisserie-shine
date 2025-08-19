"use client";

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Package, Store } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';
import { productService, uniteService, referentielService, utils } from '../../lib/supabase'; // ← CORRECTION: Ajouter referentielService

export default function StockManager({ currentUser }) {
  const [products, setProducts] = useState([]);
  const [unites, setUnites] = useState([]);
  const [referentiels, setReferentiels] = useState([]); // ← CORRECTION: État pour référentiels
  const [loading, setLoading] = useState(true);
  const [unitesLoading, setUnitesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedReferentiel, setSelectedReferentiel] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nom: '',
    date_achat: new Date().toISOString().split('T')[0],
    prix_achat_total: '',
    quantite: '',
    quantite_restante: '',
    unite_id: '',
    definir_prix_vente: false, // ← CORRECTION: Nom correct
    prix_vente: ''
  });
  const filtered = referentiels.filter(ref =>
    `${ref.reference} ${ref.nom}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadUnites(),
        loadReferentiels() // ← CORRECTION: Appeler la fonction
      ]);
    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // ← CORRECTION: Fonction manquante
  const loadReferentiels = async () => {
    try {
      const { referentiels, error } = await referentielService.getAll();
      if (error) {
        console.error('Erreur chargement référentiel:', error);
      } else {
        setReferentiels(referentiels);
        console.log('✅ Référentiels chargés:', referentiels.length);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  // ← CORRECTION: Fonction handleReferentielSelect corrigée
  const handleReferentielSelect = (referentielId) => {
    if (!referentielId) {
      setSelectedReferentiel(null);
      return;
    }

    const referentiel = referentiels.find(r => r.id === parseInt(referentielId));
    if (referentiel) {
      setSelectedReferentiel(referentiel);
      
      // Calculer le prix unitaire
      const prixUnitaire = referentiel.quantite_par_conditionnement > 0 ? 
        referentiel.prix_achat_total / referentiel.quantite_par_conditionnement : 0;

      // Trouver l'unité correspondante
      const uniteCorrespondante = unites.find(u => u.value === referentiel.unite_mesure);
      
      setFormData(prev => ({
        ...prev,
        nom: referentiel.nom,
        prix_achat_total: referentiel.prix_achat_total.toString(),
        quantite: referentiel.quantite_par_conditionnement.toString(),
        quantite_restante: editingProduct ? prev.quantite_restante : referentiel.quantite_par_conditionnement.toString(),
        unite_id: uniteCorrespondante ? uniteCorrespondante.id.toString() : ''
      }));
      
      console.log('✅ Référentiel sélectionné:', referentiel.nom);
    } else {
      setSelectedReferentiel(null);
      console.warn('⚠️ Référentiel non trouvé pour ID:', referentielId);
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
      await uniteService.createBasicUnitsIfEmpty();
      
      const { unites, error } = await uniteService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des unités:', error);
        setError(error);
      } else {
        setUnites(unites);
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
      // Calculer le prix unitaire à partir du prix total
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite);
      
      const { product, error } = await productService.createWithPriceOption({
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: prixUnitaire,
        prix_achat_total: parseFloat(formData.prix_achat_total),
        quantite: parseFloat(formData.quantite),
        unite_id: parseInt(formData.unite_id),
        definir_prix_vente: formData.definir_prix_vente,
        prix_vente: formData.definir_prix_vente ? parseFloat(formData.prix_vente) : null
      });

      if (error) {
        setError(error);
      } else {
        await loadProducts();
        resetForm();
        setShowAddModal(false);
        
        if (formData.definir_prix_vente) {
          alert(`Produit créé avec succès !\n\nAjouté au stock principal avec prix de vente défini: ${utils.formatCFA(parseFloat(formData.prix_vente))}\n\nPour l'ajouter à la boutique, un employé doit faire une demande vers "Boutique".`);
        } else {
          alert('Produit créé avec succès dans le stock principal !');
        }
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
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite);
      
      const { product, error } = await productService.update(editingProduct.id, {
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: prixUnitaire,
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
    const prixTotal = (product.prix_achat || 0) * (product.quantite || 1);
    setFormData({
      nom: product.nom,
      date_achat: product.date_achat,
      prix_achat_total: prixTotal.toString(),
      quantite: product.quantite.toString(),
      quantite_restante: product.quantite_restante.toString(),
      unite_id: product.unite_id.toString(),
      definir_prix_vente: false,
      prix_vente: ''
    });
    setError('');
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      date_achat: new Date().toISOString().split('T')[0],
      prix_achat_total: '',
      quantite: '',
      quantite_restante: '',
      unite_id: '',
      definir_prix_vente: false, // ← CORRECTION
      prix_vente: ''
    });
    setSelectedReferentiel(null);
    setError('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingProduct(null);
    resetForm();
  };

  // Calculer le prix unitaire pour affichage
  const getPrixUnitaire = () => {
    if (formData.prix_achat_total && formData.quantite) {
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite);
      return prixUnitaire.toFixed(2);
    }
    return '0';
  };

  // Calculer la marge si prix de vente défini
  const calculerMarge = () => {
    if (formData.prix_vente && formData.prix_achat_total && formData.quantite) {
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite);
      const prixVente = parseFloat(formData.prix_vente);
      const marge = prixVente - prixUnitaire;
      const pourcentageMarge = prixUnitaire > 0 ? (marge / prixUnitaire) * 100 : 0;
      
      return {
        marge: marge,
        pourcentage: pourcentageMarge
      };
    }
    return { marge: 0, pourcentage: 0 };
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valeur totale</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
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
                  const valeurTotale = (product.prix_achat || 0) * (product.quantite_restante || 0);
                  
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
                        {utils.formatCFA(product.prix_achat)} / {product.unite?.value}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {utils.formatCFA(valeurTotale)}
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
        title={editingProduct ? "Modifier le Produit" : "Ajouter un Produit au Stock Principal"} 
        size="lg"
      >
        <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {unites.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-yellow-800">
                <strong>⚠️ Aucune unité disponible</strong>
                <br />
                Vous devez d'abord créer des unités de mesure dans l'onglet "Unités".
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Produit du référentiel (optionnel)
        </label>

        {/* Champ de recherche au lieu de <select> */}
        <div className="relative mb-3">
          <input
            type="text"
            value={search || (selectedReferentiel ? `[${selectedReferentiel.reference}] ${selectedReferentiel.nom}` : "")}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={submitting}
            placeholder="Sélectionner depuis le référentiel..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />

          {/* Liste des options filtrées */}
          {open && filtered.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow">
              {filtered.map(ref => (
                <li
                  key={ref.id}
                  onClick={() => {
                    handleReferentielSelect(ref.id);
                    setSearch(`[${ref.reference}] ${ref.nom}`);
                    setOpen(false);
                  }}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                >
                  [{ref.reference}] {ref.nom} - {ref.quantite_par_conditionnement}/{ref.unite_mesure}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ton champ Nom du produit */}
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nom du produit * 
          {selectedReferentiel && (
            <span className="text-xs text-blue-600 ml-2">
              (Auto-rempli depuis référentiel [{selectedReferentiel.reference}])
            </span>
          )}
        </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Farine de Blé"
                required
                disabled={submitting}
              />
              {selectedReferentiel && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Référentiel sélectionné</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div><strong>Référence:</strong> {selectedReferentiel.reference}</div>
                    <div><strong>Conditionnement:</strong> {selectedReferentiel.type_conditionnement}</div>
                    <div><strong>Quantité:</strong> {selectedReferentiel.quantite_par_conditionnement} {selectedReferentiel.unite_mesure}</div>
                    <div><strong>Prix total:</strong> {utils.formatCFA(selectedReferentiel.prix_achat_total)}</div>
                    <div><strong>Prix unitaire:</strong> {utils.formatCFA(selectedReferentiel.prix_unitaire)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReferentiel(null);
                      setFormData(prev => ({
                        ...prev,
                        nom: '',
                        prix_achat_total: '',
                        quantite: '',
                        quantite_restante: '',
                        unite_id: ''
                      }));
                    }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                  >
                    ✕ Effacer la sélection
                  </button>
                </div>
              )}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Unité *</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix d'achat TOTAL (CFA) *
                <span className="text-xs text-gray-500 block">Prix total de toute la quantité</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.prix_achat_total}
                onChange={(e) => setFormData({...formData, prix_achat_total: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="18500"
                required
                disabled={submitting}
              />
              {formData.prix_achat_total && formData.quantite && (
                <p className="text-xs text-blue-600 mt-1">
                  Prix unitaire: {utils.formatCFA(getPrixUnitaire())} / {unites.find(u => u.id === parseInt(formData.unite_id))?.value || 'unité'}
                </p>
              )}
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
          </div>

          {/* Section Prix de Vente */}
          {!editingProduct && (
            <div className="border-t pt-4">
              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="checkbox"
                  id="definir_prix_vente"
                  checked={formData.definir_prix_vente}
                  onChange={(e) => setFormData({...formData, definir_prix_vente: e.target.checked, prix_vente: e.target.checked ? formData.prix_vente : ''})}
                  className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="definir_prix_vente" className="flex items-center text-sm font-medium text-gray-700">
                  <Store className="w-4 h-4 mr-2 text-orange-600" />
                  Définir le prix de vente (pour futures demandes vers boutique)
                </label>
              </div>

              {formData.definir_prix_vente && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-700 mb-2">
                        Prix de vente unitaire (CFA) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.prix_vente}
                        onChange={(e) => setFormData({...formData, prix_vente: e.target.value})}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="2500"
                        required={formData.definir_prix_vente}
                        disabled={submitting}
                      />
                    </div>

                    {formData.prix_vente && formData.prix_achat_total && formData.quantite && (
                      <div className="self-end">
                        <div className="bg-white border border-blue-300 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-blue-700 mb-2">Marge calculée</h4>
                          <div className="text-xs space-y-1">
                            <div>Prix d'achat unitaire: {utils.formatCFA(getPrixUnitaire())}</div>
                            <div>Prix de vente: {utils.formatCFA(formData.prix_vente)}</div>
                            <div className="border-t pt-1">
                              <div className={`font-semibold ${calculerMarge().marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Marge: {calculerMarge().marge >= 0 ? '+' : ''}{utils.formatCFA(calculerMarge().marge)}
                              </div>
                              <div className={`text-xs ${calculerMarge().pourcentage >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                                {Math.round(calculerMarge().pourcentage)}% de marge
                                {calculerMarge().pourcentage < 20 && ' (⚠️ Faible)'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-blue-700">
                    ℹ️ Le produit sera ajouté au stock principal avec prix de vente défini
                    <br />
                    📋 Pour l'ajouter à la boutique : Créer une demande vers "Boutique"
                    <br />
                    ✅ Le prix sera appliqué automatiquement lors de l'ajout en boutique
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={submitting || unites.length === 0 || !formData.unite_id || (formData.definir_prix_vente && !formData.prix_vente)}
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
