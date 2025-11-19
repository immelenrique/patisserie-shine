// src/components/caisse/CancelSaleModal.js
"use client";

import React, { useState } from 'react';
import { AlertTriangle, Loader2, XCircle, CheckCircle, Info } from 'lucide-react';
import { Modal } from '../ui';
import { utils } from '../../utils/formatters';
import { supabase } from '../../lib/supabase-client';

/**
 * Modal pour annuler une vente
 * @param {boolean} isOpen - État d'ouverture du modal
 * @param {Function} onClose - Fonction pour fermer le modal
 * @param {Object} vente - Objet vente à annuler
 * @param {Function} onSuccess - Callback après annulation réussie
 */
export default function CancelSaleModal({ isOpen, onClose, vente, onSuccess }) {
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('confirm'); // 'confirm' | 'processing' | 'success' | 'error'

  // Vérifier si la vente peut être annulée (délai de 7 jours)
  const canCancel = () => {
    if (!vente) return false;

    const venteDate = new Date(vente.created_at);
    const aujourdhui = new Date();
    const differenceJours = Math.floor((aujourdhui - venteDate) / (1000 * 60 * 60 * 24));

    return differenceJours <= 7;
  };

  const joursDepuis = () => {
    if (!vente) return 0;
    const venteDate = new Date(vente.created_at);
    const aujourdhui = new Date();
    return Math.floor((aujourdhui - venteDate) / (1000 * 60 * 60 * 24));
  };

  // Gérer l'annulation
  const handleCancel = async () => {
    // Validation
    if (!motif || motif.trim().length === 0) {
      setError('Le motif est obligatoire');
      return;
    }

    if (motif.trim().length < 10) {
      setError('Le motif doit contenir au moins 10 caractères');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      // Appeler l'API d'annulation
      const response = await fetch('/api/admin/cancel-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          venteId: vente.id,
          motif: motif.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erreur lors de l\'annulation');
      }

      setStep('success');

      // Attendre 2 secondes avant de fermer et notifier le succès
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);

    } catch (err) {
      console.error('Erreur annulation vente:', err);
      setError(err.message);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Fermer et réinitialiser
  const handleClose = () => {
    setMotif('');
    setError(null);
    setStep('confirm');
    setLoading(false);
    onClose();
  };

  if (!vente) return null;

  const delaiDepasse = !canCancel();
  const jours = joursDepuis();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Annuler une vente"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Étape : Confirmation */}
        {step === 'confirm' && (
          <>
            {/* Avertissement délai */}
            {delaiDepasse ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Annulation impossible</p>
                  <p className="text-sm text-red-700 mt-1">
                    Cette vente date de {jours} jours. Le délai maximum d'annulation est de 7 jours.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900">Attention : Action irréversible</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    L'annulation de cette vente restaurera automatiquement les stocks. Cette action ne peut pas être annulée.
                  </p>
                </div>
              </div>
            )}

            {/* Informations de la vente */}
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <h4 className="font-semibold text-gray-900">Détails de la vente</h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">N° Ticket</p>
                  <p className="font-medium text-gray-900">{vente.numero_ticket}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(vente.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Vendeur</p>
                  <p className="font-medium text-gray-900">{vente.vendeur_nom}</p>
                </div>
                <div>
                  <p className="text-gray-500">Montant</p>
                  <p className="font-medium text-green-600">{utils.formatCFA(vente.total)}</p>
                </div>
              </div>

              {/* Articles */}
              {vente.items && vente.items.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-2">Articles ({vente.items.length})</p>
                  <div className="space-y-1">
                    {vente.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.nom_produit} × {item.quantite}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {utils.formatCFA(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Information sur le délai */}
            {!delaiDepasse && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Cette vente date de {jours} jour{jours > 1 ? 's' : ''}.
                  Il reste {7 - jours} jour{(7 - jours) > 1 ? 's' : ''} pour l'annuler.
                </p>
              </div>
            )}

            {/* Champ motif */}
            {!delaiDepasse && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif de l'annulation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motif}
                  onChange={(e) => {
                    setMotif(e.target.value);
                    setError(null);
                  }}
                  placeholder="Décrivez la raison de l'annulation (minimum 10 caractères)..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {motif.length} / 10 caractères minimum
                </p>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Annuler
              </button>
              {!delaiDepasse && (
                <button
                  onClick={handleCancel}
                  disabled={loading || motif.trim().length < 10}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Annulation...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmer l'annulation
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* Étape : Traitement */}
        {step === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Annulation en cours...</p>
            <p className="text-sm text-gray-500 mt-2">Restauration des stocks...</p>
          </div>
        )}

        {/* Étape : Succès */}
        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Vente annulée avec succès !</p>
            <p className="text-sm text-gray-500 mt-2">Les stocks ont été restaurés.</p>
          </div>
        )}

        {/* Étape : Erreur */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Erreur lors de l'annulation</p>
              <p className="text-sm text-red-600 mt-2">{error}</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Fermer
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
