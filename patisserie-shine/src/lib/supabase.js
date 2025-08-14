// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine (Version mise à jour)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  // Connexion par email
  async signInWithUsername(username, password) {
    try {
      // Conversion username vers email pour Supabase Auth
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('Erreur d\'authentification:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur profil:', profileError)
        return { user: data.user, profile: null, error: profileError.message }
      }
      
      return { user: data.user, profile, error: null }
    } catch (error) {
      console.error('Erreur dans signInWithUsername:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Déconnexion
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      return { error: error.message }
    }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Erreur getCurrentUser:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          console.error('Erreur profil getCurrentUser:', profileError)
          return { user, profile: null, error: profileError.message }
        }
        
        return { user, profile, error: null }
      }
      
      return { user: null, profile: null, error: null }
    } catch (error) {
      console.error('Erreur dans getCurrentUser:', error)
      return { user: null, profile: null, error: error.message }
    }
  }
}

// ===================== SERVICES PRODUITS =====================
export const productService = {
  // Récupérer tous les produits
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label),
          created_by_profile:profiles!produits_created_by_fkey(nom)
        `)
        .order('nom')
      
      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
      return { products: [], error: error.message }
    }
  },

  // Créer un nouveau produit
  async create(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite, // Initialement égal à la quantité
          unite_id: productData.unite_id,
          created_by: user?.id
        })
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur create produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans create produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Mettre à jour un produit
  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite_restante,
          unite_id: productData.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Obtenir les produits en stock faible
  async getLowStock() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_faible')
        .select('*')
        .order('pourcentage_restant')
      
      if (error) {
        console.error('Erreur getLowStock:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getLowStock:', error)
      return { products: [], error: error.message }
    }
  }
}

// ===================== SERVICES DEMANDES =====================
export const demandeService = {
  // Récupérer toutes les demandes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll demandes:', error)
        return { demandes: [], error: error.message }
      }
      
      return { demandes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll demandes:', error)
      return { demandes: [], error: error.message }
    }
  },

  // Créer une nouvelle demande
  async create(demandeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .insert({
          produit_id: demandeData.produit_id,
          quantite: demandeData.quantite,
          destination: demandeData.destination,
          demandeur_id: user?.id
        })
        .select(`
          *,
          produit:produits(nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom)
        `)
        .single()
      
      if (error) {
        console.error('Erreur create demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans create demande:', error)
      return { demande: null, error: error.message }
    }
  },

  // Valider une demande
  async validate(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase.rpc('valider_demande', {
        demande_id: demandeId,
        valideur_id: user?.id
      })
      
      if (error) {
        console.error('Erreur validate demande:', error)
        return { result: null, error: error.message }
      }
      
      return { result: data, error: null }
    } catch (error) {
      console.error('Erreur dans validate demande:', error)
      return { result: null, error: error.message }
    }
  },

  // Refuser une demande
  async reject(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: user?.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .select()
        .single()
      
      if (error) {
        console.error('Erreur reject demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans reject demande:', error)
      return { demande: null, error: error.message }
    }
  }
}

// ===================== SERVICES PRODUCTION =====================
export const productionService = {
  // Récupérer toutes les productions
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll productions:', error)
        return { productions: [], error: error.message }
      }
      
      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll productions:', error)
      return { productions: [], error: error.message }
    }
  },

  // Créer une nouvelle production
  async create(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('productions')
        .insert({
          produit: productionData.produit,
          quantite: productionData.quantite,
          destination: productionData.destination || 'Boutique',
          date_production: productionData.date_production || new Date().toISOString().split('T')[0],
          statut: productionData.statut || 'termine',
          producteur_id: user?.id
        })
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .single()
      
      if (error) {
        console.error('Erreur create production:', error)
        return { production: null, error: error.message }
      }
      
      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans create production:', error)
      return { production: null, error: error.message }
    }
  },

  // Mettre à jour une production
  async update(productionId, updates) {
    try {
      const { data, error } = await supabase
        .from('productions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionId)
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update production:', error)
        return { production: null, error: error.message }
      }
      
      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans update production:', error)
      return { production: null, error: error.message }
    }
  }
}

// ===================== SERVICES UTILISATEURS =====================
export const userService = {
  // Récupérer tous les utilisateurs
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll users:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll users:', error)
      return { users: [], error: error.message }
    }
  },

  // Mettre à jour un profil utilisateur
  async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Erreur updateProfile:', error)
        return { user: null, error: error.message }
      }
      
      return { user: data, error: null }
    } catch (error) {
      console.error('Erreur dans updateProfile:', error)
      return { user: null, error: error.message }
    }
  }
}

// ===================== SERVICES UNITÉS =====================
export const uniteService = {
  // Récupérer toutes les unités
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('unites')
        .select('*')
        .order('label')
      
      if (error) {
        console.error('Erreur getAll unites:', error)
        return { unites: [], error: error.message }
      }
      
      return { unites: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll unites:', error)
      return { unites: [], error: error.message }
    }
  }
}

// ===================== SERVICES STATISTIQUES =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      // Récupérer les statistiques depuis différentes tables
      const [
        { data: produits, error: produitsError },
        { data: demandes, error: demandesError },
        { data: productions, error: productionsError },
        { data: profiles, error: profilesError },
        { data: stockFaible, error: stockFaibleError }
      ] = await Promise.all([
        supabase.from('produits').select('id'),
        supabase.from('demandes').select('id').eq('statut', 'en_attente'),
        supabase.from('productions').select('id').eq('date_production', new Date().toISOString().split('T')[0]),
        supabase.from('profiles').select('id'),
        supabase.from('vue_stock_faible').select('id')
      ])

      if (produitsError || demandesError || productionsError || profilesError || stockFaibleError) {
        console.error('Erreur lors du chargement des statistiques')
        return { stats: null, error: 'Erreur lors du chargement des statistiques' }
      }

      const stats = {
        total_produits: produits?.length || 0,
        demandes_en_attente: demandes?.length || 0,
        productions_jour: productions?.length || 0,
        utilisateurs_actifs: profiles?.length || 0,
        produits_stock_critique: stockFaible?.length || 0
      }

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error)
      return { stats: null, error: error.message }
    }
  },

  // Obtenir les mouvements de stock récents
  async getRecentMovements(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom),
          utilisateur:profiles(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getRecentMovements:', error)
        return { movements: [], error: error.message }
      }
      
      return { movements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getRecentMovements:', error)
      return { movements: [], error: error.message }
    }
  }
}

// ===================== UTILITAIRES =====================
export const utils = {
  // Formatage de la monnaie CFA
  formatCFA(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount || 0)
  },

  // Formatage de la date
  formatDate(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  // Formatage de la date et heure
  formatDateTime(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  // Calculer le pourcentage de stock restant
  calculateStockPercentage(quantiteRestante, quantiteInitiale) {
    if (quantiteInitiale === 0) return 0
    return Math.round((quantiteRestante / quantiteInitiale) * 100)
  },

  // Déterminer le niveau d'alerte stock
  getStockAlertLevel(quantiteRestante, quantiteInitiale) {
    const percentage = this.calculateStockPercentage(quantiteRestante, quantiteInitiale)
    if (percentage <= 0) return 'rupture'
    if (percentage <= 20) return 'critique'
    if (percentage <= 50) return 'faible'
    return 'normal'
  },

  // Formater un nombre avec séparateurs
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  }
},
// ==========================================
// SERVICES POUR STOCK ATELIER
// ==========================================

// Ajouter dans lib/supabase.js
export const stockAtelierService = {
  // Récupérer le stock atelier
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_atelier')
        .select('*')
        .order('nom');
      
      if (error) {
        console.error('Erreur getStockAtelier:', error);
        return { stock: [], error: error.message };
      }
      
      return { stock: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error);
      return { stock: [], error: error.message };
    }
  },

  // Transférer vers l'atelier
  async transfererVersAtelier(produitId, quantite) {
    try {
      const { data, error } = await supabase.rpc('transferer_vers_atelier', {
        p_produit_id: produitId,
        p_quantite: quantite,
        p_transfere_par: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Erreur transfert:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur dans transfererVersAtelier:', error);
      return { success: false, error: error.message };
    }
  }
};

export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('vue_recettes_cout')
        .select('*')
        .order('nom_produit', 'ingredient_nom');
      
      if (error) {
        console.error('Erreur getAll recettes:', error);
        return { recettes: [], error: error.message };
      }
      
      return { recettes: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error);
      return { recettes: [], error: error.message };
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .insert({
          nom_produit: recetteData.nom_produit,
          produit_ingredient_id: recetteData.produit_ingredient_id,
          quantite_necessaire: recetteData.quantite_necessaire,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur create recette:', error);
        return { recette: null, error: error.message };
      }

      return { recette: data, error: null };
    } catch (error) {
      console.error('Erreur dans create recette:', error);
      return { recette: null, error: error.message };
    }
  },

  // Calculer stock nécessaire
  async calculerStockNecessaire(nomProduit, quantite) {
    try {
      const { data, error } = await supabase.rpc('calculer_stock_necessaire', {
        p_nom_produit: nomProduit,
        p_quantite_a_produire: quantite
      });

      if (error) {
        console.error('Erreur calcul stock:', error);
        return { besoins: [], error: error.message };
      }

      return { besoins: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans calculerStockNecessaire:', error);
      return { besoins: [], error: error.message };
    }
  }
};

// ==========================================
// COMPOSANT STOCK ATELIER
// ==========================================

const StockAtelierManager = ({ currentUser }) => {
  const [stockAtelier, setStockAtelier] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    produit_id: '',
    quantite: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, productsResult] = await Promise.all([
        stockAtelierService.getStockAtelier(),
        productService.getAll()
      ]);

      if (stockResult.error) {
        console.error('Erreur stock atelier:', stockResult.error);
      } else {
        setStockAtelier(stockResult.stock);
      }

      if (productsResult.error) {
        console.error('Erreur produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      const { success, error } = await stockAtelierService.transfererVersAtelier(
        parseInt(transferData.produit_id),
        parseFloat(transferData.quantite)
      );

      if (error) {
        alert('Erreur lors du transfert: ' + error);
      } else {
        await loadData();
        setTransferData({ produit_id: '', quantite: '' });
        setShowTransferModal(false);
        alert('Transfert effectué avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du transfert');
    }
  };

  const statsAtelier = {
    totalArticles: stockAtelier.length,
    articlesDisponibles: stockAtelier.filter(s => s.niveau_alerte === 'normal').length,
    articlesCritiques: stockAtelier.filter(s => s.niveau_alerte === 'critique' || s.niveau_alerte === 'rupture').length,
    valeurTotale: stockAtelier.reduce((sum, s) => sum + (s.quantite_libre * 10), 0) // estimation
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Atelier</h2>
          <p className="text-gray-600">Gestion des matières premières dans l'atelier</p>
        </div>
        <button 
          onClick={() => setShowTransferModal(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
        >
          <ArrowRightLeft className="h-5 w-5" />
          <span>Transférer vers Atelier</span>
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Articles en Stock"
          value={statsAtelier.totalArticles}
          icon={Warehouse}
          color="blue"
        />
        <StatCard
          title="Disponibles"
          value={statsAtelier.articlesDisponibles}
          icon={ShoppingBasket}
          color="green"
        />
        <StatCard
          title="En Alerte"
          value={statsAtelier.articlesCritiques}
          icon={AlertTriangle}
          color={statsAtelier.articlesCritiques > 0 ? "red" : "green"}
        />
        <StatCard
          title="Valeur Estimée"
          value={utils.formatCFA(statsAtelier.valeurTotale)}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* Liste du stock */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Article</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Disponible</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Réservé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Libre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière MAJ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockAtelier.map((stock) => (
                <tr key={stock.id} className={stock.niveau_alerte === 'critique' || stock.niveau_alerte === 'rupture' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        stock.niveau_alerte === 'rupture' ? 'bg-red-600' :
                        stock.niveau_alerte === 'critique' ? 'bg-red-500' :
                        stock.niveau_alerte === 'faible' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{stock.nom}</div>
                        <div className="text-sm text-gray-500">{stock.unite_label}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stock.quantite_disponible} {stock.unite_value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stock.quantite_reservee} {stock.unite_value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      stock.quantite_libre <= 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {stock.quantite_libre} {stock.unite_value}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={stock.niveau_alerte} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {utils.formatDateTime(stock.derniere_maj)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Transfert */}
      <Modal 
        isOpen={showTransferModal} 
        onClose={() => setShowTransferModal(false)} 
        title="Transférer vers l'Atelier" 
        size="md"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Produit à transférer *</label>
            <select
              value={transferData.produit_id}
              onChange={(e) => setTransferData({...transferData, produit_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un produit</option>
              {products.filter(p => p.quantite_restante > 0).map(product => (
                <option key={product.id} value={product.id}>
                  {product.nom} ({product.quantite_restante} {product.unite?.value} disponibles)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité à transférer *</label>
            <input
              type="number"
              step="0.01"
              value={transferData.quantite}
              onChange={(e) => setTransferData({...transferData, quantite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10"
              required
            />
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <p className="text-sm text-blue-800">
              <strong>Note :</strong> Cette action va déduire la quantité du stock principal et l'ajouter au stock atelier.
            </p>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200">
              Effectuer le transfert
            </button>
            <button 
              type="button" 
              onClick={() => setShowTransferModal(false)}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ==========================================
// COMPOSANT RECETTES
// ==========================================

const RecettesManager = ({ currentUser }) => {
  const [recettes, setRecettes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalculModal, setShowCalculModal] = useState(false);
  const [calculData, setCalculData] = useState({
    nom_produit: '',
    quantite: ''
  });
  const [besoins, setBesoins] = useState([]);
  const [formData, setFormData] = useState({
    nom_produit: '',
    produit_ingredient_id: '',
    quantite_necessaire: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recettesResult, productsResult] = await Promise.all([
        recetteService.getAll(),
        productService.getAll()
      ]);

      if (recettesResult.error) {
        console.error('Erreur recettes:', recettesResult.error);
      } else {
        setRecettes(recettesResult.recettes);
      }

      if (productsResult.error) {
        console.error('Erreur produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecette = async (e) => {
    e.preventDefault();
    try {
      const { recette, error } = await recetteService.create({
        nom_produit: formData.nom_produit,
        produit_ingredient_id: parseInt(formData.produit_ingredient_id),
        quantite_necessaire: parseFloat(formData.quantite_necessaire)
      });

      if (error) {
        alert('Erreur lors de la création: ' + error);
      } else {
        await loadData();
        setFormData({ nom_produit: '', produit_ingredient_id: '', quantite_necessaire: '' });
        setShowAddModal(false);
        alert('Ingrédient ajouté à la recette');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création');
    }
  };

  const handleCalculBesoins = async (e) => {
    e.preventDefault();
    try {
      const { besoins, error } = await recetteService.calculerStockNecessaire(
        calculData.nom_produit,
        parseFloat(calculData.quantite)
      );

      if (error) {
        alert('Erreur lors du calcul: ' + error);
      } else {
        setBesoins(besoins);
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du calcul');
    }
  };

  // Grouper les recettes par produit
  const recettesGroupees = recettes.reduce((acc, recette) => {
    if (!acc[recette.nom_produit]) {
      acc[recette.nom_produit] = [];
    }
    acc[recette.nom_produit].push(recette);
    return acc;
  }, {});

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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recettes de Production</h2>
          <p className="text-gray-600">Gestion des ingrédients nécessaires pour chaque produit</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowCalculModal(true)}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Calculator className="h-5 w-5" />
            <span>Calculer Besoins</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvel Ingrédient</span>
          </button>
        </div>
      </div>

      {/* Liste des recettes par produit */}
      <div className="space-y-6">
        {Object.entries(recettesGroupees).map(([nomProduit, ingredients]) => {
          const coutTotal = ingredients.reduce((sum, ing) => sum + (ing.cout_ingredient || 0), 0);
          const peutProduire = ingredients.every(ing => ing.ingredient_disponible);
          
          return (
            <Card key={nomProduit} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <ChefHat className="h-6 w-6 mr-2 text-orange-500" />
                    {nomProduit}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Coût total: {utils.formatCFA(coutTotal)} • 
                    <span className={peutProduire ? 'text-green-600' : 'text-red-600'}>
                      {peutProduire ? ' ✓ Peut être produit' : ' ✗ Ingrédients manquants'}
                    </span>
                  </p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  peutProduire ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock Atelier</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coût</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ingredients.map((ingredient) => (
                      <tr key={ingredient.recette_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {ingredient.ingredient_nom}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {ingredient.quantite_necessaire} {ingredient.unite}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {ingredient.stock_atelier_disponible || 0} {ingredient.unite}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {utils.formatCFA(ingredient.cout_ingredient || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ingredient.ingredient_disponible 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ingredient.ingredient_disponible ? '✓ Disponible' : '✗ Insuffisant'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal Nouvel Ingrédient */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Ajouter un Ingrédient à la Recette" 
        size="md"
      >
        <form onSubmit={handleAddRecette} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit fini *</label>
            <input
              type="text"
              value={formData.nom_produit}
              onChange={(e) => setFormData({...formData, nom_produit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ingrédient *</label>
            <select
              value={formData.produit_ingredient_id}
              onChange={(e) => setFormData({...formData, produit_ingredient_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un ingrédient</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nom} ({product.unite?.label})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité nécessaire *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite_necessaire}
              onChange={(e) => setFormData({...formData, quantite_necessaire: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.5"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Quantité nécessaire pour produire 1 unité du produit fini</p>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Ajouter l'ingrédient
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Calcul Besoins */}
      <Modal 
        isOpen={showCalculModal} 
        onClose={() => setShowCalculModal(false)} 
        title="Calculer les Besoins de Production" 
        size="lg"
      >
        <form onSubmit={handleCalculBesoins} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Produit à fabriquer *</label>
              <input
                type="text"
                value={calculData.nom_produit}
                onChange={(e) => setCalculData({...calculData, nom_produit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Croissants au Beurre"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité à produire *</label>
              <input
                type="number"
                step="0.01"
                value={calculData.quantite}
                onChange={(e) => setCalculData({...calculData, quantite: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="50"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200">
            Calculer les besoins
          </button>
        </form>

        {besoins.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-4">Besoins calculés :</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ingrédient</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nécessaire</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Disponible</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Manquant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {besoins.map((besoin, index) => (
                    <tr key={index} className={besoin.quantite_manquante > 0 ? 'bg-red-50' : 'bg-green-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {besoin.ingredient_nom}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_necessaire} {besoin.unite}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_disponible} {besoin.unite}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {besoin.quantite_manquante} {besoin.unite}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          besoin.quantite_manquante === 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {besoin.quantite_manquante === 0 ? '✓ OK' : '✗ Insuffisant'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default supabase

