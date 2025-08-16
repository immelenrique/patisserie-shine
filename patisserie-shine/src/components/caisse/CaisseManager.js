"use client";

import { useState, useEffect } from 'react';
import { caisseService, stockBoutiqueService, utils } from '../../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, CreditCard, Printer, Receipt, Calendar, BarChart3, X } from 'lucide-react';
import { Card, Modal } from '../ui';

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
    loadData();
  }, []);

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
    const existant = panier.find(item => item.id === produit.id);
    
    if (existant) {
      if (existant.quantite >= produit.stock_reel) {
        alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_reel}`);
        return;
      }
      setPanier(panier.map(item =>
        item.id === produit.id
          ? { ...item, quantite: item.quantite + 1 }
          : item
      ));
    } else {
      setPanier([...panier, {
        id: produit.id,
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

    const produit = produitsBoutique.find(p => p.id === id);
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
    if (!lastReceipt) return;

    const contenuRecu = genererContenuRecu(lastReceipt);
    const fenetreImpression = window.open('', '_blank');
    
    fenetreImpression.document.write(`
      <html>
        <head>
          <title>Reçu ${lastReceipt.numero}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 20px; }
            .recu { max-width: 300px; margin: 0 auto; }
            .center { text-align: center; }
            .ligne { border-bottom: 1px dashed #000; margin: 10px 0; }
            .total { font-weight: bold; font-size: 14px; }
            @media print { body { margin: 0; padding: 10px; } }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${contenuRecu}
        </body>
      </html>
    `);
    
    fenetreImpression.document.close();
  };

  const genererContenuRecu = (recu) => {
    return `
      <div class="recu">
        <div class="center">
          <h2>${recu.boutique}</h2>
          <p>Reçu N° ${recu.numero}</p>
          <p>${recu.date}</p>
        </div>
        <div class="ligne"></div>
        ${recu.items.map(item => `
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>${item.nom} x${item.quantite}</span>
            <span>${utils.formatCFA(item.prix * item.quantite)}</span>
          </div>
        `).join('')}
        <div class="ligne"></div>
        <div class="total center">
          <p>TOTAL: ${utils.formatCFA(recu.total)}</p>
          <p>Montant donné: ${utils.formatCFA(recu.montant_donne)}</p>
          <p>Monnaie rendue: ${utils.formatCFA(recu.monnaie_rendue)}</p>
        </div>
        <div class="ligne"></div>
        <div class="center">
          <p>Vendeur: ${recu.vendeur}</p>
          <p>Merci de votre visite !</p>
        </div>
      </div>
    `;
  };

  // Filtrer les produits
  const produitsFiltres = produitsBoutique.filter(produit =>
    produit.nom_produit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Chargement de la caisse...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <CreditCard className="w-8 h-8 text-orange-600 mr-3" />
            Caisse
          </h1>
          <p className="text-gray-600">Point de vente - Gestion des transactions</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Vendeur</p>
            <p className="font-semibold">{currentUser.nom}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Session</p>
            <p className="font-semibold">{new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('caisse')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'caisse'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Caisse
          </button>
          <button
            onClick={() => setActiveTab('ventes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ventes'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Ventes du Jour
          </button>
        </nav>
      </div>

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
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucun produit disponible à la vente
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {produitsFiltres.map((produit) => (
                      <div key={produit.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{produit.nom_produit}</h4>
                          <span className="text-lg font-bold text-green-600">
                            {utils.formatCFA(produit.prix_vente)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            Stock: {utils.formatNumber(produit.stock_reel, 1)} {produit.unite}
                          </span>
                          <button
                            onClick={() => ajouterAuPanier(produit)}
                            className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition-colors text-sm flex items-center"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Ajouter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Panier et paiement */}
          <div>
            <Card>
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Panier</h3>
                  {panier.length > 0 && (
                    <button
                      onClick={viderPanier}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      Vider
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-4">
                {panier.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Panier vide</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {panier.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{item.nom}</h5>
                          <p className="text-sm text-gray-500">
                            {utils.formatCFA(item.prix)} × {item.quantite}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => modifierQuantite(item.id, item.quantite - 1)}
                            className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantite}</span>
                          <button
                            onClick={() => modifierQuantite(item.id, item.quantite + 1)}
                            className="w-6 h-6 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => retirerDuPanier(item.id)}
                            className="w-6 h-6 bg-red-100 rounded text-red-600 hover:bg-red-200 flex items-center justify-center ml-2"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="ml-4 font-semibold text-gray-900">
                          {utils.formatCFA(item.prix * item.quantite)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {panier.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {/* Total */}
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">{utils.formatCFA(totalPanier)}</span>
                      </div>
                    </div>

                    {/* Montant donné */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Montant donné par le client
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="25"
                          min="0"
                          value={montantDonne}
                          onChange={(e) => setMontantDonne(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="0"
                        />
                        <CreditCard className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      </div>
                      
                      {/* Boutons montants rapides */}
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[500, 1000, 2000, 5000, 10000, 20000].map((montant) => (
                          <button
                            key={montant}
                            onClick={() => setMontantDonne(montant.toString())}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                          >
                            {utils.formatCFA(montant)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Monnaie à rendre */}
                    {montantDonne && (
                      <div className={`p-3 rounded-lg ${
                        monnaieARendre >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Monnaie à rendre:</span>
                          <span className={`font-bold text-lg ${
                            monnaieARendre >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {utils.formatCFA(Math.abs(monnaieARendre))}
                          </span>
                        </div>
                        {monnaieARendre < 0 && (
                          <p className="text-red-600 text-sm mt-1">
                            Montant insuffisant !
                          </p>
                        )}
                      </div>
                    )}

                    {/* Bouton finaliser */}
                    <button
                      onClick={finaliserVente}
                      disabled={panier.length === 0 || montantDonneNum < totalPanier}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center"
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Finaliser la Vente
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'ventes' && (
        <div className="space-y-6">
          {/* Statistiques du jour */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center">
                <Receipt className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Ventes aujourd'hui</p>
                  <p className="text-2xl font-bold text-gray-900">{ventesJour.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Chiffre d'affaires</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {utils.formatCFA(ventesJour.reduce((sum, v) => sum + (v.total || 0), 0))}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center">
                <ShoppingCart className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Articles vendus</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {ventesJour.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.quantite, 0) || 0), 0)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center">
                <Calculator className="w-8 h-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Ticket moyen</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {ventesJour.length > 0 ? 
                      utils.formatCFA(ventesJour.reduce((sum, v) => sum + (v.total || 0), 0) / ventesJour.length) : 
                      utils.formatCFA(0)
                    }
                  </p>
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
                              <div key={idx}>{item.nom} ×{item.quantite}</div>
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
                            className="text-orange-600 hover:text-orange-800"
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

      {/* Modal Reçu */}
      <Modal 
        isOpen={showReceiptModal} 
        onClose={() => setShowReceiptModal(false)} 
        title="Reçu de Vente" 
        size="md"
      >
        {lastReceipt && (
          <div className="space-y-4">
            <div className="bg-white border-2 border-dashed border-gray-300 p-6 font-mono text-sm">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold">{lastReceipt.boutique}</h3>
                <p>Reçu N° {lastReceipt.numero}</p>
                <p>{lastReceipt.date}</p>
              </div>
              
              <div className="border-t border-dashed border-gray-400 my-4"></div>
              
              {lastReceipt.items.map((item, index) => (
                <div key={index} className="flex justify-between mb-2">
                  <span>{item.nom} ×{item.quantite}</span>
                  <span>{utils.formatCFA(item.prix * item.quantite)}</span>
                </div>
              ))}
              
              <div className="border-t border-dashed border-gray-400 my-4"></div>
              
              <div className="text-center font-bold">
                <div className="flex justify-between mb-2">
                  <span>TOTAL:</span>
                  <span>{utils.formatCFA(lastReceipt.total)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Montant donné:</span>
                  <span>{utils.formatCFA(lastReceipt.montant_donne)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monnaie rendue:</span>
                  <span>{utils.formatCFA(lastReceipt.monnaie_rendue)}</span>
                </div>
              </div>
              
              <div className="border-t border-dashed border-gray-400 my-4"></div>
              
              <div className="text-center">
                <p>Vendeur: {lastReceipt.vendeur}</p>
                <p className="mt-2">Merci de votre visite !</p>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={imprimerRecu}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
