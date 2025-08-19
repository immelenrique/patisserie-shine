import React from 'react';
import { ChefHat, Bell, LogOut, Home, Package, Warehouse, Calculator, ShoppingCart, Users, UserPlus, Store, CreditCard, BarChart3,Database } from 'lucide-react';

// Header Component
export function Header({ currentUser, stats, onLogout }) {
  // Vérifications de sécurité
  if (!currentUser) {
    return null;
  }

  return (
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
                <p className="text-sm text-gray-500">Gestion complète</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="h-5 w-5" />
                {((stats?.demandes_en_attente || 0) + (stats?.stock_atelier_critique || 0) + (stats?.produits_stock_critique || 0)) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {(stats?.demandes_en_attente || 0) + (stats?.stock_atelier_critique || 0) + (stats?.produits_stock_critique || 0)}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {(currentUser?.nom?.charAt(0) || currentUser?.email?.charAt(0) || 'U').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{currentUser?.nom || 'Utilisateur'}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {currentUser?.role === 'admin' ? 'Administrateur' :
                   currentUser?.role === 'employe_production' ? 'Employé Production' : 'Employé Boutique'}
                </p>
              </div>
            </div>
            
            <button
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Navigation Component
export function Navigation({ tabs, activeTab, onTabChange, stats }) {
  // Vérifications de sécurité
  if (!tabs || !Array.isArray(tabs)) {
    return null;
  }

  const tabIcons = {
    dashboard: Home,
    stock: Package,
    'stock-atelier': Warehouse,
    'stock-boutique': Store,
    referentiel: Database,
    recettes: Calculator,
    demandes: ShoppingCart,
    production: ChefHat,
    caisse: CreditCard,
    'prix-vente': CreditCard,
    comptabilite: BarChart3,
    unites: Calculator,
    equipe: Users,
    users: UserPlus
  };

  const tabBadges = {
    stock: stats?.produits_stock_critique || 0,
    'stock-atelier': stats?.stock_atelier_critique || 0,
    'stock-boutique': stats?.stock_boutique_critique || 0,
    demandes: stats?.demandes_en_attente || 0,
    caisse: stats?.ventes_en_cours || 0
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.id] || Package;
            const badge = tabBadges[tab.id] || 0;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange && onTabChange(tab.id)}
                className={`flex items-center space-x-2 px-4 py-4 rounded-t-lg font-medium text-sm transition-all duration-200 relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Footer Component
export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
              <ChefHat className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm text-gray-600">
              © 2025 Pâtisserie Shine - Gestion complète avec caisse intégrée
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Version 4.0.0</span>
            <span>•</span>
            <span>Made in Burkina Faso 🇧🇫</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
