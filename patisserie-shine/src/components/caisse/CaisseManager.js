// src/components/caisse/CaisseManager.js
"use client";

import { useState, useEffect } from 'react';
import { caisseService, stockBoutiqueService, utils, supabase } from '../../lib/supabase';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Calculator, 
  CreditCard, 
  Printer, 
  Receipt, 
  Calendar, 
  BarChart3, 
  X, 
  Lock,
  TrendingUp,
  Users
} from 'lucide-react';
import { Card, Modal } from '../ui';
import CashierDashboard from './CashierDashboard'; // Import du nouveau dashboard

export default function CaisseManager({ currentUser }) {
  const [produitsBoutique, setProduitsBoutique] = useState([]);
  const [panier, setPanier] = useState([]);
  const [montantDonne, setMontantDonne] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [ventesJour, setVentesJour] = useState([]);
  const [activeTab, setActiveTab] = useState('caisse');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Charger les données seulement pour les onglets caisse et ventes
    if (activeTab !== 'dashboard') {
      loadData();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, ventesResult] = await Promise.all([
        stockBoutiqueService.getStockBoutique(),
        caisseService.getVentesJour()
      ]);

      if (stockResult.error) throw new Error(stockResult.error);
      if (ventesResult.error) throw new Error(ventesResult.error);

      // Filtrer seulement les produits avec stock > 0 ET prix défini
      const produitsDisponibles = (stockResult.stock || []).filter(p => 
        (p.stock_reel || 0) > 0 && (p.prix_vente || 0) > 0 && p.prix_defini
      );

      setProduitsBoutique(produitsDisponibles);
      setVentesJour(ventesResult.ventes || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fonctions de gestion du panier
  const ajouterAuPanier = (produit) => {
    const existant = panier.find(item => item.id === produit.produit_id);
    
    if (existant) {
      if (existant.quantite >= produit.stock_reel) {
        alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_reel}`);
        return;
      }
      setPanier(panier.map(item =>
        item.id === produit.produit_id
          ? { ...item, quantite: item.quantite + 1 }
          : item
      ));
    } else {
      setPanier([...panier, {
        id: produit.produit_id,
        nom: produit.nom_produit,
        prix: produit.prix_vente,
        quantite: 1,
        stockDisponible: produit.stock_reel,
        unite: produit.unite
      }]);
    }
  };

  const modifierQuantite = (id, nouvelleQuantite) => {
    if (nouvelleQuantite <= 0) {
      retirerDuPanier(id);
      return;
    }

    const produit = produitsBoutique.find(p => p.produit_id === id);
    if (nouvelleQuantite > produit.stock_reel) {
      alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_reel}`);
      return;
    }

    setPanier(panier.map(item =>
      item.id === id
        ? { ...item, quantite: nouvelleQuantite }
        : item
    ));
  };

  const retirerDuPanier = (id) => {
    setPanier(panier.filter(item => item.id !== id));
  };

  const viderPanier = () => {
    setPanier([]);
  };

  // Calculs
  const totalPanier = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
  const montantDonneNum = parseFloat(montantDonne) || 0;
  const monnaieARendre = montantDonneNum - totalPanier;

  // Finaliser la vente
  const finaliserVente = async () => {
    if (panier.length === 0) {
      alert('Le panier est vide !');
      return;
    }

    if (montantDonneNum < totalPanier) {
      alert('Le montant donné est insuffisant !');
      return;
    }

    try {
      // Enregistrer la vente
      const venteData = {
        items: panier,
        total: totalPanier,
        montant_donne: montantDonneNum,
        monnaie_rendue: monnaieARendre,
        vendeur_id: currentUser.id
      };

      const { vente, error } = await caisseService.enregistrerVente(venteData);

      if (error) {
        alert('Erreur lors de l\'enregistrement : ' + error);
        return;
      }

      // Créer le reçu
      const recu = {
        numero: vente.numero_ticket,
        date: new Date().toLocaleString('fr-FR'),
        items: panier,
        total: totalPanier,
        montant_donne: montantDonneNum,
        monnaie_rendue: monnaieARendre,
        vendeur: currentUser.nom,
        boutique: 'Pâtisserie Shine'
      };

      setLastReceipt(recu);
      setShowReceiptModal(true);

      // Réinitialiser
      setPanier([]);
      setMontantDonne('');
      
      // Recharger les données
      loadData();

    } catch (err) {
      alert('Erreur lors de la finalisation : ' + err.message);
    }
  };

  // Imprimer le reçu
  const imprimerRecu = () => {
    window.print();
  };

  // Filtrer les produits selon la recherche
  const produitsFiltres = produitsBoutique.filter(p =>
    p.nom_produit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculer les statistiques du jour
  const statsJour = {
    totalVentes: ventesJour.reduce((sum, v) => sum + (v.total || 0), 0),
    nombreVentes: ventesJour.length,
    ticketMoyen: ventesJour.length > 0 ? 
      ventesJour.reduce((sum, v) => sum + (v.total || 0), 0) / ventesJour.length : 0
  };

  if (loading && activeTab !== 'dashboard') {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <CreditCard className="w-8 h-8 text-orange-600 mr-3" />
            Module Caisse
          </h1>
          <p className="text-gray-600">
            {activeTab === 'caisse' && 'Point de vente - Enregistrement des transactions'}
            {activeTab === 'ventes' && 'Liste des ventes effectuées aujourd\'hui'}
            {activeTab === 'dashboard' && 'Tableau de bord et analyse des performances'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Vendeur</p>
            <p className="font-semibold">{currentUser?.nom || currentUser?.username}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Session</p>
            <p className="font-semibold">{new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {error && activeTab !== 'dashboard' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Onglets améliorés */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <nav className="-mb-px flex space-x-8 px-6">
          {/* Onglet Point de Vente */}
          <button
            onClick={() => setActiveTab('caisse')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'caisse'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Point de Vente
          </button>

          {/* Onglet Ventes du Jour */}
          <button
            onClick={() => setActiveTab('ventes')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'ventes'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Receipt className="w-4 h-4 inline mr-2" />
            Ventes du Jour
            {ventesJour.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">
                {ventesJour.length}
              </span>
            )}
          </button>

          {/* NOUVEAU - Onglet Tableau de Bord */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'dashboard'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Tableau de Bord
            {currentUser?.role === 'admin' && (
              <span className="ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3 inline mr-1" />
                Vue Admin
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Contenu Point de Vente */}
      {activeTab === 'caisse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Produits disponibles */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Produits Disponibles</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher un produit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                {produitsFiltres.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {produitsFiltres.map((produit) => (
                      <div
                        key={produit.produit_id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => ajouterAuPanier(produit)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{produit.nom_produit}</h4>
                            <p className="text-sm text-gray-500">Stock: {produit.stock_reel}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{utils.formatCFA(produit.prix_vente)}</p>
                            <button className="mt-2 bg-orange-100 text-orange-600 px-3 py-1 rounded hover:bg-orange-200 transition">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Panier */}
          <div>
            <Card>
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Panier</h3>
                  {panier.length > 0 && (
                    <button
                      onClick={viderPanier}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Vider
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                {panier.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Panier vide
                  </div>
                ) : (
                  <div className="space-y-3">
                    {panier.map((item) => (
                      <div key={item.id} className="border-b pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{item.nom}</p>
                            <p className="text-sm text-gray-500">
                              {utils.formatCFA(item.prix)} × {item.quantite}
                            </p>
                          </div>
                          <p className="font-semibold">
                            {utils.formatCFA(item.prix * item.quantite)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            onClick={() => modifierQuantite(item.id, item.quantite - 1)}
                            className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={item.quantite}
                            onChange={(e) => modifierQuantite(item.id, parseInt(e.target.value) || 0)}
                            className="w-16 text-center border rounded"
                            min="1"
                            max={item.stockDisponible}
                          />
                          <button
                            onClick={() => modifierQuantite(item.id, item.quantite + 1)}
                            className="p-1 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => retirerDuPanier(item.id)}
                            className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200 ml-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Total et paiement */}
                    <div className="space-y-3 pt-3">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total</span>
                        <span className="text-green-600">{utils.formatCFA(totalPanier)}</span>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Montant donné
                        </label>
                        <input
                          type="number"
                          value={montantDonne}
                          onChange={(e) => setMontantDonne(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="0"
                          min={totalPanier}
                        />
                      </div>

                      {montantDonneNum > 0 && (
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="flex justify-between">
                            <span>Monnaie à rendre</span>
                            <span className={`font-semibold ${monnaieARendre >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {utils.formatCFA(Math.abs(monnaieARendre))}
                            </span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={finaliserVente}
                        disabled={panier.length === 0 || montantDonneNum < totalPanier}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                      >
                        <Calculator className="w-5 h-5 inline mr-2" />
                        Finaliser la Vente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Contenu Ventes du Jour */}
      {activeTab === 'ventes' && (
        <div className="space-y-6">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total du Jour</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {utils.formatCFA(statsJour.totalVentes)}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre de Ventes</p>
                    <p className="text-2xl font-bold text-gray-900">{statsJour.nombreVentes}</p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-blue-500" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ticket Moyen</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {utils.formatCFA(statsJour.ticketMoyen)}
                    </p>
                  </div>
                  <Calculator className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Liste des ventes */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Détail des Ventes du Jour</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heure</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donné</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rendu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ventesJour.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucune vente aujourd'hui
                      </td>
                    </tr>
                  ) : (
                    ventesJour.map((vente) => (
                      <tr key={vente.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{vente.numero_ticket}</td>
                        <td className="px-6 py-4">{new Date(vente.created_at).toLocaleTimeString('fr-FR')}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {vente.items?.map((item, idx) => (
                              <div key={idx}>{item.nom_produit || item.nom} ×{item.quantite}</div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-green-600">
                          {utils.formatCFA(vente.total)}
                        </td>
                        <td className="px-6 py-4">{utils.formatCFA(vente.montant_donne)}</td>
                        <td className="px-6 py-4">{utils.formatCFA(vente.monnaie_rendue)}</td>
                        <td className="px-6 py-4">{vente.vendeur?.nom}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setLastReceipt({
                                numero: vente.numero_ticket,
                                date: new Date(vente.created_at).toLocaleString('fr-FR'),
                                items: vente.items,
                                total: vente.total,
                                montant_donne: vente.montant_donne,
                                monnaie_rendue: vente.monnaie_rendue,
                                vendeur: vente.vendeur?.nom,
                                boutique: 'Pâtisserie Shine'
                              });
                              setShowReceiptModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* NOUVEAU - Contenu Tableau de Bord */}
      {activeTab === 'dashboard' && (
        <div className="bg-gray-50 -m-6 p-6">
          <CashierDashboard />
        </div>
      )}

      {/* Modal de reçu */}
      {showReceiptModal && lastReceipt && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="Reçu de Vente"
        >
          <div className="p-6 bg-white" id="receipt-content">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">{lastReceipt.boutique}</h2>
              <p className="text-sm text-gray-500">Ticket N° {lastReceipt.numero}</p>
              <p className="text-sm text-gray-500">{lastReceipt.date}</p>
            </div>

            <div className="border-t border-b py-4 my-4">
              {lastReceipt.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1">
                  <span>{item.nom} ×{item.quantite}</span>
                  <span>{utils.formatCFA(item.prix * item.quantite)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{utils.formatCFA(lastReceipt.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Montant donné</span>
                <span>{utils.formatCFA(lastReceipt.montant_donne)}</span>
              </div>
              <div className="flex justify-between">
                <span>Monnaie rendue</span>
                <span>{utils.formatCFA(lastReceipt.monnaie_rendue)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
              <p>Servi par : {lastReceipt.vendeur}</p>
              <p className="mt-2">Merci de votre visite !</p>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={imprimerRecu}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Printer className="w-4 h-4 inline mr-2" />
                Imprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
