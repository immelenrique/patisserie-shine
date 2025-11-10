// src/components/dashboard/Dashboard.js ok
"use client";

import { useState } from 'react';
import { 
  ChefHat, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  AlertTriangle, 
  TrendingUp,
  Receipt 
} from 'lucide-react';
import { Card, StatCard } from '../ui';
import HistoriqueEmployeVentes from '../admin/HistoriqueVentesParEmploye';

export default function Dashboard({ stats, loading, currentUser }) {
  // État pour gérer l'onglet actif
  const [activeTab, setActiveTab] = useState('vue-ensemble');

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
      {/* En-tête avec onglets */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tableau de Bord</h2>
            <p className="text-gray-600">Vue d'ensemble de votre activité</p>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('vue-ensemble')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'vue-ensemble'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Vue d'ensemble
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('historique-ventes')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'historique-ventes'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Receipt className="w-4 h-4 inline mr-2" />
                Historique Ventes par Employé
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Contenu selon l'onglet actif */}
      {activeTab === 'vue-ensemble' && (
        <>
          {/* Statistiques principales */}
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

          {/* Alertes stock */}
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
        </>
      )}

      {/* Onglet Historique Ventes */}
      {activeTab === 'historique-ventes' && currentUser?.role === 'admin' && (
        <HistoriqueEmployeVentes currentUser={currentUser} />
      )}
    </div>
  );
}
