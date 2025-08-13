"use client";
import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Package, TrendingUp, Bell, Check, X, Plus, 
  LogOut, AlertTriangle, Search, Calendar, Clock, Star, 
  ChefHat, Eye, Trash2, Send, FileText, 
  Edit3, Save, Printer, Download, Home,
  Archive, BarChart3, Users, Lock, ArrowUp, ArrowDown
} from 'lucide-react';

// ===================== DONNÉES INITIALES =====================
const PRODUCT_CATEGORIES = [
  'Farines & Bases',
  'Sucres & Édulcorants', 
  'Produits Laitiers',
  'Corps Gras',
  'Agents Levants',
  'Arômes & Parfums',
  'Colorants',
  'Chocolats',
  'Œufs & Produits Frais',
  'Fruits & Garnitures',
  'Épices & Condiments',
  'Emballages',
  'Matériel Jetable',
  'Boissons',
  'Divers'
];

const SUPPLIERS = [
  { id: 1, name: 'Fournisseur Principal', contact: '+226 XX XX XX XX', email: 'contact@fournisseur1.bf' },
  { id: 2, name: 'Fournisseur Spécialisé', contact: '+226 XX XX XX XX', email: 'contact@fournisseur2.bf' },
  { id: 3, name: 'Fournisseur Chocolat', contact: '+226 XX XX XX XX', email: 'contact@chocolat.bf' },
  { id: 4, name: 'Fournisseur Frais', contact: '+226 XX XX XX XX', email: 'contact@frais.bf' }
];

const INITIAL_PRODUCTS = [
  { id: 'PS1', reference: 'PS1', name: 'Farine Etalon', category: 'Farines & Bases', unit: 'kg', package_type: 'sac', package_size: 50, unit_price: 468, purchase_price: 23400, min_stock: 50, current_stock: 100, supplier_id: 1, supplier_name: 'Fournisseur Principal', status: 'active' },
  { id: 'PS2', reference: 'PS2', name: 'Farine Pain complet', category: 'Farines & Bases', unit: 'kg', package_type: 'sac', package_size: 50, unit_price: 504, purchase_price: 25200, min_stock: 50, current_stock: 75, supplier_id: 1, supplier_name: 'Fournisseur Principal', status: 'active' },
  { id: 'PS3', reference: 'PS3', name: 'Sucre', category: 'Sucres & Édulcorants', unit: 'kg', package_type: 'sac', package_size: 50, unit_price: 540, purchase_price: 27000, min_stock: 50, current_stock: 120, supplier_id: 1, supplier_name: 'Fournisseur Principal', status: 'active' },
  { id: 'PS4', reference: 'PS4', name: 'Lait', category: 'Produits Laitiers', unit: 'kg', package_type: 'sac', package_size: 25, unit_price: 2440, purchase_price: 61000, min_stock: 25, current_stock: 30, supplier_id: 1, supplier_name: 'Fournisseur Principal', status: 'active' },
  { id: 'PS5', reference: 'PS5', name: 'Huile', category: 'Corps Gras', unit: 'litre', package_type: 'bidon', package_size: 20, unit_price: 1088, purchase_price: 21750, min_stock: 20, current_stock: 25, supplier_id: 1, supplier_name: 'Fournisseur Principal', status: 'active' },
  { id: 'PS6', reference: 'PS6', name: 'Lévure Boulangère', category: 'Agents Levants', unit: 'g', package_type: 'carton', package_size: 20, unit_price: 1050, purchase_price: 21000, min_stock: 10, current_stock: 5, supplier_id: 2, supplier_name: 'Fournisseur Spécialisé', status: 'active' },
  { id: 'PS20', reference: 'PS20', name: 'Colorant rouge', category: 'Colorants', unit: 'litre', package_type: 'bidon', package_size: 1, unit_price: 10000, purchase_price: 10000, min_stock: 1, current_stock: 2, supplier_id: 2, supplier_name: 'Fournisseur Spécialisé', status: 'active' },
  { id: 'PS25', reference: 'PS25', name: 'Chocolat Blanc', category: 'Chocolats', unit: 'g', package_type: 'sachet', package_size: 2500, unit_price: 7, purchase_price: 17500, min_stock: 1000, current_stock: 1500, supplier_id: 3, supplier_name: 'Fournisseur Chocolat', status: 'active' },
  { id: 'PS26', reference: 'PS26', name: 'Chocolat Noir', category: 'Chocolats', unit: 'g', package_type: 'sachet', package_size: 2500, unit_price: 7, purchase_price: 17500, min_stock: 1000, current_stock: 800, supplier_id: 3, supplier_name: 'Fournisseur Chocolat', status: 'active' },
  { id: 'PS37', reference: 'PS37', name: 'Plaquette d\'oeuf', category: 'Œufs & Produits Frais', unit: 'boule', package_type: 'plaquette', package_size: 30, unit_price: 103, purchase_price: 3100, min_stock: 30, current_stock: 25, supplier_id: 4, supplier_name: 'Fournisseur Frais', status: 'active' },
  { id: 'PS110', reference: 'PS110', name: 'Beurre aya', category: 'Corps Gras', unit: 'g', package_type: 'carton', package_size: 40, unit_price: 413, purchase_price: 16500, min_stock: 20, current_stock: 35, supplier_id: 4, supplier_name: 'Fournisseur Frais', status: 'active' },
  { id: 'PS111', reference: 'PS111', name: 'Beurre ambassador', category: 'Corps Gras', unit: 'g', package_type: 'carton', package_size: 40, unit_price: 1350, purchase_price: 54000, min_stock: 20, current_stock: 15, supplier_id: 4, supplier_name: 'Fournisseur Frais', status: 'active' }
];

