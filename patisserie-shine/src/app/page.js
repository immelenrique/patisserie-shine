"use client";
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ShoppingCart, 
  ChefHat, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Plus,
  Search,
  Filter,
  Eye,
  EyeOff,
  User,
  Lock,
  LogOut,
  Settings,
  Bell,
  Home,
  FileText,
  Calculator,
  Truck,
  Calendar,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

// Données simulées réalistes pour Pâtisserie Shine
const initialData = {
  produits: [
    { id: 1, nom: 'Farine de Blé T45', marque: 'Grands Moulins', stock: 25, minimum: 10, unite: 'kg', prix: 18500, emplacement: 'Réserve A1', peremption: '2024-12-31' },
    { id: 2, nom: 'Sucre Cristallisé', marque: 'Sucrivoire', stock: 3, minimum: 20, unite: 'kg', prix: 8500, emplacement: 'Réserve B1', peremption: null },
    { id: 3, nom: 'Beurre Extra-Fin', marque: 'Président', stock: 8, minimum: 5, unite: 'kg', prix: 45000, emplacement: 'Chambre Froide', peremption: '2024-09-15' },
    { id: 4, nom: 'Œufs Frais Gros', marque: 'Ferme Moderne', stock: 120, minimum: 50, unite: 'pcs', prix: 3500, emplacement: 'Chambre Froide', peremption: '2024-09-10' },
    { id: 5, nom: 'Chocolat Noir 70%', marque: 'Cémoi', stock: 2, minimum: 2, unite: 'kg', prix: 85000, emplacement: 'Réserve F1', peremption: '2025-06-30' }
  ],
  demandes: [
    { id: 1, numero: 'DEM-20240901-0001', produit: 'Farine de Blé T45', quantite: 5, service: 'Atelier', urgence: 'critique', statut: 'en_attente', demandeur: 'Marie Kouassi', date: '2024-09-01' },
    { id: 2, numero: 'DEM-20240901-0002', produit: 'Sucre Cristallisé', quantite: 10, service: 'Boutique', urgence: 'urgente', statut: 'en_attente', demandeur: 'Jean Koffi', date: '2024-09-01' },
    { id: 3, numero: 'DEM-20240831-0015', produit: 'Beurre Extra-Fin', quantite: 2, service: 'Atelier', urgence: 'normale', statut: 'approuvee', demandeur: 'Marie Kouassi', date: '2024-08-31' }
  ],
  productions: [
    { id: 1, numero: 'PROD-20240901-0001', produit: 'Croissants au Beurre', type: 'Viennoiseries', quantite: 48, vendu: 45, cout: 12500, prix: 350, chef: 'Marie Kouassi', statut: 'termine' },
    { id: 2, numero: 'PROD-20240901-0002', produit: 'Pain de Mie', type: 'Pains', quantite: 20, vendu: 18, cout: 8000, prix: 600, chef: 'Marie Kouassi', statut: 'termine' },
    { id: 3, numero: 'PROD-20240901-0003', produit: 'Gâteau au Chocolat', type: 'Gâteaux', quantite: 2, vendu: 0, cout: 15000, prix: 12000, chef: 'Marie Kouassi', statut: 'en_cours' }
  ],
  utilisateurs: [
    { id: 1, username: 'admin', nom: 'Administrateur Système', role: 'admin', telephone: '0701020304', actif: true },
    { id: 2, username: 'marie', nom: 'Marie Kouassi - Chef Pâtissière', role: 'chef_patissier', telephone: '0707080910', actif: true },
    { id: 3, username: 'jean', nom: 'Jean Koffi - Vendeur', role: 'vendeur', telephone: '0505060708', actif: true },
    { id: 4, username: 'sophie', nom: 'Sophie Diabaté - Vendeuse', role: 'vendeur', telephone: '0509101112', actif: true }
  ]
};

// Formatage de la monnaie CFA
const formatCFA = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0
  }).format(amount);
};

