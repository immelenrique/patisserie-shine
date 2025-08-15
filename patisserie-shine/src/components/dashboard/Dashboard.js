"use client";

import { ChefHat, Package, ShoppingCart, Warehouse, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, StatCard } from '@/components/ui';

export default function Dashboard({ stats, loading }) {
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
}