const INITIAL_PURCHASES = [
  {
    id: 1,
    number: 'BC-2024-001',
    supplier_id: 1,
    supplier_name: 'Fournisseur Principal',
    order_date: '2024-01-15',
    expected_delivery: '2024-01-18',
    status: 'pending',
    total_amount: 125600,
    notes: 'Commande urgente pour réapprovisionnement',
    created_by: 'admin',
    items: [
      { product_id: 'PS1', product_name: 'Farine Etalon', quantity: 2, unit_price: 23400, total: 46800 },
      { product_id: 'PS3', product_name: 'Sucre', quantity: 1, unit_price: 27000, total: 27000 },
      { product_id: 'PS4', product_name: 'Lait', quantity: 1, unit_price: 61000, total: 61000 }
    ]
  },
  {
    id: 2,
    number: 'BC-2024-002',
    supplier_id: 3,
    supplier_name: 'Fournisseur Chocolat',
    order_date: '2024-01-12',
    expected_delivery: '2024-01-15',
    delivery_date: '2024-01-15',
    status: 'received',
    total_amount: 35000,
    notes: 'Chocolats pour production spéciale',
    created_by: 'admin',
    items: [
      { product_id: 'PS25', product_name: 'Chocolat Blanc', quantity: 1, unit_price: 17500, total: 17500, quantity_received: 1 },
      { product_id: 'PS26', product_name: 'Chocolat Noir', quantity: 1, unit_price: 17500, total: 17500, quantity_received: 1 }
    ]
  }
];

// ===================== HOOKS PERSONNALISÉS =====================
const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  const setStoredValue = (newValue) => {
    try {
      setValue(newValue);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      }
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  };

  return [value, setStoredValue];
};

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (username, password) => {
    setLoading(true);
    try {
      if (username === 'admin' && password === 'admin123') {
        const userData = {
          id: '1',
          username: 'admin',
          name: 'Administrateur',
          role: 'Propriétaire',
          email: 'admin@patisserie-shine.bf'
        };
        setUser(userData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(userData));
        }
        return { success: true };
      }
      return { success: false, error: 'Identifiants incorrects' };
    } catch (error) {
      return { success: false, error: 'Erreur de connexion' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
  }, []);

  return { user, loading, signIn, signOut };
};

// ===================== COMPOSANTS UI =====================
const Card = ({ children, className = '', hover = false }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''} ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '', loading = false, type = 'button' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg',
    warning: 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg',
    outline: 'border-2 border-amber-500 text-amber-600 hover:bg-amber-50',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${className}`}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      ) : null}
      {children}
    </button>
  );
};

const Input = ({ type = 'text', placeholder, value, onChange, className = '', icon, ...props }) => (
  <div className="relative">
    {icon && (
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {icon}
      </div>
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all ${className}`}
      {...props}
    />
  </div>
);

