"use client";

import { useState, useEffect } from 'react';
import { demandeService, productService, utils, supabase } from '../../lib/supabase';
import { Plus, ShoppingCart, Check, X, Clock, Package, ArrowRight, Warehouse, Store, DollarSign, Trash2, Search, Factory } from 'lucide-react';
import { Card, Modal, StatusBadge } from '../ui';
import { notificationService } from '../../services/notificationService';

export default function DemandesManager({ currentUser }) {
  const [demandes, setDemandes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroupedDemande, setSelectedGroupedDemande] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // État pour la demande multi-produits
  const [formData, setFormData] = useState({
    destination: 'Production',
    commentaire: ''
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

      // Charger DIRECTEMENT depuis Supabase pour éviter les problèmes de format
      const { data: produitsData, error: produitsError } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .gt('quantite_restante', 0)  // Seulement les produits avec du stock
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

  // Fonction pour charger les détails d'une demande groupée
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

  // Ajouter un produit à la sélection
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
      quantite_demandee: 1
    };

    setSelectedProducts([...selectedProducts, newProduct]);
    setSearchTerm('');
    setShowProductSearch(false);
  };

  // Modifier la quantité d'un produit sélectionné
  const updateProductQuantity = (productId, newQuantity) => {
    setSelectedProducts(prev => 
      prev.map(p => 
        p.id === productId 
          ? { ...p, quantite_demandee: Math.max(1, parseInt(newQuantity) || 1) }
          : p
      )
    );
  };

  // Supprimer un produit de la sélection
  const removeProductFromSelection = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Filtrer les produits disponibles pour la recherche
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

  // Créer la demande multi-produits
 
// Puis remplacez votre handleCreateDemande par celle-ci :
const handleCreateDemande = async (e) => {
  e.preventDefault();
  
  if (selectedProducts.length === 0) {
    alert('Veuillez sélectionner au moins un produit');
    return;
  }
  
  // Vérifier que toutes les quantités sont valides
  const invalidProducts = selectedProducts.filter(p => 
      !p.quantite_demandee || p.quantite_demandee < 1 || p.quantite_demandee > Math.floor(p.quantite_disponible)
  );
  
  if (invalidProducts.length > 0) {
    alert(`Quantités invalides pour : ${invalidProducts.map(p => p.nom).join(', ')}`);
    return;
  }
  
  try {
    setError('');
    
    // Créer directement dans Supabase si le service n'existe pas
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setError('Vous devez être connecté');
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
      return;
    }
    
    // 2. Créer les demandes individuelles
    const demandesIndividuelles = selectedProducts.map(p => ({
      produit_id: p.id,
      quantite: p.quantite_demandee,
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
      // Rollback : supprimer la demande groupée
      await supabase
        .from('demandes_groupees')
        .delete()
        .eq('id', demandeGroupee.id);
      
      console.error('Erreur création demandes individuelles:', demandesError);
      setError('Erreur lors de la création des demandes: ' + demandesError.message);
      return;
    }
    
    // 3. NOUVEAU : Notifier les administrateurs
    try {
      // Récupérer tous les admins actifs
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,username.eq.proprietaire')
        .eq('actif', true);
      
      if (admins && admins.length > 0) {
        // Créer une notification pour chaque admin
        const notifications = admins.map(admin => ({
          destinataire_id: admin.id,
          emetteur_id: user.id,
          type: 'demande_nouvelle',
          message: `Nouvelle demande de ${currentUser?.nom || currentUser?.username || 'Un employé'}`,
          details: `${selectedProducts.length} produit(s) pour ${formData.destination}`,
          lien: `/demandes#${demandeGroupee.id}`,
          lu: false,
          priorite: 'normale',
          created_at: new Date().toISOString()
        }));
        
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);
        
        if (notifError) {
          console.error('Erreur envoi notifications:', notifError);
          // Ne pas bloquer si les notifications échouent
        } else {
          console.log(`${admins.length} administrateur(s) notifié(s)`);
        }
      }
    } catch (notifErr) {
      console.error('Erreur notifications:', notifErr);
      // Ne pas bloquer le processus si les notifications échouent
    }
    
    // Succès
    await loadData();
    resetForm();
    setShowAddModal(false);
    
    alert(`✅ Demande créée avec succès !\n\n${selectedProducts.length} produit(s) demandé(s) vers ${formData.destination}\n\nLes administrateurs ont été notifiés.`);
    
  } catch (err) {
    console.error('Erreur:', err);
    setError('Erreur lors de la création de la demande');
  }
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

 const handleValidateGroupedDemande = async (demandeGroupeeId) => {
  if (!confirm('Êtes-vous sûr de vouloir valider toute cette demande groupée ?')) return;

  try {
    // =============== VÉRIFICATION DU STOCK AVANT VALIDATION ===============
    // Récupérer toutes les demandes du groupe
    const { data: demandesGroupe, error: fetchError } = await supabase
      .from('demandes')
      .select(`
        *,
        produit:produits(id, nom, quantite_restante, unite:unites(label))
      `)
      .eq('demande_groupee_id', demandeGroupeeId)
      .eq('statut', 'en_attente');

    if (fetchError) {
      alert('Erreur lors de la récupération des demandes: ' + fetchError.message);
      return;
    }

    // Vérifier le stock disponible pour chaque demande
    const stockInsuffisant = [];
    
    for (const demande of demandesGroupe) {
      if (!demande.produit) {
        stockInsuffisant.push({
          nom: 'Produit inconnu (ID: ' + demande.produit_id + ')',
          raison: 'Produit introuvable dans la base de données'
        });
        continue;
      }
      
      // Vérifier si le stock est suffisant
      if (demande.produit.quantite_restante < demande.quantite) {
        stockInsuffisant.push({
          nom: demande.produit.nom,
          demande: demande.quantite,
          disponible: demande.produit.quantite_restante,
          manque: demande.quantite - demande.produit.quantite_restante,
          unite: demande.produit.unite?.label || 'unité'
        });
      }
    }
    
    // Si stock insuffisant, bloquer la validation
    if (stockInsuffisant.length > 0) {
      let messageErreur = '❌ IMPOSSIBLE DE VALIDER - STOCK INSUFFISANT :\n\n';
      
      stockInsuffisant.forEach(produit => {
        if (produit.raison) {
          messageErreur += `• ${produit.nom} : ${produit.raison}\n`;
        } else {
          messageErreur += `• ${produit.nom} :\n`;
          messageErreur += `  - Demandé : ${produit.demande} ${produit.unite}\n`;
          messageErreur += `  - Stock disponible : ${produit.disponible} ${produit.unite}\n`;
          messageErreur += `  - Manquant : ${produit.manque} ${produit.unite}\n\n`;
        }
      });
      
      messageErreur += '\n💡 Actions possibles :\n';
      messageErreur += '1. Réapprovisionner le stock principal\n';
      messageErreur += '2. Modifier les quantités de la demande\n';
      messageErreur += '3. Refuser la demande et en créer une nouvelle';
      
      alert(messageErreur);
      return; // Bloquer la validation
    }
    
    // =============== FIN DE LA VÉRIFICATION ===============

    // Si tout est OK, procéder à la validation
    for (const demande of demandesGroupe) {
      // Réduire le stock principal
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_produit_id: demande.produit_id,
        p_quantite: demande.quantite
      });

      if (stockError) {
        console.error('Erreur mise à jour stock:', stockError);
        alert(`Erreur lors de la mise à jour du stock pour ${demande.produit?.nom}: ${stockError.message}`);
        continue;
      }

      // === STOCK ATELIER ===
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

      // === STOCK BOUTIQUE ===
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
              type_produit: existingStockBoutique.type_produit || 'vendable', // Assurer le type
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
              type_produit: 'vendable', // IMPORTANT : Définir le type par défaut
              transfere_par: currentUser.id,
              created_at: new Date().toISOString()
            });
        }

        // Enregistrer entrée boutique
        await supabase.from('entrees_boutique').insert({
          produit_id: demande.produit_id,
          quantite: demande.quantite,
          source: 'Stock Principal',
          type_entree: 'Demande',
          ajoute_par: currentUser.id,
          created_at: new Date().toISOString()
        });
      }

      // === MOUVEMENT DE STOCK ===
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
    }

    // Marquer toutes les demandes comme validées
    await supabase
      .from('demandes')
      .update({
        statut: 'validee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString()
      })
      .eq('demande_groupee_id', demandeGroupeeId);

    // Marquer la demande groupée comme validée
    await supabase
      .from('demandes_groupees')
      .update({
        statut: 'validee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString()
      })
      .eq('id', demandeGroupeeId);

    // Notification au demandeur
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
          details: `${demandeInfo.nombre_produits} produit(s) ajoutés au stock ${demandeInfo.destination}`,
          lien: `/demandes#${demandeGroupeeId}`,
          lu: false,
          priorite: 'normale',
          created_at: new Date().toISOString()
        });
    }

    await loadData();
    alert('✅ Demande groupée validée avec succès ! Les stocks ont été mis à jour.');

  } catch (err) {
    console.error('Erreur:', err);
    alert('Erreur lors de la validation de la demande groupée: ' + err.message);
  }
};
// Ajoutez cette fonction dans DemandesManager.js

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
        if (demandeGroupeeInfo.destination === 'Boutique') {
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

        } else if (demandeGroupeeInfo.destination === 'Production' || demandeGroupeeInfo.destination === 'Atelier') {
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

        // 3.3 Créer un mouvement de stock pour la traçabilité
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: demande.produit_id,
            type_mouvement: 'restauration_annulation',
            quantite: demande.quantite,
            source: demandeGroupeeInfo.destination,
            destination: 'Stock Principal',
            utilisateur_id: currentUser.id,
            reference_id: demande.id,
            reference_type: 'demande_annulee',
            commentaire: `Annulation de la demande groupée #${demandeGroupeeId}`,
            raison: raison,
            created_at: new Date().toISOString()
          });

        succesRestauration.push(`${demande.produit?.nom}: ${demande.quantite} unités restaurées`);

      } catch (err) {
        console.error(`Erreur lors de la restauration de ${demande.produit?.nom}:`, err);
        erreurs.push(`${demande.produit?.nom}: ${err.message}`);
      }
    }

    // 4. Mettre à jour le statut de toutes les demandes
    await supabase
      .from('demandes')
      .update({
        statut: 'annulee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString(),
        commentaire: `Annulé par ${currentUser.nom || currentUser.username}: ${raison}`
      })
      .eq('demande_groupee_id', demandeGroupeeId);

    // 5. Mettre à jour le statut de la demande groupée
    await supabase
      .from('demandes_groupees')
      .update({
        statut: 'annulee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString(),
        details_validation: {
          annule_par: currentUser.nom || currentUser.username,
          date_annulation: new Date().toISOString(),
          raison: raison,
          restaurations: succesRestauration,
          erreurs: erreurs
        }
      })
      .eq('id', demandeGroupeeId);

    // 6. Notifier le demandeur original
    if (demandeGroupeeInfo?.demandeur_id && demandeGroupeeInfo.demandeur_id !== currentUser.id) {
      await supabase
        .from('notifications')
        .insert({
          destinataire_id: demandeGroupeeInfo.demandeur_id,
          emetteur_id: currentUser.id,
          type: 'demande_annulee',
          message: `Votre demande validée a été annulée par ${currentUser.nom || currentUser.username}`,
          details: `Raison: ${raison}\n${demandeGroupeeInfo.nombre_produits} produit(s) ont été restaurés au stock principal`,
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
  const handleRejectGroupedDemande = async (demandeGroupeeId) => {
  if (!confirm('Êtes-vous sûr de vouloir refuser toute cette demande groupée ?')) return;
  
  const raison = prompt('Raison du refus (optionnel):');
  
  try {
    // Marquer la demande groupée comme refusée
    await supabase
      .from('demandes_groupees')
      .update({
        statut: 'refusee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString()
      })
      .eq('id', demandeGroupeeId);

    // Marquer toutes les demandes comme refusées
    await supabase
      .from('demandes')
      .update({
        statut: 'refusee',
        valideur_id: currentUser.id,
        date_validation: new Date().toISOString()
      })
      .eq('demande_groupee_id', demandeGroupeeId);

    // ========== NOTIFICATION ==========
    // Récupérer les infos pour notifier
    const { data: demandeInfo } = await supabase
      .from('demandes_groupees')
      .select('demandeur_id, nombre_produits')
      .eq('id', demandeGroupeeId)
      .single();
    
    if (demandeInfo?.demandeur_id && demandeInfo.demandeur_id !== currentUser.id) {
      // Notifier le demandeur du refus
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
    // ========== FIN NOTIFICATION ==========

    await loadData();
    alert('Demande refusée. Le demandeur a été notifié.');
    
  } catch (err) {
    console.error('Erreur:', err);
    alert('Erreur lors du refus de la demande groupée');
  }
};
  const handleValidateDemande = async (demandeId) => {
    try {
      const { result, error, message } = await demandeService.validateWithBoutiqueCheck(demandeId);
      
      if (error) {
        alert('Erreur lors de la validation: ' + error);
      } else {
        await loadData();
        alert(message || 'Demande validée avec succès !');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la validation de la demande');
    }
  };

  const handleRejectDemande = async (demandeId) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser cette demande ?')) return;
    
    try {
      const { demande, error } = await demandeService.reject(demandeId);
      
      if (error) {
        alert('Erreur lors du refus: ' + error);
      } else {
        await loadData();
        alert('Demande refusée');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du refus de la demande');
    }
  };

  const getDestinationIcon = (destination) => {
    switch (destination) {
      case 'Production': return <Warehouse className="w-4 h-4" />;
      case 'Boutique': return <Store className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getDestinationColor = (destination) => {
    switch (destination) {
      case 'Production': return 'bg-blue-100 text-blue-800';
      case 'Boutique': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                              📦 Demande groupée ({demande.nombre_produits || demande.lignes?.length || 0} produits)
                            </div>
                            
                            {/* Aperçu des 3 premiers produits */}
                            <div className="text-xs text-gray-500 space-y-1 mt-1">
                              {demande.lignes && demande.lignes.slice(0, 3).map((ligne, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>• {ligne.produit?.nom}:</span>
                                  <span className="font-medium">
                                    {utils.formatNumber(ligne.quantite)} {ligne.produit?.unite?.label}
                                    {ligne.statut === 'validee' && ' ✅'}
                                    {ligne.statut === 'refusee' && ' ❌'}
                                  </span>
                                </div>
                              ))}
                              {demande.lignes && demande.lignes.length > 3 && (
                                <div className="text-blue-600 font-medium">
                                  ... et {demande.lignes.length - 3} autre(s)
                                </div>
                              )}
                            </div>
                            
                            {/* Bouton pour voir tous les détails */}
                            <button
                              onClick={() => loadGroupedDetails(demande.id)}
                              className="mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                            >
                              👁️ Voir tous les détails
                            </button>
                            
                            {/* Afficher le valideur si la demande est traitée */}
                            {demande.valideur && (
                              <div className="mt-2 text-xs text-green-600">
                                ✅ Validée par: {demande.valideur.nom}
                                {demande.date_validation && (
                                  <span className="text-gray-500 ml-2">
                                    le {new Date(demande.date_validation).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            )}
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
                              onClick={() => demande.type === 'groupee' 
                                ? handleValidateGroupedDemande(demande.id)
                                : handleValidateDemande(demande.id)
                              }
                              className="text-green-600 hover:text-green-900"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => demande.type === 'groupee'
                                ? handleRejectGroupedDemande(demande.id)
                                : handleRejectDemande(demande.id)
                              }
                              className="text-red-600 hover:text-red-900"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
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
              <div className="border rounded-lg p-4 space-y-3">
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div className="flex-1">
                      <div className="font-medium">{product.nom}</div>
                      <div className="text-xs text-gray-500">
                        Max: {product.quantite_disponible} {product.unite?.label}
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

          {/* Boutons */}
          <div className="flex space-x-4">
            <button 
              type="submit" 
              disabled={selectedProducts.length === 0}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-300"
            >
              Créer la demande
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
            {/* En-tête avec informations générales */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Demandeur</p>
                  <p className="font-medium">
                    {selectedGroupedDemande.demandeur?.nom || 'Non spécifié'}
                    <span className="text-gray-500 text-sm ml-2">
                      @{selectedGroupedDemande.demandeur?.username}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Destination</p>
                  <p className="font-medium flex items-center">
                    {selectedGroupedDemande.destination === 'Production' ? (
                      <>
                        <Factory className="w-4 h-4 mr-1 text-blue-600" />
                        Production / Atelier
                      </>
                    ) : (
                      <>
                        <Store className="w-4 h-4 mr-1 text-green-600" />
                        Boutique
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date de création</p>
                  <p className="font-medium">
                    {new Date(selectedGroupedDemande.created_at).toLocaleDateString('fr-FR')}
                    <span className="text-gray-500 text-sm ml-2">
                      {new Date(selectedGroupedDemande.created_at).toLocaleTimeString('fr-FR')}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Statut</p>
                  <StatusBadge status={selectedGroupedDemande.statut} />
                </div>
              </div>
              
              {/* Valideur si validée */}
              {selectedGroupedDemande.valideur && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Validée par</p>
                  <p className="font-medium text-green-600">
                    {selectedGroupedDemande.valideur.nom}
                    <span className="text-gray-500 text-sm ml-2">
                      le {new Date(selectedGroupedDemande.date_validation).toLocaleDateString('fr-FR')}
                      à {new Date(selectedGroupedDemande.date_validation).toLocaleTimeString('fr-FR')}
                    </span>
                  </p>
                </div>
              )}
              
              {/* Commentaire si présent */}
              {selectedGroupedDemande.commentaire && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Commentaire</p>
                  <p className="text-gray-900 italic">"{selectedGroupedDemande.commentaire}"</p>
                </div>
              )}
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {selectedGroupedDemande.stats?.total || 0}
                </p>
                <p className="text-sm text-gray-600">Produits</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {selectedGroupedDemande.stats?.validees || 0}
                </p>
                <p className="text-sm text-gray-600">Validés</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {selectedGroupedDemande.stats?.refusees || 0}
                </p>
                <p className="text-sm text-gray-600">Refusés</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {utils.formatCFA(selectedGroupedDemande.valeur_totale || 0)}
                </p>
                <p className="text-sm text-gray-600">Valeur totale</p>
              </Card>
            </div>

            {/* Liste détaillée des produits */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">
                Détail des produits ({selectedGroupedDemande.lignes?.length || 0})
              </h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité demandée</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock disponible</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valeur</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Validé par</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedGroupedDemande.lignes?.map((ligne, idx) => (
                      <tr key={idx} className={ligne.statut === 'refusee' ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-sm">
                          <div className="font-medium text-gray-900">{ligne.produit?.nom}</div>
                          <div className="text-xs text-gray-500">{ligne.produit?.unite?.label}</div>
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          {utils.formatNumber(ligne.quantite)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={ligne.produit?.quantite_restante < ligne.quantite ? 'text-red-600' : 'text-green-600'}>
                            {utils.formatNumber(ligne.produit?.quantite_restante || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {utils.formatCFA((ligne.produit?.prix_achat || 0) * ligne.quantite)}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={ligne.statut} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {ligne.valideur_ligne?.nom || '-'}
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
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fermer
              </button>
              
              {/* Si admin et demande en attente */}
              {selectedGroupedDemande.statut === 'en_attente' && 
               (currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                <>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleValidateGroupedDemande(selectedGroupedDemande.id);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Valider tout
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleRejectGroupedDemande(selectedGroupedDemande.id);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
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
