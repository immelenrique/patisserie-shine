import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Package, TrendingUp, Bell, Check, X, Plus, 
  LogOut, AlertTriangle, Search, Calendar, Clock, Star, 
  ChefHat, Menu, Cake, Eye, Trash2, Send, FileText, Store, 
  Factory, Scale, Target, Calculator, DollarSign, Truck,
  ClipboardCheck, BarChart3, Users, Settings
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ===================== SERVICES =====================
const authService = {
  async signIn(username, password) {
    try {
      const email = `${username}@shine.local`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      return { user, error };
    } catch (error) {
      return { user: null, error: error.message };
    }
  },

  async getProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return { profile: data, error };
    } catch (error) {
      return { profile: null, error: error.message };
    }
  }
};

const dataService = {
  // Produits
  async getProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    return { data: data || [], error };
  },

  async updateProductStock(productId, newStock) {
    const { data, error } = await supabase
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();
    return { data, error };
  },

  // Achats
  async getPurchases() {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        items:purchase_items(*)
      `)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  async createPurchase(purchaseData, items) {
    try {
      // Créer l'achat
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert(purchaseData)
        .select()
        .single();
      
      if (purchaseError) throw purchaseError;

      // Ajouter les items
      const itemsToInsert = items.map(item => ({
        ...item,
        purchase_id: purchase.id
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
      
      return { data: purchase, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  async receivePurchase(purchaseId, receivedItems) {
    try {
      // Mettre à jour les quantités reçues
      for (const item of receivedItems) {
        await supabase
          .from('purchase_items')
          .update({ quantity_received: item.quantity_received })
          .eq('id', item.id);
      }

      // Marquer l'achat comme reçu
      const { data, error } = await supabase
        .from('purchases')
        .update({ 
          status: 'received',
          delivery_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  // Demandes de stock
  async getStockRequests() {
    const { data, error } = await supabase
      .from('stock_requests')
      .select(`
        *,
        items:stock_request_items(*)
      `)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  async createStockRequest(requestData, items) {
    try {
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .insert(requestData)
        .select()
        .single();

      if (requestError) throw requestError;

      const itemsToInsert = items.map(item => ({
        ...item,
        request_id: request.id
      }));

      const { error: itemsError } = await supabase
        .from('stock_request_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
      
      return { data: request, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  async validateStockRequest(requestId, status, validatedBy, validatedByName, approvedQuantities = {}) {
    try {
      // Mettre à jour la demande
      const { data: request, error: requestError } = await supabase
        .from('stock_requests')
        .update({
          status,
          validated_by: validatedBy,
          validated_by_name: validatedByName,
          validated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (requestError) throw requestError;

      // Si approuvé, mettre à jour les quantités et déduire du stock
      if (status === 'approved') {
        for (const [itemId, approvedQty] of Object.entries(approvedQuantities)) {
          await supabase
            .from('stock_request_items')
            .update({ quantity_approved: approvedQty })
            .eq('id', itemId);
        }
      }

      return { data: request, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  // Recettes
  async getRecipes() {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients:recipe_ingredients(*)
      `)
      .eq('is_active', true)
      .order('name');
    return { data: data || [], error };
  },

  async createRecipe(recipeData, ingredients) {
    try {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipeData)
        .select()
        .single();

      if (recipeError) throw recipeError;

      const ingredientsToInsert = ingredients.map(ing => ({
        ...ing,
        recipe_id: recipe.id
      }));

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientsToInsert);

      if (ingredientsError) throw ingredientsError;
      
      return { data: recipe, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  },

  // Production
  async getProductionBatches() {
    const { data, error } = await supabase
      .from('production_batches')
      .select('*')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  async createProductionBatch(batchData) {
    const { data, error } = await supabase
      .from('production_batches')
      .insert(batchData)
      .select()
      .single();
    return { data, error };
  },

  async recordProductionUsage(batchId, ingredientUsage) {
    const usageToInsert = ingredientUsage.map(usage => ({
      ...usage,
      batch_id: batchId
    }));

    const { data, error } = await supabase
      .from('production_ingredient_usage')
      .insert(usageToInsert);
    return { data, error };
  },

  // Produits finis
  async getFinishedProducts() {
    const { data, error } = await supabase
      .from('finished_products_journal')
      .select('*')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  async createFinishedProduct(productData) {
    const { data, error } = await supabase
      .from('finished_products_journal')
      .insert(productData)
      .select()
      .single();
    return { data, error };
  },

  // Analyses
  async getStockAnalysis() {
    const { data, error } = await supabase
      .from('stock_analysis')
      .select('*')
      .order('name');
    return { data: data || [], error };
  }
};

// ===================== HOOKS =====================
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const { user: currentUser } = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        const { profile } = await authService.getProfile(currentUser.id);
        setProfile(profile);
      }
    } catch (error) {
      console.error('Erreur authentification:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username, password) => {
    const { data, error } = await authService.signIn(username, password);
    if (!error) {
      await initializeAuth();
    }
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signIn, signOut };
};

