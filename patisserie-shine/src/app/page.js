// ===============================================================
// CORRECTION 1: src/app/page.js - Supprimer l'onglet Prix Vente
// ===============================================================

"use client";

import { useState, useEffect } from 'react';
import { authService, statsService } from '../lib/supabase';

// Import des composants
import LoginForm from '../components/auth/LoginForm';
import { Header, Navigation, Footer } from '../components/layout';
import Dashboard from '../components/dashboard/Dashboard';

// Import des gestionnaires
import StockManager from '../components/stock/StockManager';
import StockAtelierManager from '../components/stock/StockAtelierManager';
import StockBoutiqueManager from '../components/stock/StockBoutiqueManager';
import DemandesManager from '../components/demandes/DemandesManager';
import ProductionManager from '../components/production/ProductionManager';
import RecettesManager from '../components/production/RecettesManager';
import CaisseManager from '../components/caisse/CaisseManager';
import ComptabiliteManager from '../components/comptabilite/ComptabiliteManager';
import UnitesManager from '../components/admin/UnitesManager';
import TeamManager from '../components/admin/TeamManager';
import UserManagement from '../components/admin/UserManagement';

export default function PatisserieApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDashboardStats();
    }
  }, [currentUser]);

  const checkAuth = async () => {
    try {
      const { user, profile } = await authService.getCurrentUser();
      if (profile) {
        setCurrentUser(profile);
      }
    } catch (err) {
      console.error('Erreur authentification:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const { stats, error } = await statsService.getDashboardStats();
      if (!error) {
        setStats(stats);
      }
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  };

  const logout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setStats(null);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  };

  // Navigation tabs avec vérification des permissions (SUPPRESSION DE PRIX-VENTE)
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', adminOnly: false },
    { id: 'stock', label: 'Stock Principal', adminOnly: false },
    { id: 'stock-atelier', label: 'Stock Atelier', adminOnly: true },
    { id: 'stock-boutique', label: 'Stock Boutique', adminOnly: false },
    { id: 'recettes', label: 'Recettes', adminOnly: true },
    { id: 'demandes', label: 'Demandes', adminOnly: false },
    { id: 'production', label: 'Production', adminOnly: false },
    { id: 'caisse', label: 'Caisse', adminOnly: false },
    { id: 'comptabilite', label: 'Comptabilité', adminOnly: true },
    { id: 'unites', label: 'Unités', adminOnly: true },
    { id: 'equipe', label: 'Équipe', adminOnly: true },
    { 
      id: 'users', 
      label: 'Utilisateurs', 
      adminOnly: true, 
      proprietaireOnly: true
    }
  ];

  // Filtrer les onglets selon les permissions
  const visibleTabs = tabs.filter(tab => {
    if (!currentUser) return false;
    
    if (tab.proprietaireOnly) {
      return currentUser.role === 'admin' || currentUser.username === 'proprietaire';
    }
    return !tab.adminOnly || currentUser.role === 'admin';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl font-semibold text-gray-900">Chargement...</div>
      </div>
    );
  }

  // Si pas connecté, afficher le formulaire de connexion
  if (!currentUser) {
    return <LoginForm onLogin={setCurrentUser} />;
  }

  // Rendu du contenu selon l'onglet actif (SUPPRESSION DU CAS PRIX-VENTE)
  const renderContent = () => {
    try {
      switch (activeTab) {
        case 'dashboard':
          return <Dashboard stats={stats} loading={!stats} />;
        case 'stock':
          return <StockManager currentUser={currentUser} />;
        case 'stock-atelier':
          return currentUser.role === 'admin' ? 
            <StockAtelierManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'stock-boutique':
          return <StockBoutiqueManager currentUser={currentUser} />;
        case 'recettes':
          return currentUser.role === 'admin' ? 
            <RecettesManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'demandes':
          return <DemandesManager currentUser={currentUser} />;
        case 'production':
          return <ProductionManager currentUser={currentUser} />;
        case 'caisse':
          return <CaisseManager currentUser={currentUser} />;
        case 'comptabilite':
          return currentUser.role === 'admin' ? 
            <ComptabiliteManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'unites':
          return currentUser.role === 'admin' ? 
            <UnitesManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'equipe':
          return currentUser.role === 'admin' ? 
            <TeamManager currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        case 'users':
          return (currentUser.role === 'admin' || currentUser.username === 'proprietaire') ? 
            <UserManagement currentUser={currentUser} /> : 
            <Dashboard stats={stats} loading={!stats} />;
        default:
          return <Dashboard stats={stats} loading={!stats} />;
      }
    } catch (error) {
      console.error('Erreur lors du rendu du contenu:', error);
      return (
        <div className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <h3 className="text-lg font-medium">Erreur de chargement</h3>
            <p className="text-sm">Une erreur s'est produite lors du chargement de cette section.</p>
          </div>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="btn-primary"
          >
            Retour au tableau de bord
          </button>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        currentUser={currentUser} 
        stats={stats} 
        onLogout={logout} 
      />
      
      <Navigation 
        tabs={visibleTabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        stats={stats}
      />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
      
      <Footer />
    </div>
  );
}

// ===============================================================
// CORRECTION 2: src/lib/supabase.js - Correction des services
// ===============================================================

// Mise à jour de la méthode validateWithBoutiqueCheck dans demandeService
export const demandeService = {
  // ... autres méthodes existantes ...

  // Valider une demande avec gestion automatique des prix boutique (CORRIGÉ)
  async validateWithBoutiqueCheck(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' }
      }

      // Récupérer les informations de la demande
      const { data: demande, error: demandeError } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(
            id, nom, prix_achat,
            unite:unites(label)
          )
        `)
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .single()

      if (demandeError || !demande) {
        return { result: null, error: 'Demande introuvable ou déjà traitée' }
      }

      // Si destination = Boutique, vérifier le prix de vente
      let prixVenteDisponible = null
      if (demande.destination === 'Boutique') {
        const { data: prixVente } = await supabase
          .from('prix_vente_produits')
          .select('prix')
          .eq('produit_id', demande.produit_id)
          .eq('actif', true)
          .single()

        prixVenteDisponible = prixVente?.prix || null
      }

      // Utiliser la fonction RPC corrigée
      const { data, error } = await supabase.rpc('valider_demande_avec_boutique', {
        demande_id_input: demandeId.toString(),
        p_valideur_id: user.id,
        p_prix_vente_boutique: prixVenteDisponible
      })
      
      if (error) {
        console.error('Erreur RPC valider_demande_avec_boutique:', error)
        return { result: null, error: error.message }
      }
      
      if (!data || !data.success) {
        return { result: null, error: data?.error || 'Erreur inconnue' }
      }
      
      return { 
        result: data, 
        error: null,
        message: data.message || 'Demande validée avec succès !'
      }
    } catch (error) {
      console.error('Erreur dans validateWithBoutiqueCheck:', error)
      return { result: null, error: error.message }
    }
  },

  // ... autres méthodes existantes ...
}

// Mise à jour de productionService
export const productionService = {
  // ... autres méthodes existantes ...

  // Créer une nouvelle production (CORRIGÉ)
  async createProduction(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { production: null, error: 'Utilisateur non connecté' }
      }

      // Utiliser la fonction PostgreSQL modifiée qui :
      // 1. Déduit les ingrédients du stock atelier
      // 2. N'ajoute PAS au stock principal
      // 3. Ajoute directement au stock boutique selon la destination
      // 4. Utilise automatiquement le prix défini dans les recettes
      const { data, error } = await supabase.rpc('creer_production_nouvelle_logique', {
        p_produit: productionData.produit,
        p_quantite: productionData.quantite,
        p_destination: productionData.destination || 'Boutique',
        p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
        p_producteur_id: user.id,
        p_prix_vente: productionData.prix_vente || null // Prix manuel optionnel
      })
      
      if (error) {
        console.error('Erreur RPC create production:', error)
        return { production: null, error: error.message }
      }

      if (!data || !data.success) {
        const errorMessage = data?.error || 'Erreur inconnue lors de la création'
        console.error('Erreur création production:', errorMessage)
        return { production: null, error: errorMessage }
      }

      return { 
        production: {
          id: data.production_id,
          message: data.message
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans createProduction:', error)
      return { production: null, error: error.message }
    }
  }
}

// ===============================================================
// CORRECTION 3: StockBoutiqueManager - Utiliser la nouvelle vue
// ===============================================================

// src/components/stock/StockBoutiqueManager.js - Méthode getStockBoutique corrigée
export const stockBoutiqueService = {
  // Récupérer l'état du stock boutique avec la nouvelle vue
  async getStockBoutique() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_boutique_complet')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getStockBoutique:', error)
        return { stock: [], error: error.message }
      }
      
      // Les données sont déjà formatées par la vue
      const stockFormate = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        unite: item.unite_label,
        quantite_disponible: item.quantite_disponible || 0,
        quantite_vendue: item.quantite_vendue || 0,
        stock_reel: item.stock_reel,
        prix_vente: item.prix_vente || 0,
        valeur_stock: item.stock_reel * (item.prix_vente || 0),
        statut_stock: item.statut_stock,
        prix_defini: (item.prix_vente || 0) > 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        derniere_maj: item.updated_at
      }))
      
      return { stock: stockFormate, error: null }
    } catch (error) {
      console.error('Erreur dans getStockBoutique:', error)
      return { stock: [], error: error.message }
    }
  },

  // ... autres méthodes restent identiques ...
}

// ===============================================================
// CORRECTION 4: Suppression du composant PrixVenteManager
// ===============================================================

// SUPPRIMER COMPLÈTEMENT LE FICHIER : src/components/caisse/PrixVenteManager.js
// IL N'EST PLUS NÉCESSAIRE

// ===============================================================
// CORRECTION 5: Mise à jour du ProductionManager
// ===============================================================

// src/components/production/ProductionManager.js - Section prix de vente mise à jour
// Dans le modal de création, remplacer la section prix de vente par :

{/* Section information sur le prix automatique */}
{formData.destination === 'Boutique' && recetteInfo && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
    <h4 className="font-medium text-green-800 mb-3 flex items-center">
      <Store className="w-5 h-5 mr-2" />
      Configuration Boutique - Prix Automatique
    </h4>
    <div className="space-y-3">
      <div className="text-sm text-green-700">
        <p className="font-medium">✓ Le prix de vente sera appliqué automatiquement :</p>
        <div className="mt-2 p-3 bg-white border border-green-300 rounded">
          <PrixRecettePreview nomProduit={formData.produit} />
        </div>
      </div>
      
      {/* Option prix manuel optionnel */}
      <div className="border-t pt-3">
        <div className="flex items-center space-x-3 mb-2">
          <input
            type="checkbox"
            id="prix_manuel"
            checked={formData.prix_manuel}
            onChange={(e) => setFormData({...formData, prix_manuel: e.target.checked, prix_vente: e.target.checked ? formData.prix_vente : ''})}
            className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
          />
          <label htmlFor="prix_manuel" className="text-sm font-medium text-green-700">
            Surcharger avec un prix manuel pour cette production
          </label>
        </div>

        {formData.prix_manuel && (
          <input
            type="number"
            step="25"
            min="0"
            value={formData.prix_vente}
            onChange={(e) => setFormData({...formData, prix_vente: e.target.value})}
            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Prix de vente manuel"
            disabled={submitting}
          />
        )}
      </div>
    </div>
    
    <div className="mt-3 text-xs text-green-700">
      ℹ️ Le produit sera ajouté directement au stock boutique avec le prix défini
      <br />
      📋 Si aucun prix n'est défini dans les recettes, vous pouvez en définir un manuellement
    </div>
  </div>
)}

// ===============================================================
// CORRECTION 6: Composant PrixRecettePreview
// ===============================================================

// Ajouter ce nouveau composant dans ProductionManager.js
function PrixRecettePreview({ nomProduit }) {
  const [prixRecette, setPrixRecette] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (nomProduit) {
      loadPrixRecette();
    } else {
      setPrixRecette(null);
      setLoading(false);
    }
  }, [nomProduit]);

  const loadPrixRecette = async () => {
    try {
      const { data } = await supabase
        .from('prix_vente_recettes')
        .select('prix_vente')
        .eq('nom_produit', nomProduit)
        .eq('actif', true)
        .single();
      
      setPrixRecette(data?.prix_vente || null);
    } catch {
      setPrixRecette(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-green-600">Chargement du prix...</div>;
  }

  if (prixRecette) {
    return (
      <div className="text-sm">
        <div className="flex items-center text-green-700">
          <DollarSign className="w-4 h-4 mr-1" />
          <strong>Prix défini dans la recette: {utils.formatCFA(prixRecette)}</strong>
        </div>
        <div className="text-xs text-green-600 mt-1">
          ✓ Ce prix sera appliqué automatiquement au stock boutique
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="flex items-center text-yellow-700">
        <AlertTriangle className="w-4 h-4 mr-1" />
        <strong>Aucun prix défini pour cette recette</strong>
      </div>
      <div className="text-xs text-yellow-600 mt-1">
        ⚠️ Le produit sera ajouté à la boutique SANS prix de vente
        <br />
        💡 Définissez un prix dans l'onglet "Recettes" ou utilisez le prix manuel ci-dessous
      </div>
    </div>
  );
}

// ===============================================================
// CORRECTION 7: Mise à jour de la navigation
// ===============================================================

// src/components/layout/index.js - Supprimer l'icône prix-vente
const tabIcons = {
  dashboard: Home,
  stock: Package,
  'stock-atelier': Warehouse,
  'stock-boutique': Store,
  recettes: Calculator,
  demandes: ShoppingCart,
  production: ChefHat,
  caisse: CreditCard,
  // SUPPRIMER: 'prix-vente': CreditCard,
  comptabilite: BarChart3,
  unites: Calculator,
  equipe: Users,
  users: UserPlus
};

// ===============================================================
// CORRECTION 8: Message informatif dans les recettes
// ===============================================================

// Dans RecettesManager.js, ajouter ce message en haut :
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
  <div className="flex items-start">
    <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
    <div className="text-blue-800">
      <h4 className="font-medium mb-1">💡 Système de prix intégré</h4>
      <p className="text-sm">
        <strong>Les prix de vente sont maintenant gérés directement dans les recettes !</strong><br/>
        ✅ Définissez le prix lors de la création de recette<br/>
        🏭 Les productions utilisent automatiquement ce prix pour la boutique<br/>
        📦 Les demandes vers "Boutique" appliquent automatiquement le prix du stock principal<br/>
        🎯 Plus besoin d'onglet "Prix Vente" séparé !
      </p>
    </div>
  </div>
</div>
