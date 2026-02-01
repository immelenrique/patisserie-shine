// src/components/cuisine/CaisseCuisineManager.js
"use client";

import { useState, useEffect } from 'react';
import { caisseCuisineService } from '../../services';
import { utils } from '../../utils/formatters';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Calculator,
  CreditCard,
  Printer,
  Receipt,
  BarChart3,
  ChefHat
} from 'lucide-react';
import { Card, Modal } from '../ui';

export default function CaisseCuisineManager({ currentUser }) {
  const [produitsCuisine, setProduitsCuisine] = useState([]);
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
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [produitsResult, ventesResult] = await Promise.all([
        caisseCuisineService.getProduitsDisponibles(),
        caisseCuisineService.getVentesJour()
      ]);

      if (produitsResult.error) throw new Error(produitsResult.error);
      if (ventesResult.error) throw new Error(ventesResult.error);

      setProduitsCuisine(produitsResult.produits || []);
      setVentesJour(ventesResult.ventes || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ajouterAuPanier = (produit) => {
    const existant = panier.find(item => item.id === produit.id);

    if (existant) {
      if (existant.quantite >= produit.stock_disponible) {
        alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_disponible}`);
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
        nom: produit.nom,
        prix: produit.prix_vente,
        quantite: 1,
        stockDisponible: produit.stock_disponible,
        unite: produit.unite
      }]);
    }
  };

  const modifierQuantite = (id, nouvelleQuantite) => {
    if (nouvelleQuantite <= 0) {
      retirerDuPanier(id);
      return;
    }

    const produit = produitsCuisine.find(p => p.id === id);
    if (nouvelleQuantite > produit.stock_disponible) {
      alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_disponible}`);
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

  const totalPanier = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
  const montantDonneNum = parseFloat(montantDonne) || 0;
  const monnaieARendre = montantDonneNum - totalPanier;

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
      const venteData = {
        items: panier,
        total: totalPanier,
        montant_donne: montantDonneNum,
        monnaie_rendue: monnaieARendre,
        vendeur_id: currentUser.id
      };

      const { vente, error } = await caisseCuisineService.enregistrerVente(venteData);

      if (error) {
        alert('Erreur lors de l\'enregistrement : ' + error);
        return;
      }

      const recu = {
        numero: vente.numero_ticket,
        date: new Date().toLocaleString('fr-FR'),
        items: panier,
        total: totalPanier,
        montant_donne: montantDonneNum,
        monnaie_rendue: monnaieARendre,
        vendeur: currentUser.nom || currentUser.username,
        boutique: 'Pâtisserie Shine - Cuisine'
      };

      setLastReceipt(recu);
      setShowReceiptModal(true);

      // Imprimer automatiquement après un court délai
      setTimeout(() => {
        imprimerRecu();
      }, 500);

      setPanier([]);
      setMontantDonne('');
      loadData();

    } catch (err) {
      alert('Erreur lors de la finalisation : ' + err.message);
    }
  };

  const imprimerRecu = () => {
    if (!lastReceipt) return;

    const contenuRecu = `
      <div style="font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 5px 0; font-size: 18px;">PÂTISSERIE SHINE</h3>
          <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">🍳 CUISINE 🍳</p>
          <p style="margin: 5px 0; font-size: 12px;">Tel: +226 05 07 39 00</p>
          <p style="margin: 5px 0; font-size: 14px;">Reçu N° ${lastReceipt.numero}</p>
          <p style="margin: 5px 0; font-size: 12px;">${lastReceipt.date}</p>
        </div>

        <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;">

        ${lastReceipt.items.map(item => `
          <div style="margin: 8px 0;">
            <div style="font-weight: bold;">${item.nom}</div>
            <div style="display: flex; justify-content: space-between; padding-left: 10px; font-size: 12px;">
              <span>${item.quantite} × ${utils.formatCFA(item.prix)}</span>
              <span>${utils.formatCFA(item.prix * item.quantite)}</span>
            </div>
          </div>
        `).join('')}

        <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;">

        <div style="font-weight: bold; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>TOTAL:</span>
            <span>${utils.formatCFA(lastReceipt.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Espèces:</span>
            <span>${utils.formatCFA(lastReceipt.montant_donne)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Monnaie:</span>
            <span>${utils.formatCFA(lastReceipt.monnaie_rendue)}</span>
          </div>
        </div>

        <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;">

        <div style="text-align: center; margin-top: 15px;">
          <p style="margin: 5px 0;">Servi par: ${lastReceipt.vendeur}</p>
          <p style="margin: 10px 0; font-weight: bold;">MERCI DE VOTRE VISITE</p>
          <p style="margin: 5px 0; font-size: 10px;">BON APPÉTIT !</p>
        </div>
      </div>
    `;

    const fenetreImpression = window.open('', '_blank', 'width=400,height=600');

    if (!fenetreImpression) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Reçu ${lastReceipt.numero}</title>
            <style>
              @media print {
                body { margin: 0; padding: 10px; }
              }
            </style>
          </head>
          <body>${contenuRecu}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      }, 250);

      return;
    }

    fenetreImpression.document.open();
    fenetreImpression.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reçu ${lastReceipt.numero}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            body {
              margin: 0;
              padding: 10px;
            }
            @media print {
              body {
                margin: 0;
                padding: 5px;
              }
            }
          </style>
        </head>
        <body>
          ${contenuRecu}
        </body>
      </html>
    `);

    fenetreImpression.document.close();

    fenetreImpression.onload = function() {
      setTimeout(() => {
        fenetreImpression.print();

        if (fenetreImpression.onafterprint !== undefined) {
          fenetreImpression.onafterprint = function() {
            fenetreImpression.close();
          };
        } else {
          setTimeout(() => {
            if (!fenetreImpression.closed) {
              fenetreImpression.close();
            }
          }, 5000);
        }
      }, 250);
    };
  };

  const produitsFiltres = produitsCuisine.filter(p =>
    p.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statsJour = {
    totalVentes: ventesJour.reduce((sum, v) => sum + (v.total || 0), 0),
    nombreVentes: ventesJour.length,
    ticketMoyen: ventesJour.length > 0
      ? ventesJour.reduce((sum, v) => sum + (v.total || 0), 0) / ventesJour.length
      : 0
  };

  if (loading) {
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
            <ChefHat className="w-8 h-8 text-orange-600 mr-3" />
            Caisse Cuisine
          </h1>
          <p className="text-gray-600">
            {activeTab === 'caisse' && 'Point de vente - Enregistrement des ventes cuisine'}
            {activeTab === 'ventes' && 'Liste des ventes cuisine effectuées aujourd\'hui'}
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg">
        <nav className="-mb-px flex space-x-8 px-6">
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
        </nav>
      </div>

      {/* Contenu Point de Vente */}
      {activeTab === 'caisse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Produits Cuisine Disponibles</h3>
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="p-4">
                {produitsFiltres.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ChefHat className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    {searchTerm ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {produitsFiltres.map((produit) => (
                      <div
                        key={produit.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => ajouterAuPanier(produit)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold">{produit.nom}</h4>
                            {produit.description && (
                              <p className="text-xs text-gray-500 mt-1">{produit.description}</p>
                            )}
                            <p className="text-sm text-gray-500 mt-1">Stock: {produit.stock_disponible} {produit.unite?.label}</p>
                          </div>
                          <div className="text-right ml-4">
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

          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Détail des Ventes Cuisine du Jour</h3>
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
                        Aucune vente cuisine aujourd'hui
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
                              <div key={idx}>{item.nom_produit} ×{item.quantite}</div>
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
                                boutique: 'Pâtisserie Shine - Cuisine'
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

      {/* Modal de reçu */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Reçu de Vente - Cuisine"
      >
        {lastReceipt && (
          <div className="p-6 bg-white">
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
              <p className="font-semibold">BON APPÉTIT !</p>
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
        )}
      </Modal>
    </div>
  );
}