// Formatage de la date
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Composant de connexion moderne
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

    setTimeout(() => {
      const user = initialData.utilisateurs.find(u => u.username === username);
      if (user && (
        (username === 'admin' && password === 'admin2024') ||
        (username === 'marie' && password === 'marie2024') ||
        (username === 'jean' && password === 'jean2024') ||
        (username === 'sophie' && password === 'sophie2024')
      )) {
        onLogin(user);
      } else {
        setError('Nom d\'utilisateur ou mot de passe incorrect');
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl mb-6 shadow-xl">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pâtisserie <span className="text-orange-500">Shine</span>
          </h1>
          <p className="text-gray-600 text-lg">Gestion d'atelier professionnelle</p>
        </div>

        {/* Formulaire de connexion */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Nom d'utilisateur */}
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

            {/* Mot de passe */}
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

            {/* Message d'erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Comptes de test */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700 mb-3">Comptes de démonstration :</p>
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

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            © 2024 Pâtisserie Shine - Système de gestion professionnel
          </p>
        </div>
      </div>
    </div>
  );
};

// Composant Card moderne
const Card = ({ children, className = '', hover = true }) => (
  <div 
    className={`bg-white rounded-xl shadow-lg border border-gray-100 ${hover ? 'hover:shadow-xl transition-all duration-300' : ''} ${className}`}
  >
    {children}
  </div>
);

// Composant de statistique
const StatCard = ({ title, value, change, trend, icon: Icon, color = 'blue' }) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600'
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          {change && (
            <div className="flex items-center space-x-1">
              {trend === 'up' ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : trend === 'down' ? (
                <ArrowDown className="h-4 w-4 text-red-500" />
              ) : (
                <Minus className="h-4 w-4 text-gray-400" />
              )}
              <span className={`text-sm font-medium ${
                trend === 'up' ? 'text-green-600' : 
                trend === 'down' ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {change}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colors[color]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

// Composant Badge de statut
const StatusBadge = ({ status, type = 'default' }) => {
  const variants = {
    default: {
      'en_attente': 'bg-yellow-100 text-yellow-800',
      'approuvee': 'bg-green-100 text-green-800',
      'refusee': 'bg-red-100 text-red-800',
      'termine': 'bg-blue-100 text-blue-800',
      'en_cours': 'bg-orange-100 text-orange-800',
      'critique': 'bg-red-100 text-red-800',
      'urgente': 'bg-orange-100 text-orange-800',
      'normale': 'bg-blue-100 text-blue-800'
    }
  };

  const labels = {
    'en_attente': 'En attente',
    'approuvee': 'Approuvée',
    'refusee': 'Refusée',
    'termine': 'Terminé',
    'en_cours': 'En cours',
    'critique': 'Critique',
    'urgente': 'Urgente',
    'normale': 'Normale'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[type][status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
};

// Application principale
const PatisserieShineApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState('');

  // Si pas connecté, afficher la page de connexion
  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  // Calculs pour le dashboard
  const stats = {
    totalProduits: data.produits.length,
    stockCritique: data.produits.filter(p => p.stock <= p.minimum).length,
    demandesEnAttente: data.demandes.filter(d => d.statut === 'en_attente').length,
    productionsJour: data.productions.length,
    caJour: data.productions.reduce((sum, p) => sum + (p.vendu * p.prix), 0),
    margeJour: data.productions.reduce((sum, p) => sum + ((p.vendu * p.prix) - p.cout), 0)
  };

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: Home },
    { id: 'stock', label: 'Stock', icon: Package, badge: stats.stockCritique },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart, badge: stats.demandesEnAttente },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'equipe', label: 'Équipe', icon: Users, adminOnly: true },
    { id: 'rapports', label: 'Rapports', icon: FileText, adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || currentUser.role === 'admin');

  const logout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

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
              {/* Notifications */}
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Bell className="h-5 w-5" />
                  {stats.demandesEnAttente > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {stats.demandesEnAttente}
                    </span>
                  )}
                </button>
              </div>

              {/* Profil utilisateur */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {currentUser.nom.split(' ')[0].charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentUser.nom.split(' - ')[0]}</p>
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
        
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tableau de Bord</h2>
              <p className="text-gray-600">Vue d'ensemble de votre activité aujourd'hui</p>
            </div>

            {/* Statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Chiffre d'Affaires Jour"
                value={formatCFA(stats.caJour)}
                change="+15%"
                trend="up"
                icon={DollarSign}
                color="green"
              />
              <StatCard
                title="Marge Brute Jour"
                value={formatCFA(stats.margeJour)}
                change="+8%"
                trend="up"
                icon={TrendingUp}
                color="blue"
              />
              <StatCard
                title="Productions Terminées"
                value={stats.productionsJour}
                change="3 en cours"
                icon={ChefHat}
                color="purple"
              />
              <StatCard
                title="Alertes Stock"
                value={stats.stockCritique}
                change={stats.stockCritique > 0 ? "Action requise" : "Tout va bien"}
                trend={stats.stockCritique > 0 ? "down" : "up"}
                icon={AlertTriangle}
                color={stats.stockCritique > 0 ? "red" : "green"}
              />
              <StatCard
                title="Demandes en Attente"
                value={stats.demandesEnAttente}
                change={stats.demandesEnAttente > 0 ? "À traiter" : "Aucune"}
                icon={Clock}
                color={stats.demandesEnAttente > 0 ? "orange" : "green"}
              />
              <StatCard
                title="Produits en Stock"
                value={stats.totalProduits}
                change="Inventaire complet"
                icon={Package}
                color="amber"
              />
            </div>

            {/* Alertes importantes */}
            {stats.stockCritique > 0 && (
              <Card className="p-6 border-l-4 border-red-500 bg-red-50">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Alerte Stock Critique</h3>
                    <p className="text-red-700">
                      {stats.stockCritique} produit(s) ont atteint le niveau de stock minimum
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={() => setActiveTab('stock')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Voir les détails
                  </button>
                </div>
              </Card>
            )}

            {/* Activité récente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Demandes Récentes</h3>
                <div className="space-y-3">
                  {data.demandes.slice(0, 5).map((demande) => (
                    <div key={demande.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{demande.produit}</p>
                        <p className="text-sm text-gray-500">
                          {demande.quantite} unités → {demande.service} • {demande.demandeur}
                        </p>
                      </div>
                      <StatusBadge status={demande.statut} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Productions du Jour</h3>
                <div className="space-y-3">
                  {data.productions.slice(0, 5).map((production) => (
                    <div key={production.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{production.produit}</p>
                        <p className="text-sm text-gray-500">
                          {production.quantite} unités • {formatCFA(production.prix)} /u
                        </p>
                      </div>
                      <StatusBadge status={production.statut} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Onglet Stock */}
        {activeTab === 'stock' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
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
                {currentUser.role === 'admin' && (
                  <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>Nouveau Produit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filtres rapides */}
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                Stock Critique ({stats.stockCritique})
              </button>
              <button className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors">
                Proche Péremption
              </button>
              <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                Tous les Produits
              </button>
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix Unitaire</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emplacement</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Péremption</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.produits
                      .filter(produit => 
                        produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        produit.marque.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((produit) => {
                        const isCritique = produit.stock <= produit.minimum;
                        const isPeremptionProche = produit.peremption && 
                          new Date(produit.peremption) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        
                        return (
                          <tr key={produit.id} className={isCritique ? 'bg-red-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-3 ${
                                  isCritique ? 'bg-red-500' : 
                                  produit.stock <= produit.minimum * 1.5 ? 'bg-orange-500' : 'bg-green-500'
                                }`}></div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{produit.nom}</div>
                                  <div className="text-sm text-gray-500">{produit.marque}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                <span className={`font-medium ${isCritique ? 'text-red-600' : 'text-gray-900'}`}>
                                  {produit.stock} {produit.unite}
                                </span>
                                <div className="text-xs text-gray-500">Min: {produit.minimum}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCFA(produit.prix)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {produit.emplacement}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {produit.peremption ? (
                                <span className={isPeremptionProche ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                                  {formatDate(produit.peremption)}
                                </span>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {isCritique ? (
                                <StatusBadge status="critique" />
                              ) : isPeremptionProche ? (
                                <StatusBadge status="urgente" />
                              ) : (
                                <StatusBadge status="normale" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Onglet Demandes */}
        {activeTab === 'demandes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Demandes de Matières Premières</h2>
                <p className="text-gray-600">Gestion des sorties de stock</p>
              </div>
              <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Nouvelle Demande</span>
              </button>
            </div>

            {/* Filtres par statut */}
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors">
                En Attente ({stats.demandesEnAttente})
              </button>
              <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                Approuvées
              </button>
              <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                Toutes les Demandes
              </button>
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgence</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demandeur</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.demandes.map((demande) => (
                      <tr key={demande.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{demande.numero}</div>
                          <div className="text-sm text-gray-500">{formatDate(demande.date)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{demande.produit}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {demande.quantite}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            demande.service === 'Atelier' ? 'bg-purple-100 text-purple-800' :
                            demande.service === 'Boutique' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {demande.service}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={demande.urgence} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {demande.demandeur}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={demande.statut} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {demande.statut === 'en_attente' && currentUser.role === 'admin' && (
                            <div className="flex space-x-2">
                              <button className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition-colors">
                                Approuver
                              </button>
                              <button className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors">
                                Refuser
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
          </div>
        )}

        {/* Onglet Production */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Production</h2>
                <p className="text-gray-600">Suivi des produits finis et recettes</p>
              </div>
              {(currentUser.role === 'admin' || currentUser.role === 'chef_patissier') && (
                <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Nouvelle Production</span>
                </button>
              )}
            </div>

            {/* Résumé de la production du jour */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{data.productions.length}</p>
                  <p className="text-sm text-gray-600">Productions</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {data.productions.reduce((sum, p) => sum + p.vendu, 0)}
                  </p>
                  <p className="text-sm text-gray-600">Unités Vendues</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{formatCFA(stats.caJour)}</p>
                  <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{formatCFA(stats.margeJour)}</p>
                  <p className="text-sm text-gray-600">Marge Brute</p>
                </div>
              </Card>
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendu</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix Unit.</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CA Réalisé</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chef</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.productions.map((production) => (
                      <tr key={production.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                              <ChefHat className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{production.produit}</div>
                              <div className="text-sm text-gray-500">{production.numero}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {production.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {production.quantite}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium text-green-600">{production.vendu}</span>
                          <span className="text-gray-400"> / {production.quantite}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCFA(production.prix)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCFA(production.vendu * production.prix)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {production.chef}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={production.statut} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Onglet Équipe */}
        {activeTab === 'equipe' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Gestion de l'Équipe</h2>
                <p className="text-gray-600">Administration des utilisateurs</p>
              </div>
              <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Nouvel Utilisateur</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.utilisateurs.map((user) => (
                <Card key={user.id} className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">
                        {user.nom.split(' ')[0].charAt(0)}{user.nom.split(' ')[1] ? user.nom.split(' ')[1].charAt(0) : ''}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{user.nom.split(' - ')[0]}</h3>
                      <p className="text-sm text-gray-500">@{user.username}</p>
                      {user.telephone && (
                        <p className="text-sm text-gray-500">{user.telephone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'chef_patissier' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
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
        )}

        {/* Onglet Rapports */}
        {activeTab === 'rapports' && currentUser.role === 'admin' && (
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
                    <span className="font-semibold text-green-600">{formatCFA(stats.caJour)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Marge brute</span>
                    <span className="font-semibold text-blue-600">{formatCFA(stats.margeJour)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taux de marge</span>
                    <span className="font-semibold text-purple-600">
                      {stats.caJour > 0 ? Math.round((stats.margeJour / stats.caJour) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Indicateurs Opérationnels</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taux de vente</span>
                    <span className="font-semibold text-green-600">
                      {Math.round((data.productions.reduce((sum, p) => sum + p.vendu, 0) / 
                        data.productions.reduce((sum, p) => sum + p.quantite, 0)) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Produits en alerte</span>
                    <span className="font-semibold text-red-600">{stats.stockCritique}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Demandes en attente</span>
                    <span className="font-semibold text-orange-600">{stats.demandesEnAttente}</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Produits du Jour</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 text-sm font-medium text-gray-500">Produit</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-500">Quantité Vendue</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-500">CA Généré</th>
                      <th className="text-left py-3 text-sm font-medium text-gray-500">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.productions
                      .sort((a, b) => (b.vendu * b.prix) - (a.vendu * a.prix))
                      .map((production) => (
                        <tr key={production.id} className="border-b border-gray-100">
                          <td className="py-3 text-sm font-medium text-gray-900">{production.produit}</td>
                          <td className="py-3 text-sm text-gray-600">{production.vendu}</td>
                          <td className="py-3 text-sm font-medium text-green-600">
                            {formatCFA(production.vendu * production.prix)}
                          </td>
                          <td className="py-3 text-sm font-medium text-blue-600">
                            {formatCFA((production.vendu * production.prix) - production.cout)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
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
