"use client";

import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Home,
  FileText,
  Bell,
  LogOut,
  Plus,
  Search,
  Eye,
  EyeOff,
  User,
  Lock,
  RefreshCw,
  Edit,
  Trash2,
  Check,
  X,
  Calendar,
  DollarSign
} from 'lucide-react';

// Import des services Supabase
import { 
  authService, 
  productService, 
  demandeService, 
  productionService, 
  userService, 
  statsService,
  utils,
  uniteService 
} from '../lib/supabase';

// Composants UI réutilisables
const Card = ({ children, className = '', hover = true }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-200 ${hover ? 'hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}>
    {children}
  </div>
);

const StatCard = ({ title, value, change, trend, icon: Icon, color = 'blue', loading = false }) => {
  const iconColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600'
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          {change && (
            <p className="text-sm text-gray-500">{change}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${iconColors[color]}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

const StatusBadge = ({ status }) => {
  const variants = {
    'en_attente': 'bg-yellow-100 text-yellow-800',
    'validee': 'bg-green-100 text-green-800',
    'refusee': 'bg-red-100 text-red-800',
    'termine': 'bg-blue-100 text-blue-800',
    'en_cours': 'bg-orange-100 text-orange-800',
    'annule': 'bg-gray-100 text-gray-800',
    'rupture': 'bg-red-100 text-red-800',
    'critique': 'bg-red-100 text-red-800',
    'faible': 'bg-yellow-100 text-yellow-800',
    'normal': 'bg-green-100 text-green-800'
  };

  const labels = {
    'en_attente': 'En attente',
    'validee': 'Validée',
    'refusee': 'Refusée',
    'termine': 'Terminé',
    'en_cours': 'En cours',
    'annule': 'Annulé',
    'rupture': 'Rupture',
    'critique': 'Critique',
    'faible': 'Faible',
    'normal': 'Normal'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-auto`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Composant de connexion
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { user, profile, error } = await authService.signInWithUsername(username, password);
      
      if (error) {
        setError(error);
      } else if (profile) {
        onLogin(profile);
      } else {
        setError('Profil utilisateur introuvable');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Erreur de connexion:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl mb-6 shadow-xl">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pâtisserie <span className="text-orange-500">Shine</span>
          </h1>
          <p className="text-gray-600 text-lg">Gestion de stock professionnelle</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Saisissez votre nom d'utilisateur"
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 text-gray-900"
                />
              </div>
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
