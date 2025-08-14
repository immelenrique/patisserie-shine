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
  Plus,
  Search,
  Eye,
  EyeOff,
  User,
  Lock,
  LogOut,
  Bell,
  Home,
  FileText,
  ArrowUp,
  ArrowDown,
  Minus,
  Edit,
  Trash2,
  X,
  RefreshCw
} from 'lucide-react';

// Simulation des services Supabase (remplacez par les vrais imports)
const mockServices = {
  authService: {
    async signInWithUsername(username, password) {
      const users = {
        'admin': { id: 1, username: 'admin', nom_complet: 'Administrateur Système', role: 'admin' },
        'marie': { id: 2, username: 'marie', nom_complet: 'Marie Kouassi - Chef Pâtissière', role: 'chef_patissier' },
        'jean': { id: 3, username: 'jean', nom_complet: 'Jean Koffi - Vendeur', role: 'vendeur' },
        'sophie': { id: 4, username: 'sophie', nom_complet: 'Sophie Diabaté - Vendeuse', role: 'vendeur' }
      };
      
      const validPasswords = { 'admin': 'admin2024', 'marie': 'marie2024', 'jean': 'jean2024', 'sophie': 'sophie2024' };
      
      if (users[username] && validPasswords[username] === password) {
        return { user: users[username], profile: users[username], error: null };
      }
      return { user: null, profile: null, error: 'Identifiants incorrects' };
    },
    
    async signOut() {
      return { error: null };
    },
    
    async getCurrentUser() {
      return { user: null, profile: null, error: null };
    }
  },
  
  utils: {
    formatCFA(amount) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0
      }).format(amount || 0);
    },
    
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('fr-FR');
    },
    
    getStockAlertLevel(current, minimum) {
      if (current <= 0) return 'rupture';
      if (current <= minimum) return 'critique';
      if (current <= minimum * 1.5) return 'faible';
      return 'normal';
    }
  }
};

