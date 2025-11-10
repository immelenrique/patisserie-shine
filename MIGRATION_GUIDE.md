# Guide de Migration - Nouveaux Contexts

Ce guide explique comment utiliser les nouveaux `AuthContext` et `PermissionContext`.

## 🎯 Pourquoi Cette Migration ?

**Avant:** État et logique dispersés dans `page.js` (595 lignes)
**Après:** Contexts réutilisables + Hooks simples + Code organisé

---

## 📚 Nouveaux Hooks Disponibles

### 1. `useAuth()` - Authentification

```javascript
import { useAuth } from '@/contexts/AuthContext'

function MonComposant() {
  const {
    user,              // Utilisateur connecté avec profil
    session,           // Session Supabase
    loading,           // État de chargement
    signIn,            // Fonction de connexion
    signOut,           // Fonction de déconnexion
    refreshUser,       // Rafraîchir le profil
    isAuthenticated,   // Boolean: utilisateur connecté?
    isAdmin,           // Boolean: admin ou propriétaire?
  } = useAuth()

  if (loading) return <Spinner />
  if (!isAuthenticated) return <LoginForm />

  return <div>Bonjour {user.nom}</div>
}
```

### 2. `usePermissions()` - Permissions

```javascript
import { usePermissions } from '@/contexts/PermissionContext'

function MonComposant() {
  const {
    hasPermission,         // Fonction pour vérifier
    availableTabs,         // Onglets accessibles
    canManagePermissions,  // Boolean: peut gérer permissions?
  } = usePermissions()

  if (!hasPermission('view_stock')) {
    return <AccessDenied />
  }

  return <StockManager />
}
```

---

## 🔄 Migration Rapide

### Étape 1: Envelopper l'App

**Fichier: `src/app/page.js`**

```javascript
"use client";
import { AuthProvider } from '../contexts/AuthContext'
import { PermissionProvider } from '../contexts/PermissionContext'

export default function Home() {
  return (
    <AuthProvider>
      <PermissionProvider>
        {/* Votre contenu actuel */}
      </PermissionProvider>
    </AuthProvider>
  )
}
```

### Étape 2: Utiliser les Hooks

**Avant:**
```javascript
const [currentUser, setCurrentUser] = useState(null)
const [loading, setLoading] = useState(true)
```

**Après:**
```javascript
const { user, loading } = useAuth()
```

---

## 💡 Exemples Pratiques

### Connexion
```javascript
const { signIn } = useAuth()

const handleLogin = async (username, password) => {
  const { error } = await signIn(username, password)
  if (error) alert(error)
}
```

### Déconnexion
```javascript
const { signOut } = useAuth()

const handleLogout = () => signOut()
```

### Vérifier Permissions
```javascript
const { hasPermission } = usePermissions()

return (
  <div>
    {hasPermission('view_stock') && <StockButton />}
    {hasPermission('manage_permissions') && <AdminPanel />}
  </div>
)
```

### Navigation Dynamique
```javascript
const { availableTabs } = usePermissions()

return (
  <nav>
    {availableTabs.map(tab => (
      <Link key={tab.id} href={`/${tab.id}`}>
        {tab.label}
      </Link>
    ))}
  </nav>
)
```

---

## 📖 Documentation Complète

Voir [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) pour le plan complet de migration.
