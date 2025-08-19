"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Upload, Download } from 'lucide-react';
import { Card, Modal } from '../ui';
import { referentielService, uniteService, utils } from '../../lib/supabase';

export default function ReferentielManager({ currentUser }) {
  const [referentiels, setReferentiels] = useState([]);
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    reference: '',
    nom: '',
    type_conditionnement: 'sac',
    unite_mesure: 'kg',
    quantite_par_conditionnement: '',
    prix_achat_total: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadReferentiels(),
        loadUnites()
      ]);
    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadReferentiels = async () => {
    try {
      const { referentiels, error } = await referentielService.getAll();
      if (error) {
        console.error('Erreur lors du chargement du référentiel:', error);
        setError(error);
      } else {
        setReferentiels(referentiels);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const loadUnites = async () => {
    try {
      const { unites, error } = await uniteService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des unités:', error);
      } else {
        setUnites(unites);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingItem) {
        const { success, error } = await referentielService.update(editingItem.id, formData);
        if (error) {
          setError(error);
        } else {
          await loadReferentiels();
          resetForm();
          setEditingItem(null);
          alert('Référentiel modifié avec succès !');
        }
      } else {
        const { success, error } = await referentielService.create(formData);
        if (error) {
          setError(error);
        } else {
          await loadReferentiels();
          resetForm();
          setShowAddModal(false);
          alert('Référentiel créé avec succès !');
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, nom) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${nom}" ?`)) return;
    
    try {
      const { success, error } = await referentielService.delete(id);
      if (error) {
        alert('Erreur lors de la suppression : ' + error);
      } else {
        await loadReferentiels();
        alert('Référentiel supprimé avec succès !');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setFormData({
      reference: item.reference,
      nom: item.nom,
      type_conditionnement: item.type_conditionnement,
      unite_mesure: item.unite_mesure,
      quantite_par_conditionnement: item.quantite_par_conditionnement.toString(),
      prix_achat_total: item.prix_achat_total.toString()
    });
    setShowAddModal(true);
    setError('');
  };

  const resetForm = () => {
    setFormData({
      reference: '',
      nom: '',
      type_conditionnement: 'sac',
      unite_mesure: 'kg',
      quantite_par_conditionnement: '',
      prix_achat_total: ''
    });
    setError('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
    resetForm();
  };

  const calculatePrixUnitaire = () => {
    if (formData.prix_achat_total && formData.quantite_par_conditionnement) {
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite_par_conditionnement);
      return prixUnitaire.toFixed(2);
    }
    return '0';
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const { success, imported, errors, error } = await referentielService.importFromCSV(file);
      
      if (error) {
        alert('Erreur lors de l\'import : ' + error);
      } else {
        alert(`Import réussi ! ${imported} éléments importés. ${errors} erreurs.`);
        loadReferentiels();
      }
    } catch (err) {
      console.error('Erreur import:', err);
      alert('Erreur lors de l\'import du fichier');
    }
    
    // Reset l'input file
    event.target.value = '';
  };

  const handleExportCSV = async () => {
    try {
      const { success, csvContent, error } = await referentielService.exportToCSV();
      
      if (error) {
        alert('Erreur lors de l\'export : ' + error);
      } else {
        // Télécharger le fichier CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `referentiel_patisserie_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Erreur export:', err);
      alert('Erreur lors de l\'export');
    }
  };

  const filteredReferentiels = referentiels.filter(item =>
    item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reference.toLowerCase().includes(searchTerm.toLowerCase())
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
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Package className="w-8 h-8 text-orange-600 mr-3" />
            Référentiel Produits
          </h2>
          <p className="text-gray-600">Gestion du catalogue des matières premières et conditionnements</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {/* Import CSV */}
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
              id="csv-import"
            />
            <label
              htmlFor="csv-import"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Importer CSV</span>
            </label>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Exporter CSV</span>
          </button>

          {/* Nouveau */}
          {currentUser.role === 'admin' && (
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

      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total produits</p>
              <p className="text-2xl font-bold text-gray-900">{referentiels.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Valeur totale référentiel</p>
              <p className="text-2xl font-bold text-gray-900">
                {utils.formatCFA(referentiels.reduce((sum, item) => sum + (item.prix_achat_total || 0), 0))}
              </p>
            </div>
          </div>
        </Card>

        
      </div>
      
      {/* Tableau */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom du produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conditionnement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité/Conditionnement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReferentiels.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    {referentiels.length === 0 ? (
                      <>
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun produit dans le référentiel
                        <br />
                        <span className="text-sm">Ajoutez votre premier produit ou importez un CSV</span>
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
                filteredReferentiels.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.reference}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.nom}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.type_conditionnement}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {utils.formatNumber(item.quantite_par_conditionnement, 1)} {item.unite_mesure}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {utils.formatCFA(item.prix_achat_total)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {utils.formatCFA(item.prix_unitaire)} / {item.unite_mesure}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {currentUser.role === 'admin' && (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => startEdit(item)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id, item.nom)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Modal Ajout/Edition */}
      <Modal 
        isOpen={showAddModal} 
        onClose={handleCloseModal} 
        title={editingItem ? "Modifier le Produit" : "Ajouter un Produit au Référentiel"} 
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Référence *</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({...formData, reference: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="PS1, PS2..."
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Farine Etalon"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type conditionnement *</label>
              <select
                value={formData.type_conditionnement}
                onChange={(e) => setFormData({...formData, type_conditionnement: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={submitting}
              >
                <option value="sac">Sac</option>
                <option value="carton">Carton</option>
                <option value="bidon">Bidon</option>
                <option value="boite">Boîte</option>
                <option value="paquet">Paquet</option>
                <option value="sachet">Sachet</option>
                <option value="feuille">Feuille</option>
                <option value="litre">Litre</option>
                <option value="plaquette">Plaquette</option>
                <option value="Pièce">Lot</option>
                <option value="lot">Lot</option>
                <option value="Unité">Lot</option>
                <option value="Autre">Lot</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unité de mesure *</label>
              <select
                value={formData.unite_mesure}
                onChange={(e) => setFormData({...formData, unite_mesure: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
                disabled={submitting}
              >
                {unites.map(unite => (
                  <option key={unite.id} value={unite.value}>
                    {unite.label} ({unite.value})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité par conditionnement *</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantite_par_conditionnement}
                onChange={(e) => setFormData({...formData, quantite_par_conditionnement: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="50"
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix d'achat total (CFA) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.prix_achat_total}
                onChange={(e) => setFormData({...formData, prix_achat_total: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="23400"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix unitaire calculé</label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="text-gray-700 font-medium">
                  {utils.formatCFA(calculatePrixUnitaire())} / {formData.unite_mesure}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Calculé automatiquement</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Exemple d'utilisation</h4>
            <p className="text-sm text-blue-800">
              Ce produit apparaîtra dans la liste des matières premières disponibles lors de l'ajout d'un nouveau stock.
              Les informations se rempliront automatiquement : prix unitaire, unité, etc.
            </p>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button 
              type="submit" 
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  {editingItem ? 'Modification...' : 'Création...'}
                </>
              ) : (
                editingItem ? 'Modifier le produit' : 'Ajouter le produit'
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