// Données de test réalistes
const mockData = {
  produits: [
    { id: 1, nom: 'Farine de Blé T45', marque: 'Grands Moulins', stock_actuel: 25, stock_minimum: 10, unite: { libelle: 'kg' }, prix_unitaire: 18500, emplacement: 'Réserve A1' },
    { id: 2, nom: 'Sucre Cristallisé', marque: 'Sucrivoire', stock_actuel: 3, stock_minimum: 20, unite: { libelle: 'kg' }, prix_unitaire: 8500, emplacement: 'Réserve B1' },
    { id: 3, nom: 'Beurre Extra-Fin', marque: 'Président', stock_actuel: 8, stock_minimum: 5, unite: { libelle: 'kg' }, prix_unitaire: 45000, emplacement: 'Chambre Froide' },
    { id: 4, nom: 'Œufs Frais Gros', marque: 'Ferme Moderne', stock_actuel: 120, stock_minimum: 50, unite: { libelle: 'pcs' }, prix_unitaire: 3500, emplacement: 'Chambre Froide' },
    { id: 5, nom: 'Chocolat Noir 70%', marque: 'Cémoi', stock_actuel: 2, stock_minimum: 2, unite: { libelle: 'kg' }, prix_unitaire: 85000, emplacement: 'Réserve F1' }
  ],
  
  demandes: [
    { id: 1, numero: 'DEM-20240901-0001', produit: { nom: 'Farine de Blé T45' }, quantite_demandee: 5, service_demandeur: 'Atelier', urgence: 'critique', statut: 'en_attente', demandeur: { nom_complet: 'Marie Kouassi' }, date_demande: '2024-09-01' },
    { id: 2, numero: 'DEM-20240901-0002', produit: { nom: 'Sucre Cristallisé' }, quantite_demandee: 10, service_demandeur: 'Boutique', urgence: 'urgente', statut: 'en_attente', demandeur: { nom_complet: 'Jean Koffi' }, date_demande: '2024-09-01' },
    { id: 3, numero: 'DEM-20240831-0015', produit: { nom: 'Beurre Extra-Fin' }, quantite_demandee: 2, service_demandeur: 'Atelier', urgence: 'normale', statut: 'approuvee', demandeur: { nom_complet: 'Marie Kouassi' }, date_demande: '2024-08-31' }
  ],
  
  productions: [
    { id: 1, numero: 'PROD-20240901-0001', nom_produit: 'Croissants au Beurre', type_produit: 'Viennoiseries', quantite_produite: 48, quantite_vendue: 45, cout_production: 12500, prix_vente_unitaire: 350, chef: { nom_complet: 'Marie Kouassi' }, statut: 'termine' },
    { id: 2, numero: 'PROD-20240901-0002', nom_produit: 'Pain de Mie', type_produit: 'Pains', quantite_produite: 20, quantite_vendue: 18, cout_production: 8000, prix_vente_unitaire: 600, chef: { nom_complet: 'Marie Kouassi' }, statut: 'termine' },
    { id: 3, numero: 'PROD-20240901-0003', nom_produit: 'Gâteau au Chocolat', type_produit: 'Gâteaux', quantite_produite: 2, quantite_vendue: 0, cout_production: 15000, prix_vente_unitaire: 12000, chef: { nom_complet: 'Marie Kouassi' }, statut: 'en_cours' }
  ],
  
  utilisateurs: [
    { id: 1, username: 'admin', nom_complet: 'Administrateur Système', role: 'admin', telephone: '0701020304', actif: true },
    { id: 2, username: 'marie', nom_complet: 'Marie Kouassi - Chef Pâtissière', role: 'chef_patissier', telephone: '0707080910', actif: true },
    { id: 3, username: 'jean', nom_complet: 'Jean Koffi - Vendeur', role: 'vendeur', telephone: '0505060708', actif: true },
    { id: 4, username: 'sophie', nom_complet: 'Sophie Diabaté - Vendeuse', role: 'vendeur', telephone: '0509101112', actif: true }
  ]
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
      const { user, profile, error } = await mockServices.authService.signInWithUsername(username, password);
      
      if (error) {
        setError(error);
      } else if (profile) {
        onLogin(profile);
      } else {
        setError('Profil utilisateur introuvable');
      }
    } catch (err) {
      setError('Erreur de connexion');
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

// Composants UI
const Card = ({ children, className = '', hover = true }) => (
  <div className={`card ${hover ? 'hover:shadow-card-hover hover:-translate-y-1' : ''} ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, change, trend, icon: Icon, color = 'blue', loading = false }) => {
  const iconColors = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-600',
    green: 'bg-gradient-to-r from-green-500 to-green-600',
    red: 'bg-gradient-to-r from-red-500 to-red-600',
    orange: 'bg-gradient-to-r from-orange-500 to-orange-600',
    purple: 'bg-gradient-to-r from-purple-500 to-purple-600',
    amber: 'bg-gradient-to-r from-amber-500 to-amber-600'
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
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
        <div className={`p-3 rounded-xl ${iconColors[color]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

const StatusBadge = ({ status }) => {
  const variants = {
    'en_attente': 'badge badge-warning',
    'approuvee': 'badge badge-success',
    'refusee': 'badge badge-error',
    'termine': 'badge badge-info',
    'en_cours': 'badge badge-orange',
    'critique': 'badge badge-error',
    'urgente': 'badge badge-orange',
    'normale': 'badge badge-info',
    'rupture': 'badge badge-error',
    'faible': 'badge badge-warning',
    'normal': 'badge badge-success'
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
    <span className={variants[status] || 'badge'}>
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

// Application principale
const PatisserieShineApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // États des données (simulation)
  const [produits, setProduits] = useState(mockData.produits);
  const [demandes, setDemandes] = useState(mockData.demandes);
  const [productions, setProductions] = useState(mockData.productions);
  const [utilisateurs, setUtilisateurs] = useState(mockData.utilisateurs);

  // États des modales
  const [showAddProduit, setShowAddProduit] = useState(false);
  const [showAddDemande, setShowAddDemande] = useState(false);
  const [showAddProduction, setShowAddProduction] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  // États des formulaires
  const [formProduit, setFormProduit] = useState({
    nom: '', marque: '', fournisseur: '', prix_unitaire: '', 
    stock_actuel: '', stock_minimum: '', unite_id: '', emplacement: ''
  });
  const [formDemande, setFormDemande] = useState({
    produit_id: '', quantite_demandee: '', service_demandeur: '', urgence: 'normale', motif_demande: ''
  });
  const [formProduction, setFormProduction] = useState({
    nom_produit: '', type_produit: '', quantite_produite: '', prix_vente_unitaire: '', cout_production: ''
  });

  // Unités disponibles
  const unites = [
    { id: 1, code: 'kg', libelle: 'Kilogrammes' },
    { id: 2, code: 'g', libelle: 'Grammes' },
    { id: 3, code: 'L', libelle: 'Litres' },
    { id: 4, code: 'ml', libelle: 'Millilitres' },
    { id: 5, code: 'pcs', libelle: 'Pièces' }
  ];

  // Si pas connecté, afficher la page de connexion
  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  // Fonctions de gestion (simulation)
  const handleAddProduit = async (e) => {
    e.preventDefault();
    const newProduit = {
      id: produits.length + 1,
      ...formProduit,
      prix_unitaire: parseFloat(formProduit.prix_unitaire),
      stock_actuel: parseFloat(formProduit.stock_actuel),
      stock_minimum: parseFloat(formProduit.stock_minimum),
      unite: unites.find(u => u.id === parseInt(formProduit.unite_id))
    };
    setProduits([...produits, newProduit]);
    setFormProduit({
      nom: '', marque: '', fournisseur: '', prix_unitaire: '', 
      stock_actuel: '', stock_minimum: '', unite_id: '', emplacement: ''
    });
    setShowAddProduit(false);
  };

  const handleAddDemande = async (e) => {
    e.preventDefault();
    const produit = produits.find(p => p.id === parseInt(formDemande.produit_id));
    const newDemande = {
      id: demandes.length + 1,
      numero: `DEM-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(demandes.length + 1).padStart(4, '0')}`,
      produit: { nom: produit?.nom },
      ...formDemande,
      quantite_demandee: parseFloat(formDemande.quantite_demandee),
      statut: 'en_attente',
      demandeur: { nom_complet: currentUser.nom_complet },
      date_demande: new Date().toISOString().split('T')[0]
    };
    setDemandes([newDemande, ...demandes]);
    setFormDemande({
      produit_id: '', quantite_demandee: '', service_demandeur: '', urgence: 'normale', motif_demande: ''
    });
    setShowAddDemande(false);
  };

  const handleAddProduction = async (e) => {
    e.preventDefault();
    const newProduction = {
      id: productions.length + 1,
      numero: `PROD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(productions.length + 1).padStart(4, '0')}`,
      ...formProduction,
      quantite_produite: parseFloat(formProduction.quantite_produite),
      prix_vente_unitaire: parseFloat(formProduction.prix_vente_unitaire),
      cout_production: parseFloat(formProduction.cout_production),
      quantite_vendue: 0,
      chef: { nom_complet: currentUser.nom_complet },
      statut: 'en_cours'
    };
    setProductions([newProduction, ...productions]);
    setFormProduction({
      nom_produit: '', type_produit: '', quantite_produite: '', prix_vente_unitaire: '', cout_production: ''
    });
    setShowAddProduction(false);
  };

  const handleApproveDemande = (demandeId) => {
    setDemandes(demandes.map(d => 
      d.id === demandeId ? { ...d, statut: 'approuvee' } : d
    ));
    alert('Demande approuvée avec succès');
  };

  const handleRejectDemande = (demandeId) => {
    setDemandes(demandes.map(d => 
      d.id === demandeId ? { ...d, statut: 'refusee' } : d
    ));
    alert('Demande refusée');
  };

  const logout = async () => {
    await mockServices.authService.signOut();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Calculs des statistiques
  const calculatedStats = {
    totalProduits: produits.length,
    stockCritique: produits.filter(p => p.stock_actuel <= p.stock_minimum).length,
    demandesEnAttente: demandes.filter(d => d.statut === 'en_attente').length,
    productionsJour: productions.filter(p => p.date_production === new Date().toISOString().split('T')[0]).length,
    caJour: productions.reduce((sum, p) => sum + ((p.quantite_vendue || 0) * (p.prix_vente_unitaire || 0)), 0),
    margeJour: productions.reduce((sum, p) => sum + (((p.quantite_vendue || 0) * (p.prix_vente_unitaire || 0)) - (p.cout_production || 0)), 0)
  };

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: Home },
    { id: 'stock', label: 'Stock', icon: Package, badge: calculatedStats.stockCritique },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart, badge: calculatedStats.demandesEnAttente },
    { id: 'production', label: 'Production', icon: ChefHat },
    { id: 'equipe', label: 'Équipe', icon: Users, adminOnly: true },
    { id: 'rapports', label: 'Rapports', icon: FileText, adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || currentUser.role === 'admin');

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
                  {calculatedStats.demandesEnAttente > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {calculatedStats.demandesEnAttente}
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
                onClick={              <button
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
              <p className="text-gray-600">Vue d'ensemble de votre activité</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Chiffre d'Affaires Jour"
                value={mockServices.utils.formatCFA(calculatedStats.caJour)}
                change="+15%"
                trend="up"
                icon={TrendingUp}
                color="green"
                loading={loading}
              />
              <StatCard
                title="Marge Brute Jour"
                value={mockServices.utils.formatCFA(calculatedStats.margeJour)}
                change="+8%"
                trend="up"
                icon={TrendingUp}
                color="blue"
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
                trend={calculatedStats.stockCritique > 0 ? "down" : "up"}
                icon={AlertTriangle}
                color={calculatedStats.stockCritique > 0 ? "red" : "green"}
                loading={loading}
              />
              <StatCard
                title="Demandes en Attente"
                value={calculatedStats.demandesEnAttente}
                change={calculatedStats.demandesEnAttente > 0 ? "À traiter" : "Aucune"}
                icon={Clock}
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
                <div className="mt-4">
                  <button 
                    onClick={() => setActiveTab('stock')}
                    className="btn-primary"
                  >
                    Voir les détails
                  </button>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Demandes Récentes</h3>
                <div className="space-y-3">
                  {demandes.slice(0, 5).map((demande) => (
                    <div key={demande.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{demande.produit?.nom}</p>
                        <p className="text-sm text-gray-500">
                          {demande.quantite_demandee} unités → {demande.service_demandeur}
                        </p>
                      </div>
                      <StatusBadge status={demande.statut} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Productions Récentes</h3>
                <div className="space-y-3">
                  {productions.slice(0, 5).map((production) => (
                    <div key={production.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{production.nom_produit}</p>
                        <p className="text-sm text-gray-500">
                          {production.quantite_produite} unités • {mockServices.utils.formatCFA(production.prix_vente_unitaire)} /u
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
                    className="form-input with-icon"
                  />
                </div>
                {(currentUser.role === 'admin' || currentUser.role === 'chef_patissier') && (
                  <button 
                    onClick={() => setShowAddProduit(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Nouveau Produit</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                Stock Critique ({calculatedStats.stockCritique})
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
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Stock</th>
                      <th>Prix Unitaire</th>
                      <th>Emplacement</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produits
                      .filter(produit => 
                        produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (produit.marque && produit.marque.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map((produit) => {
                        const alertLevel = mockServices.utils.getStockAlertLevel(produit.stock_actuel, produit.stock_minimum);
                        
                        return (
                          <tr key={produit.id} className={alertLevel === 'critique' || alertLevel === 'rupture' ? 'bg-red-50' : ''}>
                            <td>
                              <div className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-3 ${
                                  alertLevel === 'rupture' ? 'bg-red-600' :
                                  alertLevel === 'critique' ? 'bg-red-500' :
                                  alertLevel === 'faible' ? 'bg-orange-500' : 'bg-green-500'
                                }`}></div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{produit.nom}</div>
                                  <div className="text-sm text-gray-500">{produit.marque}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-sm text-gray-900">
                                <span className={`font-medium ${
                                  alertLevel === 'critique' || alertLevel === 'rupture' ? 'text-red-600' : 'text-gray-900'
                                }`}>
                                  {produit.stock_actuel} {produit.unite?.libelle}
                                </span>
                                <div className="text-xs text-gray-500">Min: {produit.stock_minimum}</div>
                              </div>
                            </td>
                            <td className="text-sm font-medium text-gray-900">
                              {mockServices.utils.formatCFA(produit.prix_unitaire)}
                            </td>
                            <td className="text-sm text-gray-500">
                              {produit.emplacement}
                            </td>
                            <td>
                              <StatusBadge status={alertLevel} />
                            </td>
                            <td>
                              <div className="flex space-x-2">
                                <button className="p-1 text-gray-400 hover:text-blue-600">
                                  <Edit className="h-4 w-4" />
                                </button>
                                {currentUser.role === 'admin' && (
                                  <button className="p-1 text-gray-400 hover:text-red-600">
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
          </div>
        )}

        {/* Onglet Demandes */}
        {activeTab === 'demandes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Demandes de Matières Premières</h2>
                <p className="text-gray-600">Gestion des sorties de stock</p>
              </div>
              <button 
                onClick={() => setShowAddDemande(true)}
                className="btn-primary"
              >
                <Plus className="h-5 w-5" />
                <span>Nouvelle Demande</span>
              </button>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Produit</th>
                      <th>Quantité</th>
                      <th>Service</th>
                      <th>Urgence</th>
                      <th>Demandeur</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandes.map((demande) => (
                      <tr key={demande.id}>
                        <td>
                          <div className="text-sm font-medium text-gray-900">{demande.numero}</div>
                          <div className="text-sm text-gray-500">{mockServices.utils.formatDate(demande.date_demande)}</div>
                        </td>
                        <td>
                          <div className="text-sm font-medium text-gray-900">{demande.produit?.nom}</div>
                        </td>
                        <td className="text-sm text-gray-900 font-medium">
                          {demande.quantite_demandee}
                        </td>
                        <td>
                          <span className={`badge ${
                            demande.service_demandeur === 'Atelier' ? 'badge-info' :
                            demande.service_demandeur === 'Boutique' ? 'badge-success' :
                            'badge-warning'
                          }`}>
                            {demande.service_demandeur}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={demande.urgence} />
                        </td>
                        <td className="text-sm text-gray-500">
                          {demande.demandeur?.nom_complet}
                        </td>
                        <td>
                          <StatusBadge status={demande.statut} />
                        </td>
                        <td>
                          {demande.statut === 'en_attente' && currentUser.role === 'admin' && (
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleApproveDemande(demande.id)}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              >
                                Approuver
                              </button>
                              <button 
                                onClick={() => handleRejectDemande(demande.id)}
                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                              >
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
                <button 
                  onClick={() => setShowAddProduction(true)}
                  className="btn-primary"
                >
                  <Plus className="h-5 w-5" />
                  <span>Nouvelle Production</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{productions.length}</p>
                <p className="text-sm text-gray-600">Productions</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {productions.reduce((sum, p) => sum + (p.quantite_vendue || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Unités Vendues</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{mockServices.utils.formatCFA(calculatedStats.caJour)}</p>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{mockServices.utils.formatCFA(calculatedStats.margeJour)}</p>
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
                          <p className="text-sm text-gray-500">{production.type_produit} • {production.chef?.nom_complet}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{production.quantite_produite} unités</p>
                        <p className="text-sm text-green-600">{production.quantite_vendue || 0} vendues</p>
                      </div>
                      <StatusBadge status={production.statut} />
                    </div>
                  ))}
                </div>
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
              <button 
                onClick={() => setShowAddUser(true)}
                className="btn-primary"
              >
                <Plus className="h-5 w-5" />
                <span>Nouvel Utilisateur</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {utilisateurs.map((user) => (
                <Card key={user.id} className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">
                        {user.nom_complet.split(' ')[0].charAt(0)}{user.nom_complet.split(' ')[1] ? user.nom_complet.split(' ')[1].charAt(0) : ''}
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
                    <span className={`badge ${
                      user.role === 'admin' ? 'badge-info' :
                      user.role === 'chef_patissier' ? 'badge-orange' :
                      'badge-success'
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
                    <span className="font-semibold text-green-600">{mockServices.utils.formatCFA(calculatedStats.caJour)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Marge brute</span>
                    <span className="font-semibold text-blue-600">{mockServices.utils.formatCFA(calculatedStats.margeJour)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Taux de marge</span>
                    <span className="font-semibold text-purple-600">
                      {calculatedStats.caJour > 0 ? Math.round((calculatedStats.margeJour / calculatedStats.caJour) * 100) : 0}%
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
                      {productions.length > 0 ? Math.round((productions.reduce((sum, p) => sum + (p.quantite_vendue || 0), 0) / 
                        productions.reduce((sum, p) => sum + p.quantite_produite, 0)) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Produits en alerte</span>
                    <span className="font-semibold text-red-600">{calculatedStats.stockCritique}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Demandes en attente</span>
                    <span className="font-semibold text-orange-600">{calculatedStats.demandesEnAttente}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* MODALES */}
      
      {/* Modale Ajouter Produit */}
      <Modal isOpen={showAddProduit} onClose={() => setShowAddProduit(false)} title="Ajouter un Produit" size="lg">
        <form onSubmit={handleAddProduit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
              <input
                type="text"
                value={formProduit.emplacement}
                onChange={(e) => setFormProduit({...formProduit, emplacement: e.target.value})}
                className="form-input"
                placeholder="Ex: Réserve A1"
              />
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Ajout...' : 'Ajouter le produit'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddProduit(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale Nouvelle Demande */}
      <Modal isOpen={showAddDemande} onClose={() => setShowAddDemande(false)} title="Nouvelle Demande" size="md">
        <form onSubmit={handleAddDemande} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Produit *</label>
            <select
              value={formDemande.produit_id}
              onChange={(e) => setFormDemande({...formDemande, produit_id: e.target.value})}
              className="form-input"
              required
            >
              <option value="">Choisir un produit</option>
              {produits.map(produit => (
                <option key={produit.id} value={produit.id}>
                  {produit.nom} ({produit.stock_actuel} {produit.unite?.libelle} disponibles)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantité demandée *</label>
            <input
              type="number"
              step="0.01"
              value={formDemande.quantite_demandee}
              onChange={(e) => setFormDemande({...formDemande, quantite_demandee: e.target.value})}
              className="form-input"
              placeholder="5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service demandeur *</label>
            <select
              value={formDemande.service_demandeur}
              onChange={(e) => setFormDemande({...formDemande, service_demandeur: e.target.value})}
              className="form-input"
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
              value={formDemande.urgence}
              onChange={(e) => setFormDemande({...formDemande, urgence: e.target.value})}
              className="form-input"
            >
              <option value="normale">Normale</option>
              <option value="urgente">Urgente</option>
              <option value="critique">Critique</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motif de la demande</label>
            <textarea
              value={formDemande.motif_demande}
              onChange={(e) => setFormDemande({...formDemande, motif_demande: e.target.value})}
              className="form-input"
              rows="3"
              placeholder="Expliquez brièvement pourquoi vous avez besoin de ce produit..."
            />
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Création...' : 'Créer la demande'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddDemande(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale Nouvelle Production */}
      <Modal isOpen={showAddProduction} onClose={() => setShowAddProduction(false)} title="Nouvelle Production" size="md">
        <form onSubmit={handleAddProduction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
            <input
              type="text"
              value={formProduction.nom_produit}
              onChange={(e) => setFormProduction({...formProduction, nom_produit: e.target.value})}
              className="form-input"
              placeholder="Ex: Croissants au Beurre"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de produit *</label>
            <select
              value={formProduction.type_produit}
              onChange={(e) => setFormProduction({...formProduction, type_produit: e.target.value})}
              className="form-input"
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
              value={formProduction.quantite_produite}
              onChange={(e) => setFormProduction({...formProduction, quantite_produite: e.target.value})}
              className="form-input"
              placeholder="48"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prix de vente unitaire (CFA)</label>
            <input
              type="number"
              value={formProduction.prix_vente_unitaire}
              onChange={(e) => setFormProduction({...formProduction, prix_vente_unitaire: e.target.value})}
              className="form-input"
              placeholder="350"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Coût de production (CFA)</label>
            <input
              type="number"
              value={formProduction.cout_production}
              onChange={(e) => setFormProduction({...formProduction, cout_production: e.target.value})}
              className="form-input"
              placeholder="12500"
            />
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Création...' : 'Enregistrer la production'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddProduction(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale Nouvel Utilisateur */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Nouvel Utilisateur" size="md">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: nouveau_user"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Jean Dupont"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle *</label>
            <select className="form-input" required>
              <option value="">Choisir un rôle</option>
              <option value="admin">👑 Administrateur</option>
              <option value="chef_patissier">👩‍🍳 Chef Pâtissier</option>
              <option value="vendeur">🛒 Vendeur</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
            <input
              type="tel"
              className="form-input"
              placeholder="Ex: 0701020304"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe temporaire *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Mot de passe temporaire"
              required
            />
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Permissions par rôle :</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div>👑 <strong>Administrateur</strong> : Accès complet à toutes les fonctionnalités</div>
              <div>👩‍🍳 <strong>Chef Pâtissier</strong> : Gestion stock, demandes, production et recettes</div>
              <div>🛒 <strong>Vendeur</strong> : Consultation stock et création de demandes</div>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <button type="submit" className="btn-primary flex-1">
              Créer l'utilisateur
            </button>
            <button 
              type="button" 
              onClick={() => setShowAddUser(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>

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
