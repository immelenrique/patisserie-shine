"use client";

import { useState, useEffect } from 'react';
import { productService, utils } from '../../lib/supabase';
import { DollarSign, Plus, Edit, TrendingUp, Package, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function PrixVenteManager({ currentUser }) {
  const [prixVente, setPrixVente] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrix, setEditingPrix] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    produit_id: '',
    prix_vente: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prixResult, produitsResult] = await Promise.all([
        productService.getPrixVente(),
        productService.getAll()
      ]);

      if (prixResult.error) {
        console.error('Erreur prix vente:', prixResult.error);
      } else {
        setPrixVente(prixResult.prix || []);
      }

      if (produitsResult.error) {
        console.error('Erreur produits:', produitsResult.error);
      } else {
        setProduits(produitsResult.products || []);
      }

      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await productService.definirPrixVente(
        parseInt(formData.produit_id),
        parseFloat(formData.prix_vente)
      );

      if (result.error || !result.success) {
        setError(result.error || 'Erreur lors de la définition du prix');
      } else {
        alert(result.message);
        setShowModal(false);
        setEditingPrix(null);
        resetForm();
        loadData();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (prix) => {
    setEditingPrix(prix);
    setFormData({
      produit_id: prix.produit_id.toString(),
      prix_vente: prix.prix_vente.toString()
    });
    setShowModal(true);
    setError('');
  };

  const resetForm = () => {
    setFormData({
      produit_id: '',
      prix_vente: ''
    });
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPrix(null);
    resetForm();
  };

  // Calculer les statistiques
  const stats = {
    totalProduits: produits.length,
    avecPrix: prixVente.length,
    sansPrix: produits.length - prixVente.length,
    margeMoyenne: prixVente.length > 0 ? 
      prixVente.reduce((sum, p) => sum + (p.pourcentage_marge || 0), 0) / prixVente.length : 0
  };

  const canManagePrices = currentUser?.role === 'admin' || currentUser?.username === 'proprietaire';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Chargement des prix...</span>
      </div>
    );
  }

  if (!canManagePrices) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accès restreint</h3>
        <p className="text-gray-500">Seuls les administrateurs et le propriétaire peuvent gérer les prix de vente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <DollarSign className="w-8 h-8 text-orange-600 mr-3" />
            Gestion des Prix de Vente
          </h1>
          <p className="text-gray-600">Définir les prix de vente et calculer les marges</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Définir Prix
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

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total produits</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProduits}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avec prix défini</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avecPrix}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Sans prix</p>
              <p className="text-2xl font-bold text-gray-900">{stats.sansPrix}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Marge moyenne</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(stats.margeMoyenne)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerte produits sans prix */}
      {stats.sansPrix > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <div>
              <h4 className="font-medium text-yellow-800">
                {stats.sansPrix} produit{stats.sansPrix > 1 ? 's' : ''} sans prix de vente défini
              </h4>
              <p className="text-yellow-700 text-sm">
                Ces produits ne pourront pas être vendus en boutique tant qu'aucun prix n'est défini.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tableau des prix */}
      <Card>
        <div className="flex justify-between items-center mb-4 p-6 border-b">
          <h3 className="text-lg font-semibold">Prix de Vente Définis</h3>
          <div className="text-sm text-gray-500">
            {prixVente.length} prix défini{prixVente.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix de vente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marge</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Marge</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Défini par</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prixVente.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucun prix de vente défini
                    <br />
                    <span className="text-sm">Définissez les prix de vente pour vos produits</span>
                  </td>
                </tr>
              ) : (
                prixVente.map((prix) => (
                  <tr key={prix.id}>
                    <td className="px-6 py-4 font-medium">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{prix.produit?.nom}</div>
                        <div className="text-sm text-gray-500">{prix.produit?.unite?.label}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">
                        {utils.formatCFA(prix.produit?.prix_achat || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-600 text-lg">
                        {utils.formatCFA(prix.prix_vente)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${prix.marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {prix.marge >= 0 ? '+' : ''}{utils.formatCFA(prix.marge || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (prix.pourcentage_marge || 0) >= 50 ? 'bg-green-100 text-green-800' :
                        (prix.pourcentage_marge || 0) >= 20 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {Math.round(prix.pourcentage_marge || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {prix.defini_par_profile?.nom}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => startEdit(prix)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Définir/Modifier Prix */}
      <Modal 
        isOpen={showModal} 
        onClose={handleCloseModal} 
        title={editingPrix ? "Modifier le Prix de Vente" : "Définir un Prix de Vente"} 
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produit *
            </label>
            <select
              value={formData.produit_id}
              onChange={(e) => setFormData({...formData, produit_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
              disabled={submitting || editingPrix}
            >
              <option value="">Sélectionner un produit</option>
              {produits.map((produit) => {
                const aPrix = prixVente.some(p => p.produit_id === produit.id);
                const enCoursEdition = editingPrix && editingPrix.produit_id === produit.id;
                
                return (
                  <option 
                    key={produit.id} 
                    value={produit.id}
                    disabled={aPrix && !enCoursEdition}
                  >
                    {produit.nom} ({utils.formatCFA(produit.prix_achat)}) {aPrix && !enCoursEdition ? '✓ Prix défini' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prix de vente (CFA) *
            </label>
            <input
              type="number"
              step="25"
              min="0"
              value={formData.prix_vente}
              onChange={(e) => setFormData({...formData, prix_vente: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="2500"
              required
              disabled={submitting}
            />
          </div>

          {/* Aperçu de la marge */}
          {formData.produit_id && formData.prix_vente && (
            <div className="bg-blue-50 p-4 rounded-lg">
              {(() => {
                const produit = produits.find(p => p.id === parseInt(formData.produit_id));
                const prixVenteNum = parseFloat(formData.prix_vente);
                const prixAchat = produit?.prix_achat || 0;
                const marge = prixVenteNum - prixAchat;
                const pourcentageMarge = prixAchat > 0 ? (marge / prixAchat) * 100 : 0;
                
                return (
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Aperçu de la marge</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Prix d'achat:</span>
                        <div className="font-semibold">{utils.formatCFA(prixAchat)}</div>
                      </div>
                      <div>
                        <span className="text-blue-700">Prix de vente:</span>
                        <div className="font-semibold text-green-600">{utils.formatCFA(prixVenteNum)}</div>
                      </div>
                      <div>
                        <span className="text-blue-700">Marge:</span>
                        <div className={`font-semibold ${marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {marge >= 0 ? '+' : ''}{utils.formatCFA(marge)}
                        </div>
                      </div>
                      <div>
                        <span className="text-blue-700">% Marge:</span>
                        <div className={`font-semibold ${pourcentageMarge >= 20 ? 'text-green-600' : 'text-red-600'}`}>
                          {Math.round(pourcentageMarge * 100) / 100}%
                        </div>
                      </div>
                    </div>
                    {pourcentageMarge < 20 && (
                      <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                        ⚠️ Marge faible (recommandé : minimum 20%)
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  {editingPrix ? 'Modification...' : 'Définition...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 inline mr-2" />
                  {editingPrix ? 'Modifier le prix' : 'Définir le prix'}
                </>
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
