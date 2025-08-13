import React, { useState, useEffect } from 'react';
import { Plus, Users, Package, ShoppingCart, Factory, Calculator, Settings, Trash2, Edit } from 'lucide-react';

// Composants UI de base
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors duration-200';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700'
  };
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = 'text', placeholder, required = false }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const Select = ({ label, value, onChange, options, placeholder }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Application principale
const PatisserieStockApp = () => {
  const [activeTab, setActiveTab] = useState('stock');
  const [currentUser, setCurrentUser] = useState({ id: 1, nom: 'Admin', role: 'admin' });
  
  // États pour les données
  const [produits, setProduits] = useState([
    { id: 1, nom: 'Farine T45', dateAchat: '2024-01-15', prixAchat: 25.50, quantite: 50, unite: 'kg', quantiteRestante: 45 },
    { id: 2, nom: 'Levure fraîche', dateAchat: '2024-01-10', prixAchat: 3.20, quantite: 20, unite: 'pieces', quantiteRestante: 15 }
  ]);
  
  const [demandes, setDemandes] = useState([
    { id: 1, produitId: 1, produitNom: 'Farine T45', quantite: 5, destination: 'Production', statut: 'en_attente', date: '2024-01-16' }
  ]);
  
  const [productions, setProductions] = useState([
    { id: 1, produit: 'Croissants', quantite: 50, destination: 'Boutique', date: '2024-01-16', statut: 'terminé' }
  ]);
  
  const [utilisateurs, setUtilisateurs] = useState([
    { id: 1, nom: 'Admin Principal', email: 'admin@patisserie.com', role: 'admin' },
    { id: 2, nom: 'Marie Dubois', email: 'marie@patisserie.com', role: 'employe_production' },
    { id: 3, nom: 'Jean Martin', email: 'jean@patisserie.com', role: 'employe_boutique' }
  ]);
  
  const [recettes, setRecettes] = useState([
    { 
      id: 1, 
      nom: 'Pain', 
      ingredients: [
        { produitId: 1, produitNom: 'Farine T45', quantite: 2, unite: 'g' },
        { produitId: 2, produitNom: 'Levure fraîche', quantite: 0.1, unite: 'pieces' }
      ]
    }
  ]);
  
  const [unites, setUnites] = useState([
    { value: 'kg', label: 'Kilogrammes' },
    { value: 'pieces', label: 'Pièces' },
    { value: 'cartons', label: 'Cartons' },
    { value: 'litres', label: 'Litres' },
    { value: 'bouteilles', label: 'Bouteilles' },
    { value: 'bidons', label: 'Bidons' },
    { value: 'g', label: 'Grammes' }
  ]);

  // États pour les modales
  const [showAddProduit, setShowAddProduit] = useState(false);
  const [showAddDemande, setShowAddDemande] = useState(false);
  const [showAddProduction, setShowAddProduction] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddRecette, setShowAddRecette] = useState(false);
  const [showAddUnite, setShowAddUnite] = useState(false);

  // États pour les formulaires
  const [formProduit, setFormProduit] = useState({
    nom: '', dateAchat: '', prixAchat: '', quantite: '', unite: ''
  });
  
  const [formDemande, setFormDemande] = useState({
    produitId: '', quantite: '', destination: ''
  });
  
  const [formProduction, setFormProduction] = useState({
    produit: '', quantite: '', destination: 'Boutique'
  });
  
  const [formUser, setFormUser] = useState({
    nom: '', email: '', role: ''
  });
  
  const [formRecette, setFormRecette] = useState({
    nom: '', ingredients: [{ produitId: '', quantite: '', unite: 'g' }]
  });
  
  const [newUnite, setNewUnite] = useState({ value: '', label: '' });

  // Fonctions de gestion
  const ajouterProduit = () => {
    if (!formProduit.nom || !formProduit.dateAchat || !formProduit.prixAchat || !formProduit.quantite || !formProduit.unite) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    const nouveauProduit = {
      id: produits.length + 1,
      ...formProduit,
      prixAchat: parseFloat(formProduit.prixAchat),
      quantite: parseFloat(formProduit.quantite),
      quantiteRestante: parseFloat(formProduit.quantite)
    };
    
    setProduits([...produits, nouveauProduit]);
    setFormProduit({ nom: '', dateAchat: '', prixAchat: '', quantite: '', unite: '' });
    setShowAddProduit(false);
  };

  const ajouterDemande = () => {
    if (!formDemande.produitId || !formDemande.quantite || !formDemande.destination) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    const produit = produits.find(p => p.id === parseInt(formDemande.produitId));
    const nouvelleDemande = {
      id: demandes.length + 1,
      ...formDemande,
      produitId: parseInt(formDemande.produitId),
      produitNom: produit.nom,
      quantite: parseFloat(formDemande.quantite),
      statut: 'en_attente',
      date: new Date().toISOString().split('T')[0]
    };
    
    setDemandes([...demandes, nouvelleDemande]);
    setFormDemande({ produitId: '', quantite: '', destination: '' });
    setShowAddDemande(false);
  };

  const validerDemande = (demandeId) => {
    const demande = demandes.find(d => d.id === demandeId);
    const produit = produits.find(p => p.id === demande.produitId);
    
    if (produit.quantiteRestante >= demande.quantite) {
      // Mettre à jour la quantité restante
      setProduits(produits.map(p => 
        p.id === demande.produitId 
          ? { ...p, quantiteRestante: p.quantiteRestante - demande.quantite }
          : p
      ));
      
      // Mettre à jour le statut de la demande
      setDemandes(demandes.map(d => 
        d.id === demandeId 
          ? { ...d, statut: 'validee' }
          : d
      ));
    } else {
      alert('Stock insuffisant !');
    }
  };

  const ajouterProduction = () => {
    if (!formProduction.produit || !formProduction.quantite) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    const nouvelleProduction = {
      id: productions.length + 1,
      ...formProduction,
      quantite: parseFloat(formProduction.quantite),
      date: new Date().toISOString().split('T')[0],
      statut: 'terminé'
    };
    
    setProductions([...productions, nouvelleProduction]);
    setFormProduction({ produit: '', quantite: '', destination: 'Boutique' });
    setShowAddProduction(false);
  };

  const ajouterUtilisateur = () => {
    if (!formUser.nom || !formUser.email || !formUser.role) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    const nouvelUtilisateur = {
      id: utilisateurs.length + 1,
      ...formUser
    };
    
    setUtilisateurs([...utilisateurs, nouvelUtilisateur]);
    setFormUser({ nom: '', email: '', role: '' });
    setShowAddUser(false);
  };

  const ajouterUnite = () => {
    if (!newUnite.value || !newUnite.label) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    setUnites([...unites, newUnite]);
    setNewUnite({ value: '', label: '' });
    setShowAddUnite(false);
  };

  const ajouterRecette = () => {
    if (!formRecette.nom || formRecette.ingredients.length === 0) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    const nouvelleRecette = {
      id: recettes.length + 1,
      ...formRecette,
      ingredients: formRecette.ingredients.map(ing => ({
        ...ing,
        produitId: parseInt(ing.produitId),
        produitNom: produits.find(p => p.id === parseInt(ing.produitId))?.nom || '',
        quantite: parseFloat(ing.quantite)
      }))
    };
    
    setRecettes([...recettes, nouvelleRecette]);
    setFormRecette({ nom: '', ingredients: [{ produitId: '', quantite: '', unite: 'g' }] });
    setShowAddRecette(false);
  };

  const calculerConsommation = (recetteId, quantiteProduite) => {
    const recette = recettes.find(r => r.id === recetteId);
    if (!recette) return [];
    
    return recette.ingredients.map(ing => ({
      ...ing,
      quantiteConsommee: ing.quantite * quantiteProduite
    }));
  };

  // Navigation tabs
  const tabs = [
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart },
    { id: 'production', label: 'Production', icon: Factory },
    { id: 'equipe', label: 'Équipe', icon: Users },
    { id: 'recettes', label: 'Recettes', icon: Calculator },
    { id: 'parametres', label: 'Paramètres', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Gestion Stock Pâtisserie</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Connecté en tant que: <strong>{currentUser.nom}</strong> ({currentUser.role})
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Onglet Stock */}
        {activeTab === 'stock' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Gestion du Stock</h2>
              <Button onClick={() => setShowAddProduit(true)}>
                <Plus size={16} className="mr-2" />
                Ajouter Produit
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Achat</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité Initiale</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité Restante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {produits.map((produit) => (
                    <tr key={produit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {produit.nom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {produit.dateAchat}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {produit.prixAchat}€
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {produit.quantite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={produit.quantiteRestante < produit.quantite * 0.2 ? 'text-red-600 font-medium' : ''}>
                          {produit.quantiteRestante}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {unites.find(u => u.value === produit.unite)?.label || produit.unite}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Demandes */}
        {activeTab === 'demandes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Demandes de Sortie</h2>
              <Button onClick={() => setShowAddDemande(true)}>
                <Plus size={16} className="mr-2" />
                Nouvelle Demande
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {demandes.map((demande) => (
                    <tr key={demande.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {demande.produitNom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {demande.quantite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {demande.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {demande.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          demande.statut === 'validee' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {demande.statut === 'validee' ? 'Validée' : 'En attente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {demande.statut === 'en_attente' && (
                          <Button 
                            variant="success" 
                            onClick={() => validerDemande(demande.id)}
                            className="text-xs py-1 px-2"
                          >
                            Valider
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Production */}
        {activeTab === 'production' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Production</h2>
              <Button onClick={() => setShowAddProduction(true)}>
                <Plus size={16} className="mr-2" />
                Nouvelle Production
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productions.map((production) => (
                    <tr key={production.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {production.produit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {production.quantite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {production.destination}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {production.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {production.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Équipe */}
        {activeTab === 'equipe' && currentUser.role === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Gestion de l'Équipe</h2>
              <Button onClick={() => setShowAddUser(true)}>
                <Plus size={16} className="mr-2" />
                Nouvel Utilisateur
              </Button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {utilisateurs.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.nom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'employe_production' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? 'Administrateur' :
                           user.role === 'employe_production' ? 'Employé Production' :
                           'Employé Boutique'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Recettes */}
        {activeTab === 'recettes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Recettes et Calculs</h2>
              <Button onClick={() => setShowAddRecette(true)}>
                <Plus size={16} className="mr-2" />
                Nouvelle Recette
              </Button>
            </div>
            
            <div className="space-y-6">
              {recettes.map((recette) => (
                <div key={recette.id} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium mb-4">{recette.nom}</h3>
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Ingrédients pour 1 unité :</h4>
                    <ul className="space-y-1">
                      {recette.ingredients.map((ing, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          • {ing.quantite} {ing.unite} de {ing.produitNom}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-700 mb-2">Calculateur de consommation :</h4>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        placeholder="Quantité produite"
                        className="px-3 py-2 border border-gray-300 rounded-lg w-32"
                        onChange={(e) => {
                          const quantite = parseInt(e.target.value) || 0;
                          if (quantite > 0) {
                            const consommation = calculerConsommation(recette.id, quantite);
                            console.log('Consommation calculée:', consommation);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-600">unités</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Onglet Paramètres */}
        {activeTab === 'parametres' && (
          <div>
            <h2 className="text-xl font-semibold mb-6">Paramètres</h2>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Unités de Mesure</h3>
                <Button onClick={() => setShowAddUnite(true)} variant="secondary">
                  <Plus size={16} className="mr-2" />
                  Ajouter Unité
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unites.map((unite, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{unite.label}</span>
                        <span className="text-gray-500 ml-2">({unite.value})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modales */}
      
      {/* Modale Ajouter Produit */}
      <Modal isOpen={showAddProduit} onClose={() => setShowAddProduit(false)} title="Ajouter un Produit">
        <Input
          label="Nom du produit"
          value={formProduit.nom}
          onChange={(value) => setFormProduit({...formProduit, nom: value})}
          required
        />
        <Input
          label="Date d'achat"
          type="date"
          value={formProduit.dateAchat}
          onChange={(value) => setFormProduit({...formProduit, dateAchat: value})}
          required
        />
        <Input
          label="Prix d'achat (€)"
          type="number"
          step="0.01"
          value={formProduit.prixAchat}
          onChange={(value) => setFormProduit({...formProduit, prixAchat: value})}
          required
        />
        <Input
          label="Quantité"
          type="number"
          step="0.01"
          value={formProduit.quantite}
          onChange={(value) => setFormProduit({...formProduit, quantite: value})}
          required
        />
        <Select
          label="Unité de mesure"
          value={formProduit.unite}
          onChange={(value) => setFormProduit({...formProduit, unite: value})}
          options={unites}
          placeholder="Choisir une unité"
        />
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterProduit} className="flex-1">
            Ajouter
          </Button>
          <Button variant="secondary" onClick={() => setShowAddProduit(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>

      {/* Modale Nouvelle Demande */}
      <Modal isOpen={showAddDemande} onClose={() => setShowAddDemande(false)} title="Nouvelle Demande">
        <Select
          label="Produit"
          value={formDemande.produitId}
          onChange={(value) => setFormDemande({...formDemande, produitId: value})}
          options={produits.map(p => ({ value: p.id, label: `${p.nom} (${p.quantiteRestante} ${unites.find(u => u.value === p.unite)?.label || p.unite} disponibles)` }))}
          placeholder="Choisir un produit"
        />
        <Input
          label="Quantité demandée"
          type="number"
          step="0.01"
          value={formDemande.quantite}
          onChange={(value) => setFormDemande({...formDemande, quantite: value})}
          required
        />
        <Select
          label="Destination"
          value={formDemande.destination}
          onChange={(value) => setFormDemande({...formDemande, destination: value})}
          options={[
            { value: 'Boutique', label: 'Boutique' },
            { value: 'Production', label: 'Production' }
          ]}
          placeholder="Choisir la destination"
        />
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterDemande} className="flex-1">
            Créer la demande
          </Button>
          <Button variant="secondary" onClick={() => setShowAddDemande(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>

      {/* Modale Nouvelle Production */}
      <Modal isOpen={showAddProduction} onClose={() => setShowAddProduction(false)} title="Nouvelle Production">
        <Input
          label="Produit fabriqué"
          value={formProduction.produit}
          onChange={(value) => setFormProduction({...formProduction, produit: value})}
          placeholder="Ex: Croissants, Pain, Gâteaux..."
          required
        />
        <Input
          label="Quantité produite"
          type="number"
          value={formProduction.quantite}
          onChange={(value) => setFormProduction({...formProduction, quantite: value})}
          required
        />
        <Select
          label="Destination"
          value={formProduction.destination}
          onChange={(value) => setFormProduction({...formProduction, destination: value})}
          options={[
            { value: 'Boutique', label: 'Boutique' }
          ]}
        />
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterProduction} className="flex-1">
            Enregistrer
          </Button>
          <Button variant="secondary" onClick={() => setShowAddProduction(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>

      {/* Modale Nouvel Utilisateur */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Nouvel Utilisateur">
        <Input
          label="Nom complet"
          value={formUser.nom}
          onChange={(value) => setFormUser({...formUser, nom: value})}
          required
        />
        <Input
          label="Email"
          type="email"
          value={formUser.email}
          onChange={(value) => setFormUser({...formUser, email: value})}
          required
        />
        <Select
          label="Rôle"
          value={formUser.role}
          onChange={(value) => setFormUser({...formUser, role: value})}
          options={[
            { value: 'admin', label: 'Administrateur' },
            { value: 'employe_production', label: 'Employé Production' },
            { value: 'employe_boutique', label: 'Employé Boutique' }
          ]}
          placeholder="Choisir un rôle"
        />
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterUtilisateur} className="flex-1">
            Créer l'utilisateur
          </Button>
          <Button variant="secondary" onClick={() => setShowAddUser(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>

      {/* Modale Nouvelle Recette */}
      <Modal isOpen={showAddRecette} onClose={() => setShowAddRecette(false)} title="Nouvelle Recette">
        <Input
          label="Nom de la recette"
          value={formRecette.nom}
          onChange={(value) => setFormRecette({...formRecette, nom: value})}
          placeholder="Ex: Pain, Croissant..."
          required
        />
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ingrédients</label>
          {formRecette.ingredients.map((ingredient, index) => (
            <div key={index} className="flex space-x-2 mb-2">
              <Select
                value={ingredient.produitId}
                onChange={(value) => {
                  const newIngredients = [...formRecette.ingredients];
                  newIngredients[index].produitId = value;
                  setFormRecette({...formRecette, ingredients: newIngredients});
                }}
                options={produits.map(p => ({ value: p.id, label: p.nom }))}
                placeholder="Produit"
              />
              <Input
                type="number"
                step="0.01"
                value={ingredient.quantite}
                onChange={(value) => {
                  const newIngredients = [...formRecette.ingredients];
                  newIngredients[index].quantite = value;
                  setFormRecette({...formRecette, ingredients: newIngredients});
                }}
                placeholder="Quantité"
              />
              <Select
                value={ingredient.unite}
                onChange={(value) => {
                  const newIngredients = [...formRecette.ingredients];
                  newIngredients[index].unite = value;
                  setFormRecette({...formRecette, ingredients: newIngredients});
                }}
                options={unites}
              />
              <Button
                variant="danger"
                onClick={() => {
                  const newIngredients = formRecette.ingredients.filter((_, i) => i !== index);
                  setFormRecette({...formRecette, ingredients: newIngredients});
                }}
                className="px-2 py-1"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          
          <Button
            variant="secondary"
            onClick={() => {
              setFormRecette({
                ...formRecette,
                ingredients: [...formRecette.ingredients, { produitId: '', quantite: '', unite: 'g' }]
              });
            }}
            className="mt-2"
          >
            <Plus size={16} className="mr-1" />
            Ajouter un ingrédient
          </Button>
        </div>
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterRecette} className="flex-1">
            Créer la recette
          </Button>
          <Button variant="secondary" onClick={() => setShowAddRecette(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>

      {/* Modale Ajouter Unité */}
      <Modal isOpen={showAddUnite} onClose={() => setShowAddUnite(false)} title="Nouvelle Unité de Mesure">
        <Input
          label="Code de l'unité"
          value={newUnite.value}
          onChange={(value) => setNewUnite({...newUnite, value: value})}
          placeholder="Ex: sacs, pots..."
          required
        />
        <Input
          label="Libellé"
          value={newUnite.label}
          onChange={(value) => setNewUnite({...newUnite, label: value})}
          placeholder="Ex: Sacs, Pots..."
          required
        />
        
        <div className="flex space-x-4 mt-6">
          <Button onClick={ajouterUnite} className="flex-1">
            Ajouter
          </Button>
          <Button variant="secondary" onClick={() => setShowAddUnite(false)} className="flex-1">
            Annuler
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default PatisserieStockApp;
