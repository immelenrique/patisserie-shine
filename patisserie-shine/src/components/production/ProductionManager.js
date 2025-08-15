"use client";

import { useState, useEffect } from 'react';
import { productionService, utils } from '../../lib/supabase';
import { Plus, ChefHat, Calendar, MapPin, User } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function ProductionManager({ currentUser }) {
  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    produit: '',
    quantite: '',
    destination: 'Boutique',
    date_production: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadProductions();
  }, []);

  const loadProductions = async () => {
    setLoading(true);
    try {
      const { productions, error } = await productionService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des productions:', error);
      } else {
        setProductions(productions);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduction = async (e) => {
    e.preventDefault();
    try {
      const { production, error } = await productionService.create({
        produit: formData.produit,
        quantite: parseFloat(formData.quantite),
        destination: formData.destination,
        date_production: formData.date_production
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la production: ' + error);
      } else {
        await loadProductions();
        setFormData({
          produit: '', quantite: '', destination: 'Boutique',
          date_production: new Date().toISOString().split('T')[0]
        });
        setShowAddModal(false);
        alert('Production créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la production');
    }
  };

  const calculatedStats = {
    totalProductions: productions.length,
    productionsJour: productions.filter(p => p.date_production === new Date().toISOString().split('T')[0]).length,
    unitesProduites: productions.reduce((sum, p) => sum + (p.quantite || 0), 0),
    productionsRecentes: productions.slice(0, 5)
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
            <ChefHat className="w-8 h-8 text-orange-600 mr-3" />
            Production
          </h2>
          <p className="text-gray-600">Suivi des produits finis</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle Production</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{calculatedStats.totalProductions}</p>
          <p className="text-sm text-gray-600">Productions Totales</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{calculatedStats.productionsJour}</p>
          <p className="text-sm text-gray-600">Productions Aujourd'hui</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{utils.formatNumber(calculatedStats.unitesProduites, 0)}</p>
          <p className="text-sm text-gray-600">Unités Produites</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">98%</p>
          <p className="text-sm text-gray-600">Taux de Réussite</p>
        </Card>
      </div>
      
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Productions récentes</h3>
          <div className="space-y-4">
            {calculatedStats.productionsRecentes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ChefHat className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                Aucune production enregistrée
                <br />
                <span className="text-sm">Créez votre première production</span>
              </div>
            ) : (
              calculatedStats.productionsRecentes.map((production) => (
                <div key={production.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
                      <ChefHat className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{production.produit}</h4>
                      <p className="text-sm text-gray-500 flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        Par {production.producteur?.nom || 'Non spécifié'}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {utils.formatDate(production.date_production)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{production.quantite} unités</p>
                    <p className="text-sm text-blue-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {production.destination}
                    </p>
                  </div>
                  <StatusBadge status={production.statut || 'termine'} />
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Modal Nouvelle Production */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nouvelle Production" size="md">
        <form onSubmit={handleAddProduction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
            <input
              type="text"
              value={formData.produit}
              onChange={(e) => setFormData({...formData, produit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité produite *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite}
              onChange={(e) => setFormData({...formData, quantite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="48"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de production *</label>
            <input
              type="date"
              value={formData.date_production}
              onChange={(e) => setFormData({...formData, date_production: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Boutique">Boutique</option>
              <option value="Commande">Commande</option>
              <option value="Stock">Stock</option>
              <option value="Événement">Événement</option>
            </select>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Enregistrer la production
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