const Select = ({ value, onChange, children, className = '', ...props }) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all bg-white ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Badge = ({ children, variant = 'default', size = 'sm' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800'
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2'
  };

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};

// ===================== COMPOSANTS PRINCIPAUX =====================

const LoginForm = ({ onLogin, error, loading }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(credentials.username, credentials.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧁</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">
            Pâtisserie Shine
          </h1>
          <p className="text-gray-600">Système de Gestion Intégré</p>
          <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto mt-4 rounded-full"></div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center text-sm">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            placeholder="Nom d'utilisateur"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            disabled={loading}
            icon={<Users className="h-4 w-4 text-gray-400" />}
          />
          
          <Input
            type="password"
            placeholder="Mot de passe"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            disabled={loading}
            icon={<Lock className="h-4 w-4 text-gray-400" />}
          />
          
          <Button
            type="submit"
            disabled={loading || !credentials.username || !credentials.password}
            loading={loading}
            className="w-full py-4"
          >
            Se connecter
          </Button>
        </form>
        
        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <p className="text-xs text-amber-700 text-center">
            <span className="font-medium">Démo:</span> admin / admin123
          </p>
        </div>
      </Card>
    </div>
  );
};

const Navigation = ({ activeTab, onTabChange, user, onSignOut }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'purchases', label: 'Achats', icon: ShoppingCart },
    { id: 'stock', label: 'Stock', icon: Archive },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'reports', label: 'Rapports', icon: BarChart3 }
  ];

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🧁</span>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Pâtisserie Shine
                </span>
                <div className="text-xs text-gray-500">Gestion Professionnelle</div>
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
                        ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 shadow-sm'
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
              <div className="text-sm font-medium text-gray-900">{user?.name}</div>
              <div className="text-xs text-gray-500">{user?.role}</div>
            </div>
            <Button onClick={onSignOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Dashboard = ({ products = [], purchases = [] }) => {
  const stats = {
    totalProducts: products.length,
    lowStock: products.filter(p => p.current_stock <= p.min_stock).length,
    criticalStock: products.filter(p => p.current_stock < (p.min_stock * 0.5)).length,
    pendingOrders: purchases.filter(p => p.status === 'pending').length,
    monthlyPurchases: purchases.filter(p => {
      const orderDate = new Date(p.order_date);
      const now = new Date();
      return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    }).length,
    totalValue: purchases.reduce((sum, p) => sum + p.total_amount, 0)
  };

  const lowStockProducts = products.filter(p => p.current_stock <= p.min_stock).slice(0, 5);
  const recentPurchases = purchases.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
          Tableau de bord
        </h1>
        <p className="text-gray-600">Vue d'ensemble de votre pâtisserie</p>
      </div>
      
      {/* Métriques principales */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" hover>
          <div className="text-center">
            <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-800">{stats.totalProducts}</div>
            <div className="text-sm text-blue-600">Produits</div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200" hover>
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-800">{stats.lowStock}</div>
            <div className="text-sm text-yellow-600">Stock Faible</div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200" hover>
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-800">{stats.criticalStock}</div>
            <div className="text-sm text-red-600">Stock Critique</div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" hover>
          <div className="text-center">
            <ShoppingCart className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-800">{stats.pendingOrders}</div>
            <div className="text-sm text-purple-600">Commandes</div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200" hover>
          <div className="text-center">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-800">{stats.monthlyPurchases}</div>
            <div className="text-sm text-green-600">Ce mois</div>
          </div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" hover>
          <div className="text-center">
            <Star className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-800">
              {Math.round(stats.totalValue / 1000)}K
            </div>
            <div className="text-sm text-amber-600">Total CFA</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alertes stock */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              Alertes Stock
            </h3>
            <Badge variant="danger">{stats.lowStock}</Badge>
          </div>
          
          {lowStockProducts.length > 0 ? (
            <div className="space-y-4">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <h4 className="font-medium text-red-900">{product.name}</h4>
                    <p className="text-sm text-red-700">
                      Stock: {product.current_stock} {product.unit} (Min: {product.min_stock})
                    </p>
                  </div>
                  <Badge variant={product.current_stock < (product.min_stock * 0.5) ? 'danger' : 'warning'}>
                    {product.current_stock < (product.min_stock * 0.5) ? 'Critique' : 'Faible'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucune alerte stock</p>
            </div>
          )}
        </Card>

        {/* Commandes récentes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <ShoppingCart className="h-5 w-5 text-blue-600 mr-2" />
              Commandes Récentes
            </h3>
            <Badge variant="info">{recentPurchases.length}</Badge>
          </div>
          
          {recentPurchases.length > 0 ? (
            <div className="space-y-4">
              {recentPurchases.map(purchase => (
                <div key={purchase.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{purchase.number}</h4>
                    <Badge variant={
                      purchase.status === 'received' ? 'success' : 
                      purchase.status === 'pending' ? 'warning' : 'info'
                    }>
                      {purchase.status === 'received' ? 'Reçu' : 
                       purchase.status === 'pending' ? 'En attente' : purchase.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{purchase.supplier_name}</p>
                  <p className="text-sm font-medium text-gray-900">{purchase.total_amount.toLocaleString()} CFA</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucune commande récente</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const ProductManagement = ({ products, setProducts, onNotification }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'stock') {
      comparison = a.current_stock - b.current_stock;
    } else if (sortBy === 'price') {
      comparison = a.unit_price - b.unit_price;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getStockStatus = (product) => {
    if (product.current_stock <= product.min_stock * 0.5) return 'critical';
    if (product.current_stock <= product.min_stock) return 'low';
    return 'normal';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Package className="h-6 w-6 mr-3 text-blue-600" />
            Gestion des Produits
          </h2>
          <p className="text-gray-600 text-sm">
            {products.length} produit{products.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <Button onClick={() => onNotification('info', 'Fonctionnalité en développement')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Produit
        </Button>
      </div>

      {/* Filtres */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
          />
          
          <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="all">Toutes les catégories</option>
            {PRODUCT_CATEGORIES.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
          
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Trier par nom</option>
            <option value="stock">Trier par stock</option>
            <option value="price">Trier par prix</option>
          </Select>
          
          <Button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            variant="outline"
          >
            {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 mr-2" /> : <ArrowDown className="h-4 w-4 mr-2" />}
            {sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
          </Button>
        </div>
      </Card>

      {/* Liste des produits */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map(product => {
                const stockStatus = getStockStatus(product);
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.reference}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="info" size="sm">{product.category}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${
                          stockStatus === 'critical' ? 'text-red-600' :
                          stockStatus === 'low' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {product.current_stock} {product.unit}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          (Min: {product.min_stock})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {product.unit_price.toLocaleString()} CFA/{product.unit}
                        </div>
                        <div className="text-xs text-gray-500">
                          Achat: {product.purchase_price.toLocaleString()} CFA
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{product.supplier_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button 
                        onClick={() => onNotification('info', 'Modification en développement')}
                        variant="ghost" 
                        size="sm"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={() => onNotification('info', 'Suppression en développement')}
                        variant="ghost" 
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const PurchaseManagement = ({ products, purchases, setPurchases, onNotification }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch = purchase.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || purchase.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <ShoppingCart className="h-6 w-6 mr-3 text-blue-600" />
            Gestion des Achats
          </h2>
          <p className="text-gray-600 text-sm">
            {purchases.length} commande{purchases.length > 1 ? 's' : ''} • 
            {purchases.filter(p => p.status === 'pending').length} en attente
          </p>
        </div>
        
        <Button onClick={() => onNotification('info', 'Création de commande en développement')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Bon de Commande
        </Button>
      </div>

      {/* Filtres */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Rechercher une commande..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
          />
          
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="received">Reçues</option>
            <option value="cancelled">Annulées</option>
          </Select>
          
          <Button 
            onClick={() => onNotification('info', 'Export en développement')}
            variant="outline"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </Card>

      {/* Liste des commandes */}
      <div className="space-y-4">
        {filteredPurchases.map(purchase => (
          <Card key={purchase.id} className="p-6" hover>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900">{purchase.number}</h3>
                  <Badge variant={
                    purchase.status === 'received' ? 'success' : 
                    purchase.status === 'pending' ? 'warning' : 
                    purchase.status === 'cancelled' ? 'danger' : 'info'
                  }>
                    {purchase.status === 'received' ? 'Reçue' : 
                     purchase.status === 'pending' ? 'En attente' : 
                     purchase.status === 'cancelled' ? 'Annulée' : purchase.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-900">Fournisseur:</span>
                    <div>{purchase.supplier_name}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Date commande:</span>
                    <div>{new Date(purchase.order_date).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Livraison prévue:</span>
                    <div>{purchase.expected_delivery ? new Date(purchase.expected_delivery).toLocaleDateString('fr-FR') : 'Non définie'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Montant total:</span>
                    <div className="text-lg font-semibold text-blue-600">
                      {purchase.total_amount.toLocaleString()} CFA
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <span className="font-medium text-gray-900">Articles: </span>
                  <span className="text-gray-600">{purchase.items?.length || 0} produit{(purchase.items?.length || 0) > 1 ? 's' : ''}</span>
                  {purchase.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <strong>Notes:</strong> {purchase.notes}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => onNotification('info', 'Détails en développement')}
                  variant="outline" 
                  size="sm"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Détails
                </Button>
                
                <Button 
                  onClick={() => onNotification('info', 'Impression en développement')}
                  variant="outline" 
                  size="sm"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                
                {purchase.status === 'pending' && (
                  <>
                    <Button 
                      onClick={() => onNotification('success', 'Réception simulée')}
                      variant="success" 
                      size="sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Réceptionner
                    </Button>
                    
                    <Button 
                      onClick={() => onNotification('warning', 'Annulation simulée')}
                      variant="danger" 
                      size="sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Annuler
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredPurchases.length === 0 && (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune commande trouvée</h3>
          <p className="text-gray-600 mb-4">Commencez par créer votre première commande</p>
          <Button onClick={() => onNotification('info', 'Création de commande en développement')}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Commande
          </Button>
        </Card>
      )}
    </div>
  );
};

const ModulePlaceholder = ({ title, icon: Icon, description }) => (
  <div className="text-center py-12">
    <Icon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
    <h3 className="text-xl font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// Composant principal de l'application
const PatisserieShineApp = () => {
  const { user, loading, signIn, signOut } = useAuth();
  const [products, setProducts] = useLocalStorage('products', INITIAL_PRODUCTS);
  const [purchases, setPurchases] = useLocalStorage('purchases', INITIAL_PURCHASES);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);

  const showNotification = (type, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleLogin = async (username, password) => {
    const { success, error } = await signIn(username, password);
    if (!success) {
      showNotification('error', error);
    }
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

  if (!user) {
    return (
      <LoginForm 
        onLogin={handleLogin} 
        error={notifications.find(n => n.type === 'error')?.message} 
        loading={loading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onSignOut={signOut}
      />
      
      <main className="max-w-7xl mx-auto py-8 px-4">
        {activeTab === 'dashboard' && (
          <Dashboard products={products} purchases={purchases} />
        )}
        
        {activeTab === 'products' && (
          <ProductManagement 
            products={products}
            setProducts={setProducts}
            onNotification={showNotification}
          />
        )}
        
        {activeTab === 'purchases' && (
          <PurchaseManagement 
            products={products}
            purchases={purchases}
            setPurchases={setPurchases}
            onNotification={showNotification}
          />
        )}
        
        {activeTab === 'stock' && (
          <ModulePlaceholder 
            title="Gestion du Stock"
            icon={Archive}
            description="Module de gestion des mouvements de stock en cours de développement"
          />
        )}
        
        {activeTab === 'production' && (
          <ModulePlaceholder 
            title="Gestion de la Production"
            icon={ChefHat}
            description="Module de suivi de la production et des recettes en cours de développement"
          />
        )}
        
        {activeTab === 'reports' && (
          <ModulePlaceholder 
            title="Rapports et Analyses"
            icon={BarChart3}
            description="Module de génération de rapports et analyses en cours de développement"
          />
        )}
      </main>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`max-w-sm p-4 rounded-lg shadow-lg border flex items-center space-x-3 ${
              notification.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : notification.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : notification.type === 'warning'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="h-5 w-5 flex-shrink-0" />
            ) : notification.type === 'info' ? (
              <Bell className="h-5 w-5 flex-shrink-0" />
            ) : notification.type === 'warning' ? (
              <Clock className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatisserieShineApp;