const useData = () => {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stockRequests, setStockRequests] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [productionBatches, setProductionBatches] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [stockAnalysis, setStockAnalysis] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        productsRes,
        purchasesRes,
        requestsRes,
        recipesRes,
        batchesRes,
        finishedRes,
        analysisRes
      ] = await Promise.all([
        dataService.getProducts(),
        dataService.getPurchases(),
        dataService.getStockRequests(),
        dataService.getRecipes(),
        dataService.getProductionBatches(),
        dataService.getFinishedProducts(),
        dataService.getStockAnalysis()
      ]);

      setProducts(productsRes.data);
      setPurchases(purchasesRes.data);
      setStockRequests(requestsRes.data);
      setRecipes(recipesRes.data);
      setProductionBatches(batchesRes.data);
      setFinishedProducts(finishedRes.data);
      setStockAnalysis(analysisRes.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    products, setProducts,
    purchases, setPurchases,
    stockRequests, setStockRequests,
    recipes, setRecipes,
    productionBatches, setProductionBatches,
    finishedProducts, setFinishedProducts,
    stockAnalysis, setStockAnalysis,
    loading,
    loadAllData
  };
};

// ===================== COMPOSANTS UI =====================
const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-600 text-white',
    secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-orange-500 hover:bg-orange-600 text-white'
  };

  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ type = 'text', placeholder, value, onChange, className = '', ...props }) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all ${className}`}
    {...props}
  />
);

const Select = ({ value, onChange, children, className = '', ...props }) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Badge = ({ children, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800'
  };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${variants[variant]}`}>
      {children}
    </span>
  );
};

// ===================== COMPOSANTS PRINCIPAUX =====================

const LoginForm = ({ onLogin, error, loading }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🧁</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pâtisserie Shine</h1>
          <p className="text-gray-600 text-sm">Gestion Achats & Production</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center text-sm">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
        
        <div className="space-y-5">
          <Input
            placeholder="Nom d'utilisateur"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            onKeyPress={(e) => e.key === 'Enter' && onLogin(credentials.username, credentials.password)}
            disabled={loading}
          />
          
          <Input
            type="password"
            placeholder="Mot de passe"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            onKeyPress={(e) => e.key === 'Enter' && onLogin(credentials.username, credentials.password)}
            disabled={loading}
          />
          
          <Button
            onClick={() => onLogin(credentials.username, credentials.password)}
            disabled={loading}
            className="w-full py-4"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-amber-50 rounded-xl">
          <p className="text-xs text-amber-700">
            Demo: proprietaire / admin123
          </p>
        </div>
      </Card>
    </div>
  );
};

