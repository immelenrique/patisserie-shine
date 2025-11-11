// src/components/layout/AppShell.js
"use client";

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionContext'
import LoginForm from '../auth/LoginForm'
import { User, LogOut } from 'lucide-react'

/**
 * Composant principal de l'application
 * Utilise les nouveaux contexts Auth et Permissions
 */
export default function AppShell({ children }) {
  const { user, loading: authLoading, signOut, isAuthenticated } = useAuth()
  const { availableTabs } = usePermissions()
  const [activeTab, setActiveTab] = useState('dashboard')

  // État de chargement
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  // Non authentifié - Afficher login
  if (!isAuthenticated) {
    return <LoginForm />
  }

  // Authentifié - Afficher l'app
  const handleLogout = async () => {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      await signOut()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-orange-600">
              🧁 Pâtisserie Shine
            </h1>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-semibold text-gray-900">{user.nom}</p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      {availableTabs.length > 0 && (
        <nav className="bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Contenu Principal */}
      <main className="container mx-auto px-4 py-6 flex-1">
        {children || (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Bienvenue {user.nom} !
            </h2>
            <p className="text-gray-600 mb-6">
              Vous avez accès à {availableTabs.length} modules
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {availableTabs.slice(0, 3).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{tab.label}</h3>
                  <p className="text-sm text-gray-600">Cliquez pour accéder</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          © 2025 Pâtisserie Shine - Système de Gestion
        </div>
      </footer>
    </div>
  )
}
