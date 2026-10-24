"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Archive, Package, Store, TrendingUp } from 'lucide-react';
import { Card, Modal, StatusBadge, useSaisie } from '../ui';
import { supabase } from '../../lib/supabase-client';
import { productService, uniteService, referentielService, recuService } from '../../services';
import ChampRecu from '../achats/ChampRecu';
import { utils } from '../../utils/formatters';


export default function StockManager({ currentUser }) {
  // Les achats du stock principal : magasinier, propriétaire et gérants (la base refuse les autres)
  const peutAcheter = ['admin', 'magasinier'].includes(currentUser.role);
  const [fenetreSaisie, demander] = useSaisie();
  // Clés anti-doublon : un double clic ou un nouvel essai après une coupure n'enregistre pas deux fois
  const cleCreationRef = useRef(null);
  const cleReapproRef = useRef(null);
  // Photo du reçu de l'achat en cours (création ou réapprovisionnement)
  const [recuCreation, setRecuCreation] = useState(null);
  const [recuReappro, setRecuReappro] = useState(null);
  const [motifCorrection, setMotifCorrection] = useState('');
  const [products, setProducts] = useState([]);
  const [unites, setUnites] = useState([]);
  const [referentiels, setReferentiels] = useState([]);
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
    definir_prix_vente: false,
    prix_vente: ''
  });
  const [reapproProduct, setReapproProduct] = useState(null);
  const [reapproData, setReapproData] = useState({
    quantite_ajoutee: '',
    prix_achat_total: '',
    date_achat: new Date().toISOString().split('T')[0]
  });
  const [reapproSearch, setReapproSearch] = useState('');
  const [reapproOpen, setReapproOpen] = useState(false);
  const [selectedReapproRef, setSelectedReapproRef] = useState(null);
  const filtered = Array.isArray(referentiels) 
  ? referentiels.filter(ref =>
      ref && ref.reference && ref.nom &&
      `${ref.reference} ${ref.nom}`
        .toLowerCase()
        .includes((search || '').toLowerCase())
    )
  : [];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadUnites(),
        loadReferentiels()
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
    const result = await referentielService.getAll();
    const referentielsData = result.referentiels || [];
    
    if (result.error) {
      console.error('Erreur chargement référentiel:', result.error);
      setReferentiels([]);
    } else {
      setReferentiels(Array.isArray(referentielsData) ? referentielsData : []);
      console.log('✅ Référentiels chargés:', referentielsData.length);
    }
  } catch (err) {
    console.error('Erreur:', err);
    setReferentiels([]);
  }
};

  // 🔧 CORRECTION: Fonction handleReferentielSelect avec calcul prix total correct
  const handleReferentielSelect = (referentielId) => {
    if (!referentielId) {
      setSelectedReferentiel(null);
      return;
    }

    const referentiel = referentiels.find(r => r.id === parseInt(referentielId));
    if (referentiel) {
      setSelectedReferentiel(referentiel);
      
      // Trouver l'unité correspondante
      const uniteCorrespondante = unites.find(u => u.value === referentiel.unite_mesure);
      
      // 🔧 CORRECTION: Utiliser quantité du conditionnement par défaut mais permettre modification
      const quantiteDefaut = referentiel.quantite_par_conditionnement;
      const prixUnitaire = referentiel.prix_unitaire;
      
      setFormData(prev => ({
        ...prev,
        nom: referentiel.nom,
        quantite: quantiteDefaut.toString(),
        prix_achat_total: (prixUnitaire * quantiteDefaut).toString(), // 🔧 Prix calculé dynamiquement
        quantite_restante: editingProduct ? prev.quantite_restante : quantiteDefaut.toString(),
        unite_id: uniteCorrespondante ? uniteCorrespondante.id.toString() : ''
      }));
      
      console.log('✅ Référentiel sélectionné:', referentiel.nom);
      console.log('💰 Prix unitaire:', prixUnitaire, 'CFA');
      console.log('📦 Quantité défaut:', quantiteDefaut);
    } else {
      setSelectedReferentiel(null);
      console.warn('⚠️ Référentiel non trouvé pour ID:', referentielId);
    }
  };

  // 🔧 NOUVELLE FONCTION: Recalculer le prix total quand la quantité change
  const handleQuantiteChange = (nouvelleQuantite) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        quantite: nouvelleQuantite,
        quantite_restante: editingProduct ? prev.quantite_restante : nouvelleQuantite
      };

      // Si un référentiel est sélectionné, recalculer le prix total
      if (selectedReferentiel && nouvelleQuantite) {
        const prixUnitaire = selectedReferentiel.prix_unitaire;
        const quantiteNum = parseFloat(nouvelleQuantite);
        if (!isNaN(quantiteNum) && quantiteNum > 0) {
          newFormData.prix_achat_total = (prixUnitaire * quantiteNum).toString();
        }
      }

      return newFormData;
    });
  };

  // Une clé correspond à un formulaire précis : elle est oubliée dès que son contenu change
  useEffect(() => {
    cleCreationRef.current = null;
  }, [formData, recuCreation]);
  useEffect(() => {
    cleReapproRef.current = null;
  }, [reapproData, reapproProduct, recuReappro]);

  // Le reçu est déposé AVANT l'achat (si le dépôt échoue, rien n'est enregistré et l'on peut réessayer),
  // puis joint à la dépense que la base vient de créer
  const deposerRecu = async (fichier, cle) => {
    if (!fichier) return { fichier: null, error: null };
    const { fichier: depose, error } = await recuService.deposer(fichier, currentUser.id, cle);
    if (error) return { fichier: null, error: `La photo du reçu n'a pas pu être envoyée (${error}). Réessayez, ou retirez la photo pour enregistrer l'achat sans reçu.` };
    return { fichier: depose, error: null };
  };
  const joindreRecu = async (depenseId, fichier) => {
    if (!fichier || !depenseId) return '';
    const { error } = await recuService.joindre(depenseId, fichier);
    return error ? `\n\n⚠️ Le reçu n'a pas pu être joint (${error}). Ajoutez-le depuis « À faire ».` : '\n\n📎 Reçu joint à la dépense.';
  };

  const loadProducts = async () => {
  try {
    const result = await productService.getAll();
    // Vérifier le nom de la propriété retournée
    const productsData = result.products || result.produits || [];
    
    if (result.error) {
      console.error('Erreur lors du chargement des produits:', result.error);
      setError(result.error);
      setProducts([]); // Tableau vide en cas d'erreur
    } else {
      setProducts(Array.isArray(productsData) ? productsData : []);
    }
  } catch (err) {
    console.error('Erreur:', err);
    setProducts([]); // Tableau vide en cas d'exception
    setError('Erreur de chargement des produits');
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
      
      if (!cleCreationRef.current) cleCreationRef.current = utils.genererCle();
      const recu = await deposerRecu(recuCreation, cleCreationRef.current);
      if (recu.error) {
        setError(recu.error);
        return;
      }
      const { product, error } = await productService.createWithPriceOption({
        cle: cleCreationRef.current,
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
        const noteRecu = await joindreRecu(product.depense_id, recu.fichier);
        cleCreationRef.current = null;
        await loadProducts();
        resetForm();
        setShowAddModal(false);
        
        if (formData.definir_prix_vente) {
          alert(`Produit créé avec succès !\n\nAjouté au stock principal avec prix de vente défini: ${utils.formatCFA(parseFloat(formData.prix_vente))}\n\nPour l'ajouter à la boutique, un employé doit faire une demande vers "Boutique".` + noteRecu);
        } else {
          alert('Produit créé avec succès dans le stock principal ! La dépense de l\'achat est enregistrée.' + noteRecu);
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
    setError('');

    // Une correction de la quantité restante est inscrite au journal avec son motif
    const nouvelleRestante = parseFloat(formData.quantite_restante);
    const restanteModifiee = !isNaN(nouvelleRestante) && nouvelleRestante !== parseFloat(editingProduct.quantite_restante);
    if (restanteModifiee && motifCorrection.trim().length < 3) {
      setError('Indiquez le motif de la correction de quantité (ex. : recomptage, casse, erreur de saisie)');
      return;
    }

    setSubmitting(true);
    try {
      const prixUnitaire = parseFloat(formData.prix_achat_total) / parseFloat(formData.quantite);

      const { error } = await productService.update(editingProduct.id, {
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: isFinite(prixUnitaire) ? prixUnitaire : null,
        unite_id: parseInt(formData.unite_id)
      });
      if (error) {
        setError(error);
        return;
      }

      if (restanteModifiee) {
        const { error: erreurCorrection } = await productService.ajusterStock(editingProduct.id, nouvelleRestante, motifCorrection.trim());
        if (erreurCorrection) {
          setError(erreurCorrection);
          await loadProducts();
          return;
        }
      }

      await loadProducts();
      resetForm();
      setEditingProduct(null);
      setMotifCorrection('');
      alert(restanteModifiee ? 'Produit modifié ; correction de quantité inscrite au journal' : 'Produit modifié avec succès');
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors de la modification du produit');
    } finally {
      setSubmitting(false);
    }
  };

  // Un produit ne se supprime plus (cela effaçait son historique) : il s'archive, s'il n'a plus de stock
  const handleArchiveProduct = async (productId, productName) => {
    const saisie = await demander({
      titre: `Archiver « ${productName} »`,
      message: 'Le produit disparaît des listes ; son historique est conservé. Possible seulement s\'il n\'a plus de stock nulle part.',
      champs: [{ nom: 'motif', label: 'Motif', obligatoire: true, placeholder: 'ex. plus commandé chez le fournisseur' }],
      confirmer: 'Archiver'
    });
    if (!saisie) return;
    setError('');
    const { error } = await productService.archiver(productId, saisie.motif);
    if (error) {
      setError(error);
      alert('Archivage impossible : ' + error);
      return;
    }
    alert(`Produit « ${productName} » archivé.`);
    await loadProducts();
  };

  const handleReapprovisionner = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!cleReapproRef.current) cleReapproRef.current = utils.genererCle();
      const recu = await deposerRecu(recuReappro, cleReapproRef.current);
      if (recu.error) {
        setError(recu.error);
        return;
      }
      const { product, error } = await productService.reapprovisionner(reapproProduct.id, {
        cle: cleReapproRef.current,
        quantite_ajoutee: parseFloat(reapproData.quantite_ajoutee),
        prix_achat_total: parseFloat(reapproData.prix_achat_total),
        date_achat: reapproData.date_achat
      });

      if (error) {
        setError(error);
      } else {
        const noteRecu = await joindreRecu(product.depense_id, recu.fichier);
        await loadProducts();

        const prixUnitaire = parseFloat(reapproData.prix_achat_total) / parseFloat(reapproData.quantite_ajoutee);
        alert(`✅ Réapprovisionnement réussi!\n\n` +
              `Produit: ${reapproProduct.nom}\n` +
              `Quantité ajoutée: ${reapproData.quantite_ajoutee} ${reapproProduct.unite?.value}\n` +
              `Prix d'achat: ${utils.formatCFA(reapproData.prix_achat_total)}\n` +
              `Prix unitaire: ${utils.formatCFA(prixUnitaire)}/${reapproProduct.unite?.value}\n` +
              `Nouveau stock: ${product.quantite_restante} ${reapproProduct.unite?.value}` + noteRecu
        );
        setRecuReappro(null);
        cleReapproRef.current = null;

        setReapproProduct(null);
        setReapproData({
          quantite_ajoutee: '',
          prix_achat_total: '',
          date_achat: new Date().toISOString().split('T')[0]
        });
        setSelectedReapproRef(null);
        setReapproSearch('');
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur lors du réapprovisionnement');
    } finally {
      setSubmitting(false);
    }
  };

  const startReappro = (product) => {
    setReapproProduct(product);
    setRecuReappro(null);
    setReapproData({
      quantite_ajoutee: '',
      prix_achat_total: '',
      date_achat: new Date().toISOString().split('T')[0]
    });
    setSelectedReapproRef(null);
    setReapproSearch('');
    setError('');
  };

  const handleReapproReferentielSelect = (referentielId) => {
    if (!referentielId) {
      setSelectedReapproRef(null);
      return;
    }

    const referentiel = referentiels.find(r => r.id === parseInt(referentielId));
    if (referentiel && referentiel.nom.toLowerCase() === reapproProduct.nom.toLowerCase()) {
      setSelectedReapproRef(referentiel);

      const quantiteDefaut = referentiel.quantite_par_conditionnement;
      const prixUnitaire = referentiel.prix_unitaire;

      setReapproData(prev => ({
        ...prev,
        quantite_ajoutee: quantiteDefaut.toString(),
        prix_achat_total: (prixUnitaire * quantiteDefaut).toString()
      }));

      console.log('✅ Référentiel sélectionné pour réappro:', referentiel.nom);
    } else {
      alert(`⚠️ Ce référentiel ne correspond pas au produit "${reapproProduct.nom}"`);
    }
  };

  const handleReapproQuantiteChange = (nouvelleQuantite) => {
    setReapproData(prev => {
      const newData = {
        ...prev,
        quantite_ajoutee: nouvelleQuantite
      };

      if (selectedReapproRef && nouvelleQuantite) {
        const prixUnitaire = selectedReapproRef.prix_unitaire;
        const quantiteNum = parseFloat(nouvelleQuantite);
        if (!isNaN(quantiteNum) && quantiteNum > 0) {
          newData.prix_achat_total = (prixUnitaire * quantiteNum).toString();
        }
      }

      return newData;
    });
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setMotifCorrection('');
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
      definir_prix_vente: false,
      prix_vente: ''
    });
    setSelectedReferentiel(null);
    setSearch('');
    setError('');
    setRecuCreation(null);
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

  const exporterStockCSV = () => {
    try {
      // Calculer les totaux
      const valeurTotaleStock = products.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite_restante || 0)), 0);
      const valeurTotaleInitiale = products.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0);
      const valeurConsommee = valeurTotaleInitiale - valeurTotaleStock;
      
      // En-tête CSV
      const csvLines = [];
      csvLines.push('RAPPORT STOCK PRINCIPAL - PATISSERIE SHINE');
      csvLines.push(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`);
      csvLines.push(`Exporté par: ${currentUser?.nom || 'Utilisateur'}`);
      csvLines.push('');
      csvLines.push('RESUME FINANCIER');
      csvLines.push(`Valeur totale stock actuel: ${utils.formatCFA(valeurTotaleStock)}`);
      csvLines.push(`Valeur stock initial: ${utils.formatCFA(valeurTotaleInitiale)}`);
      csvLines.push(`Valeur consommée: ${utils.formatCFA(valeurConsommee)}`);
      csvLines.push(`Taux d'utilisation: ${valeurTotaleInitiale > 0 ? ((valeurConsommee / valeurTotaleInitiale) * 100).toFixed(1) : 0}%`);
      csvLines.push('');
      csvLines.push('DETAILS DU STOCK');
      csvLines.push('Produit,Quantité Restante,Quantité Initiale,Prix Unitaire CFA,Valeur Stock CFA,Unité,Date Achat,Statut');
      
      // Données des produits
      products.forEach(product => {
        const valeurStock = (product.prix_achat || 0) * (product.quantite_restante || 0);
        const alertLevel = utils.getStockAlertLevel(product.quantite_restante, product.quantite);
        const statutFr = alertLevel === 'normal' ? 'Normal' :
                        alertLevel === 'faible' ? 'Faible' :
                        alertLevel === 'critique' ? 'Critique' :
                        'Rupture';
        
        csvLines.push([
          `"${product.nom}"`,
          product.quantite_restante || 0,
          product.quantite || 0,
          product.prix_achat || 0,
          valeurStock.toFixed(2),
          product.unite?.label || '',
          product.date_achat || '',
          statutFr
        ].join(','));
      });
      
      // Statistiques de fin
      csvLines.push('');
      csvLines.push('STATISTIQUES');
      const stockNormal = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'normal').length;
      const stockFaible = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'faible').length;
      const stockCritique = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'critique').length;
      const stockRupture = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'rupture').length;
      
      csvLines.push(`Total produits: ${products.length}`);
      csvLines.push(`Stock normal: ${stockNormal}`);
      csvLines.push(`Stock faible: ${stockFaible}`);
      csvLines.push(`Stock critique: ${stockCritique}`);
      csvLines.push(`Stock en rupture: ${stockRupture}`);
      
      // Télécharger le fichier
      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `stock_principal_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`✅ Export CSV généré avec succès !\n\nValeur totale exportée: ${utils.formatCFA(valeurTotaleStock)}`);
    } catch (err) {
      console.error('Erreur export CSV:', err);
      alert('Erreur lors de l\'export CSV: ' + err.message);
    }
  };

  const filteredProducts = Array.isArray(products)
  ? products.filter(product =>
      product && product.nom &&
      product.nom.toLowerCase().includes((searchTerm || '').toLowerCase())
    )
  : [];
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
      {fenetreSaisie}
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
          
          {/* Bouton Export Stock */}
          {products.length > 0 && (
            <button
              onClick={exporterStockCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 flex items-center space-x-2"
              title="Exporter le stock en CSV"
            >
              <Package className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          )}
          
          {peutAcheter && (
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

      {/* Statistiques du stock principal */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total produits</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Valeur totale stock</p>
                <p className="text-2xl font-bold text-green-600">
                  {utils.formatCFA(
                    products.reduce((sum, product) => 
                      sum + ((product.prix_achat || 0) * (product.quantite_restante || 0)), 0
                    )
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Valeur stock initial</p>
                <p className="text-2xl font-bold text-orange-600">
                  {utils.formatCFA(
                    products.reduce((sum, product) => 
                      sum + ((product.prix_achat || 0) * (product.quantite || 0)), 0
                    )
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Stock critique</p>
                <p className="text-2xl font-bold text-red-600">
                  {products.filter(product => {
                    const alertLevel = utils.getStockAlertLevel(product.quantite_restante, product.quantite);
                    return alertLevel === 'critique' || alertLevel === 'rupture';
                  }).length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Analyse détaillée du stock */}
      {products.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Analyse du Stock Principal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Répartition par valeur */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Répartition par valeur</h4>
              <div className="space-y-2">
                {(() => {
                  const valeurActuelle = products.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite_restante || 0)), 0);
                  const valeurInitiale = products.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0);
                  const valeurConsommee = valeurInitiale - valeurActuelle;
                  const pourcentageConsomme = valeurInitiale > 0 ? (valeurConsommee / valeurInitiale) * 100 : 0;
                  
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Stock restant:</span>
                        <span className="font-semibold text-green-600">{utils.formatCFA(valeurActuelle)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Valeur consommée:</span>
                        <span className="font-semibold text-blue-600">{utils.formatCFA(valeurConsommee)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taux d'utilisation:</span>
                        <span className="font-semibold text-purple-600">{pourcentageConsomme.toFixed(1)}%</span>
                      </div>
                      
                      {/* Barre de progression */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pourcentageConsomme, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Top 5 des produits les plus chers */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Top 5 - Valeur stock</h4>
              <div className="space-y-2">
                {products
                  .map(p => ({
                    ...p,
                    valeurStock: (p.prix_achat || 0) * (p.quantite_restante || 0)
                  }))
                  .sort((a, b) => b.valeurStock - a.valeurStock)
                  .slice(0, 5)
                  .map((produit, index) => (
                    <div key={produit.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-semibold mr-2">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 truncate max-w-[120px]" title={produit.nom}>
                          {produit.nom}
                        </span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {utils.formatCFA(produit.valeurStock)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Alertes stock */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">État du stock</h4>
              <div className="space-y-2">
                {(() => {
                  const stockNormal = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'normal').length;
                  const stockFaible = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'faible').length;
                  const stockCritique = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'critique').length;
                  const stockRupture = products.filter(p => utils.getStockAlertLevel(p.quantite_restante, p.quantite) === 'rupture').length;
                  
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Normal:</span>
                        </div>
                        <span className="font-semibold text-green-600">{stockNormal}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Faible:</span>
                        </div>
                        <span className="font-semibold text-yellow-600">{stockFaible}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Critique:</span>
                        </div>
                        <span className="font-semibold text-orange-600">{stockCritique}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                          <span className="text-gray-600">Rupture:</span>
                        </div>
                        <span className="font-semibold text-red-600">{stockRupture}</span>
                      </div>
                      
                      {(stockCritique > 0 || stockRupture > 0) && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <strong>⚠️ Action requise:</strong> {stockCritique + stockRupture} produit(s) nécessitent un réapprovisionnement
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </Card>
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
                          {peutAcheter && (
                            <button
                              onClick={() => startReappro(product)}
                              className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                              title="Réapprovisionner"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                          )}
                          {/* Nom, unité, prix d'achat : gérants et production (modifier_produit) */}
                          {['admin', 'employe_production'].includes(currentUser.role) && (
                            <button
                              onClick={() => startEdit(product)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button
                              onClick={() => handleArchiveProduct(product.id, product.nom)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                              title="Archiver (produit sans stock)"
                            >
                              <Archive className="h-4 w-4" />
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

              {/* Champ de recherche référentiel */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={search || (selectedReferentiel ? `[${selectedReferentiel.reference}] ${selectedReferentiel.nom}` : "")}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setTimeout(() => setOpen(false), 200)}
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
                        <div className="font-medium">[{ref.reference}] {ref.nom}</div>
                        <div className="text-xs text-gray-500">
                          {ref.quantite_par_conditionnement} {ref.unite_mesure} - {utils.formatCFA(ref.prix_unitaire)}/unité
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

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
                    <div><strong>Prix unitaire:</strong> {utils.formatCFA(selectedReferentiel.prix_unitaire)}</div>
                    <div><strong>Quantité défaut:</strong> {selectedReferentiel.quantite_par_conditionnement} {selectedReferentiel.unite_mesure}</div>
                  </div>
                  <div className="mt-2 text-xs text-green-700">
                    💡 Vous pouvez modifier la quantité - le prix total sera recalculé automatiquement
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
                      setSearch('');
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité totale *
                {selectedReferentiel && (
                  <span className="text-xs text-green-600 ml-2">
                    (Prix recalculé automatiquement)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.quantite}
                onChange={(e) => handleQuantiteChange(e.target.value)} // 🔧 CORRECTION: Utiliser la nouvelle fonction
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="25"
                required
                disabled={submitting}
              />
              {selectedReferentiel && (
                <p className="text-xs text-blue-600 mt-1">
                  Quantité de base: {selectedReferentiel.quantite_par_conditionnement} {selectedReferentiel.unite_mesure}
                </p>
              )}
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
                disabled={submitting || (selectedReferentiel && !editingProduct)} // 🔧 CORRECTION: Désactiver si référentiel sélectionné
              />
              {formData.prix_achat_total && formData.quantite && (
                <p className="text-xs text-blue-600 mt-1">
                  Prix unitaire: {utils.formatCFA(getPrixUnitaire())} / {unites.find(u => u.id === parseInt(formData.unite_id))?.value || 'unité'}
                </p>
              )}
              {selectedReferentiel && !editingProduct && (
                <p className="text-xs text-green-600 mt-1">
                  💡 Prix calculé automatiquement: {formData.quantite} × {utils.formatCFA(selectedReferentiel.prix_unitaire)}
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
                {editingProduct && parseFloat(formData.quantite_restante) !== parseFloat(editingProduct.quantite_restante) && (
                  <input
                    type="text"
                    value={motifCorrection}
                    onChange={(e) => setMotifCorrection(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Motif de la correction (obligatoire) : recomptage, casse, erreur…"
                    disabled={submitting}
                  />
                )}
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
          
          {!editingProduct && <ChampRecu id="recu-creation" fichier={recuCreation} onChange={setRecuCreation} />}

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

      {/* Modal Réapprovisionnement */}
      <Modal
        isOpen={reapproProduct !== null}
        onClose={() => {
          setReapproProduct(null);
          setReapproData({
            quantite_ajoutee: '',
            prix_achat_total: '',
            date_achat: new Date().toISOString().split('T')[0]
          });
          setSelectedReapproRef(null);
          setReapproSearch('');
          setError('');
        }}
        title={`Réapprovisionner - ${reapproProduct?.nom}`}
        size="lg"
      >
        <form onSubmit={handleReapprovisionner} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Info produit actuel */}
          {reapproProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">📊 Stock actuel</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Stock restant:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite_restante} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-blue-600">Stock total:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-blue-600">Prix unitaire actuel:</span>
                  <span className="ml-2 font-semibold">{utils.formatCFA(reapproProduct.prix_achat)}</span>
                </div>
                <div>
                  <span className="text-blue-600">Valeur stock:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {utils.formatCFA(reapproProduct.prix_achat * reapproProduct.quantite_restante)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recherche référentiel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher dans le référentiel (optionnel)
            </label>
            <div className="relative">
              <input
                type="text"
                value={reapproSearch || (selectedReapproRef ? `[${selectedReapproRef.reference}] ${selectedReapproRef.nom}` : "")}
                onChange={(e) => {
                  setReapproSearch(e.target.value);
                  setReapproOpen(true);
                }}
                onFocus={() => setReapproOpen(true)}
                onBlur={() => setTimeout(() => setReapproOpen(false), 200)}
                disabled={submitting}
                placeholder="Sélectionner depuis le référentiel..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />

              {reapproOpen && referentiels.filter(ref =>
                ref && ref.reference && ref.nom &&
                ref.nom.toLowerCase() === reapproProduct?.nom.toLowerCase() &&
                `${ref.reference} ${ref.nom}`.toLowerCase().includes((reapproSearch || '').toLowerCase())
              ).length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow">
                  {referentiels.filter(ref =>
                    ref && ref.reference && ref.nom &&
                    ref.nom.toLowerCase() === reapproProduct?.nom.toLowerCase() &&
                    `${ref.reference} ${ref.nom}`.toLowerCase().includes((reapproSearch || '').toLowerCase())
                  ).map(ref => (
                    <li
                      key={ref.id}
                      onClick={() => {
                        handleReapproReferentielSelect(ref.id);
                        setReapproSearch(`[${ref.reference}] ${ref.nom}`);
                        setReapproOpen(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    >
                      <div className="font-medium">[{ref.reference}] {ref.nom}</div>
                      <div className="text-xs text-gray-500">
                        {ref.quantite_par_conditionnement} {ref.unite_mesure} - {utils.formatCFA(ref.prix_unitaire)}/unité
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedReapproRef && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-medium text-green-800">✅ Référentiel sélectionné</h4>
                    <p className="text-xs text-green-700 mt-1">
                      Prix: {utils.formatCFA(selectedReapproRef.prix_unitaire)}/{selectedReapproRef.unite_mesure}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReapproRef(null);
                      setReapproSearch('');
                      setReapproData(prev => ({
                        ...prev,
                        quantite_ajoutee: '',
                        prix_achat_total: ''
                      }));
                    }}
                    className="text-xs text-green-600 hover:text-green-800"
                  >
                    ✕ Effacer
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité à ajouter *
                {selectedReapproRef && (
                  <span className="text-xs text-green-600 ml-2">
                    (Prix recalculé auto)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={reapproData.quantite_ajoutee}
                onChange={(e) => handleReapproQuantiteChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 20"
                required
                disabled={submitting}
              />
              {reapproData.quantite_ajoutee && reapproProduct && (
                <p className="text-xs text-blue-600 mt-1">
                  Nouveau total: {parseFloat(reapproProduct.quantite) + parseFloat(reapproData.quantite_ajoutee || 0)} {reapproProduct.unite?.value}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix d'achat TOTAL de ce réapprovisionnement (CFA) *
              </label>
              <input
                type="number"
                step="0.01"
                value={reapproData.prix_achat_total}
                onChange={(e) => setReapproData({...reapproData, prix_achat_total: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 15000"
                required
                disabled={submitting || (selectedReapproRef && true)}
              />
              {reapproData.prix_achat_total && reapproData.quantite_ajoutee && (
                <p className="text-xs text-blue-600 mt-1">
                  Prix unitaire: {utils.formatCFA(parseFloat(reapproData.prix_achat_total) / parseFloat(reapproData.quantite_ajoutee))}/{reapproProduct?.unite?.value}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date d'achat *</label>
              <input
                type="date"
                value={reapproData.date_achat}
                onChange={(e) => setReapproData({...reapproData, date_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Aperçu du calcul */}
          {reapproData.quantite_ajoutee && reapproData.prix_achat_total && reapproProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 mb-3">📊 Aperçu du nouveau stock</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-green-700">Quantité actuelle:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-green-700">Quantité ajoutée:</span>
                  <span className="ml-2 font-semibold text-green-600">+{reapproData.quantite_ajoutee} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-green-700">Nouveau total:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {parseFloat(reapproProduct.quantite) + parseFloat(reapproData.quantite_ajoutee)} {reapproProduct.unite?.value}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Nouvelle valeur stock:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {utils.formatCFA(
                      (parseFloat(reapproProduct.prix_achat) * parseFloat(reapproProduct.quantite) +
                       parseFloat(reapproData.prix_achat_total))
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <ChampRecu id="recu-reappro" fichier={recuReappro} onChange={setRecuReappro} />

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  Réapprovisionnement...
                </>
              ) : (
                '✓ Confirmer le réapprovisionnement'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setReapproProduct(null);
                setReapproData({
                  quantite_ajoutee: '',
                  prix_achat_total: '',
                  date_achat: new Date().toISOString().split('T')[0]
                });
                setSelectedReapproRef(null);
                setReapproSearch('');
                setError('');
              }}
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