const Dashboard = ({ data, profile }) => {
  const { products, purchases, stockRequests, stockAnalysis } = data;
  
  const stats = {
    productsCount: products.length,
    lowStockCount: stockAnalysis.filter(p => p.stock_status === 'critical').length,
    pendingPurchases: purchases.filter(p => p.status === 'pending').length,
    pendingRequests: stockRequests.filter(r => r.status === 'pending').length,
    monthlyPurchaseValue: purchases
      .filter(p => new Date(p.created_at).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + (p.total_amount || 0), 0)
  };

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Tableau de bord</h1>
        <p className="text-gray-600 text-sm">Bienvenue {profile?.full_name} - Suivi complet</p>
      </div>
      
      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card className="p-4 bg-blue-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-800">{stats.productsCount}</div>
            <div className="text-sm text-blue-600">Produits</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-red-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-800">{stats.lowStockCount}</div>
            <div className="text-sm text-red-600">Alertes Stock</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-orange-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-800">{stats.pendingPurchases}</div>
            <div className="text-sm text-orange-600">Achats en cours</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-purple-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-800">{stats.pendingRequests}</div>
            <div className="text-sm text-purple-600">Demandes</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-green-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-800">
              {Math.round(stats.monthlyPurchaseValue / 1000)}K
            </div>
            <div className="text-sm text-green-600">Achats mois (CFA)</div>
          </div>
        </Card>
      </div>

      {/* Alertes critiques */}
      {stats.lowStockCount > 0 && (
        <Card className="border-l-4 border-red-400 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-800">Stock Critique</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockAnalysis
              .filter(p => p.stock_status === 'critical')
              .slice(0, 6)
              .map(product => (
                <div key={product.id} className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-medium text-red-900">{product.name}</h4>
                  <p className="text-sm text-red-700">
                    Stock: {product.current_stock} {product.unit} 
                    (Min: {product.min_stock})
                  </p>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Demandes en attente */}
      {stats.pendingRequests > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Demandes en attente ({stats.pendingRequests})
          </h3>
          <div className="space-y-3">
            {stockRequests
              .filter(r => r.status === 'pending')
              .slice(0, 5)
              .map(request => (
                <div key={request.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium">{request.employee_name}</p>
                    <p className="text-sm text-gray-600">
                      {request.destination} • {request.items?.length || 0} produits
                    </p>
                  </div>
                  <Badge variant="warning">{request.urgency}</Badge>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const PurchaseManagement = ({ data, onNotification, onReload }) => {
  const { products, purchases } = data;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  
  const [newPurchase, setNewPurchase] = useState({
    supplier: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity_ordered: '',
    unit_price: ''
  });

  const addItemToPurchase = () => {
    if (!newItem.product_id || !newItem.quantity_ordered || !newItem.unit_price) {
      onNotification('error', 'Tous les champs sont requis');
      return;
    }

    const product = products.find(p => p.id === newItem.product_id);
    if (!product) return;

    const item = {
      product_id: product.id,
      product_name: product.name,
      quantity_ordered: parseFloat(newItem.quantity_ordered),
      unit_price: parseFloat(newItem.unit_price),
      unit: product.unit,
      tempId: Date.now()
    };

    setNewPurchase(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    setNewItem({ product_id: '', quantity_ordered: '', unit_price: '' });
  };

  const createPurchase = async () => {
    if (!newPurchase.supplier || newPurchase.items.length === 0) {
      onNotification('error', 'Fournisseur et au moins un produit requis');
      return;
    }

    try {
      const purchaseData = {
        purchase_number: `ACH-${Date.now()}`,
        supplier: newPurchase.supplier,
        purchase_date: newPurchase.purchase_date,
        total_amount: newPurchase.items.reduce((sum, item) => 
          sum + (item.quantity_ordered * item.unit_price), 0),
        notes: newPurchase.notes,
        created_by: 'current-user-id', // À remplacer par l'ID réel
        created_by_name: 'Utilisateur' // À remplacer par le nom réel
      };

      const { error } = await dataService.createPurchase(purchaseData, newPurchase.items);
      
      if (error) {
        onNotification('error', error);
      } else {
        onNotification('success', 'Commande créée avec succès');
        setShowCreateForm(false);
        setNewPurchase({ supplier: '', purchase_date: new Date().toISOString().split('T')[0], notes: '', items: [] });
        onReload();
      }
    } catch (error) {
      onNotification('error', 'Erreur lors de la création');
    }
  };

  const receivePurchase = async (receivedItems) => {
    if (!selectedPurchase) return;

    try {
      const { error } = await dataService.receivePurchase(selectedPurchase.id, receivedItems);
      
      if (error) {
        onNotification('error', error);
      } else {
        onNotification('success', 'Réception enregistrée avec succès');
        setShowReceiveModal(false);
        setSelectedPurchase(null);
        onReload();
      }
    } catch (error) {
      onNotification('error', 'Erreur lors de la réception');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <ShoppingCart className="h-6 w-6 mr-3 text-blue-600" />
            Gestion des Achats
          </h2>
          <p className="text-gray-600 text-sm">
            {purchases.length} commande{purchases.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Commande
        </Button>
      </div>

      {/* Liste des achats */}
      <div className="space-y-4">
        {purchases.map(purchase => (
          <Card key={purchase.id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Truck className="h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-semibold">{purchase.purchase_number}</h3>
                  <Badge variant={
                    purchase.status === 'received' ? 'success' : 
                    purchase.status === 'pending' ? 'warning' : 'danger'
                  }>
                    {purchase.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Fournisseur:</strong> {purchase.supplier}
                  </div>
                  <div>
                    <strong>Date:</strong> {new Date(purchase.purchase_date).toLocaleDateString('fr-FR')}
                  </div>
                  <div>
                    <strong>Montant:</strong> {purchase.total_amount?.toLocaleString()} CFA
                  </div>
                  <div>
                    <strong>Articles:</strong> {purchase.items?.length || 0}
                  </div>
                </div>
                
                {purchase.notes && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    {purchase.notes}
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                {purchase.status === 'pending' && (
                  <Button 
                    onClick={() => {
                      setSelectedPurchase(purchase);
                      setShowReceiveModal(true);
                    }}
                    variant="success" 
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Réceptionner
                  </Button>
                )}
                
                <Button variant="secondary" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Détails
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal création commande */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Nouvelle commande d'achat</h3>
                <Button onClick={() => setShowCreateForm(false)} variant="secondary" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fournisseur *
                    </label>
                    <Input
                      placeholder="Nom du fournisseur"
                      value={newPurchase.supplier}
                      onChange={(e) => setNewPurchase({...newPurchase, supplier: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de commande
                    </label>
                    <Input
                      type="date"
                      value={newPurchase.purchase_date}
                      onChange={(e) => setNewPurchase({...newPurchase, purchase_date: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500"
                    rows="3"
                    placeholder="Notes sur la commande..."
                    value={newPurchase.notes}
                    onChange={(e) => setNewPurchase({...newPurchase, notes: e.target.value})}
                  />
                </div>

                {/* Ajout de produits */}
                <div className="border-t pt-6">
                  <h4 className="font-semibold mb-4">Ajouter des produits</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <Select
                      value={newItem.product_id}
                      onChange={(e) => setNewItem({...newItem, product_id: e.target.value})}
                    >
                      <option value="">Sélectionner produit</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.unit})
                        </option>
                      ))}
                    </Select>
                    
                    <Input
                      type="number"
                      placeholder="Quantité"
                      value={newItem.quantity_ordered}
                      onChange={(e) => setNewItem({...newItem, quantity_ordered: e.target.value})}
                      step="0.01"
                    />
                    
                    <Input
                      type="number"
                      placeholder="Prix unitaire (CFA)"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({...newItem, unit_price: e.target.value})}
                    />
                    
                    <Button onClick={addItemToPurchase} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                  </div>
                </div>

                {/* Liste des produits ajoutés */}
                {newPurchase.items.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-4">
                      Produits commandés ({newPurchase.items.length})
                    </h4>
                    
                    <div className="space-y-2">
                      {newPurchase.items.map(item => (
                        <div key={item.tempId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{item.product_name}</span>
                            <div className="text-sm text-gray-600">
                              {item.quantity_ordered} {item.unit} × {item.unit_price} CFA 
                              = {(item.quantity_ordered * item.unit_price).toLocaleString()} CFA
                            </div>
                          </div>
                          <Button 
                            onClick={() => setNewPurchase(prev => ({
                              ...prev,
                              items: prev.items.filter(i => i.tempId !== item.tempId)
                            }))}
                            variant="danger" 
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="text-lg font-semibold text-blue-800">
                        Total: {newPurchase.items.reduce((sum, item) => 
                          sum + (item.quantity_ordered * item.unit_price), 0
                        ).toLocaleString()} CFA
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button onClick={() => setShowCreateForm(false)} variant="secondary">
                    Annuler
                  </Button>
                  <Button onClick={createPurchase} disabled={newPurchase.items.length === 0}>
                    <Send className="h-4 w-4 mr-2" />
                    Créer la commande
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {purchases.length === 0 && (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Aucune commande d'achat</p>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Première commande
          </Button>
        </Card>
      )}
    </div>
  );
};

const ProductionTracking = ({ data, onNotification, onReload }) => {
  const { recipes, productionBatches, stockAnalysis } = data;
  const [activeTab, setActiveTab] = useState('batches');

  // Calcul de capacité de production
  const calculateProductionCapacity = (recipe) => {
    if (!recipe.ingredients || !stockAnalysis) return 0;
    
    let maxBatches = Infinity;
    
    recipe.ingredients.forEach(ingredient => {
      const stockItem = stockAnalysis.find(s => s.name === ingredient.product_name);
      if (stockItem) {
        const possibleBatches = Math.floor(stockItem.current_stock / ingredient.quantity_needed);
        maxBatches = Math.min(maxBatches, possibleBatches);
      } else {
        maxBatches = 0;
      }
    });
    
    return maxBatches === Infinity ? 0 : maxBatches;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <ChefHat className="h-6 w-6 mr-3 text-purple-600" />
            Suivi de Production
          </h2>
          <p className="text-gray-600 text-sm">
            {recipes.length} recette{recipes.length > 1 ? 's' : ''} • 
            {productionBatches.length} lot{productionBatches.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'batches', label: 'Lots de Production', count: productionBatches.length },
            { id: 'capacity', label: 'Capacité de Production' },
            { id: 'recipes', label: 'Recettes', count: recipes.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} {tab.count && `(${tab.count})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Onglet Lots de Production */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {productionBatches.map(batch => (
            <Card key={batch.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Factory className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold">{batch.batch_number}</h3>
                    <Badge variant={
                      batch.status === 'completed' ? 'success' : 
                      batch.status === 'in_progress' ? 'info' : 'warning'
                    }>
                      {batch.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>Recette:</strong> {batch.recipe_name}
                    </div>
                    <div>
                      <strong>Quantité:</strong> {batch.quantity_produced}/{batch.quantity_planned} {batch.unit}
                    </div>
                    <div>
                      <strong>Destination:</strong> {batch.destination}
                    </div>
                    <div>
                      <strong>Employé:</strong> {batch.employee_name}
                    </div>
                  </div>
                  
                  {batch.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      {batch.notes}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="secondary" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    Détails
                  </Button>
                  
                  {batch.status === 'completed' && (
                    <Button variant="success" size="sm">
                      <ClipboardCheck className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Onglet Capacité de Production */}
      {activeTab === 'capacity' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Capacité de Production par Recette</h3>
            <div className="space-y-4">
              {recipes.map(recipe => {
                const capacity = calculateProductionCapacity(recipe);
                const maxUnits = capacity * recipe.yield_quantity;
                
                return (
                  <div key={recipe.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{recipe.name}</h4>
                        <p className="text-sm text-gray-600">{recipe.category}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {capacity} lots
                        </div>
                        <div className="text-sm text-gray-600">
                          = {maxUnits} {recipe.yield_unit}
                        </div>
                      </div>
                    </div>
                    
                    {capacity === 0 && (
                      <div className="bg-red-50 p-3 rounded mt-3">
                        <p className="text-xs font-medium text-red-800 mb-2">
                          Production impossible - ingrédients manquants
                        </p>
                      </div>
                    )}
                    
                    {capacity > 0 && capacity < 5 && (
                      <div className="bg-orange-50 p-3 rounded mt-3">
                        <p className="text-xs font-medium text-orange-800">
                          Capacité limitée - réapprovisionnement recommandé
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Onglet Recettes */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map(recipe => {
            const capacity = calculateProductionCapacity(recipe);
            
            return (
              <Card key={recipe.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                    <p className="text-sm text-gray-600">{recipe.category}</p>
                  </div>
                  <Badge variant={capacity > 0 ? 'success' : 'danger'}>
                    {capacity > 0 ? 'Disponible' : 'Indisponible'}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Rendement:</span>
                    <span className="font-medium">{recipe.yield_quantity} {recipe.yield_unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ingrédients:</span>
                    <span className="font-medium">{recipe.ingredients?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Lots possibles:</span>
                    <span className={`font-medium ${capacity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {capacity}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                  <Button disabled={capacity === 0} size="sm" className="flex-1">
                    <Plus className="h-4 w-4 mr-1" />
                    Produire
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StockAnalysisComponent = ({ data, onNotification }) => {
  const { stockAnalysis, finishedProducts } = data;
  
  // Calculer l'écart théorique
  const theoreticalAnalysis = stockAnalysis.map(product => {
    const theoreticalUsage = finishedProducts
      .filter(fp => fp.product_name === product.name)
      .reduce((sum, fp) => sum + (fp.quantity_produced || 0), 0);
    
    return {
      ...product,
      theoretical_usage: theoreticalUsage,
      variance: product.current_stock - (product.current_stock - theoreticalUsage),
      variance_percentage: theoreticalUsage > 0 ? 
        ((product.current_stock - (product.current_stock - theoreticalUsage)) / product.current_stock) * 100 : 0
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <BarChart3 className="h-6 w-6 mr-3 text-green-600" />
            Analyse des Stocks
          </h2>
          <p className="text-gray-600 text-sm">
            Comparaison stock réel vs stock théorique après production
          </p>
        </div>
      </div>

      {/* Métriques de synthèse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-800">
              {stockAnalysis.filter(p => p.stock_status === 'normal').length}
            </div>
            <div className="text-sm text-blue-600">Stock Normal</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-orange-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-800">
              {stockAnalysis.filter(p => p.stock_status === 'low').length}
            </div>
            <div className="text-sm text-orange-600">Stock Faible</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-red-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-800">
              {stockAnalysis.filter(p => p.stock_status === 'critical').length}
            </div>
            <div className="text-sm text-red-600">Stock Critique</div>
          </div>
        </Card>
        
        <Card className="p-4 bg-purple-50">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-800">
              {theoreticalAnalysis.filter(p => Math.abs(p.variance_percentage) > 10).length}
            </div>
            <div className="text-sm text-purple-600">Écarts > 10%</div>
          </div>
        </Card>
      </div>

      {/* Tableau d'analyse */}
      <Card>
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Analyse Détaillée</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Produit</th>
                <th className="p-3 text-left">Catégorie</th>
                <th className="p-3 text-left">Stock Actuel</th>
                <th className="p-3 text-left">Usage Théorique</th>
                <th className="p-3 text-left">Stock Théorique</th>
                <th className="p-3 text-left">Écart</th>
                <th className="p-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {theoreticalAnalysis.map(product => (
                <tr key={product.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{product.name}</td>
                  <td className="p-3 text-sm">{product.category}</td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      product.stock_status === 'critical' ? 'text-red-600' :
                      product.stock_status === 'low' ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {product.current_stock} {product.unit}
                    </span>
                  </td>
                  <td className="p-3">{product.theoretical_usage.toFixed(1)} {product.unit}</td>
                  <td className="p-3">{product.theoretical_remaining.toFixed(1)} {product.unit}</td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      Math.abs(product.variance_percentage) > 10 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {product.variance_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3">
                    <Badge variant={
                      product.stock_status === 'critical' ? 'danger' :
                      product.stock_status === 'low' ? 'warning' : 'success'
                    }>
                      {product.stock_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const Navigation = ({ activeTab, onTabChange, profile, onSignOut }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'purchases', label: 'Achats', icon: ShoppingCart },
    { id: 'requests', label: 'Demandes Stock', icon: Bell },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'analysis', label: 'Analyse Stocks', icon: TrendingUp }
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🧁</span>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Pâtisserie Shine
                </span>
                <div className="text-xs text-gray-500">Gestion Complète</div>
              </div>
            </div>
            
            <div className="hidden lg:flex space-x-1">
              {navItems.map(item => {
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-amber-100 text-amber-800 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{profile?.full_name}</div>
              <div className="text-xs text-gray-500">{profile?.role}</div>
            </div>
            <Button onClick={onSignOut} variant="secondary" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// ===================== COMPOSANT PRINCIPAL =====================
const PatisserieShineApp = () => {
  const { user, profile, loading, signIn, signOut } = useAuth();
  const data = useData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && profile) {
      data.loadAllData();
    }
  }, [user, profile]);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleLogin = async (username, password) => {
    const { error } = await signIn(username, password);
    if (error) {
      setError(error);
    }
  };

  const handleNotification = (type, message) => {
    if (type === 'error') setError(message);
    if (type === 'success') setSuccess(message);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <LoginForm 
        onLogin={handleLogin} 
        error={error} 
        loading={loading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profile={profile}
        onSignOut={signOut}
      />
      
      <main className="max-w-7xl mx-auto py-6 px-4">
        {activeTab === 'dashboard' && (
          <Dashboard data={data} profile={profile} />
        )}
        
        {activeTab === 'purchases' && (
          <PurchaseManagement 
            data={data} 
            onNotification={handleNotification}
            onReload={data.loadAllData}
          />
        )}
        
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Demandes de Stock</h2>
              <p className="text-gray-600">Module en cours de développement</p>
            </div>
          </div>
        )}
        
        {activeTab === 'production' && (
          <ProductionTracking 
            data={data} 
            onNotification={handleNotification}
            onReload={data.loadAllData}
          />
        )}
        
        {activeTab === 'analysis' && (
          <StockAnalysisComponent 
            data={data} 
            onNotification={handleNotification}
          />
        )}
      </main>

      {/* Notifications */}
      {(error || success) && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg mb-2 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button 
                onClick={() => setError('')}
                className="ml-2 text-white hover:text-red-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center">
              <Check className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{success}</span>
              <button 
                onClick={() => setSuccess('')}
                className="ml-2 text-white hover:text-green-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatisserieShineApp;