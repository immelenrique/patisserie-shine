# Plan de Refactoring - Pâtisserie Shine

## Résumé Exécutif

Ce document détaille le plan de refactoring pour améliorer l'architecture, la maintenabilité et la qualité du code de l'application Pâtisserie Shine.

**Durée Estimée:** 2-3 semaines
**Priorité:** HAUTE (Dette technique critique)

---

## Phase 1: Corrections Critiques ✅ COMPLÉTÉ

### 1.1 Sécurité Middleware ✅
**Fichier:** `src/middleware.js`
**Problème:** Bypass de sécurité non documenté
**Solution:** Ajout de vérification minimale du Bearer token
**Status:** ✅ COMPLÉTÉ

### 1.2 Fichiers Dupliqués ✅
**Problème:** `HistoriqueEmployeVentes.js` existait en 2 versions
**Solution:**
- Version Admin renommée → `HistoriqueVentesParEmploye.js` (vue focalisée)
- Version Caisse → `HistoriqueEmployeVentes.js` (vue globale)
- Imports mis à jour dans `Dashboard.js`

**Status:** ✅ COMPLÉTÉ

### 1.3 Services Dupliqués ✅
**Problème:** `historiqueVentesService` dans `lib/supabase.js` (3564 lignes) ET `services/`
**Solution:**
- Service principal: `src/services/historiqueVentesService.js`
- Créé: `src/lib/historiqueVentes.js` (re-export pour compatibilité)
- Composant admin mis à jour

**Status:** ✅ COMPLÉTÉ (lib/supabase.js reste à diviser complètement)

### 1.4 Nettoyage Fichiers Obsolètes ✅
- ✅ Supprimé: `Dashboard_last.js`

**Status:** ✅ COMPLÉTÉ

---

## Phase 2: Refactoring Architectural (EN COURS)

### 2.1 Diviser `lib/supabase.js` (3564 lignes → ~200 lignes)

**Objectif:** Séparer les 19 services en fichiers individuels

**Structure Cible:**
```
src/lib/
├── supabase-client.js          # Client Supabase uniquement (~60 lignes)
├── utils.js                    # Utilitaires formatage (EXISTE DÉJÀ ~100 lignes)
└── (autres services → src/services/)

src/services/
├── authService.js              # Authentification
├── userService.js              # Gestion utilisateurs
├── statsService.js             # Statistiques
├── productService.js           # Produits
├── demandeService.js           # Demandes
├── stockAtelierService.js      # Stock atelier
├── stockBoutiqueService.js     # Stock boutique
├── prixService.js              # Prix de vente
├── caisseService.js            # Caisse
├── comptabiliteService.js      # Comptabilité
├── productionService.js        # Production
├── recetteService.js           # Recettes
├── referentielService.js       # Référentiel produits
├── uniteService.js             # Unités de mesure
├── mouvementStockService.js    # Mouvements stock
├── arretCaisseService.js       # Arrêts de caisse
├── permissionService.js        # Permissions
├── historiqueVentesService.js  # Historique ventes (EXISTE DÉJÀ)
└── index.js                    # Barrel export
```

**Plan d'Action:**
1. Créer `src/lib/supabase-client.js` (export client uniquement)
2. Vérifier que `src/lib/utils.js` existe et fonctionne
3. Extraire chaque service un par un vers `src/services/`
4. Créer `src/services/index.js` pour exports centralisés
5. Mettre à jour tous les imports progressivement
6. Tester après chaque service migré
7. Supprimer les services de `lib/supabase.js` une fois migrés

**Ordre de Migration (du moins risqué au plus risqué):**
1. ✅ historiqueVentesService (DÉJÀ FAIT)
2. permissionService (peu de dépendances)
3. uniteService (simple)
4. referentielService
5. statsService
6. authService
7. userService
8. Les autres services métier

**Estimation:** 2-3 jours

---

### 2.2 Refactoring `src/app/page.js` (595 lignes)

**Problème Actuel:**
- Gère TOUT: auth, permissions, routing, state, rendering
- 10+ useState au root level
- Logique de permissions imbriquée (5 niveaux)
- Impossible à tester
- Performance impactée

**Architecture Cible:**

