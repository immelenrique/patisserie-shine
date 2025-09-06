"use client";

import { useState, useEffect, useRef } from 'react';
import { caisseService, stockBoutiqueService, utils, supabase } from '../../lib/supabase';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, CreditCard, Printer, Receipt, Calendar, BarChart3, X, Lock, Edit2, Check } from 'lucide-react';
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
  
  // Nouveaux états pour la saisie directe
  const [editingItemId, setEditingItemId] = useState(null);
  const [tempQuantity, setTempQuantity] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Focus sur l'input quand on passe en mode édition
  useEffect(() => {
    if (editingItemId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingItemId]);

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
    if (!produit) return;
    
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

  // Nouvelles fonctions pour la saisie directe
  const startEditingQuantity = (itemId, currentQuantity) => {
    setEditingItemId(itemId);
    setTempQuantity(currentQuantity.toString());
  };

  const validateQuantityInput = () => {
    const newQuantity = parseInt(tempQuantity);
    const item = panier.find(p => p.id === editingItemId);
    const produit = produitsBoutique.find(p => p.produit_id === editingItemId);
    
    if (!item || !produit) {
      cancelEditingQuantity();
      return;
    }
    
    if (isNaN(newQuantity) || newQuantity < 0) {
      alert('Quantité invalide');
      cancelEditingQuantity();
      return;
    }
    
    if (newQuantity === 0) {
      retirerDuPanier(editingItemId);
      cancelEditingQuantity();
      return;
    }
    
    if (newQuantity > produit.stock_reel) {
      alert(`Stock insuffisant ! Maximum disponible : ${produit.stock_reel}`);
      setTempQuantity(produit.stock_reel.toString());
      return;
    }
    
    modifierQuantite(editingItemId, newQuantity);
    cancelEditingQuantity();
  };

  const cancelEditingQuantity = () => {
    setEditingItemId(null);
    setTempQuantity('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      validateQuantityInput();
    } else if (e.key === 'Escape') {
      cancelEditingQuantity();
    }
  };

  const retirerDuPanier = (id) => {
    setPanier(panier.filter(item => item.id !== id));
  };

  const viderPanier = () => {
    if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
      setPanier([]);
      setEditingItemId(null);
      setTempQuantity('');
    }
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
      setEditingItemId(null);
      setTempQuantity('');
      
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

  const effectuerCloture = async () => {
    try {
      // Calculer le total des ventes du jour
      const aujourdhui = new Date().toISOString().split('T')[0];
      
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select('*')
        .gte('created_at', aujourdhui + 'T00:00:00')
        .lte('created_at', aujourdhui + 'T23:59:59')
        .eq('vendeur_id', currentUser.id);
      
      if (error) throw error;
      
      const montantTotal = ventes.reduce((sum, v) => sum + (v.total || 0), 0);
      const nombreVentes = ventes.length;
      
      // Demander le montant en caisse
      const montantDeclare = prompt(`Montant théorique: ${montantTotal} FCFA\nEntrez le montant réel en caisse:`);
      
      if (!montantDeclare) return;
      
      const ecart = parseFloat(montantDeclare) - montantTotal;
      
      // Enregistrer la clôture
      const { error: clotureError } = await supabase
        .from('arrets_caisse')
        .insert({
          vendeur_id: currentUser.id,
          date_arret: aujourdhui,
          montant_theorique: montantTotal,
          montant_declare: parseFloat(montantDeclare),
          ecart: ecart,
          nombre_ventes: nombreVentes,
          details_ventes: { ventes: ventes.map(v => v.id) },
          statut: 'termine'
        });
      
      if (clotureError) throw clotureError;
      
      alert(`Clôture effectuée!\nÉcart: ${ecart} FCFA ${ecart === 0 ? '✓' : ecart > 0 ? '(excédent)' : '(manque)'}`);
      
    } catch (error) {
      console.error('Erreur clôture:', error);
      alert('Erreur lors de la clôture');
    }
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
      {/* Bouton de clôture en haut */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gestion de la Caisse</h2>
        <button
          onClick={effectuerCloture}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center"
        >
          <Lock className="w-4 h-4 mr-2" />
          Clôturer la Caisse
        </button>
      </div>

      {/* En-tête existant */}
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
                    {produitsBoutique.length === 0 ? 
                      "Aucun produit disponible à la vente" :
                      "Aucun produit trouvé pour votre recherche"
                    }
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {produitsFiltres.map((produit) => (
                      <div key={produit.produit_id} className="border rounded-lg p-4 hover:bg-gray-50">
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

          {/* Panier et paiement AMÉLIORÉ */}
          <div>
            <Card>
              <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Panier ({panier.length})</h3>
                  {panier.length > 0 && (
                    <button
                      onClick={viderPanier}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
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
                    {/* Articles du panier avec saisie directe */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {panier.map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{item.nom}</h5>
                              <p className="text-sm text-gray-500">
                                {utils.formatCFA(item.prix)} / {item.unite || 'unité'}
                              </p>
                            </div>
                            <button
                              onClick={() => retirerDuPanier(item.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors"
                              title="Retirer du panier"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Contrôles de quantité améliorés */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {/* Bouton décrémenter */}
                              <button
                                onClick={() => modifierQuantite(item.id, item.quantite - 1)}
                                disabled={item.quantite <= 1 || editingItemId === item.id}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                  item.quantite <= 1 || editingItemId === item.id
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                }`}
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              {/* Zone de quantité éditable */}
                              {editingItemId === item.id ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    ref={inputRef}
                                    type="number"
                                    value={tempQuantity}
                                    onChange={(e) => setTempQuantity(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={validateQuantityInput}
                                    className="w-14 px-1 py-1 border-2 border-orange-400 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    min="1"
                                    max={item.stockDisponible}
                                  />
                                  <button
                                    onClick={validateQuantityInput}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Valider"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={cancelEditingQuantity}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Annuler"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditingQuantity(item.id, item.quantite)}
                                  className="flex items-center space-x-1 px-2 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded transition-colors"
                                  title="Cliquer pour modifier directement"
                                >
                                  <span className="font-semibold text-sm">{item.quantite}</span>
                                  <Edit2 className="h-3 w-3 text-gray-400" />
                                </button>
                              )}

                              {/* Bouton incrémenter */}
                              <button
                                onClick={() => modifierQuantite(item.id, item.quantite + 1)}
                                disabled={item.quantite >= item.stockDisponible || editingItemId === item.id}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                  item.quantite >= item.stockDisponible || editingItemId === item.id
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                                }`}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            
                            {/* Sous-total */}
                            <div className="text-right">
                              <span className="font-semibold text-gray-900">
                                {utils.formatCFA(item.prix * item.quantite)}
                              </span>
                              <p className="text-xs text-gray-500">
                                Stock: {item.stockDisponible - item.quantite} restants
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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

      {/* Reste du code pour l'onglet ventes et le modal reçu... */}
      {activeTab === 'ventes' && (
        // ... Code existant pour l'onglet ventes ...
        <div className="space-y-6">
          {/* Votre code existant pour les ventes */}
        </div>
      )}

      {/* Modal Reçu - Code existant */}
      <Modal 
        isOpen={showReceiptModal} 
        onClose={() => setShowReceiptModal(false)} 
        title="Reçu de Vente" 
        size="md"
      >
        {/* Votre code existant pour le reçu */}
      </Modal>
    </div>
  );
}
