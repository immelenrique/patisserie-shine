# Exemple d'Utilisation - Nouveaux Contexts

Ce fichier montre comment utiliser les nouveaux contexts dans votre application.

## 🚀 Utilisation dans page.js (NOUVELLE VERSION)

```javascript
// src/app/page.js
"use client";

import { AuthProvider, PermissionProvider } from '../contexts'
import AppShell from '../components/layout/AppShell'

export default function Home() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <AppShell />
      </PermissionProvider>
    </AuthProvider>
  )
}
```

**C'est tout ! 595 lignes → 15 lignes** ✨

---

## 📝 Exemple de Composant Utilisant les Hooks

### Exemple 1: Composant Simple

```javascript
// src/components/MyComponent.js
"use client";

import { useAuth, usePermissions } from '@/contexts'

export default function MyComponent() {
  const { user, isAdmin } = useAuth()
  const { hasPermission } = usePermissions()

  if (!hasPermission('view_stock')) {
    return <div>Accès refusé</div>
  }

  return (
    <div>
      <h1>Bonjour {user.nom}</h1>
      {isAdmin && <AdminPanel />}
    </div>
  )
}
```

### Exemple 2: Avec Data Fetching

```javascript
// src/components/UserList.js
"use client";

import { useAsyncData } from '@/hooks'
import { userService } from '@/services'

export default function UserList() {
  const { data, loading, error, refetch } = useAsyncData(
    () => userService.getAll(),
    []
  )

  if (loading) return <div>Chargement...</div>
  if (error) return <div>Erreur: {error}</div>

  return (
    <div>
      <button onClick={refetch}>Rafraîchir</button>
      {data?.users.map(user => (
        <div key={user.id}>{user.nom}</div>
      ))}
    </div>
  )
}
```

### Exemple 3: Avec localStorage

```javascript
// src/components/Settings.js
"use client";

import { useLocalStorage } from '@/hooks'

export default function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light')

  return (
    <div>
      <button onClick={() => setTheme('dark')}>
        Mode Sombre
      </button>
      <p>Thème actuel: {theme}</p>
    </div>
  )
}
```

---

## 🔄 Migration Progressive

Vous n'avez **pas besoin de tout réécrire** !

### Étape 1: Envelopper avec les Providers

```javascript
// page.js
<AuthProvider>
  <PermissionProvider>
    {/* Votre ancien code ici */}
  </PermissionProvider>
</AuthProvider>
```

### Étape 2: Utiliser les hooks dans les nouveaux composants

Les anciens composants continuent de fonctionner !

### Étape 3: Migrer progressivement

Remplacez les props par les hooks au fur et à mesure.

---

## 📦 Services Disponibles

Tous les services sont maintenant centralisés :

```javascript
import {
  authService,
  userService,
  permissionService,
  historiqueVentesService
} from '@/services'

// Utilisation
const { users } = await userService.getAll()
const { user, error } = await authService.signInWithUsername('username', 'password')
```

---

## 🎯 Hooks Disponibles

```javascript
// Contexts
import { useAuth, usePermissions } from '@/contexts'

// Utilitaires
import { useAsyncData, useLocalStorage } from '@/hooks'
```

---

## ✨ Avantages

1. **Code Plus Court**: 595 lignes → ~50 lignes pour page.js
2. **Réutilisable**: Hooks utilisables partout
3. **Testable**: Facile à tester avec mocks
4. **Maintenable**: Logique centralisée
5. **Performant**: Moins de re-renders

---

## 📚 Documentation Complète

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Guide de migration
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Plan complet