```
src/
├── app/
│   └── page.js                 # Point d'entrée léger (~50 lignes)
├── contexts/
│   ├── AuthContext.js          # Gestion auth globale
│   └── PermissionContext.js    # Gestion permissions
├── hooks/
│   ├── useAuth.js              # Hook authentification
│   ├── usePermissions.js       # Hook permissions
│   ├── useAsyncData.js         # Hook data fetching
│   └── useLocalStorage.js      # Hook localStorage
├── components/
│   ├── layout/
│   │   ├── AppShell.js         # Layout principal
│   │   ├── Sidebar.js          # Navigation latérale
│   │   ├── Header.js           # En-tête avec user menu
│   │   └── TabNavigation.js    # Navigation onglets
│   └── auth/
│       └── PasswordChangeModal.js  # (existe déjà)
└── lib/
    └── permissions.js          # Configuration permissions
```

**Étape 2.2.1: Créer les Contexts**

**Fichier:** `src/contexts/AuthContext.js`
```javascript
"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, authService } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialisation et gestion session
  // ... (extraire de page.js lines 34-100)

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

**Fichier:** `src/contexts/PermissionContext.js`
```javascript
"use client";
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

export function PermissionProvider({ children }) {
  const { user } = useAuth();

  // Extraire la logique de permissions de page.js (lines 184-253)
  const permissions = useMemo(() => {
    if (!user) return { availableTabs: [], hasPermission: () => false };

    // Logique de permissions ici
    // ...

    return { availableTabs, hasPermission };
  }, [user]);

  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error('usePermissions must be used within PermissionProvider');
  return context;
}
```

**Étape 2.2.2: Créer AppShell**

**Fichier:** `src/components/layout/AppShell.js`
```javascript
"use client";
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import Header from './Header';
import TabNavigation from './TabNavigation';
import PasswordChangeModal from '../auth/PasswordChangeModal';

export default function AppShell() {
  const { user, loading } = useAuth();
  const { availableTabs } = usePermissions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginForm />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onPasswordChange={() => setShowPasswordModal(true)} />
      <TabNavigation
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="container mx-auto p-6">
        {renderActiveComponent(activeTab, user)}
      </main>
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
}
```

**Étape 2.2.3: Nouveau `src/app/page.js`**
```javascript
"use client";
import { AuthProvider } from '../contexts/AuthContext';
import { PermissionProvider } from '../contexts/PermissionContext';
import AppShell from '../components/layout/AppShell';

export default function Home() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <AppShell />
      </PermissionProvider>
    </AuthProvider>
  );
}
```

**Estimation:** 3-4 jours

---

### 2.3 Standardiser les Patterns de Réponse API

**Problème:** 3 patterns différents dans les services

**Pattern Standard à Adopter:**
```javascript
{
  success: boolean,
  data: any,
  error: string | null
}
```

**Fichiers à Modifier:**
- Tous les services dans `src/services/`
- Wrapper utilitaire pour Supabase calls

**Fichier:** `src/lib/supabase-helpers.js`
```javascript
export async function executeQuery(queryFn, errorContext = '') {
  try {
    const result = await queryFn();

    if (result.error) {
      console.error(`${errorContext}:`, result.error);
      return { success: false, data: null, error: result.error.message };
    }

    return { success: true, data: result.data, error: null };
  } catch (error) {
    console.error(`${errorContext} (exception):`, error);
    return { success: false, data: null, error: error.message };
  }
}
```

**Usage:**
```javascript
// Avant
const { data, error } = await supabase.from('table').select()
if (error) return { error: error.message }
return { data }

// Après
return executeQuery(
  () => supabase.from('table').select(),
  'Error loading table'
);
```

**Estimation:** 1-2 jours

---

### 2.4 Créer Custom Hooks Réutilisables

**Hooks à Créer:**

**`src/hooks/useAsyncData.js`**
```javascript
import { useState, useEffect } from 'react';

export function useAsyncData(asyncFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        setLoading(true);
        const result = await asyncFn();
        if (!ignore) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchData();
    return () => { ignore = true; };
  }, deps);

  return { data, loading, error, refetch: () => fetchData() };
}
```

**`src/hooks/useLocalStorage.js`**
```javascript
import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  };

  return [storedValue, setValue];
}
```

**`src/hooks/usePagination.js`**
```javascript
import { useState, useMemo } from 'react';

