"use client";

import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Home,
  FileText,
  Bell,
  LogOut,
  Plus,
  Search,
  Eye,
  EyeOff,
  User,
  Lock,
  RefreshCw,
  Edit,
  Trash2,
  Check,
  X
} from 'lucide-react';

// Import des services Supabase
import { 
  authService, 
  productService, 
  demandeService, 
  productionService, 
  userService, 
  statsService,
  utils 
} from '../lib/supabase';

// Composants UI réutilisables
const Card = ({ children, className = '', hover = true }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-200 ${hover ? 'hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, change, trend, icon: Icon, color = 'blue', loading = false }) => {
  const iconColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600'
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          {change && (
            <p className="text-sm text-gray-500">{change}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${iconColors[color]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

const StatusBadge = ({ status }) => {
  const variants = {
    'en_attente': 'bg-yellow-100 text-yellow-800',
    'approuvee': 'bg-green-100 text-green-800',
    'refusee': 'bg-red-100 text-red-800',
    'termine': 'bg-blue-100 text-blue-800',
    'en_cours': 'bg-orange-100 text-orange-800',
    'critique': 'bg-red-100 text-red-800',
    'urgente': 'bg-orange-100 text-orange-800',
    'normale': 'bg-blue-100 text-blue-800',
    'rupture': 'bg-red-100 text-red-800',
    'faible': 'bg-yellow-100 text-yellow-800',
    'normal': 'bg-green-100 text-green-800'
  };

  const labels = {
    'en_attente': 'En attente',
    'approuvee': 'Approuvée',
    'refusee': 'Refusée',
    'termine': 'Terminé',
    'en_cours': 'En cours',
    'critique': 'Critique',
    'urgente': 'Urgente',
    'normale': 'Normale',
    'rupture': 'Rupture',
    'faible': 'Faible',
    'normal': 'Normal'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-auto`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Composant de connexion
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { user, profile, error } = await authService.signInWithUsername(username, password);
      
      if (error) {
        setError(error);
      } else if (profile) {
        onLogin(profile);
      } else {
        setError('Profil utilisateur introuvable');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Erreur de connexion:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl mb-6 shadow-xl">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pâtisserie <span className="text-orange-500">Shine</span>
          </h1>
          <p className="text-gray-600 text-lg">Gestion d'atelier professionnelle</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Saisissez votre nom d'utilisateur"
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700 mb-3">Comptes de test :</p>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>👑 Admin:</span>
                <span className="font-mono">admin / admin2024</span>
              </div>
              <div className="flex justify-between">
                <span>👩‍🍳 Chef:</span>
                <span className="font-mono">marie / marie2024</span>
              </div>
              <div className="flex justify-between">
                <span>🛒 Vendeur:</span>
                <span className="font-mono">jean / jean2024</span>
              </div>
              <div className="flex justify-between">
                <span>🛒 Vendeuse:</span>
                <span className="font-mono">sophie / sophie2024</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant Dashboard
const Dashboard = ({ stats, loading }) => {
  const calculatedStats = {
    totalProduits: stats?.total_produits || 0,
    stockCritique: stats?.produits_stock_critique || 0,
    demandesEnAttente: stats?.demandes_en_attente || 0,
    productionsJour: stats?.productions_jour || 0,
    caJour: stats?.ca_jour || 0,
    utilisateursActifs: stats?.utilisateurs_actifs || 0
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tableau de Bord</h2>
        <p className="text-gray-600">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Chiffre d'Affaires Jour"
          value={utils.formatCFA(calculatedStats.caJour)}
          change="+15% vs hier"
          icon={TrendingUp}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Productions Jour"
          value={calculatedStats.productionsJour}
          change="En cours"
          icon={ChefHat}
          color="purple"
          loading={loading}
        />
        <StatCard
          title="Alertes Stock"
          value={calculatedStats.stockCritique}
          change={calculatedStats.stockCritique > 0 ? "Action requise" : "Tout va bien"}
          icon={AlertTriangle}
          color={calculatedStats.stockCritique > 0 ? "red" : "green"}
          loading={loading}
        />
        <StatCard
          title="Demandes en Attente"
          value={calculatedStats.demandesEnAttente}
          change={calculatedStats.demandesEnAttente > 0 ? "À traiter" : "Aucune"}
          icon={ShoppingCart}
          color={calculatedStats.demandesEnAttente > 0 ? "orange" : "green"}
          loading={loading}
        />
        <StatCard
          title="Produits en Stock"
          value={calculatedStats.totalProduits}
          change="Inventaire complet"
          icon={Package}
          color="amber"
          loading={loading}
        />
        <StatCard
          title="Utilisateurs Actifs"
          value={calculatedStats.utilisateursActifs}
          change="Équipe connectée"
          icon={Users}
          color="blue"
          loading={loading}
        />
      </div>

      {calculatedStats.stockCritique > 0 && (
        <Card className="p-6 border-l-4 border-red-500 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Alerte Stock Critique</h3>
              <p className="text-red-700">
                {calculatedStats.stockCritique} produit(s) ont atteint le niveau de stock minimum
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// Composant Stock
const StockManager = ({ currentUser }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    marque: '',
    fournisseur: '',
    prix_unitaire: '',
    stock_actuel: '',
    stock_minimum: '',
    stock_maximum: '',
    unite_id: '',
    emplacement: ''
  });

  // Unités disponibles (à récupérer depuis la DB)
  const unites = [
    { id: 1, code: 'kg', libelle: 'Kilogrammes' },
    { id: 2, code: 'g', libelle: 'Grammes' },
    { id: 3, code: 'L', libelle: 'Litres' },
    { id: 4, code: 'ml', libelle: 'Millilitres' },
    { id: 5, code: 'pcs', libelle: 'Pièces' }
  ];

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { products, error } = await productService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des produits:', error);
      } else {
        setProducts(products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const { product, error } = await productService.create({
        ...formData,
        prix_unitaire: parseFloat(formData.prix_unitaire),
        stock_actuel: parseFloat(formData.stock_actuel),
        stock_minimum: parseFloat(formData.stock_minimum),
        stock_maximum: formData.stock_maximum ? parseFloat(formData.stock_maximum) : null,
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création du produit');
      } else {
        setProducts([product, ...products]);
        setFormData({
          nom: '', marque: '', fournisseur: '', prix_unitaire: '',
          stock_actuel: '', stock_minimum: '', stock_maximum: '',
          unite_id: '', emplacement: ''
        });
        setShowAddModal(false);
        alert('Produit créé avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création du produit');
    }
  };

  const filteredProducts = products.filter(product => 
    product.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.marque && product.marque.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion du Stock</h2>
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
          {(currentUser.role === 'admin' || currentUser.role === 'chef_patissier') && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nouveau Produit</span>
            </button>
          )}
        </div>
      </div>
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emplacement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const alertLevel = utils.getStockAlertLevel(product.stock_actuel, product.stock_minimum);
                
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
                          <div className="text-sm text-gray-500">{product.marque}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <span className={`font-medium ${
                          alertLevel === 'critique' || alertLevel === 'rupture' ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {product.stock_actuel} {product.unite?.libelle}
                        </span>
                        <div className="text-xs text-gray-500">Min: {product.stock_minimum}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {utils.formatCFA(product.prix_unitaire)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.emplacement}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={alertLevel} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-indigo-600 hover:text-indigo-900">
                          <Edit className="h-4 w-4" />
                        </button>
                        {currentUser.role === 'admin' && (
                          <button className="text-red-600 hover:text-red-900">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Ajout Produit */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter un Produit" size="lg">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Farine de Blé T45"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Marque</label>
              <input
                type="text"
                value={formData.marque}
                onChange={(e) => setFormData({...formData, marque: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Grands Moulins"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fournisseur</label>
              <input
                type="text"
                value={formData.fournisseur}
                onChange={(e) => setFormData({...formData, fournisseur: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: CFAO Agri"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix unitaire (CFA) *</label>
              <input
                type="number"
                value={formData.prix_unitaire}
                onChange={(e) => setFormData({...formData, prix_unitaire: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="18500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock actuel *</label>
              <input
                type="number"
                step="0.01"
                value={formData.stock_actuel}
                onChange={(e) => setFormData({...formData, stock_actuel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="25"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock minimum *</label>
              <input
                type="number"
                step="0.01"
                value={formData.stock_minimum}
                onChange={(e) => setFormData({...formData, stock_minimum: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="10"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unité *</label>
              <select
                value={formData.unite_id}
                onChange={(e) => setFormData({...formData, unite_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              >
                <option value="">Choisir une unité</option>
                {unites.map(unite => (
                  <option key={unite.id} value={unite.id}>
                    {unite.libelle} ({unite.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emplacement</label>
              <input
                type="text"
                value={formData.emplacement}
                onChange={(e) => setFormData({...formData, emplacement: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Réserve A1"
              />
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Ajouter le produit
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
    </div>
  );
};

// Composant Demandes
const DemandesManager = ({ currentUser }) => {
  const [demandes, setDemandes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    produit_id: '',
    quantite_demandee: '',
    service_demandeur: '',
    urgence: 'normale',
    motif_demande: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [demandesResult, productsResult] = await Promise.all([
        demandeService.getAll(),
        productService.getAll()
      ]);

      if (demandesResult.error) {
        console.error('Erreur lors du chargement des demandes:', demandesResult.error);
      } else {
        setDemandes(demandesResult.demandes);
      }

      if (productsResult.error) {
        console.error('Erreur lors du chargement des produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDemande = async (e) => {
    e.preventDefault();
    try {
      const { demande, error } = await demandeService.create({
        ...formData,
        quantite_demandee: parseFloat(formData.quantite_demandee),
        produit_id: parseInt(formData.produit_id)
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la demande');
      } else {
        setDemandes([demande, ...demandes]);
        setFormData({
          produit_id: '', quantite_demandee: '', service_demandeur: '',
          urgence: 'normale', motif_demande: ''
        });
        setShowAddModal(false);
        alert('Demande créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la demande');
    }
  };

  const handleApproveDemande = async (demandeId, quantiteAccordee = null) => {
    try {
      const demande = demandes.find(d => d.id === demandeId);
      const quantite = quantiteAccordee || demande.quantite_demandee;
      
      const { result, error } = await demandeService.approve(demandeId, quantite);
      
      if (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur lors de l\'approbation de la demande');
      } else {
        await loadData(); // Recharger les données
        alert('Demande approuvée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de l\'approbation de la demande');
    }
  };

  const handleRejectDemande = async (demandeId) => {
    const motif = prompt('Motif du refus (optionnel):');
    try {
      const { demande, error } = await demandeService.reject(demandeId, motif);
      
      if (error) {
        console.error('Erreur lors du refus:', error);
        alert('Erreur lors du refus de la demande');
      } else {
        setDemandes(demandes.map(d => 
          d.id === demandeId ? { ...d, statut: 'refusee', motif_refus: motif } : d
        ));
        alert('Demande refusée');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors du refus de la demande');
    }
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Demandes de Matières Premières</h2>
          <p className="text-gray-600">Gestion des sorties de stock</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Demande</span>
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demandeur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {demandes.map((demande) => (
                <tr key={demande.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{demande.numero}</div>
                    <div className="text-sm text-gray-500">{utils.formatDate(demande.date_demande)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{demande.produit?.nom}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {demande.quantite_demandee} {demande.produit?.unite?.libelle}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      demande.service_demandeur === 'Atelier' ? 'bg-blue-100 text-blue-800' :
                      demande.service_demandeur === 'Boutique' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {demande.service_demandeur}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={demande.urgence} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {demande.demandeur?.nom_complet}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={demande.statut} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {demande.statut === 'en_attente' && (currentUser.role === 'admin' || currentUser.role === 'chef_patissier') && (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleApproveDemande(demande.id)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleRejectDemande(demande.id)}
                          className="text-red-600 hover:text-red-900 flex items-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nouvelle Demande */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nouvelle Demande" size="md">
        <form onSubmit={handleAddDemande} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Produit *</label>
            <select
              value={formData.produit_id}
              onChange={(e) => setFormData({...formData, produit_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un produit</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.nom} ({product.stock_actuel} {product.unite?.libelle} disponibles)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité demandée *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite_demandee}
              onChange={(e) => setFormData({...formData, quantite_demandee: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service demandeur *</label>
            <select
              value={formData.service_demandeur}
              onChange={(e) => setFormData({...formData, service_demandeur: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un service</option>
              <option value="Atelier">🏭 Atelier</option>
              <option value="Boutique">🏪 Boutique</option>
              <option value="Evenementiel">🎉 Événementiel</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgence</label>
            <select
              value={formData.urgence}
              onChange={(e) => setFormData({...formData, urgence: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="normale">Normale</option>
              <option value="urgente">Urgente</option>
              <option value="critique">Critique</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motif de la demande</label>
            <textarea
              value={formData.motif_demande}
              onChange={(e) => setFormData({...formData, motif_demande: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows="3"
              placeholder="Expliquez brièvement pourquoi vous avez besoin de ce produit..."
            />
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Créer la demande
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
    </div>
  );
};

// Composant Production
const ProductionManager = ({ currentUser }) => {
  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    nom_produit: '',
    type_produit: '',
    quantite_produite: '',
    prix_vente_unitaire: '',
    cout_production: '',
    destination: 'Boutique'
  });

  useEffect(() => {
    loadProductions();
  }, []);

  const loadProductions = async () => {
    setLoading(true);
    try {
      const { productions, error } = await productionService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des productions:', error);
      } else {
        setProductions(productions);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduction = async (e) => {
    e.preventDefault();
    try {
      const { production, error } = await productionService.create({
        ...formData,
        quantite_produite: parseFloat(formData.quantite_produite),
        prix_vente_unitaire: formData.prix_vente_unitaire ? parseFloat(formData.prix_vente_unitaire) : null,
        cout_production: formData.cout_production ? parseFloat(formData.cout_production) : null
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la production');
      } else {
        setProductions([production, ...productions]);
        setFormData({
          nom_produit: '', type_produit: '', quantite_produite: '',
          prix_vente_unitaire: '', cout_production: '', destination: 'Boutique'
        });
        setShowAddModal(false);
        alert('Production créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la production');
    }
  };

  const calculatedStats = {
    totalProductions: productions.length,
    unitesVendues: productions.reduce((sum, p) => sum + (p.quantite_vendue || 0), 0),
    unitesProduites: productions.reduce((sum, p) => sum + p.quantite_produite, 0),
    chiffreAffaires: productions.reduce((sum, p) => sum + ((p.quantite_vendue || 0) * (p.prix_vente_unitaire || 0)), 0),
    marge: productions.reduce((sum, p) => sum + (((p.quantite_vendue || 0) * (p.prix_vente_unitaire || 0)) - (p.cout_production || 0)), 0)
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
          <h2 className="text-2xl font-bold text-gray-900">Production</h2>
          <p className="text-gray-600">Suivi des produits finis et recettes</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'chef_patissier') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle Production</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{calculatedStats.totalProductions}</p>
          <p className="text-sm text-gray-600">Productions</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{calculatedStats.unitesVendues}</p>
          <p className="text-sm text-gray-600">Unités Vendues</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{utils.formatCFA(calculatedStats.chiffreAffaires)}</p>
          <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{utils.formatCFA(calculatedStats.marge)}</p>
          <p className="text-sm text-gray-600">Marge Brute</p>
        </Card>
      </div>
      
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Productions récentes</h3>
          <div className="space-y-4">
            {productions.map((production) => (
              <div key={production.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
                    <ChefHat className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{production.nom_produit}</h4>
                    <p className="text-sm text-gray-500">
                      {production.type_produit} • {production.chef?.nom_complet}
                    </p>
                    <p className="text-sm text-gray-500">{utils.formatDate(production.date_production)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{production.quantite_produite} unités</p>
                  <p className="text-sm text-green-600">{production.quantite_vendue || 0} vendues</p>
                  {production.prix_vente_unitaire && (
                    <p className="text-sm text-gray-500">{utils.formatCFA(production.prix_vente_unitaire)} /u</p>
                  )}
                </div>
                <StatusBadge status={production.statut} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Modal Nouvelle Production */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Nouvelle Production" size="md">
        <form onSubmit={handleAddProduction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de produit *</label>
            <select
              value={formData.type_produit}
              onChange={(e) => setFormData({...formData, type_produit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir un type</option>
              <option value="Viennoiseries">Viennoiseries</option>
              <option value="Pâtisseries">Pâtisseries</option>
              <option value="Gâteaux">Gâteaux</option>
              <option value="Pains">Pains</option>
              <option value="Autres">Autres</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité produite *</label>
            <input
              type="number"
              value={formData.quantite_produite}
              onChange={(e) => setFormData({...formData, quantite_produite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="48"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prix de vente unitaire (CFA)</label>
            <input
              type="number"
              value={formData.prix_vente_unitaire}
              onChange={(e) => setFormData({...formData, prix_vente_unitaire: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="350"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Coût de production (CFA)</label>
            <input
              type="number"
              value={formData.cout_production}
              onChange={(e) => setFormData({...formData, cout_production: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="12500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Boutique">Boutique</option>
              <option value="Commande">Commande</option>
              <option value="Evenement">Événement</option>
            </select>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              Enregistrer la production
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
    </div>
  );
};

// Composant Équipe (Admin uniquement)
const TeamManager = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { users, error } = await userService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
      } else {
        setUsers(users);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 h-48 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion de l'Équipe</h2>
          <p className="text-gray-600">Administration des utilisateurs</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvel Utilisateur</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-semibold">
                  {user.nom_complet.charAt(0)}{user.nom_complet.split(' ')[1]?.charAt(0) || ''}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{user.nom_complet.split(' - ')[0]}</h3>
                <p className="text-sm text-gray-500">@{user.username}</p>
                {user.telephone && (
                  <p className="text-sm text-gray-500">{user.telephone}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                user.role === 'chef_patissier' ? 'bg-orange-100 text-orange-800' :
                'bg-green-100 text-green-800'
              }`}>
                {user.role === 'admin' ? '👑 Administrateur' :
                 user.role === 'chef_patissier' ? '👩‍🍳 Chef Pâtissier' :
                 '🛒 Vendeur'}
              </span>
              
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${user.actif ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-500">
                  {user.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Composant Rapports (Admin uniquement)
const ReportsManager = ({ currentUser }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { stats, error } = await statsService.getDashboardStats();
      if (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
      } else {
        setStats(stats);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-200 h-64 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Rapports et Analyses</h2>
        <p className="text-gray-600">Tableaux de bord et statistiques détaillées</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Financière</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">CA du jour</span>
              <span className="font-semibold text-green-600">{utils.formatCFA(stats?.ca_jour || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Productions du jour</span>
              <span className="font-semibold text-blue-600">{stats?.productions_jour || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Utilisateurs actifs</span>
              <span className="font-semibold text-purple-600">{stats?.utilisateurs_actifs || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Indicateurs Opérationnels</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total produits</span>
              <span className="font-semibold text-blue-600">{stats?.total_produits || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Produits en alerte</span>
              <span className="font-semibold text-red-600">{stats?.produits_stock_critique || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Demandes en attente</span>
              <span className="font-semibold text-orange-600">{stats?.demandes_en_attente || 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Application principale
const PatisserieShineApp = () => {
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
      console.error('Erreur lors de la vérification de l\'authentification:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const { stats, error } = await statsService.getDashboardStats();
      if (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
      } else {
        setStats(stats);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const logout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setActiveTab('dashboard');
      setStats(null);
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
    }
  };

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: Home },
    { id: 'stock', label: 'Stock', icon: Package, badge: stats?.produits_stock_critique },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart, badge: stats?.demandes_en_attente },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'equipe', label: 'Équipe', icon: Users, adminOnly: true },
    { id: 'rapports', label: 'Rapports', icon: FileText, adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || currentUser?.role === 'admin');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl mb-4">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <div className="text-xl font-semibold text-gray-900">Chargement...</div>
        </div>
      </div>
    );
  }

  // Si pas connecté, afficher la page de connexion
  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                  <ChefHat className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Pâtisserie <span className="text-orange-500">Shine</span>
                  </h1>
                  <p className="text-sm text-gray-500">Gestion d'atelier</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="h-5 w-5" />
                  {stats?.demandes_en_attente > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {stats.demandes_en_attente}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {currentUser.nom_complet.split(' ')[0].charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentUser.nom_complet.split(' - ')[0]}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {currentUser.role === 'admin' ? 'Administrateur' :
                     currentUser.role === 'chef_patissier' ? 'Chef Pâtissier' : 'Vendeur'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-4 rounded-t-lg font-medium text-sm transition-all duration-200 relative ${
                    activeTab === tab.id
                      ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard stats={stats} loading={!stats} />
        )}
        
        {activeTab === 'stock' && (
          <StockManager currentUser={currentUser} />
        )}
        
        {activeTab === 'demandes' && (
          <DemandesManager currentUser={currentUser} />
        )}
        
        {activeTab === 'production' && (
          <ProductionManager currentUser={currentUser} />
        )}
        
        {activeTab === 'equipe' && currentUser.role === 'admin' && (
          <TeamManager currentUser={currentUser} />
        )}
        
        {activeTab === 'rapports' && currentUser.role === 'admin' && (
          <ReportsManager currentUser={currentUser} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 sm:mb-0">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-gray-600">
                © 2024 Pâtisserie Shine - Système de gestion professionnel
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Version 2.0.0</span>
              <span>•</span>
              <span>Made in Côte d'Ivoire 🇨🇮</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PatisserieShineApp;
