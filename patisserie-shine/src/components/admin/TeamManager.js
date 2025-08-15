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