export function usePagination(items, itemsPerPage = 20) {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }, [items, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  return {
    currentPage,
    setCurrentPage,
    paginatedData,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
}
```

**Estimation:** 1 jour

---

## Phase 3: Qualité du Code (1 semaine)

### 3.1 Nettoyer Console.log (54 instances)

**Fichiers Prioritaires:**
- `src/middleware.js` (3 restants après Phase 1)
- `src/app/api/admin/*.js` (8 routes API)
- Tous les composants

**Solution:** Créer logger centralisé

**Fichier:** `src/lib/logger.js`
```javascript
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message, ...args) => {
    if (isDev) console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (isDev) console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (isDev) console.debug(`[DEBUG] ${message}`, ...args);
  }
};
```

**Remplacement Systématique:**
```javascript
// Avant
console.log('[Middleware] User logged in')

// Après
import { logger } from '@/lib/logger'
logger.info('[Middleware] User logged in')
```

**Estimation:** 2-3 heures

---

### 3.2 Implémenter Error Boundaries

**Fichier:** `src/components/ErrorBoundary.js`
```javascript
"use client";
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Une erreur est survenue
          </h2>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'Erreur inconnue'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage dans `page.js`:**
```javascript
<ErrorBoundary>
  <AppShell />
</ErrorBoundary>
```

**Estimation:** 1 heure

---

### 3.3 Fixer les Imports Inconsistants

**Problèmes:**
- Certains utilisent chemins relatifs: `'../../lib/supabase'`
- Pas d'alias `@/` configuré partout
- Services importés depuis plusieurs sources

**Solution:** Configurer path aliases dans `jsconfig.json`

**Fichier:** `jsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/services/*": ["src/services/*"],
      "@/lib/*": ["src/lib/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/contexts/*": ["src/contexts/*"]
    }
  }
}
```

**Après:**
```javascript
// Avant
import { utils } from '../../lib/supabase'

// Après
import { utils } from '@/lib/utils'
```

**Estimation:** 2-3 heures (rechercher/remplacer)

---

## Phase 4: Tests et Documentation (1 semaine)

### 4.1 Tests Unitaires (Priorité Critique)

**Outils:** Jest + React Testing Library

**Installation:**
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

**Config:** `jest.config.js`
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
}

module.exports = createJestConfig(customJestConfig)
```

**Tests Prioritaires:**

**1. Tests Services**
```
src/services/__tests__/
├── authService.test.js
├── permissionService.test.js
└── historiqueVentesService.test.js
```

**2. Tests Hooks**
```
src/hooks/__tests__/
├── useAuth.test.js
├── usePermissions.test.js
└── useAsyncData.test.js
```

**3. Tests Utilitaires**
```
src/lib/__tests__/
└── utils.test.js
```

**Exemple:** `src/lib/__tests__/utils.test.js`
```javascript
import { utils } from '../utils';

describe('utils.formatCFA', () => {
  it('should format number as CFA', () => {
    expect(utils.formatCFA(1000)).toBe('1 000 CFA');
    expect(utils.formatCFA(0)).toBe('0 CFA');
    expect(utils.formatCFA(null)).toBe('0 CFA');
  });
});

describe('utils.getStockAlertLevel', () => {
  it('should return correct alert level', () => {
    expect(utils.getStockAlertLevel(0, 100)).toBe('rupture');
    expect(utils.getStockAlertLevel(10, 100)).toBe('critique');
    expect(utils.getStockAlertLevel(30, 100)).toBe('faible');
    expect(utils.getStockAlertLevel(80, 100)).toBe('normal');
  });
});
```

**Objectif:** 70%+ coverage sur logique critique

**Estimation:** 3-4 jours

---

### 4.2 Documentation

**4.2.1 README Principal**
```markdown
# Pâtisserie Shine

Système de gestion complet pour pâtisserie (stock, production, ventes, caisse)

## Fonctionnalités
- Gestion des stocks (boutique + atelier)
- Système de production
- Point de vente / Caisse
- Demandes inter-services
- Comptabilité
- Gestion des permissions

## Stack Technique
- Next.js 14 (App Router)
- React 18
- Supabase (Backend + Auth)
- Tailwind CSS

## Installation
...

## Architecture
Voir [ARCHITECTURE.md](./ARCHITECTURE.md)
```

**4.2.2 Documentation Architecture**

**Fichier:** `ARCHITECTURE.md`
```markdown
# Architecture de l'Application

## Vue d'Ensemble
...

## Structure des Dossiers
...

## Flux de Données
...

## Gestion des Permissions
...
```

**4.2.3 Documentation API**

**Fichier:** `docs/API.md`
- Documenter toutes les routes `/api/admin/*`
- Schéma de requêtes/réponses
- Exemples d'utilisation

**Estimation:** 2 jours

---

## Phase 5: Améliorations (Bonus)

### 5.1 Migration vers TypeScript

**Approche Graduelle:**
1. Renommer `.js` → `.ts` progressivement
2. Commencer par les types/interfaces
3. Puis services
4. Puis composants

**Fichier:** `src/types/index.ts`
```typescript
export interface User {
  id: string;
  username: string;
  nom: string;
  role: 'admin' | 'employe_boutique' | 'employe_production';
  actif: boolean;
}

export interface Vente {
  id: number;
  numero_ticket: string;
  total: number;
  montant_donne: number;
  monnaie_rendue: number;
  vendeur_id: string;
  created_at: string;
}

// ... autres types
```

**Estimation:** 1 semaine

---

### 5.2 Optimisations Performance

**5.2.1 Code Splitting**
```javascript
// Dynamic imports pour composants lourds
const CaisseManager = dynamic(() => import('@/components/caisse/CaisseManager'), {
  loading: () => <Spinner />,
  ssr: false
});
```

**5.2.2 React Query / SWR**
Remplacer fetch manuel par cache intelligent

**5.2.3 Memoization**
```javascript
const statistiques = useMemo(() => {
  return calculateStats(ventes);
}, [ventes]);
```

**Estimation:** 2-3 jours

---

### 5.3 Accessibilité (A11y)

**Checklist:**
- [ ] ARIA labels sur tous les boutons/icons
- [ ] Navigation clavier complète
- [ ] Screen reader support
- [ ] Contrast ratios WCAG AA
- [ ] Focus indicators visibles
- [ ] Skip links

**Estimation:** 1-2 jours

---

## Résumé du Planning

| Phase | Durée | Priorité | Status |
|-------|-------|----------|--------|
| **Phase 1: Corrections Critiques** | 3-5 jours | HAUTE | ✅ 80% COMPLÉTÉ |
| **Phase 2: Refactoring Architectural** | 5-10 jours | HAUTE | ⏳ EN COURS |
| **Phase 3: Qualité du Code** | 1 semaine | MOYENNE | 📋 PLANIFIÉ |
| **Phase 4: Tests et Documentation** | 1 semaine | MOYENNE | 📋 PLANIFIÉ |
| **Phase 5: Améliorations** | 1-2 semaines | BASSE | 💡 OPTIONNEL |

**Total Minimum (Phases 1-3):** 2-3 semaines
**Total avec Tests (Phases 1-4):** 3-4 semaines
**Total Complet (Toutes phases):** 5-6 semaines

---

## Prochaines Actions Immédiates

### Cette Semaine:
1. ✅ Terminer Phase 1 (corrections critiques)
2. ⏳ Commencer extraction services de `lib/supabase.js`
3. ⏳ Créer les contexts (Auth + Permissions)

### Semaine Prochaine:
4. Créer AppShell et composants layout
5. Refactoring complet de `page.js`
6. Tests du nouveau système

---

## Notes Importantes

### Principes à Respecter:
1. **Ne jamais casser le code existant** - Refactoring progressif
2. **Tester après chaque modification** - Pas de big bang
3. **Garder les anciennes versions** - Branches Git pour rollback
4. **Documenter les changements** - Comments + Git commits clairs
5. **Une tâche à la fois** - Pas de mélange de refactoring

### Commandes Git Recommandées:
```bash
# Créer branche pour chaque phase
git checkout -b refactor/phase-2-services
git commit -m "refactor: extract authService from lib/supabase"

# Merge progressif
git checkout main
git merge refactor/phase-2-services
```

### Points de Contrôle (Checkpoints):
- [ ] Après chaque extraction de service: Build OK + App fonctionne
- [ ] Après contexts: Auth fonctionne correctement
- [ ] Après AppShell: Navigation complète OK
- [ ] Avant merge main: Tests manuels complets

---

## Contact & Questions

Pour questions sur ce plan: Voir fichier ou créer issue GitHub

**Dernière Mise à Jour:** 10 Novembre 2025
**Version:** 1.0
**Auteur:** Refactoring Analysis - Claude Code
