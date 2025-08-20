"use client";

import { useState } from 'react';
import { Lock, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal } from '../ui';
import { authService } from '../../lib/supabase';

export default function PasswordChangeModal({ isOpen, user, onPasswordChanged, onLogout }) {
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false
  });
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validations
    if (passwords.newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwords.newPassword === passwords.confirmPassword && passwords.newPassword.length < 8) {
      setError('Pour votre sécurité, utilisez un mot de passe d\'au moins 8 caractères');
      return;
    }

    setChanging(true);

    try {
      // Changer le mot de passe via l'API
      const result = await authService.updatePassword(passwords.newPassword);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        
        // Marquer que le changement de mot de passe n'est plus requis
        await authService.markPasswordChangeComplete();
        
        setTimeout(() => {
          onPasswordChanged();
        }, 2000);
      }
    } catch (err) {
      setError('Erreur lors du changement de mot de passe');
      console.error('Erreur changement mot de passe:', err);
    } finally {
      setChanging(false);
    }
  };

  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    return strength;
  };

  const getStrengthLabel = (strength) => {
    if (strength <= 2) return { label: 'Faible', color: 'text-red-600' };
    if (strength <= 4) return { label: 'Moyen', color: 'text-yellow-600' };
    return { label: 'Fort', color: 'text-green-600' };
  };

  const strength = getPasswordStrength(passwords.newPassword);
  const strengthInfo = getStrengthLabel(strength);

  if (success) {
    return (
      <Modal isOpen={isOpen} title="Mot de passe modifié" size="md">
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Mot de passe modifié avec succès !
          </h3>
          <p className="text-gray-600 mb-6">
            Votre mot de passe a été mis à jour. Vous allez être redirigé...
          </p>
          <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} title="Changement de mot de passe requis" size="md">
      <div className="space-y-6">
        {/* Message d'information */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <Shield className="w-6 h-6 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">
                Première connexion détectée
              </h4>
              <p className="text-sm text-yellow-800">
                Pour votre sécurité, vous devez changer votre mot de passe temporaire avant de continuer.
              </p>
            </div>
          </div>
        </div>

        {/* Informations utilisateur */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Connecté en tant que :</h4>
          <div className="text-sm text-blue-800">
            <p><strong>Nom :</strong> {user?.nom || 'Non défini'}</p>
            <p><strong>Username :</strong> @{user?.username}</p>
            <p><strong>Rôle :</strong> {user?.role}</p>
          </div>
        </div>

        {/* Formulaire de changement */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nouveau mot de passe *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwords.newPassword}
                onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Entrez votre nouveau mot de passe"
                required
                minLength="6"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            
            {/* Indicateur de force */}
            {passwords.newPassword && (
              <div className="mt-2">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">Force :</span>
                  <span className={strengthInfo.color}>{strengthInfo.label}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      strength <= 2 ? 'bg-red-500' : 
                      strength <= 4 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${(strength / 6) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Confirmation mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmer le mot de passe *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Confirmez votre nouveau mot de passe"
                required
                minLength="6"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            
            {/* Vérification correspondance */}
            {passwords.confirmPassword && (
              <div className="mt-2 text-sm">
                {passwords.newPassword === passwords.confirmPassword ? (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Les mots de passe correspondent
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Les mots de passe ne correspondent pas
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Conseils de sécurité */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Conseils pour un mot de passe sécurisé :</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${passwords.newPassword.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Au moins 8 caractères
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${/[A-Z]/.test(passwords.newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Une lettre majuscule
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${/[a-z]/.test(passwords.newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Une lettre minuscule
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${/[0-9]/.test(passwords.newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Un chiffre
              </li>
              <li className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${/[^A-Za-z0-9]/.test(passwords.newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                Un caractère spécial (!@#$%^&*)
              </li>
            </ul>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center text-red-800">
                <AlertTriangle className="w-5 h-5 mr-2" />
                {error}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={changing || passwords.newPassword !== passwords.confirmPassword || passwords.newPassword.length < 6}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {changing ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  Changement en cours...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 inline mr-2" />
                  Changer le mot de passe
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={onLogout}
              disabled={changing}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 font-medium"
            >
              Se déconnecter
            </button>
          </div>
        </form>

        {/* Avertissement */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-medium mb-1">Important :</p>
              <p>Vous ne pourrez pas accéder à l'application tant que vous n'aurez pas changé votre mot de passe. Cette mesure garantit la sécurité de votre compte.</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
