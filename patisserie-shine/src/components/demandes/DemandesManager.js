"use client";

import { useState, useEffect } from 'react';
import { demandeService, utils, supabase } from '../../lib/supabase';
import { 
  Plus, ShoppingCart, Check, X, Clock, Package, 
  Warehouse, Store, Trash2, Search, Factory, 
  FileCheck, FileX, Eye, Archive,RotateCcw
} from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';

export default function DemandesManager({ currentUser }) {
  // ============ ÉTATS ============
  const [activeTab, setActiveTab] = useState('en_attente');
  const [demandes, setDemandes] = useState([]);
  const [demandesEnAttente, setDemandesEnAttente] = useState([]);
  const [demandesTraitees, setDemandesTraitees] = useState([]);
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
  }, [currentUser]);

  // ============ FONCTIONS DE CHARGEMENT ============
  const loadData = async () => {
    setLoading(true);
    try {
      // Récupérer les demandes selon le rôle
      let query = supabase
        .from('demandes_groupees')
        .select(`
          *,
          demandeur:profiles!demandes_groupees_demandeur_id_fkey(id, nom, username),
          valideur:profiles!demandes_groupees_valideur_id_fkey(id, nom, username),
          lignes:demandes!demandes_demande_groupee_id_fkey(
            *,
            produit:produits(id, nom, quantite_restante, unite:unites(label)),
            valideur:profiles!demandes_valideur_id_fkey(nom, username)
          )
        `)
        .order('created_at', { ascending: false });

      // Si l'utilisateur n'est pas admin, filtrer ses demandes uniquement
      if (currentUser.role !== 'admin' && currentUser.role !== 'employe_production') {
        query = query.eq('demandeur_id', currentUser.id);
      }

      const { data: demandesData, error: demandesError } = await query;

      if (demandesError) {
        console.error('Erreur chargement demandes:', demandesError);
        setDemandes([]);
      } else {
        // Séparer les demandes
        const allDemandes = demandesData || [];
        
        // Demandes en attente
        const enAttente = allDemandes.filter(d => 
          d.statut === 'en_attente' || d.statut === 'en_traitement'
        );
        
        // Demandes traitées (validées, refusées, annulées)
        const traitees = allDemandes.filter(d => 
          d.statut === 'validee' || 
          d.statut === 'partiellement_validee' || 
          d.statut === 'refusee' || 
          d.statut === 'annulee'
        );

        setDemandes(allDemandes);
        setDemandesEnAttente(enAttente);
        setDemandesTraitees(traitees);
      }

      // Charger les produits disponibles
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
      } else {
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
    
    const emptyProducts = selectedProducts.filter(p => 
      p.quantite_demandee === '' || 
      p.quantite_demandee === null || 
      p.quantite_demandee === undefined
    );
    
    if (emptyProducts.length > 0) {
      setError(`Veuillez saisir les quantités pour : ${emptyProducts.map(p => p.nom).join(', ')}`);
      return;
    }
    
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
      
      // Créer la demande groupée
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
      
      // Créer les demandes individuelles
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
        await supabase
          .from('demandes_groupees')
          .delete()
          .eq('id', demandeGroupee.id);
        
        console.error('Erreur création demandes individuelles:', demandesError);
        setError('Erreur lors de la création des demandes: ' + demandesError.message);
        setSubmitting(false);
        return;
      }
      
      // Notifier les admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'employe_production'])
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

  // ============ VALIDATION DE DEMANDE ============
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
    showProgress('🔒 Vérification...');

    // Vérifier le statut actuel
    const { data: demandeActuelle, error: checkError } = await supabase
      .from('demandes_groupees')
      .select('statut')
      .eq('id', demandeGroupeeId)
      .single();

    if (checkError || demandeActuelle.statut !== 'en_attente') {
      alert('Cette demande ne peut pas être validée');
      return;
    }

    showProgress('📋 Traitement...');

    // Récupérer les demandes avec les infos complètes
    const { data: demandesGroupe, error: fetchError } = await supabase
      .from('demandes')
      .select(`
        *,
        produit:produits(id, nom, quantite_restante, unite:unites(label))
      `)
      .eq('demande_groupee_id', demandeGroupeeId)
      .eq('statut', 'en_attente');

    if (fetchError || !demandesGroupe || demandesGroupe.length === 0) {
      throw new Error('Aucune demande en attente trouvée');
    }

    // Récupérer la destination de la demande groupée
    const { data: demandeGroupeeInfo } = await supabase
      .from('demandes_groupees')
      .select('destination')
      .eq('id', demandeGroupeeId)
      .single();

    showProgress('🔍 Vérification des stocks...');

    // Vérifier les stocks disponibles
    const stockInsuffisant = [];
    for (const demande of demandesGroupe) {
      if (!demande.produit || demande.produit.quantite_restante < demande.quantite) {
        stockInsuffisant.push({
          produit: demande.produit?.nom || 'Produit inconnu',
          demande: demande.quantite,
          disponible: demande.produit?.quantite_restante || 0
        });
      }
    }

    if (stockInsuffisant.length > 0) {
      let message = '⚠️ Stock insuffisant :\n';
      stockInsuffisant.forEach(item => {
        message += `• ${item.produit}: demandé ${item.demande}, disponible ${item.disponible}\n`;
      });
      throw new Error(message);
    }

    showProgress('⚙️ Validation en cours...');

    const errors = [];
    let processedCount = 0;

    // Traiter chaque demande
    for (const demande of demandesGroupe) {
      try {
        // 1. Réduire le stock principal
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          p_produit_id: demande.produit_id,
          p_quantite: demande.quantite
        });

        if (stockError) throw stockError;

        // 2. Gérer le stock de destination selon le type
        const destination = demande.destination || demandeGroupeeInfo?.destination;
        
        if (destination === 'Production' || destination === 'Atelier') {
          // Gérer le stock atelier
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
          
        } else if (destination === 'Boutique') {
          // Gérer le stock boutique
          const { data: existingStockBoutique } = await supabase
            .from('stock_boutique')
            .select('*')
            .eq('produit_id', demande.produit_id)
            .maybeSingle();

          // Récupérer le prix de vente si défini
          const { data: prixVente } = await supabase
            .from('prix_vente_produits')
            .select('prix')
            .eq('produit_id', demande.produit_id)
            .eq('actif', true)
            .maybeSingle();

          if (existingStockBoutique) {
            // Mettre à jour le stock existant
            await supabase
              .from('stock_boutique')
              .update({
                quantite_disponible: (existingStockBoutique.quantite_disponible || 0) + demande.quantite,
                type_produit: existingStockBoutique.type_produit || 'vendable',
                nom_produit: existingStockBoutique.nom_produit || demande.produit?.nom || `Produit ${demande.produit_id}`,
                prix_vente: prixVente?.prix || existingStockBoutique.prix_vente || null,
                statut_stock: 'normal',
                transfere_par: currentUser.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingStockBoutique.id);
          } else {
            // Créer une nouvelle entrée dans stock_boutique
            await supabase
              .from('stock_boutique')
              .insert({
                produit_id: demande.produit_id,
                nom_produit: demande.produit?.nom || `Produit ${demande.produit_id}`,
                quantite_disponible: demande.quantite,
                quantite_vendue: 0,
                quantite_utilisee: 0,
                type_produit: 'vendable',
                prix_vente: prixVente?.prix || null,
                statut_stock: 'normal',
                transfere_par: currentUser.id,
                created_at: new Date().toISOString()
              });
          }

          // Enregistrer l'entrée dans entrees_boutique
          await supabase
            .from('entrees_boutique')
            .insert({
              produit_id: demande.produit_id,
              quantite: demande.quantite,
              source: 'Stock Principal',
              type_entree: 'Demande',
              prix_vente: prixVente?.prix || null,
              ajoute_par: currentUser.id,
              created_at: new Date().toISOString()
            });
        }

        // 3. Enregistrer le mouvement de stock
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: demande.produit_id,
            type_mouvement: 'transfert',
            quantite: demande.quantite,
            source: 'Stock Principal',
            destination: destination || 'Production',
            utilisateur_id: currentUser.id,
            reference_id: demande.id,
            reference_type: 'demande',
            commentaire: `Demande groupée #${demandeGroupeeId} validée`,
            created_at: new Date().toISOString()
          });

        processedCount++;
        
      } catch (error) {
        console.error(`Erreur pour ${demande.produit?.nom}:`, error);
        errors.push({
          produit: demande.produit?.nom || `Produit ID: ${demande.produit_id}`,
          erreur: error.message
        });
      }
    }

    showProgress('📝 Finalisation...');

    // 4. Passer en traitement puis valider (pour respecter la contrainte CHECK)
    await supabase
      .from('demandes_groupees')
      .update({ statut: 'en_traitement' })
      .eq('id', demandeGroupeeId);

    // 5. Mettre à jour les demandes individuelles
    await supabase
      .from('demandes')
      .update({
        statut: 'validee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString()
      })
      .eq('demande_groupee_id', demandeGroupeeId);

    // 6. Valider la demande groupée
    const statutFinal = errors.length > 0 ? 'partiellement_validee' : 'validee';
    
    await supabase
      .from('demandes_groupees')
      .update({
        statut: statutFinal,
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString(),
        details_validation: errors.length > 0 ? { erreurs: errors } : null
      })
      .eq('id', demandeGroupeeId);

    // 7. Notifier le demandeur
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
            ? `${processedCount}/${demandesGroupe.length} produit(s) traités avec succès`
            : `${demandeInfo.nombre_produits} produit(s) ajoutés au stock ${demandeInfo.destination}`,
          lien: `/demandes#${demandeGroupeeId}`,
          lu: false,
          priorite: 'normale',
          created_at: new Date().toISOString()
        });
    }

    await loadData();
    hideProgress();
    
    // 8. Message de résultat
    if (errors.length > 0) {
      let message = `⚠️ Validation terminée avec des erreurs\n\n`;
      message += `✅ ${processedCount}/${demandesGroupe.length} produits traités avec succès\n\n`;
      message += `❌ Erreurs rencontrées :\n`;
      errors.forEach(e => {
        message += `• ${e.produit}: ${e.erreur}\n`;
      });
      alert(message);
    } else {
      alert(`✅ Demande groupée validée avec succès !\n\n${processedCount} produits ont été transférés vers le stock ${demandeGroupeeInfo?.destination || 'de destination'}.`);
    }

  } catch (err) {
    hideProgress();
    console.error('Erreur globale:', err);
    alert('❌ ' + err.message);
  } finally {
    // 9. Libération du verrou
    setValidationsEnCours(prev => {
      const newSet = new Set(prev);
      newSet.delete(demandeGroupeeId);
      return newSet;
    });
  }
};
  const handleCancelValidatedDemande = async (demandeGroupeeId) => {
  // Vérifier que l'utilisateur est admin
  if (currentUser.role !== 'admin') {
    alert('⛔ Seuls les administrateurs peuvent annuler une demande validée.');
    return;
  }

  // Confirmation avec avertissement sérieux
  const firstConfirm = confirm(
    '⚠️ ATTENTION - ANNULATION DE DEMANDE VALIDÉE\n\n' +
    'Vous êtes sur le point d\'annuler une demande déjà validée.\n\n' +
    'Cette action va :\n' +
    '• Restaurer le stock principal\n' +
    '• Retirer les produits du stock de destination\n' +
    '• Créer un mouvement de restauration\n\n' +
    'Êtes-vous sûr de vouloir continuer ?'
  );

  if (!firstConfirm) return;

  // Double confirmation pour une action critique
  const raison = prompt(
    'CONFIRMATION FINALE\n\n' +
    'Veuillez indiquer la raison de l\'annulation (obligatoire) :'
  );

  if (!raison || raison.trim() === '') {
    alert('L\'annulation a été abandonnée. Une raison est obligatoire.');
    return;
  }

  try {
    // 1. Récupérer toutes les demandes de ce groupe
    const { data: demandesGroupe, error: fetchError } = await supabase
      .from('demandes')
      .select(`
        *,
        produit:produits(id, nom, quantite_restante, unite:unites(label))
      `)
      .eq('demande_groupee_id', demandeGroupeeId)
      .eq('statut', 'validee');

    if (fetchError) {
      alert('Erreur lors de la récupération des demandes: ' + fetchError.message);
      return;
    }

    if (!demandesGroupe || demandesGroupe.length === 0) {
      alert('Aucune demande validée trouvée pour cette demande groupée.');
      return;
    }

    // 2. Récupérer les informations de la demande groupée
    const { data: demandeGroupeeInfo } = await supabase
      .from('demandes_groupees')
      .select('destination, demandeur_id, nombre_produits')
      .eq('id', demandeGroupeeId)
      .single();

    console.log('🔄 Début de l\'annulation de la demande groupée #' + demandeGroupeeId);
    
    const erreurs = [];
    const succesRestauration = [];

    // 3. Pour chaque demande, restaurer les stocks
    for (const demande of demandesGroupe) {
      try {
        console.log(`  Restauration de ${demande.quantite} ${demande.produit?.nom}...`);

        // 3.1 Restaurer le stock principal
        const { data: produitActuel } = await supabase
          .from('produits')
          .select('quantite_restante')
          .eq('id', demande.produit_id)
          .single();

        if (produitActuel) {
          const nouvelleQuantite = (produitActuel.quantite_restante || 0) + demande.quantite;
          
          const { error: restoreError } = await supabase
            .from('produits')
            .update({
              quantite_restante: nouvelleQuantite,
              updated_at: new Date().toISOString()
            })
            .eq('id', demande.produit_id);

          if (restoreError) {
            erreurs.push(`Erreur restauration stock principal pour ${demande.produit?.nom}: ${restoreError.message}`);
            continue;
          }
        }

        // 3.2 Retirer du stock de destination
        const destination = demande.destination || demandeGroupeeInfo?.destination;
        
        if (destination === 'Boutique') {
          // Retirer du stock boutique
          const { data: stockBoutique } = await supabase
            .from('stock_boutique')
            .select('id, quantite_disponible')
            .eq('produit_id', demande.produit_id)
            .single();

          if (stockBoutique) {
            const nouvelleQuantiteBoutique = Math.max(0, (stockBoutique.quantite_disponible || 0) - demande.quantite);
            
            await supabase
              .from('stock_boutique')
              .update({
                quantite_disponible: nouvelleQuantiteBoutique,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockBoutique.id);
          }

        } else if (destination === 'Production' || destination === 'Atelier') {
          // Retirer du stock atelier
          const { data: stockAtelier } = await supabase
            .from('stock_atelier')
            .select('id, quantite_disponible')
            .eq('produit_id', demande.produit_id)
            .single();

          if (stockAtelier) {
            const nouvelleQuantiteAtelier = Math.max(0, (stockAtelier.quantite_disponible || 0) - demande.quantite);
            
            await supabase
              .from('stock_atelier')
              .update({
                quantite_disponible: nouvelleQuantiteAtelier,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockAtelier.id);
          }
        }

        // 3.3 Créer un mouvement de restauration
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: demande.produit_id,
            type_mouvement: 'restauration_annulation',
            quantite: demande.quantite,
            source: destination || 'Production',
            destination: 'Stock Principal',
            utilisateur_id: currentUser.id,
            reference_id: demande.id,
            reference_type: 'annulation_demande',
            raison: raison,
            commentaire: `Annulation demande groupée #${demandeGroupeeId}: ${raison}`,
            created_at: new Date().toISOString()
          });

        succesRestauration.push(`${demande.produit?.nom}: ${demande.quantite} ${demande.produit?.unite?.label || ''} restauré`);

      } catch (error) {
        console.error(`Erreur restauration ${demande.produit?.nom}:`, error);
        erreurs.push(`${demande.produit?.nom}: ${error.message}`);
      }
    }

    // 4. Mettre à jour le statut des demandes individuelles
    await supabase
      .from('demandes')
      .update({
        statut: 'annulee',
        date_validation: new Date().toISOString()
      })
      .eq('demande_groupee_id', demandeGroupeeId);

    // 5. Mettre à jour le statut de la demande groupée
    await supabase
      .from('demandes_groupees')
      .update({
        statut: 'annulee',
        details_validation: {
          annulation: {
            date: new Date().toISOString(),
            par: currentUser.id,
            raison: raison,
            erreurs: erreurs.length > 0 ? erreurs : undefined
          }
        }
      })
      .eq('id', demandeGroupeeId);

    // 6. Notifier le demandeur
    if (demandeGroupeeInfo?.demandeur_id && demandeGroupeeInfo.demandeur_id !== currentUser.id) {
      await supabase
        .from('notifications')
        .insert({
          destinataire_id: demandeGroupeeInfo.demandeur_id,
          emetteur_id: currentUser.id,
          type: 'demande_modifiee',
          message: `Votre demande validée a été annulée par ${currentUser.nom || currentUser.username}`,
          details: `Raison: ${raison}`,
          lien: `/demandes#${demandeGroupeeId}`,
          lu: false,
          priorite: 'haute',
          created_at: new Date().toISOString()
        });
    }

    // 7. Afficher le résultat
    let messageResultat = '✅ ANNULATION TERMINÉE\n\n';
    
    if (succesRestauration.length > 0) {
      messageResultat += 'Restaurations réussies :\n';
      succesRestauration.forEach(s => messageResultat += `• ${s}\n`);
    }
    
    if (erreurs.length > 0) {
      messageResultat += '\n⚠️ Erreurs rencontrées :\n';
      erreurs.forEach(e => messageResultat += `• ${e}\n`);
    }

    messageResultat += `\nRaison de l'annulation : ${raison}`;

    alert(messageResultat);

    // 8. Recharger les données
    await loadData();

  } catch (err) {
    console.error('Erreur lors de l\'annulation:', err);
    alert('❌ Erreur critique lors de l\'annulation de la demande: ' + err.message);
  }
};

  // ============ REFUS DE DEMANDE ============
  const handleRejectGroupedDemande = async (demandeGroupeeId) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser cette demande ?')) return;
    
    const raison = prompt('Raison du refus (optionnel):');
    
    try {
      // Passer en traitement puis refuser
      await supabase
        .from('demandes_groupees')
        .update({ statut: 'en_traitement' })
        .eq('id', demandeGroupeeId);

      await supabase
        .from('demandes_groupees')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeGroupeeId);

      await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: currentUser.id,
          date_validation: new Date().toISOString()
        })
        .eq('demande_groupee_id', demandeGroupeeId);

      await loadData();
      alert('Demande refusée');
      
    } catch (err) {
      console.error('Erreur:', err);
      alert('❌ Erreur lors du refus');
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

  const canValidate = () => {
    return currentUser.role === 'admin' || currentUser.role === 'employe_production';
  };

  const getTabIcon = (tab) => {
    switch (tab) {
      case 'en_attente': return <Clock className="w-4 h-4" />;
      case 'traitees': return <FileCheck className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTabCount = (tab) => {
    switch (tab) {
      case 'en_attente': return demandesEnAttente.length;
      case 'traitees': return demandesTraitees.length;
      default: return 0;
    }
  };

  // ============ COMPOSANT DE TABLEAU ============
  const DemandesTable = ({ demandes, showActions = true }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandeur</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valideur</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {demandes.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                Aucune demande dans cette catégorie
              </td>
            </tr>
          ) : (
            demandes.map((demande) => (
              <tr key={demande.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">#{demande.id}</td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      📦 {demande.nombre_produits || 0} produits
                    </div>
                    {demande.lignes && demande.lignes.slice(0, 2).map((ligne, idx) => (
                      <div key={idx} className="text-xs text-gray-500">
                        • {ligne.produit?.nom}: {ligne.quantite} {ligne.produit?.unite?.label}
                      </div>
                    ))}
                    {demande.lignes && demande.lignes.length > 2 && (
                      <div className="text-xs text-gray-400">
                        ... et {demande.lignes.length - 2} autre(s)
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getDestinationColor(demande.destination)}`}>
                    {demande.destination}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {demande.demandeur?.nom || demande.demandeur?.username}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={demande.statut} />
                </td>
                <td className="px-6 py-4 text-sm">
                  {demande.valideur ? (
                    <div>
                      <div className="text-gray-900">{demande.valideur.nom || demande.valideur.username}</div>
                      {demande.date_validation && (
                        <div className="text-xs text-gray-500">
                          {new Date(demande.date_validation).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => loadGroupedDetails(demande.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Voir les détails"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {showActions && demande.statut === 'en_attente' && canValidate() && (
                      <>
                        <button 
                          onClick={() => handleValidateGroupedDemande(demande.id)}
                          disabled={validationsEnCours.has(demande.id)}
                          className={`text-green-600 hover:text-green-900 ${
                            validationsEnCours.has(demande.id) ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title="Valider"
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
                          title="Refuser"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                      {demande.statut === 'validee' && currentUser.role === 'admin' && (
      <button 
        onClick={() => handleCancelValidatedDemande(demande.id)}
        className="text-orange-600 hover:text-orange-900"
        title="Annuler cette demande validée"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

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
        <h2 className="text-2xl font-bold">Gestion des Demandes</h2>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouvelle Demande
        </button>
      </div>

      {/* Info utilisateur */}
      {currentUser.role !== 'admin' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          <p className="text-sm">
            Vous visualisez uniquement vos demandes. Seuls les administrateurs peuvent voir toutes les demandes et les valider.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['en_attente', 'traitees'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${activeTab === tab
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {getTabIcon(tab)}
              <span>
                {tab === 'en_attente' ? 'En attente' : 'Traitées'}
              </span>
              <span className={`
                ml-2 py-0.5 px-2 rounded-full text-xs
                ${activeTab === tab
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {getTabCount(tab)}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu selon l'onglet actif */}
      <Card className="overflow-hidden">
        {activeTab === 'en_attente' ? (
          <DemandesTable demandes={demandesEnAttente} showActions={true} />
        ) : (
          <DemandesTable demandes={demandesTraitees} showActions={false} />
        )}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Produits ({selectedProducts.length} sélectionnés)
            </label>
            
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

            {selectedProducts.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.nom}</div>
                      <div className="text-xs text-gray-500">
                        Stock: {product.quantite_disponible} {product.unite?.label}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max={Math.floor(product.quantite_disponible)}
                        value={product.quantite_demandee}
                        onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                        placeholder="Qté"
                        className="w-20 px-2 py-1 border rounded"
                      />
                      <span className="text-xs">{product.unite?.label}</span>
                      
                      <button
                        type="button"
                        onClick={() => removeProductFromSelection(product.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex space-x-4">
            <button 
              type="submit" 
              disabled={selectedProducts.length === 0 || submitting}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Création...' : 'Créer la demande'}
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

      {/* Modal Détails reste identique */}
      <Modal 
        isOpen={showDetailsModal} 
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedGroupedDemande(null);
        }} 
        title="Détails de la Demande" 
        size="xl"
      >
        {selectedGroupedDemande && (
          <div className="space-y-6">
            {/* Contenu détaillé de la demande */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Demandeur</p>
                  <p className="font-medium">{selectedGroupedDemande.demandeur?.nom}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Destination</p>
                  <p className="font-medium">{selectedGroupedDemande.destination}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
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
                      <td className="px-4 py-2 text-sm">
                        {ligne.quantite} {ligne.produit?.unite?.label}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={ligne.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedGroupedDemande(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
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
