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
