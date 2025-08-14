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
  X,
  Calendar,
  DollarSign,
  Calculator,
  Warehouse,
  ArrowRightLeft,
  ShoppingBasket
} from 'lucide-react';

// Import des services Supabase
import { 
  authService, 
  productService, 
  demandeService, 
  productionService, 
  userService, 
  statsService,
  utils,
  uniteService,
  stockAtelierService,
  recetteService,
  supabase
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
    'validee': 'bg-green-100 text-green-800',
    'refusee': 'bg-red-100 text-red-800',
    'termine': 'bg-blue-100 text-blue-800',
    'en_cours': 'bg-orange-100 text-orange-800',
    'annule': 'bg-gray-100 text-gray-800',
    'rupture': 'bg-red-100 text-red-800',
    'critique': 'bg-red-100 text-red-800',
    'faible': 'bg-yellow-100 text-yellow-800',
    'normal': 'bg-green-100 text-green-800'
  };

  const labels = {
    'en_attente': 'En attente',
    'validee': 'Validée',
    'refusee': 'Refusée',
    'termine': 'Terminé',
    'en_cours': 'En cours',
    'annule': 'Annulé',
    'rupture': 'Rupture',
    'critique': 'Critique',
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
          <p className="text-gray-600 text-lg">Gestion de stock professionnelle</p>
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
            <p className="text-sm font-medium text-gray-700 mb-3">Créez d'abord vos comptes dans Supabase :</p>
            <div className="space-y-2 text-xs text-gray-600">
              <div>1. Dashboard Supabase → Authentication → Users</div>
              <div>2. Add user → Email: admin@patisserie.local</div>
              <div>3. Répétez pour: marie@patisserie.local, jean@patisserie.local</div>
              <div>4. Connectez-vous avec: admin, marie, jean</div>
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
    utilisateursActifs: stats?.utilisateurs_actifs || 0,
    stockAtelierCritique: stats?.stock_atelier_critique || 0,
    efficaciteProduction: stats?.efficacite_production || 0
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tableau de Bord</h2>
        <p className="text-gray-600">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Produits Fabriqués Aujourd'hui"
          value={calculatedStats.productionsJour}
          change="Productions du jour"
          icon={ChefHat}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Stock Principal en Alerte"
          value={calculatedStats.stockCritique}
          change={calculatedStats.stockCritique > 0 ? "Action requise" : "Tout va bien"}
          icon={AlertTriangle}
          color={calculatedStats.stockCritique > 0 ? "red" : "green"}
          loading={loading}
        />
        <StatCard
          title="Stock Atelier en Alerte"
          value={calculatedStats.stockAtelierCritique}
          change={calculatedStats.stockAtelierCritique > 0 ? "Réapprovisionner" : "Tout va bien"}
          icon={Warehouse}
          color={calculatedStats.stockAtelierCritique > 0 ? "red" : "green"}
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
          title="Efficacité Production"
          value={`${calculatedStats.efficaciteProduction}%`}
          change="Sur 30 derniers jours"
          icon={TrendingUp}
          color="purple"
          loading={loading}
        />
      </div>

      {(calculatedStats.stockCritique > 0 || calculatedStats.stockAtelierCritique > 0) && (
        <Card className="p-6 border-l-4 border-red-500 bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Alertes Stock</h3>
              <div className="text-red-700 space-y-1">
                {calculatedStats.stockCritique > 0 && (
                  <p>{calculatedStats.stockCritique} produit(s) en stock principal faible</p>
                )}
                {calculatedStats.stockAtelierCritique > 0 && (
                  <p>{calculatedStats.stockAtelierCritique} produit(s) en stock atelier faible</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// Composant Stock Principal
const StockManager = ({ currentUser }) => {
  const [products, setProducts] = useState([]);
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    date_achat: new Date().toISOString().split('T')[0],
    prix_achat: '',
    quantite: '',
    quantite_restante: '',
    unite_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsResult, unitesResult] = await Promise.all([
        productService.getAll(),
        uniteService.getAll()
      ]);

      if (productsResult.error) {
        console.error('Erreur lors du chargement des produits:', productsResult.error);
      } else {
        setProducts(productsResult.products);
      }

      if (unitesResult.error) {
        console.error('Erreur lors du chargement des unités:', unitesResult.error);
      } else {
        setUnites(unitesResult.unites);
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
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: parseFloat(formData.prix_achat),
        quantite: parseFloat(formData.quantite),
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création du produit: ' + error);
      } else {
        await loadData();
        resetForm();
        setShowAddModal(false);
        alert('Produit créé avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création du produit');
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      const { product, error } = await productService.update(editingProduct.id, {
        nom: formData.nom,
        date_achat: formData.date_achat,
        prix_achat: parseFloat(formData.prix_achat),
        quantite: parseFloat(formData.quantite),
        quantite_restante: parseFloat(formData.quantite_restante),
        unite_id: parseInt(formData.unite_id)
      });

      if (error) {
        console.error('Erreur lors de la modification:', error);
        alert('Erreur lors de la modification du produit: ' + error);
      } else {
        await loadData();
        resetForm();
        setEditingProduct(null);
        alert('Produit modifié avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la modification du produit');
    }
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      nom: product.nom,
      date_achat: product.date_achat,
      prix_achat: product.prix_achat.toString(),
      quantite: product.quantite.toString(),
      quantite_restante: product.quantite_restante.toString(),
      unite_id: product.unite_id.toString()
    });
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      date_achat: new Date().toISOString().split('T')[0],
      prix_achat: '',
      quantite: '',
      quantite_restante: '',
      unite_id: ''
    });
  };

  const filteredProducts = products.filter(product => 
    product.nom.toLowerCase().includes(searchTerm.toLowerCase())
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
          {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'achat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const alertLevel = utils.getStockAlertLevel(product.quantite_restante, product.quantite);
                const percentage = utils.calculateStockPercentage(product.quantite_restante, product.quantite);
                
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
                      {utils.formatCFA(product.prix_achat)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {utils.formatDate(product.date_achat)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={alertLevel} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                          <button 
                            onClick={() => startEdit(product)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
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

      {/* Modal Ajout/Edition Produit */}
      <Modal 
        isOpen={showAddModal || editingProduct} 
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
          resetForm();
        }} 
        title={editingProduct ? "Modifier le Produit" : "Ajouter un Produit"} 
        size="lg"
      >
        <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: Farine de Blé"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date d'achat *</label>
              <input
                type="date"
                value={formData.date_achat}
                onChange={(e) => setFormData({...formData, date_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prix d'achat (CFA) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.prix_achat}
                onChange={(e) => setFormData({...formData, prix_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="18500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité totale *</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantite}
                onChange={(e) => {
                  const newQuantite = e.target.value;
                  setFormData({
                    ...formData, 
                    quantite: newQuantite,
                    quantite_restante: editingProduct ? formData.quantite_restante : newQuantite
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="25"
                required
              />
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
                />
              </div>
            )}
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
                    {unite.label} ({unite.value})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              {editingProduct ? 'Modifier le produit' : 'Ajouter le produit'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setEditingProduct(null);
                resetForm();
              }}
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
    quantite: '',
    destination: ''
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
        produit_id: parseInt(formData.produit_id),
        quantite: parseFloat(formData.quantite),
        destination: formData.destination
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la demande: ' + error);
      } else {
        await loadData();
        setFormData({
          produit_id: '', quantite: '', destination: ''
        });
        setShowAddModal(false);
        alert('Demande créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de la demande');
    }
  };

  const handleValidateDemande = async (demandeId) => {
    try {
      const { result, error } = await demandeService.validate(demandeId);
      
      if (error) {
        console.error('Erreur lors de la validation:', error);
        alert('Erreur lors de la validation de la demande: ' + error);
      } else {
        await loadData();
        alert('Demande validée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la validation de la demande');
    }
  };

  const handleRejectDemande = async (demandeId) => {
    try {
      const { demande, error } = await demandeService.reject(demandeId);
      
      if (error) {
        console.error('Erreur lors du refus:', error);
        alert('Erreur lors du refus de la demande: ' + error);
      } else {
        await loadData();
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demandeur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {demandes.map((demande) => (
                <tr key={demande.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{demande.produit?.nom}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {demande.quantite} {demande.produit?.unite?.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      demande.destination === 'Production' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {demande.destination}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {demande.demandeur?.nom}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {utils.formatDate(demande.date_demande)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={demande.statut} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {demande.statut === 'en_attente' && currentUser.role === 'admin' && (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleValidateDemande(demande.id)}
                          className="text-green-600 hover:text-green-900 flex items-center"
                          title="Valider"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleRejectDemande(demande.id)}
                          className="text-red-600 hover:text-red-900 flex items-center"
                          title="Refuser"
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
                  {product.nom} ({product.quantite_restante} {product.unite?.value} disponibles)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité demandée *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite}
              onChange={(e) => setFormData({...formData, quantite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
            <select
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="">Choisir une destination</option>
              <option value="Production">🏭 Production</option>
              <option value="Boutique">🏪 Boutique</option>
            </select>
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
    produit: '',
    quantite: '',
    destination: 'Boutique',
    date_production: new Date().toISOString().split('T')[0]
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
        produit: formData.produit,
        quantite: parseFloat(formData.quantite),
        destination: formData.destination,
        date_production: formData.date_production
      });

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de la production: ' + error);
      } else {
        await loadProductions();
        setFormData({
          produit: '', quantite: '', destination: 'Boutique',
          date_production: new Date().toISOString().split('T')[0]
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
    productionsJour: productions.filter(p => p.date_production === new Date().toISOString().split('T')[0]).length,
    unitesProduites: productions.reduce((sum, p) => sum + p.quantite, 0),
    productionsRecentes: productions.slice(0, 5)
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
          <p className="text-gray-600">Suivi des produits finis</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
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
          <p className="text-sm text-gray-600">Productions Totales</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{calculatedStats.productionsJour}</p>
          <p className="text-sm text-gray-600">Productions Aujourd'hui</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{calculatedStats.unitesProduites}</p>
          <p className="text-sm text-gray-600">Unités Produites</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">98%</p>
          <p className="text-sm text-gray-600">Taux de Réussite</p>
        </Card>
      </div>
      
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Productions récentes</h3>
          <div className="space-y-4">
            {calculatedStats.productionsRecentes.map((production) => (
              <div key={production.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
                    <ChefHat className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{production.produit}</h4>
                    <p className="text-sm text-gray-500">
                      Par {production.producteur?.nom || 'Non spécifié'}
                    </p>
                    <p className="text-sm text-gray-500">{utils.formatDate(production.date_production)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{production.quantite} unités</p>
                  <p className="text-sm text-blue-600">→ {production.destination}</p>
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
              value={formData.produit}
              onChange={(e) => setFormData({...formData, produit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité produite *</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantite}
              onChange={(e) => setFormData({...formData, quantite: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="48"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date de production *</label>
            <input
              type="date"
              value={formData.date_production}
              onChange={(e) => setFormData({...formData, date_production: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
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

// Composant Gestionnaire d'Unités
const UnitesManager = ({ currentUser }) => {
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnite, setEditingUnite] = useState(null);
  const [formData, setFormData] = useState({
    value: '',
    label: ''
  });

  useEffect(() => {
    loadUnites();
  }, []);

  const loadUnites = async () => {
    setLoading(true);
    try {
      const { unites, error } = await uniteService.getAll();
      if (error) {
        console.error('Erreur lors du chargement des unités:', error);
      } else {
        setUnites(unites);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnite = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('unites')
        .insert({
          value: formData.value,
          label: formData.label
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création:', error);
        alert('Erreur lors de la création de l\'unité: ' + error.message);
      } else {
        await loadUnites();
        resetForm();
        setShowAddModal(false);
        alert('Unité créée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la création de l\'unité');
    }
  };

  const handleEditUnite = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('unites')
        .update({
          value: formData.value,
          label: formData.label,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUnite.id)
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la modification:', error);
        alert('Erreur lors de la modification de l\'unité: ' + error.message);
      } else {
        await loadUnites();
        resetForm();
        setEditingUnite(null);
        alert('Unité modifiée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la modification de l\'unité');
    }
  };

  const handleDeleteUnite = async (uniteId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) return;
    
    try {
      const { error } = await supabase
        .from('unites')
        .delete()
        .eq('id', uniteId);

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression: ' + error.message);
      } else {
        await loadUnites();
        alert('Unité supprimée avec succès');
      }
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur lors de la suppression de l\'unité');
    }
  };

  const startEdit = (unite) => {
    setEditingUnite(unite);
    setFormData({
      value: unite.value,
      label: unite.label
    });
  };

  const resetForm = () => {
    setFormData({
      value: '',
      label: ''
    });
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
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Unités</h2>
          <p className="text-gray-600">Configuration des unités de mesure</p>
        </div>
        {currentUser.role === 'admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle Unité</span>
          </button>
        )}
      </div>
      
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libellé</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unites.map((unite) => (
                <tr key={unite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {unite.value}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {unite.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {utils.formatDate(unite.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {currentUser.role === 'admin' && (
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => startEdit(unite)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUnite(unite.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Modal Ajout/Edition Unité */}
      <Modal 
        isOpen={showAddModal || editingUnite} 
        onClose={() => {
          setShowAddModal(false);
          setEditingUnite(null);
          resetForm();
        }} 
        title={editingUnite ? "Modifier l'Unité" : "Ajouter une Unité"} 
        size="md"
      >
        <form onSubmit={editingUnite ? handleEditUnite : handleAddUnite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Code de l'unité *</label>
            <input
              type="text"
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: kg, ml, pcs"
              required
              maxLength="50"
            />
            <p className="text-xs text-gray-500 mt-1">Code court pour identifier l'unité</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Libellé complet *</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({...formData, label: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Kilogrammes, Millilitres, Pièces"
              required
              maxLength="100"
            />
            <p className="text-xs text-gray-500 mt-1">Nom complet affiché dans l'interface</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Exemples d'unités courantes :</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
              <div><strong>kg</strong> → Kilogrammes</div>
              <div><strong>g</strong> → Grammes</div>
              <div><strong>L</strong> → Litres</div>
              <div><strong>ml</strong> → Millilitres</div>
              <div><strong>pcs</strong> → Pièces</div>
              <div><strong>boites</strong> → Boîtes</div>
              <div><strong>sacs</strong> → Sacs</div>
              <div><strong>ccafe</strong> → Cuillères à café</div>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200">
              {editingUnite ? 'Modifier l\'unité' : 'Ajouter l\'unité'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setEditingUnite(null);
                resetForm();
              }}
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

  const handleAddUser = async (e) => {
    e.preventDefault();
    alert('Pour créer un nouvel utilisateur :\n\n1. Allez dans votre dashboard Supabase\n2. Section Authentication > Users\n3. Cliquez sur "Add user"\n4. Email: nom@patisserie.local\n5. Le profil sera créé automatiquement');
    setShowAddModal(false);
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
                  {user.nom?.charAt(0) || user.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{user.nom || 'Nom non défini'}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                user.role === 'employe_production' ? 'bg-orange-100 text-orange-800' :
                'bg-green-100 text-green-800'
              }`}>
                {user.role === 'admin' ? '👑 Administrateur' :
                 user.role === 'employe_production' ? '👩‍🍳 Employé Production' :
                 '🛒 Employé Boutique'}
              </span>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-500">Actif</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Nouvel Utilisateur */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Information - Création d'Utilisateur" 
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Création d'utilisateurs</h4>
            <p className="text-sm text-blue-800 mb-4">
              Pour créer un nouvel utilisateur, vous devez utiliser le dashboard Supabase :
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>Allez dans votre dashboard Supabase</li>
              <li>Section Authentication → Users</li>
              <li>Cliquez sur "Add user"</li>
              <li>Email: nom@patisserie.local (ex: pierre@patisserie.local)</li>
              <li>Définissez un mot de passe temporaire</li>
              <li>Le profil sera créé automatiquement dans l'application</li>
            </ol>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-xl">
            <h4 className="font-medium text-yellow-900 mb-2">Rôles disponibles :</h4>
            <div className="space-y-1 text-sm text-yellow-800">
              <div>👑 <strong>admin</strong> : Accès complet à toutes les fonctionnalités</div>
              <div>👩‍🍳 <strong>employe_production</strong> : Gestion stock et production</div>
              <div>🛒 <strong>employe_boutique</strong> : Consultation et demandes uniquement</div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={() => setShowAddModal(false)}
              className="bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              J'ai compris
            </button>
          </div>
        </div>
      </Modal>
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
    { id: 'stock', label: 'Stock Principal', icon: Package, badge: stats?.produits_stock_critique },
    { id: 'stock-atelier', label: 'Stock Atelier', icon: Warehouse, badge: stats?.stock_atelier_critique, adminOnly: true },
    { id: 'recettes', label: 'Recettes', icon: Calculator, adminOnly: true },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart, badge: stats?.demandes_en_attente },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'unites', label: 'Unités', icon: Calculator, adminOnly: true },
    { id: 'equipe', label: 'Équipe', icon: Users, adminOnly: true }
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
                  <p className="text-sm text-gray-500">Gestion de stock</p>
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
                    {currentUser.nom?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentUser.nom || 'Utilisateur'}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {currentUser.role === 'admin' ? 'Administrateur' :
                     currentUser.role === 'employe_production' ? 'Employé Production' : 'Employé Boutique'}
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
          <div className="flex space-x-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-4 rounded-t-lg font-medium text-sm transition-all duration-200 relative whitespace-nowrap ${
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
        
        {activeTab === 'stock-atelier' && currentUser.role === 'admin' && (
          <StockAtelierManager currentUser={currentUser} />
        )}
        
        {activeTab === 'recettes' && currentUser.role === 'admin' && (
          <RecettesManager currentUser={currentUser} />
        )}
        
        {activeTab === 'demandes' && (
          <DemandesManager currentUser={currentUser} />
        )}
        
        {activeTab === 'production' && (
          <ProductionManager currentUser={currentUser} />
        )}
        
        {activeTab === 'unites' && currentUser.role === 'admin' && (
          <UnitesManager currentUser={currentUser} />
        )}
        
        {activeTab === 'equipe' && currentUser.role === 'admin' && (
          <TeamManager currentUser={currentUser} />
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
                © 2024 Pâtisserie Shine - Gestion de stock professionnelle
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Version 3.0.0</span>
              <span>•</span>
              <span>Made with ❤️ in Burkina Faso 🇧🇫</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};


// Composant Stock Atelier
// Composant Stock Atelier Corrigé
const StockAtelierManager = ({ currentUser }) => {
  const [stockAtelier, setStockAtelier] = useState([]);
  const [consommations, setConsommations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockResult, consommationsResult] = await Promise.all([
        stockAtelierService.getStockAtelier(),
        stockAtelierService.getHistoriqueConsommations()
      ]);

      if (stockResult.error) {
        console.error('Erreur stock atelier:', stockResult.error);
      } else {
        setStockAtelier(stockResult.stock);
      }

      if (consommationsResult.error) {
        console.error('Erreur consommations:', consommationsResult.error);
      } else {
        setConsommations(consommationsResult.consommations);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatusInfo = (statut) => {
    switch (statut) {
      case 'rupture':
        return { color: 'text-red-600', bg: 'bg-red-50', label: 'Épuisé' };
      case 'critique':
        return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Critique' };
      case 'faible':
        return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Faible' };
      default:
        return { color: 'text-green-600', bg: 'bg-green-50', label: 'Normal' };
    }
  };

  const statsAtelier = {
    totalArticles: stockAtelier.length,
    articlesDisponibles: stockAtelier.filter(s => s.stock_restant > 0).length,
    articlesCritiques: stockAtelier.filter(s => s.statut_stock === 'critique' || s.statut_stock === 'rupture').length,
    stockUtilise: stockAtelier.reduce((sum, s) => sum + (s.quantite_utilisee || 0), 0),
    stockRestant: stockAtelier.reduce((sum, s) => sum + (s.stock_restant || 0), 0)
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
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Atelier</h2>
          <p className="text-gray-600">Suivi des consommations lors des productions</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('stock')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stock'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            État du Stock
          </button>
          <button
            onClick={() => setActiveTab('consommations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'consommations'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Historique Consommations
          </button>
        </nav>
      </div>

      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Statistiques rapides */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              title="Articles suivis"
              value={statsAtelier.totalArticles}
              icon={Package}
              color="blue"
            />
            <StatCard
              title="Stock disponible"
              value={statsAtelier.articlesDisponibles}
              icon={ShoppingBasket}
              color="green"
            />
            <StatCard
              title="En alerte"
              value={statsAtelier.articlesCritiques}
              icon={AlertTriangle}
              color={statsAtelier.articlesCritiques > 0 ? "red" : "green"}
            />
            <StatCard
              title="Quantité utilisée"
              value={utils.formatNumber(statsAtelier.stockUtilise, 1)}
              icon={TrendingDown}
              color="orange"
            />
            <StatCard
              title="Quantité restante"
              value={utils.formatNumber(statsAtelier.stockRestant, 1)}
              icon={TrendingUp}
              color="purple"
            />
          </div>

          {/* Tableau du stock */}
          <Card className="overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">État Actuel du Stock</h3>
              <div className="text-sm text-gray-500">
                Stock restant = Stock initial - Stock utilisé dans les productions
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Initial</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité Utilisée</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Restant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Utilisé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernière Utilisation</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockAtelier.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucun ingrédient utilisé en production
                        <br />
                        <span className="text-sm">Les consommations apparaîtront ici après les productions</span>
                      </td>
                    </tr>
                  ) : (
                    stockAtelier.map((stock) => {
                      const statusInfo = getStockStatusInfo(stock.statut_stock);
                      const pourcentageUtilise = stock.stock_initial > 0 
                        ? Math.round((stock.quantite_utilisee / stock.stock_initial) * 100) 
                        : 0;
                      
                      return (
                        <tr key={stock.produit_id} className={stock.statut_stock === 'critique' || stock.statut_stock === 'rupture' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-3 ${
                                stock.statut_stock === 'rupture' ? 'bg-red-600' :
                                stock.statut_stock === 'critique' ? 'bg-red-500' :
                                stock.statut_stock === 'faible' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{stock.nom_produit}</div>
                                <div className="text-sm text-gray-500">{stock.unite_label}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {utils.formatNumber(stock.stock_initial, 1)} {stock.unite_value}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                            {utils.formatNumber(stock.quantite_utilisee, 1)} {stock.unite_value}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold ${
                              stock.stock_restant <= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {utils.formatNumber(stock.stock_restant, 1)} {stock.unite_value}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    pourcentageUtilise >= 80 ? 'bg-red-500' :
                                    pourcentageUtilise >= 60 ? 'bg-orange-500' :
                                    pourcentageUtilise >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(pourcentageUtilise, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-600">{pourcentageUtilise}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {stock.derniere_utilisation ? utils.formatDate(stock.derniere_utilisation) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        )}
};

      {activeTab === 'consommations' && (
        <Card className="overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Historique des Consommations
            </h3>
            <div className="text-sm text-gray-500">
              Ingrédients utilisés lors des productions
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Production</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingrédient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité Utilisée</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producteur</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {consommations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      Aucune consommation enregistrée
                    </td>
                  </tr>
                ) : (
                  consommations.map((consommation, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {utils.formatDate(consommation.date_production)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{consommation.produit_fini}</div>
                        <div className="text-sm text-gray-500">{consommation.quantite_produite} unités</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {consommation.ingredient_nom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                        -{utils.formatNumber(consommation.quantite_utilisee, 1)} {consommation.unite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {consommation.producteur_nom}
                      </td>
                    </tr>
                  ))
                )}
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

// Composant Recettes
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
export default PatisserieShineApp;


