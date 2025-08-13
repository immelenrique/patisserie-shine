"use client";
import React, { useState, useEffect } from 'react';
import { Plus, Users, Package, ShoppingCart, Factory, Calculator, Settings, Trash2, Edit, LogOut, Eye, EyeOff, Mail, Lock, ChefHat, TrendingUp, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';

// Styles CSS inline pour assurer l'affichage
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    color: #374151;
    background-color: #f9fafb;
  }
  
  .bg-gradient-to-r {
    background-image: linear-gradient(to right, var(--tw-gradient-stops));
  }
  
  .from-blue-600 {
    --tw-gradient-from: #2563eb;
    --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(37, 99, 235, 0));
  }
  
  .to-blue-700 {
    --tw-gradient-to: #1d4ed8;
  }
  
  .from-blue-50 {
    --tw-gradient-from: #eff6ff;
    --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(239, 246, 255, 0));
  }
  
  .to-purple-50 {
    --tw-gradient-to: #faf5ff;
  }
  
  .shadow-lg {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  
  .shadow-xl {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .rounded-xl {
    border-radius: 0.75rem;
  }
  
  .rounded-2xl {
    border-radius: 1rem;
  }
  
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
  
  .duration-200 {
    transition-duration: 200ms;
  }
  
  .duration-300 {
    transition-duration: 300ms;
  }
  
  .hover\\:scale-105:hover {
    transform: scale(1.05);
  }
  
  .active\\:scale-95:active {
    transform: scale(0.95);
  }
  
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }
`;

// Injection des styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Composants UI modernes avec styles inline
const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, icon: Icon, type = 'button' }) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '500',
    borderRadius: '0.75rem',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: disabled ? '0.5' : '1',
    transform: 'scale(1)',
    outline: 'none',
    fontFamily: 'inherit'
  };
  
  const variants = {
    primary: {
      background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    secondary: {
      background: 'white',
      color: '#374151',
      border: '1px solid #d1d5db',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    },
    danger: {
      background: 'linear-gradient(to right, #dc2626, #b91c1c)',
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    success: {
      background: 'linear-gradient(to right, #059669, #047857)',
      color: 'white',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    ghost: {
      background: 'transparent',
      color: '#6b7280',
      border: 'none'
    }
  };
  
  const sizes = {
    sm: { padding: '0.5rem 0.75rem', fontSize: '0.875rem' },
    md: { padding: '0.625rem 1rem', fontSize: '0.875rem' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
    xl: { padding: '1rem 2rem', fontSize: '1.125rem' }
  };
  
  const handleMouseEnter = (e) => {
    if (!disabled) {
      e.target.style.transform = 'scale(1.05)';
      if (variant === 'primary') {
        e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
      }
    }
  };
  
  const handleMouseLeave = (e) => {
    if (!disabled) {
      e.target.style.transform = 'scale(1)';
      if (variant === 'primary') {
        e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
      }
    }
  };
  
  return (
    <button 
      type={type}
      style={{...baseStyles, ...variants[variant], ...sizes[size]}}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} style={{marginRight: '0.5rem'}} />}
      {children}
    </button>
  );
};

const Input = ({ label, value, onChange, type = 'text', placeholder, required = false, icon: Icon, error }) => (
  <div style={{marginBottom: '1rem'}}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '0.5rem'
      }}>
        {label} {required && <span style={{color: '#ef4444'}}>*</span>}
      </label>
    )}
    <div style={{position: 'relative'}}>
      {Icon && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '0.75rem',
          transform: 'translateY(-50%)',
          pointerEvents: 'none'
        }}>
          <Icon style={{width: '1.25rem', height: '1.25rem', color: '#9ca3af'}} />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          paddingLeft: Icon ? '2.5rem' : '1rem',
          paddingRight: '1rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
          border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
          borderRadius: '0.75rem',
          fontSize: '0.875rem',
          transition: 'all 0.2s ease',
          outline: 'none',
          fontFamily: 'inherit'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? '#ef4444' : '#2563eb';
          e.target.style.boxShadow = error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(37, 99, 235, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#d1d5db';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
    {error && <p style={{fontSize: '0.875rem', color: '#ef4444', marginTop: '0.25rem'}}>{error}</p>}
  </div>
);

const Select = ({ label, value, onChange, options, placeholder, required = false, error }) => (
  <div style={{marginBottom: '1rem'}}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '0.5rem'
      }}>
        {label} {required && <span style={{color: '#ef4444'}}>*</span>}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
        borderRadius: '0.75rem',
        fontSize: '0.875rem',
        transition: 'all 0.2s ease',
        outline: 'none',
        fontFamily: 'inherit',
        backgroundColor: 'white'
      }}
      onFocus={(e) => {
        e.target.style.borderColor = error ? '#ef4444' : '#2563eb';
        e.target.style.boxShadow = error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(37, 99, 235, 0.1)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#d1d5db';
        e.target.style.boxShadow = 'none';
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option, index) => (
        <option key={index} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error && <p style={{fontSize: '0.875rem', color: '#ef4444', marginTop: '0.25rem'}}>{error}</p>}
  </div>
);

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizes = {
    sm: '28rem',
    md: '32rem',
    lg: '48rem',
    xl: '64rem'
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: sizes[size],
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '1.5rem',
          borderRadius: '1rem 1rem 0 0'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0}}>{title}</h2>
            <button 
              onClick={onClose}
              style={{
                color: '#9ca3af',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#6b7280';
                e.target.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#9ca3af';
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{padding: '1.5rem'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

const Card = ({ children, className = '', hover = true, style = {} }) => (
  <div 
    style={{
      backgroundColor: 'white',
      borderRadius: '1rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      border: '1px solid #f3f4f6',
      transition: hover ? 'all 0.3s ease' : 'none',
      ...style
    }}
    onMouseEnter={hover ? (e) => {
      e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
    } : undefined}
    onMouseLeave={hover ? (e) => {
      e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } : undefined}
    className={className}
  >
    {children}
  </div>
);

const StatCard = ({ title, value, change, icon: Icon, color = 'blue' }) => {
  const colors = {
    blue: 'linear-gradient(to right, #3b82f6, #2563eb)',
    green: 'linear-gradient(to right, #10b981, #059669)',
    red: 'linear-gradient(to right, #ef4444, #dc2626)',
    yellow: 'linear-gradient(to right, #f59e0b, #d97706)',
    purple: 'linear-gradient(to right, #8b5cf6, #7c3aed)'
  };

  return (
    <Card style={{padding: '1.5rem'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div>
          <p style={{fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: '0 0 0.5rem 0'}}>{title}</p>
          <p style={{fontSize: '1.875rem', fontWeight: '700', color: '#111827', margin: '0 0 0.5rem 0'}}>{value}</p>
          {change && (
            <p style={{
              fontSize: '0.875rem',
              color: change.startsWith('+') ? '#059669' : change.includes('Action') || change.includes('nécessaire') ? '#d97706' : '#059669',
              display: 'flex',
              alignItems: 'center',
              margin: 0
            }}>
              {change}
            </p>
          )}
        </div>
        <div style={{
          padding: '0.75rem',
          borderRadius: '1rem',
          background: colors[color]
        }}>
          <Icon style={{width: '2rem', height: '2rem', color: 'white'}} />
        </div>
      </div>
    </Card>
  );
};

// Composant de connexion
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulation de connexion (à remplacer par votre logique Supabase)
    setTimeout(() => {
      if (email === 'admin@patisserie.com' && password === 'admin123') {
        onLogin({ id: 1, nom: 'Admin Principal', email: 'admin@patisserie.com', role: 'admin' });
      } else if (email === 'marie@patisserie.com' && password === 'marie123') {
        onLogin({ id: 2, nom: 'Marie Dubois', email: 'marie@patisserie.com', role: 'employe_production' });
      } else if (email === 'jean@patisserie.com' && password === 'jean123') {
        onLogin({ id: 3, nom: 'Jean Martin', email: 'jean@patisserie.com', role: 'employe_boutique' });
      } else {
        setError('Email ou mot de passe incorrect');
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">StockMaster Pro</h1>
          <p className="text-gray-600">Gestion intelligente pour votre pâtisserie</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="votre@email.com"
              icon={Mail}
              required
              error={error}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-2">Comptes de démonstration :</p>
            <div className="space-y-1 text-xs text-gray-500">
              <div>👑 Admin: admin@patisserie.com / admin123</div>
              <div>🏭 Production: marie@patisserie.com / marie123</div>
              <div>🏪 Boutique: jean@patisserie.com / jean123</div>
            </div>
          </div>
        </Card>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            © 2024 StockMaster Pro - Solution professionnelle de gestion
          </p>
        </div>
      </div>
    </div>
  );
};

// Application principale
const PatisserieStockApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // États pour les données
  const [produits, setProduits] = useState([
    { id: 1, nom: 'Farine T45', dateAchat: '2024-01-15', prixAchat: 25.50, quantite: 50, unite: 'kg', quantiteRestante: 45 },
    { id: 2, nom: 'Levure fraîche', dateAchat: '2024-01-10', prixAchat: 3.20, quantite: 20, unite: 'pieces', quantiteRestante: 3 },
    { id: 3, nom: 'Beurre', dateAchat: '2024-01-12', prixAchat: 8.90, quantite: 10, unite: 'kg', quantiteRestante: 7 },
    { id: 4, nom: 'Sucre blanc', dateAchat: '2024-01-08', prixAchat: 15.30, quantite: 25, unite: 'kg', quantiteRestante: 2 }
  ]);
  
  const [demandes, setDemandes] = useState([
    { id: 1, produitId: 1, produitNom: 'Farine T45', quantite: 5, destination: 'Production', statut: 'en_attente', date: '2024-01-16' },
    { id: 2, produitId: 2, produitNom: 'Levure fraîche', quantite: 2, destination: 'Production', statut: 'validee', date: '2024-01-15' },
    { id: 3, produitId: 3, produitNom: 'Beurre', quantite: 1, destination: 'Boutique', statut: 'en_attente', date: '2024-01-16' }
  ]);
  
  const [productions, setProductions] = useState([
    { id: 1, produit: 'Croissants', quantite: 50, destination: 'Boutique', date: '2024-01-16', statut: 'termine' },
    { id: 2, produit: 'Pain de campagne', quantite: 20, destination: 'Boutique', date: '2024-01-16', statut: 'termine' },
    { id: 3, produit: 'Tartes aux fruits', quantite: 8, destination: 'Boutique', date: '2024-01-15', statut: 'termine' }
  ]);
  
  const [utilisateurs, setUtilisateurs] = useState([
    { id: 1, nom: 'Admin Principal', email: 'admin@patisserie.com', role: 'admin' },
    { id: 2, nom: 'Marie Dubois', email: 'marie@patisserie.com', role: 'employe_production' },
    { id: 3, nom: 'Jean Martin', email: 'jean@patisserie.com', role: 'employe_boutique' }
  ]);
  
  const [recettes, setRecettes] = useState([
    { 
      id: 1, 
      nom: 'Croissant', 
      ingredients: [
        { produitId: 1, produitNom: 'Farine T45', quantite: 500, unite: 'g' },
        { produitId: 2, produitNom: 'Levure fraîche', quantite: 0.5, unite: 'pieces' },
        { produitId: 3, produitNom: 'Beurre', quantite: 250, unite: 'g' }
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

  // Si pas connecté, afficher la page de connexion
  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  // Calculs pour le dashboard
  const produitsEnStock = produits.length;
  const demandesEnAttente = demandes.filter(d => d.statut === 'en_attente').length;
  const productionsJour = productions.filter(p => p.date === '2024-01-16').length;
  const stocksFaibles = produits.filter(p => p.quantiteRestante < p.quantite * 0.2).length;

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
      setProduits(produits.map(p => 
        p.id === demande.produitId 
          ? { ...p, quantiteRestante: p.quantiteRestante - demande.quantite }
          : p
      ));
      
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
      statut: 'termine'
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

  const logout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: BarChart3 },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'demandes', label: 'Demandes', icon: ShoppingCart, badge: demandesEnAttente },
    { id: 'production', label: 'Production', icon: Factory },
    { id: 'equipe', label: 'Équipe', icon: Users, adminOnly: true },
    { id: 'recettes', label: 'Recettes', icon: Calculator },
    { id: 'parametres', label: 'Paramètres', icon: Settings, adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || currentUser.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header moderne */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <ChefHat className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">StockMaster Pro</h1>
                  <p className="text-sm text-gray-500">Gestion intelligente</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {currentUser.nom.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{currentUser.nom}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {currentUser.role === 'admin' ? 'Administrateur' :
                     currentUser.role === 'employe_production' ? 'Production' : 'Boutique'}
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                icon={LogOut}
                onClick={logout}
                className="text-gray-500 hover:text-red-600"
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation moderne */}
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
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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

            {/* Statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Produits en Stock"
                value={produitsEnStock}
                change="+2 cette semaine"
                icon={Package}
                color="blue"
              />
              <StatCard
                title="Demandes en Attente"
                value={demandesEnAttente}
                change={demandesEnAttente > 0 ? "Action requise" : "Aucune"}
                icon={Clock}
                color={demandesEnAttente > 0 ? "yellow" : "green"}
              />
              <StatCard
                title="Productions Aujourd'hui"
                value={productionsJour}
                change="+15% vs hier"
                icon={Factory}
                color="green"
              />
              <StatCard
                title="Alertes Stock"
                value={stocksFaibles}
                change={stocksFaibles > 0 ? "Réappro. nécessaire" : "Stock OK"}
                icon={AlertTriangle}
                color={stocksFaibles > 0 ? "red" : "green"}
              />
            </div>

            {/* Alertes importantes */}
            {stocksFaibles > 0 && (
              <Card className="p-6 border-l-4 border-red-500 bg-red-50">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Attention - Stock Faible</h3>
                    <p className="text-red-700">
                      {stocksFaibles} produit(s) ont un stock inférieur à 20% de la quantité initiale
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => setActiveTab('stock')}
                  >
                    Voir les détails
                  </Button>
                </div>
              </Card>
            )}

            {/* Activité récente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Demandes Récentes</h3>
                <div className="space-y-3">
                  {demandes.slice(0, 5).map((demande) => (
                    <div key={demande.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{demande.produitNom}</p>
                        <p className="text-sm text-gray-500">{demande.quantite} unités → {demande.destination}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        demande.statut === 'validee' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {demande.statut === 'validee' ? 'Validée' : 'En attente'}
                      </span>
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
                        <p className="font-medium text-gray-900">{production.produit}</p>
                        <p className="text-sm text-gray-500">{production.quantite} unités - {production.date}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Terminé
                      </span>
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
                <p className="text-gray-600">Suivi des matières premières et ingrédients</p>
              </div>
              <Button onClick={() => setShowAddProduit(true)} icon={Plus}>
                Ajouter Produit
              </Button>
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Achat</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Initial</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Restant</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niveau</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {produits.map((produit) => {
                      const pourcentage = (produit.quantiteRestante / produit.quantite) * 100;
                      const isLow = pourcentage < 20;
                      const isMedium = pourcentage < 50 && pourcentage >= 20;
                      
                      return (
                        <tr key={produit.id} className={isLow ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-3 ${
                                isLow ? 'bg-red-500' : isMedium ? 'bg-yellow-500' : 'bg-green-500'
                              }`}></div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{produit.nom}</div>
                                <div className="text-sm text-gray-500">
                                  {unites.find(u => u.value === produit.unite)?.label}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {produit.dateAchat}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {produit.prixAchat}€
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {produit.quantite}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              isLow ? 'text-red-600' : isMedium ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {produit.quantiteRestante}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  isLow ? 'bg-red-500' : isMedium ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.max(pourcentage, 5)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 mt-1 block">
                              {Math.round(pourcentage)}%
                            </span>
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
                <h2 className="text-2xl font-bold text-gray-900">Demandes de Sortie</h2>
                <p className="text-gray-600">Gestion des sorties de stock</p>
              </div>
              <Button onClick={() => setShowAddDemande(true)} icon={Plus}>
                Nouvelle Demande
              </Button>
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {demandes.map((demande) => (
                      <tr key={demande.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{demande.produitNom}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {demande.quantite}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            demande.destination === 'Production' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {demande.destination}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {demande.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            demande.statut === 'validee' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              demande.statut === 'validee' ? 'bg-green-500' : 'bg-yellow-500'
                            }`}></div>
                            {demande.statut === 'validee' ? 'Validée' : 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {demande.statut === 'en_attente' && currentUser.role === 'admin' && (
                            <Button 
                              variant="success" 
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => validerDemande(demande.id)}
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
            </Card>
          </div>
        )}

        {/* Onglet Production */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Production</h2>
                <p className="text-gray-600">Suivi des produits finis</p>
              </div>
              {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
                <Button onClick={() => setShowAddProduction(true)} icon={Plus}>
                  Nouvelle Production
                </Button>
              )}
            </div>
            
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productions.map((production) => (
                      <tr key={production.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                              <ChefHat className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-sm font-medium text-gray-900">{production.produit}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {production.quantite}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {production.destination}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {production.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {production.statut}
                          </span>
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
              <Button onClick={() => setShowAddUser(true)} icon={Plus}>
                Nouvel Utilisateur
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {utilisateurs.map((user) => (
                <Card key={user.id} className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl flex items-center justify-center">
                      <span className="text-white text-lg font-semibold">
                        {user.nom.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{user.nom}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'employe_production' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {user.role === 'admin' ? '👑 Administrateur' :
                     user.role === 'employe_production' ? '🏭 Employé Production' :
                     '🏪 Employé Boutique'}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Onglet Recettes */}
        {activeTab === 'recettes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Recettes et Calculs</h2>
                <p className="text-gray-600">Formules et consommation d'ingrédients</p>
              </div>
              <Button onClick={() => setShowAddRecette(true)} icon={Plus}>
                Nouvelle Recette
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recettes.map((recette) => (
                <Card key={recette.id} className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <Calculator className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{recette.nom}</h3>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-3">Ingrédients pour 1 unité :</h4>
                    <div className="space-y-2">
                      {recette.ingredients.map((ing, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700">{ing.produitNom}</span>
                          <span className="text-sm font-medium text-gray-900">
                            {ing.quantite} {ing.unite}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-700 mb-3">Calculateur de consommation :</h4>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        placeholder="Quantité"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onChange={(e) => {
                          const quantite = parseInt(e.target.value) || 0;
                          if (quantite > 0) {
                            console.log(`Production de ${quantite} ${recette.nom}(s)`);
                            recette.ingredients.forEach(ing => {
                              console.log(`${ing.produitNom}: ${ing.quantite * quantite} ${ing.unite}`);
                            });
                          }
                        }}
                      />
                      <Button variant="secondary" size="sm">
                        Calculer
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Onglet Paramètres */}
        {activeTab === 'parametres' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Paramètres</h2>
              <p className="text-gray-600">Configuration de l'application</p>
            </div>
            
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Unités de Mesure</h3>
                  <p className="text-sm text-gray-600">Gérer les unités disponibles</p>
                </div>
                <Button variant="secondary" onClick={() => setShowAddUnite(true)} icon={Plus}>
                  Ajouter Unité
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unites.map((unite, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 transition-colors duration-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-900">{unite.label}</span>
                        <span className="text-gray-500 ml-2 text-sm">({unite.value})</span>
                      </div>
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Modales */}
      
      {/* Modale Ajouter Produit */}
      <Modal isOpen={showAddProduit} onClose={() => setShowAddProduit(false)} title="Ajouter un Produit" size="md">
        <div className="space-y-6">
          <Input
            label="Nom du produit"
            value={formProduit.nom}
            onChange={(value) => setFormProduit({...formProduit, nom: value})}
            placeholder="Ex: Farine T45, Beurre..."
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
            label="Prix d'achat"
            type="number"
            step="0.01"
            value={formProduit.prixAchat}
            onChange={(value) => setFormProduit({...formProduit, prixAchat: value})}
            placeholder="0.00"
            required
          />
          <Input
            label="Quantité"
            type="number"
            step="0.01"
            value={formProduit.quantite}
            onChange={(value) => setFormProduit({...formProduit, quantite: value})}
            placeholder="0"
            required
          />
          <Select
            label="Unité de mesure"
            value={formProduit.unite}
            onChange={(value) => setFormProduit({...formProduit, unite: value})}
            options={unites}
            placeholder="Choisir une unité"
            required
          />
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterProduit} className="flex-1">
              Ajouter le produit
            </Button>
            <Button variant="secondary" onClick={() => setShowAddProduit(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Nouvelle Demande */}
      <Modal isOpen={showAddDemande} onClose={() => setShowAddDemande(false)} title="Nouvelle Demande" size="md">
        <div className="space-y-6">
          <Select
            label="Produit"
            value={formDemande.produitId}
            onChange={(value) => setFormDemande({...formDemande, produitId: value})}
            options={produits.map(p => ({ 
              value: p.id, 
              label: `${p.nom} (${p.quantiteRestante} ${unites.find(u => u.value === p.unite)?.label || p.unite} disponibles)` 
            }))}
            placeholder="Choisir un produit"
            required
          />
          <Input
            label="Quantité demandée"
            type="number"
            step="0.01"
            value={formDemande.quantite}
            onChange={(value) => setFormDemande({...formDemande, quantite: value})}
            placeholder="0"
            required
          />
          <Select
            label="Destination"
            value={formDemande.destination}
            onChange={(value) => setFormDemande({...formDemande, destination: value})}
            options={[
              { value: 'Boutique', label: '🏪 Boutique' },
              { value: 'Production', label: '🏭 Production' }
            ]}
            placeholder="Choisir la destination"
            required
          />
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterDemande} className="flex-1">
              Créer la demande
            </Button>
            <Button variant="secondary" onClick={() => setShowAddDemande(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Nouvelle Production */}
      <Modal isOpen={showAddProduction} onClose={() => setShowAddProduction(false)} title="Nouvelle Production" size="md">
        <div className="space-y-6">
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
            placeholder="0"
            required
          />
          <Select
            label="Destination"
            value={formProduction.destination}
            onChange={(value) => setFormProduction({...formProduction, destination: value})}
            options={[
              { value: 'Boutique', label: '🏪 Boutique' }
            ]}
            required
          />
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterProduction} className="flex-1">
              Enregistrer la production
            </Button>
            <Button variant="secondary" onClick={() => setShowAddProduction(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Nouvel Utilisateur */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Nouvel Utilisateur" size="md">
        <div className="space-y-6">
          <Input
            label="Nom complet"
            value={formUser.nom}
            onChange={(value) => setFormUser({...formUser, nom: value})}
            placeholder="Ex: Marie Dupont"
            required
          />
          <Input
            label="Adresse email"
            type="email"
            value={formUser.email}
            onChange={(value) => setFormUser({...formUser, email: value})}
            placeholder="marie@patisserie.com"
            icon={Mail}
            required
          />
          <Select
            label="Rôle"
            value={formUser.role}
            onChange={(value) => setFormUser({...formUser, role: value})}
            options={[
              { value: 'admin', label: '👑 Administrateur' },
              { value: 'employe_production', label: '🏭 Employé Production' },
              { value: 'employe_boutique', label: '🏪 Employé Boutique' }
            ]}
            placeholder="Choisir un rôle"
            required
          />
          
          <div className="bg-blue-50 p-4 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Permissions par rôle :</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div>👑 <strong>Administrateur</strong> : Accès complet à toutes les fonctionnalités</div>
              <div>🏭 <strong>Production</strong> : Gestion stock, demandes, production et recettes</div>
              <div>🏪 <strong>Boutique</strong> : Consultation stock et création de demandes</div>
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterUtilisateur} className="flex-1">
              Créer l'utilisateur
            </Button>
            <Button variant="secondary" onClick={() => setShowAddUser(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Nouvelle Recette */}
      <Modal isOpen={showAddRecette} onClose={() => setShowAddRecette(false)} title="Nouvelle Recette" size="lg">
        <div className="space-y-6">
          <Input
            label="Nom de la recette"
            value={formRecette.nom}
            onChange={(value) => setFormRecette({...formRecette, nom: value})}
            placeholder="Ex: Pain de campagne, Croissant..."
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Ingrédients <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {formRecette.ingredients.map((ingredient, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Select
                        value={ingredient.produitId}
                        onChange={(value) => {
                          const newIngredients = [...formRecette.ingredients];
                          newIngredients[index].produitId = value;
                          setFormRecette({...formRecette, ingredients: newIngredients});
                        }}
                        options={produits.map(p => ({ value: p.id, label: p.nom }))}
                        placeholder="Choisir un produit"
                      />
                    </div>
                    <div>
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
                    </div>
                    <div className="flex space-x-2">
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
                        size="sm"
                        onClick={() => {
                          const newIngredients = formRecette.ingredients.filter((_, i) => i !== index);
                          setFormRecette({...formRecette, ingredients: newIngredients});
                        }}
                        className="px-3"
                        disabled={formRecette.ingredients.length === 1}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button
              variant="secondary"
              onClick={() => {
                setFormRecette({
                  ...formRecette,
                  ingredients: [...formRecette.ingredients, { produitId: '', quantite: '', unite: 'g' }]
                });
              }}
              icon={Plus}
              className="mt-3"
            >
              Ajouter un ingrédient
            </Button>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterRecette} className="flex-1">
              Créer la recette
            </Button>
            <Button variant="secondary" onClick={() => setShowAddRecette(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modale Ajouter Unité */}
      <Modal isOpen={showAddUnite} onClose={() => setShowAddUnite(false)} title="Nouvelle Unité de Mesure" size="md">
        <div className="space-y-6">
          <Input
            label="Code de l'unité"
            value={newUnite.value}
            onChange={(value) => setNewUnite({...newUnite, value: value})}
            placeholder="Ex: sacs, pots, tubes..."
            required
          />
          <Input
            label="Libellé complet"
            value={newUnite.label}
            onChange={(value) => setNewUnite({...newUnite, label: value})}
            placeholder="Ex: Sacs, Pots, Tubes..."
            required
          />
          
          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="font-medium text-gray-900 mb-2">Aperçu :</h4>
            <p className="text-sm text-gray-600">
              {newUnite.label || 'Libellé'} ({newUnite.value || 'code'})
            </p>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <Button onClick={ajouterUnite} className="flex-1">
              Ajouter l'unité
            </Button>
            <Button variant="secondary" onClick={() => setShowAddUnite(false)} className="flex-1">
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm text-gray-600">
                © 2024 StockMaster Pro - Solution professionnelle de gestion
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Alimenté par Supabase & Vercel</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PatisserieStockApp;
