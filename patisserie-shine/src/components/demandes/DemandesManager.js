"use client";

import { useState, useEffect } from 'react';
import { demandeService, productService, utils } from '../../lib/supabase';
import { Plus, ShoppingCart, Check, X, Clock, Package } from 'lucide-react';
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
        alert('Demande validée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la validation de la demande');
    }
  };

  const handleRejectDemande = async (demandeId) => {
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
          <p className="text-gray-600">Gestion des sorties de stock</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Demande</span>
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
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
                    <span className="text-sm">Créez votre première demande</span>
                  </td>
                </tr>
              ) : (
                demandes.map((demande) => (
                  <tr key={demande.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">{demande.produit?.nom || 'Produit inconnu'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {demande.quantite} {demande.produit?.unite?.label || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        demande.destination === 'Production' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {demande.destination}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {demande.demandeur?.nom || 'Non spécifié'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {utils.formatDate(demande.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={demande.statut} />
