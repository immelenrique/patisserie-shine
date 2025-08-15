"use client";

import { useState, useEffect } from 'react';
import { uniteService, utils } from '../../lib/supabase';
import { Plus, Edit, Trash2, Calculator } from 'lucide-react';
import { Card, Modal } from '../ui';

export default function UnitesManager({ currentUser }) {
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnite, setEditingUnite] = useState(null);
  const [formData, setFormData] = useState({
    value: '',
    label: ''
  });

  useEffect(() => {
    loadUnites();
  }, []);

  const loadUnites = async () => {
    setLoading(true);
    try {
      const { unites, error } = await uniteService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des unités:', error);
      } else {
        setUnites(unites);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnite = async (e) => {
    e.preventDefault();
    try {
      // Simulation d'ajout - dans une vraie app cela appellerait l'API
      const newUnite = {
        id: Date.now(),
        value: formData.value,
        label: formData.label,
        created_at: new Date().toISOString()
      };
      
      setUnites([...unites, newUnite]);
      resetForm();
      setShowAddModal(false);
      alert('Unité créée avec succès');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de l\'unité');
    }
  };

  const handleEditUnite = async (e) => {
    e.preventDefault();
    try {
      // Simulation de modification
      const updatedUnites = unites.map(unite => 
        unite.id === editingUnite.id 
          ? { ...unite, value: formData.value, label: formData.label, updated_at: new Date().toISOString() }
          : unite
      );
      
      setUnites(updatedUnites);
      resetForm();
      setEditingUnite(null);
      alert('Unité modifiée avec succès');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la modification de l\'unité');
    }
  };

  const handleDeleteUnite = async (uniteId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) return;
    
    try {
      // Simulation de suppression
      setUnites(unites.filter(unite => unite.id !== uniteId));
      alert('Unité supprimée avec succès');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la suppression de l\'unité');
    }
  };

  const startEdit = (unite) => {
    setEditingUnite(unite);
    setFormData({
      value: unite.value,
      label: unite.label
    });
  };

  const resetForm = () => {
    setFormData({
      value: '',
      label: ''
    });
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Calculator className="w-8 h-8 text-orange-600 mr-3" />
            Gestion des Unités
          </h2>
          <p className="text-gray-600">Configuration des unités de mesure</p>
        </div>
        {currentUser.role === 'admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle Unité</span>
          </button>
        )}
      </div>
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libellé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unites.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    <Calculator className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucune unité créée
                    <br />
                    <span className="text-sm">Ajoutez votre première unité de mesure</span>
                  </td>
                </tr>
              ) : (
                unites.map((unite) => (
                  <tr key={unite.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {unite.value}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {unite.label}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {utils.formatDate(unite.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {currentUser.role === 'admin' && (
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => startEdit(unite)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUnite(unite.id)}
                            className="text-red-600 hover:text-red-900"
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

      {/* Modal Ajout/Edition Unité */}
      <Modal 
        isOpen={showAddModal || editingUnite} 
        onClose={() => {
          setShowAddModal(false);
          setEditingUnite(null);
          resetForm();
        }} 
        title={editingUnite ? "Modifier l'Unité" : "Ajouter une Unité"} 
        size="md"
      >
        <form onSubmit={editingUnite ? handleEditUnite : handleAddUnite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Code de l'unité *</label>
            <input
              type="text"
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: kg, ml, pcs"
              required
              maxLength="50"
            />
            <p className="text-xs text-gray-500 mt-1">Code court pour identifier l'unité</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Libellé complet *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({...formData, label: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Kilogrammes, Millilitres, Pièces"
              required
              maxLength="100"
            />
            <p className="text-xs text-gray-500 mt-1">Nom complet affiché dans l'interface</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Exemples d'unités courantes :</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
              <div><strong>kg</strong> → Kilogrammes</div>
              <div><strong>g</strong> → Grammes</div>
              <div><strong>L</strong> → Litres</div>
              <div><strong>ml</strong> → Millilitres</div>
              <div><strong>pcs</strong> → Pièces</div>
              <div><strong>boites</strong> → Boîtes</div>
              <div><strong>sacs</strong> → Sacs</div>
              <div><strong>ccafe</strong> → Cuillères à café</div>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              {editingUnite ? 'Modifier l\'unité' : 'Ajouter l\'unité'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setEditingUnite(null);
                resetForm();
              }}
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
