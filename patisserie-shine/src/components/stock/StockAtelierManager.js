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
      )}
    </div>
  );
};
