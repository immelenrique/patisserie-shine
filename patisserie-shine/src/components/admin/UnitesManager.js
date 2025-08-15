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
