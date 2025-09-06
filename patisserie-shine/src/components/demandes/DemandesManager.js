"use client";

import { useState, useEffect } from 'react';
import { demandeService, productService, utils, supabase } from '../../lib/supabase';
import { 
  Plus, ShoppingCart, Check, X, Clock, Package, 
  ArrowRight, Warehouse, Store, DollarSign, Trash2, 
  Search, Factory, RotateCcw 
} from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';
import { notificationService } from '../../services/notificationService';

export default function DemandesManager({ currentUser }) {
  // ============ ÉTATS ============
  const [demandes, setDemandes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroupedDemande, setSelectedGroupedDemande] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [validationsEnCours, setValidationsEnCours] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  // État pour la demande multi-produits
  const [formData, setFormData] = useState({
    destination: 'Production',
    commentaire: ''
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // ============ HOOKS ============
  useEffect(() => {
    loadData();
  }, []);

  // ============ FONCTIONS DE CHARGEMENT ============
  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les demandes
      const { demandes: demandesData, error: demandesError } = await demandeService.getAll();
      
      if (demandesError) {
        console.error('Erreur chargement demandes:', demandesError);
        setDemandes([]);
      } else {
        setDemandes(demandesData || []);
      }

      // Charger les produits avec stock disponible
      const { data: produitsData, error: produitsError } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .gt('quantite_restante', 0)
        .order('nom', { ascending: true });

      if (produitsError) {
        console.error('Erreur chargement produits:', produitsError);
        setProducts([]);
        setError('Impossible de charger les produits disponibles');
      } else {
        console.log(`${produitsData?.length || 0} produits avec stock disponibles`);
        setProducts(produitsData || []);
      }

    } catch (err) {
      console.error('Erreur générale:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupedDetails = async (demandeGroupeeId) => {
    setLoadingDetails(true);
    try {
      const { details, error } = await demandeService.getGroupedDetails(demandeGroupeeId);
      if (error) {
        console.error('Erreur chargement détails:', error);
        alert('Erreur lors du chargement des détails');
      } else {
        setSelectedGroupedDemande(details);
        setShowDetailsModal(true);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ============ GESTION DES PRODUITS ============
  const addProductToSelection = (product) => {
    const isAlreadySelected = selectedProducts.find(p => p.id === product.id);
    if (isAlreadySelected) {
      alert('Ce produit est déjà sélectionné');
      return;
    }

    const newProduct = {
      id: product.id,
      nom: product.nom,
      quantite_disponible: product.quantite_restante,
      unite: product.unite,
      quantite_demandee: ''
    };

    setSelectedProducts([...selectedProducts, newProduct]);
    setSearchTerm('');
    setShowProductSearch(false);
  };

  const updateProductQuantity = (productId, newQuantity) => {
    setSelectedProducts(prev => 
      prev.map(p => 
        p.id === productId 
          ? { ...p, quantite_demandee: newQuantity === '' ? '' : newQuantity }
          : p
      )
    );
  };

  const removeProductFromSelection = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const getAvailableProducts = () => {
    if (!Array.isArray(products)) return [];
    
    return products.filter(product => 
      product && 
      product.nom &&
      product.quantite_restante > 0 && 
      product.nom.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedProducts.find(p => p.id === product.id)
    );
  };

  const resetForm = () => {
    setFormData({
      destination: 'Production',
      commentaire: ''
    });
    setSelectedProducts([]);
    setSearchTerm('');
    setShowProductSearch(false);
    setError('');
  };

  // ============ CRÉATION DE DEMANDE ============
  const handleCreateDemande = async (e) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      setError('Veuillez sélectionner au moins un produit');
      return;
    }
    
    // Vérifier les champs vides
    const emptyProducts = selectedProducts.filter(p => 
      p.quantite_demandee === '' || 
      p.quantite_demandee === null || 
      p.quantite_demandee === undefined
    );
    
    if (emptyProducts.length > 0) {
      setError(`Veuillez saisir les quantités pour : ${emptyProducts.map(p => p.nom).join(', ')}`);
      const firstEmptyProduct = emptyProducts[0];
      const input = document.querySelector(`input[data-product-id="${firstEmptyProduct.id}"]`);
      if (input) input.focus();
      return;
    }
    
    // Vérifier que toutes les quantités sont valides
    const invalidProducts = selectedProducts.filter(p => {
      const qte = parseFloat(p.quantite_demandee);
      return isNaN(qte) || qte < 1 || qte > Math.floor(p.quantite_disponible);
    });
    
    if (invalidProducts.length > 0) {
      setError(`Quantités invalides pour : ${invalidProducts.map(p => p.nom).join(', ')}`);
      return;
    }
    
    setSubmitting(true);
    
    try {
      setError('');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Vous devez être connecté');
        setSubmitting(false);
        return;
      }
      
      // 1. Créer la demande groupée
      const { data: demandeGroupee, error: groupError } = await supabase
        .from('demandes_groupees')
        .insert({
          destination: formData.destination,
          commentaire: formData.commentaire || '',
          demandeur_id: user.id,
          statut: 'en_attente',
          nombre_produits: selectedProducts.length,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (groupError) {
        console.error('Erreur création demande groupée:', groupError);
        setError('Erreur lors de la création de la demande: ' + groupError.message);
        setSubmitting(false);
        return;
      }
      
      // 2. Créer les demandes individuelles
      const demandesIndividuelles = selectedProducts.map(p => ({
        produit_id: p.id,
        quantite: parseFloat(p.quantite_demandee),
        destination: formData.destination,
        statut: 'en_attente',
        demandeur_id: user.id,
        demande_groupee_id: demandeGroupee.id,
        created_at: new Date().toISOString()
      }));
      
      const { error: demandesError } = await supabase
        .from('demandes')
        .insert(demandesIndividuelles);
      
      if (demandesError) {
        // Rollback
        await supabase
          .from('demandes_groupees')
          .delete()
          .eq('id', demandeGroupee.id);
        
        console.error('Erreur création demandes individuelles:', demandesError);
        setError('Erreur lors de la création des demandes: ' + demandesError.message);
        setSubmitting(false);
        return;
      }
      
      // 3. Créer les notifications
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('actif', true);
      
      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          destinataire_id: admin.id,
          emetteur_id: user.id,
          type: 'demande_nouvelle',
          message: `Nouvelle demande groupée de ${selectedProducts.length} produit(s) pour ${formData.destination}`,
          details: `Demandeur: ${currentUser?.nom || currentUser?.username}`,
          lien: `/demandes#${demandeGroupee.id}`,
          lu: false,
          priorite: 'normale',
          created_at: new Date().toISOString()
        }));
        
        await supabase.from('notifications').insert(notifications);
      }
      
      alert(`✅ Demande créée avec succès !\n${selectedProducts.length} produit(s) demandé(s) pour ${formData.destination}`);
      
      resetForm();
      setShowAddModal(false);
      await loadData();
      
    } catch (err) {
      console.error('Erreur complète:', err);
      setError('Erreur lors de la création de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ VALIDATION DE DEMANDE GROUPÉE ============
  const handleValidateGroupedDemande = async (demandeGroupeeId) => {
    if (validationsEnCours.has(demandeGroupeeId)) {
      alert('⏳ Une validation est déjà en cours pour cette demande. Veuillez patienter...');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir valider toute cette demande groupée ?')) return;

    setValidationsEnCours(prev => new Set(prev).add(demandeGroupeeId));

    const showProgress = (message) => {
      const existingProgress = document.getElementById('validation-progress');
      if (existingProgress) {
        existingProgress.textContent = message;
      } else {
        const progressDiv = document.createElement('div');
        progressDiv.id = 'validation-progress';
        progressDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 9999;';
        progressDiv.textContent = message;
        document.body.appendChild(progressDiv);
      }
    };

    const hideProgress = () => {
      const progressDiv = document.getElementById('validation-progress');
      if (progressDiv) progressDiv.remove();
    };

    try {
      showProgress('🔒 Verrouillage de la demande...');

      // Vérification du statut actuel
      const { data: demandeActuelle, error: checkError } = await supabase
        .from('demandes_groupees')
        .select('statut, valideur_id, date_validation')
        .eq('id', demandeGroupeeId)
        .single();

      if (checkError) {
        throw new Error('Impossible de vérifier le statut de la demande');
      }

      if (demandeActuelle.statut !== 'en_attente') {
        if (demandeActuelle.statut === 'validee') {
          alert(`⚠️ Cette demande a déjà été validée le ${new Date(demandeActuelle.date_validation).toLocaleString('fr-FR')}`);
        } else if (demandeActuelle.statut === 'refusee') {
          alert('⚠️ Cette demande a déjà été refusée');
        } else {
          alert(`⚠️ Cette demande est déjà en statut: ${demandeActuelle.statut}`);
        }
        return;
      }

      showProgress('📋 Récupération des demandes...');
      
      // Récupération des demandes
      const { data: demandesGroupe, error: fetchError } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, quantite_restante, unite:unites(label))
        `)
        .eq('demande_groupee_id', demandeGroupeeId)
        .eq('statut', 'en_attente');

      if (fetchError) {
        throw new Error('Erreur lors de la récupération des demandes: ' + fetchError.message);
      }

      if (!demandesGroupe || demandesGroupe.length === 0) {
        throw new Error('Aucune demande en attente trouvée pour cette demande groupée');
      }

      showProgress('🔍 Vérification des stocks...');

      // Vérification des stocks
      const stockInsuffisant = [];
      
      for (const demande of demandesGroupe) {
        if (!demande.produit) {
          stockInsuffisant.push({
            produit: `Produit ID ${demande.produit_id} introuvable`,
            demande: demande.quantite,
            disponible: 0
          });
          continue;
        }

        const stockActuel = demande.produit.quantite_restante || 0;
        if (stockActuel < demande.quantite) {
          stockInsuffisant.push({
            produit: demande.produit.nom,
            demande: demande.quantite,
            disponible: stockActuel,
            unite: demande.produit.unite?.label || 'unité'
          });
        }
      }

      if (stockInsuffisant.length > 0) {
        let message = '⚠️ Stock insuffisant pour les produits suivants :\n\n';
        stockInsuffisant.forEach(item => {
          message += `• ${item.produit}: demandé ${item.demande} ${item.unite}, disponible ${item.disponible} ${item.unite}\n`;
        });
        throw new Error(message);
      }

      showProgress('⚙️ Traitement des demandes...');
      
      const errors = [];
      let processedCount = 0;
      const totalDemandes = demandesGroupe.length;
      const batchSize = 5;

      // Traitement par batch
      for (let i = 0; i < demandesGroupe.length; i += batchSize) {
        const batch = demandesGroupe.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(demandesGroupe.length / batchSize);
        
        showProgress(`⚙️ Traitement batch ${batchIndex}/${totalBatches}...`);

        const batchPromises = batch.map(async (demande) => {
          try {
            // Réduire le stock principal
            const { error: stockError } = await supabase.rpc('decrement_stock', {
              p_produit_id: demande.produit_id,
              p_quantite: demande.quantite
            });

            if (stockError) {
              throw new Error(`Stock: ${stockError.message}`);
            }

            // Gérer le stock de destination
            if (demande.destination === 'Production' || demande.destination === 'Atelier') {
              const { data: existingStock } = await supabase
                .from('stock_atelier')
                .select('*')
                .eq('produit_id', demande.produit_id)
                .maybeSingle();

              if (existingStock) {
                await supabase
                  .from('stock_atelier')
                  .update({
                    quantite_disponible: existingStock.quantite_disponible + demande.quantite,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingStock.id);
              } else {
                await supabase
                  .from('stock_atelier')
                  .insert({
                    produit_id: demande.produit_id,
                    quantite_disponible: demande.quantite,
                    transfere_par: currentUser.id,
                    created_at: new Date().toISOString()
                  });
              }

            } else if (demande.destination === 'Boutique') {
              const { data: existingStockBoutique } = await supabase
                .from('stock_boutique')
                .select('*')
                .eq('produit_id', demande.produit_id)
                .maybeSingle();

              if (existingStockBoutique) {
                await supabase
                  .from('stock_boutique')
                  .update({
                    quantite_disponible: (existingStockBoutique.quantite_disponible || 0) + demande.quantite,
                    type_produit: existingStockBoutique.type_produit || 'vendable',
                    transfere_par: currentUser.id,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingStockBoutique.id);
              } else {
                await supabase
                  .from('stock_boutique')
                  .insert({
                    produit_id: demande.produit_id,
                    nom_produit: demande.produit?.nom || `Produit ${demande.produit_id}`,
                    quantite_disponible: demande.quantite,
                    quantite_vendue: 0,
                    quantite_utilisee: 0,
                    type_produit: 'vendable',
                    transfere_par: currentUser.id,
                    created_at: new Date().toISOString()
                  });
              }

              await supabase.from('entrees_boutique').insert({
                produit_id: demande.produit_id,
                quantite: demande.quantite,
                source: 'Stock Principal',
                type_entree: 'Demande',
                ajoute_par: currentUser.id,
                created_at: new Date().toISOString()
              });
            }

            // Enregistrer le mouvement de stock
            await supabase
              .from('mouvements_stock')
              .insert({
                produit_id: demande.produit_id,
                type_mouvement: 'transfert',
                quantite: demande.quantite,
                source: 'Stock Principal',
                destination: demande.destination,
                utilisateur_id: currentUser.id,
                reference_id: demande.id,
                reference_type: 'demande',
                commentaire: `Demande groupée #${demandeGroupeeId} validée`,
                created_at: new Date().toISOString()
              });

            processedCount++;
            return { success: true, produit: demande.produit?.nom };

          } catch (error) {
            console.error(`Erreur pour ${demande.produit?.nom}:`, error);
            errors.push({
              produit: demande.produit?.nom || `ID: ${demande.produit_id}`,
              erreur: error.message
            });
            return { success: false, produit: demande.produit?.nom, error: error.message };
          }
        });

        await Promise.all(batchPromises);
        
        if (batchIndex < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      showProgress('📝 Finalisation...');

// ÉTAPE 1 : Passer la demande groupée en "en_traitement"
const { error: traitementError } = await supabase
  .from('demandes_groupees')
  .update({
    statut: 'en_traitement',
    updated_at: new Date().toISOString()
  })
  .eq('id', demandeGroupeeId);

if (traitementError) {
  console.error('Erreur passage en traitement:', traitementError);
  throw new Error(`Erreur lors du passage en traitement: ${traitementError.message}`);
}

// ÉTAPE 2 : Mettre à jour les demandes individuelles
const { error: demandesUpdateError } = await supabase
  .from('demandes')
  .update({
    statut: 'validee',
    valideur_id: currentUser.id,
    date_validation: new Date().toISOString()
  })
  .eq('demande_groupee_id', demandeGroupeeId);

if (demandesUpdateError) {
  console.error('Erreur mise à jour demandes:', demandesUpdateError);
  throw new Error(`Erreur lors de la mise à jour des demandes: ${demandesUpdateError.message}`);
}

// ÉTAPE 3 : Passer la demande groupée au statut final
const statutFinal = errors.length > 0 ? 'partiellement_validee' : 'validee';

const { data: updateData, error: groupUpdateError } = await supabase
  .from('demandes_groupees')
  .update({
    statut: statutFinal,
    valideur_id: currentUser.id,
    date_validation: new Date().toISOString(),
    details_validation: errors.length > 0 ? { erreurs: errors } : null,
    updated_at: new Date().toISOString()
  })
  .eq('id', demandeGroupeeId)
  .select()
  .single();

if (groupUpdateError) {
  console.error('❌ Erreur update demande groupée:', groupUpdateError);
  throw new Error(`Impossible de mettre à jour la demande groupée: ${groupUpdateError.message}`);
}

console.log('✅ Demande groupée mise à jour avec succès:', updateData);

      // Notification
      const { data: demandeInfo } = await supabase
        .from('demandes_groupees')
        .select('demandeur_id, nombre_produits, destination')
        .eq('id', demandeGroupeeId)
        .single();

      if (demandeInfo?.demandeur_id && demandeInfo.demandeur_id !== currentUser.id) {
        await supabase
          .from('notifications')
          .insert({
            destinataire_id: demandeInfo.demandeur_id,
            emetteur_id: currentUser.id,
            type: 'demande_validee',
            message: `Votre demande a été validée par ${currentUser.nom || currentUser.username}`,
            details: errors.length > 0 
              ? `${processedCount}/${totalDemandes} produit(s) traités avec succès`
              : `${demandeInfo.nombre_produits} produit(s) ajoutés au stock ${demandeInfo.destination}`,
            lien: `/demandes#${demandeGroupeeId}`,
            lu: false,
            priorite: 'normale',
            created_at: new Date().toISOString()
          });
      }

      await loadData();
      hideProgress();
      
      // Message de résultat
      if (errors.length > 0) {
        let message = `⚠️ Validation terminée avec des erreurs\n\n`;
        message += `✅ ${processedCount}/${totalDemandes} produits traités avec succès\n\n`;
        message += `❌ Erreurs rencontrées :\n`;
        errors.forEach(e => {
          message += `• ${e.produit}: ${e.erreur}\n`;
        });
        alert(message);
      } else {
        alert(`✅ Demande groupée validée avec succès !\n\n${processedCount} produits ont été transférés vers le stock ${demandeInfo.destination}.`);
      }

    } catch (err) {
      hideProgress();
      console.error('Erreur globale:', err);
      alert('❌ ' + err.message);
      
    } finally {
      setValidationsEnCours(prev => {
        const newSet = new Set(prev);
        newSet.delete(demandeGroupeeId);
        return newSet;
      });
    }
  };

  // ============ REFUS DE DEMANDE GROUPÉE ============
  const handleRejectGroupedDemande = async (demandeGroupeeId) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser toute cette demande groupée ?')) return;
    
    const raison = prompt('Raison du refus (optionnel):');
    
    try {
      const { error: groupError } = await supabase
        .from('demandes_groupees')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeGroupeeId);

      if (groupError) {
        throw new Error(`Erreur mise à jour demande groupée: ${groupError.message}`);
      }

      const { error: demandesError } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('demande_groupee_id', demandeGroupeeId);

      if (demandesError) {
        throw new Error(`Erreur mise à jour demandes: ${demandesError.message}`);
      }

      // Notification
      const { data: demandeInfo } = await supabase
        .from('demandes_groupees')
        .select('demandeur_id, nombre_produits')
        .eq('id', demandeGroupeeId)
        .single();
      
      if (demandeInfo?.demandeur_id && demandeInfo.demandeur_id !== currentUser.id) {
        await supabase
          .from('notifications')
          .insert({
            destinataire_id: demandeInfo.demandeur_id,
            emetteur_id: currentUser.id,
            type: 'demande_refusee',
            message: `Votre demande a été refusée par ${currentUser.nom || currentUser.username}`,
            details: raison || 'Aucune raison spécifiée',
            lien: `/demandes#${demandeGroupeeId}`,
            lu: false,
            priorite: 'normale',
            created_at: new Date().toISOString()
          });
      }

      await loadData();
      alert('Demande refusée. Le demandeur a été notifié.');
      
    } catch (err) {
      console.error('Erreur:', err);
      alert('❌ ' + err.message);
    }
  };

  // ============ HELPERS ============
  const getDestinationColor = (destination) => {
    switch (destination) {
      case 'Production': return 'bg-blue-100 text-blue-800';
      case 'Boutique': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // ============ RENDU ============
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Demandes de Matières Premières</h2>
        
        <button 
          onClick={() => {
            setShowAddModal(true);
            setError('');
          }}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Demande Multi-produits
        </button>
      </div>

      {/* Message si pas de produits */}
      {products.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          Aucun produit avec du stock disponible. Veuillez d'abord ajouter des produits dans le stock principal.
        </div>
      )}

      {/* Liste des demandes */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandeur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {demandes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucune demande enregistrée
                  </td>
                </tr>
              ) : (
                demandes.map((demande) => {
                  const peutValider = currentUser.role === 'admin' || currentUser.role === 'employe_production';
                  
                  return (
                    <tr key={demande.id}>
                      <td className="px-6 py-4">#{demande.id}</td>
                      <td className="px-6 py-4">
                        {demande.type === 'groupee' ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              📦 Demande groupée ({demande.nombre_produits || 0} produits)
                            </div>
                            
                            <button
                              onClick={() => loadGroupedDetails(demande.id)}
                              className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                            >
                              👁️ Voir tous les détails
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium">{demande.produit?.nom}</div>
                            <div className="text-sm text-gray-500">
                              {demande.quantite} {demande.produit?.unite?.label}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${getDestinationColor(demande.destination)}`}>
                          {demande.destination}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{demande.demandeur?.nom}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={demande.statut} />
                      </td>
                      <td className="px-6 py-4">
                        {demande.statut === 'en_attente' && peutValider && (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleValidateGroupedDemande(demande.id)}
                              disabled={validationsEnCours.has(demande.id)}
                              className={`text-green-600 hover:text-green-900 ${
                                validationsEnCours.has(demande.id) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              title={validationsEnCours.has(demande.id) ? "Validation en cours..." : "Valider la demande"}
                            >
                              {validationsEnCours.has(demande.id) ? (
                                <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button 
                              onClick={() => handleRejectGroupedDemande(demande.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Refuser la demande"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {demande.statut === 'validee' && (
                          <span className="text-green-600 text-sm">✓ Validée</span>
                        )}
                        {demande.statut === 'refusee' && (
                          <span className="text-red-600 text-sm">✗ Refusée</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nouvelle Demande */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => {
          setShowAddModal(false); 
          resetForm();
        }} 
        title="Nouvelle Demande Multi-produits" 
        size="lg"
      >
        <form onSubmit={handleCreateDemande} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="Production">Production (Stock Atelier)</option>
              <option value="Boutique">Boutique</option>
            </select>
          </div>

          {/* Commentaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
            <textarea
              value={formData.commentaire}
              onChange={(e) => setFormData({...formData, commentaire: e.target.value})}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Description de la demande..."
            />
          </div>

          {/* Sélection des produits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produits ({selectedProducts.length} sélectionnés)
            </label>
            
            {/* Recherche */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowProductSearch(e.target.value.length > 0);
                }}
                onFocus={() => setShowProductSearch(searchTerm.length > 0)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Rechercher un produit..."
              />
              
              {/* Résultats de recherche */}
              {showProductSearch && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {getAvailableProducts().length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      Aucun produit trouvé
                    </div>
                  ) : (
                    getAvailableProducts().map(product => (
                      <div
                        key={product.id}
                        onClick={() => addProductToSelection(product)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{product.nom}</div>
                            <div className="text-xs text-gray-500">
                              Stock: {product.quantite_restante} {product.unite?.label}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-orange-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Produits sélectionnés */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.nom}</div>
                      <div className="text-xs text-gray-500">
                        Stock disponible: {product.quantite_disponible} {product.unite?.label}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max={Math.floor(product.quantite_disponible)}
                          value={product.quantite_demandee}
                          onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                          data-product-id={product.id}
                          placeholder="Quantité"
                          className={`w-24 px-2 py-1 border rounded transition-colors ${
                            product.quantite_demandee === '' 
                              ? 'border-orange-400 bg-orange-50' 
                              : 'border-gray-300'
                          } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                        />
                        {product.quantite_demandee === '' && (
                          <div className="absolute -bottom-5 left-0 text-xs text-orange-600">
                            Requis
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">{product.unite?.label}</span>
                      
                      <button
                        type="button"
                        onClick={() => removeProductFromSelection(product.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Retirer ce produit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Boutons */}
          <div className="flex space-x-4">
            <button 
              type="submit" 
              disabled={selectedProducts.length === 0 || submitting}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Création en cours...
                </>
              ) : (
                'Créer la demande'
              )}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false); 
                resetForm();
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Détails Demande Groupée */}
      <Modal 
        isOpen={showDetailsModal} 
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedGroupedDemande(null);
        }} 
        title="Détails de la Demande Groupée" 
        size="xl"
      >
        {selectedGroupedDemande && (
          <div className="space-y-6">
            {/* Détails complets - structure simplifiée pour la lisibilité */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Demandeur</p>
                  <p className="font-medium">{selectedGroupedDemande.demandeur?.nom || 'Non spécifié'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Destination</p>
                  <p className="font-medium">{selectedGroupedDemande.destination}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date de création</p>
                  <p className="font-medium">
                    {new Date(selectedGroupedDemande.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Statut</p>
                  <StatusBadge status={selectedGroupedDemande.statut} />
                </div>
              </div>
            </div>

            {/* Liste des produits */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">
                Produits demandés ({selectedGroupedDemande.lignes?.length || 0})
              </h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantité</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedGroupedDemande.lignes?.map((ligne, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{ligne.produit?.nom}</td>
                        <td className="px-4 py-2 text-sm">{ligne.quantite} {ligne.produit?.unite?.label}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={ligne.statut} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedGroupedDemande(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Fermer
              </button>
              
              {selectedGroupedDemande.statut === 'en_attente' && 
               (currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                <>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleValidateGroupedDemande(selectedGroupedDemande.id);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Valider tout
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleRejectGroupedDemande(selectedGroupedDemande.id);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Refuser tout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
