'use client'

import { useEffect, useState } from 'react'
import { formatCFA } from '@/utils/formatters'

export default function AffichageClient() {
  const [panier, setPanier] = useState([])
  const [montantDonne, setMontantDonne] = useState(0)

  useEffect(() => {
    // Écouter les messages de la fenêtre principale
    const handleMessage = (event) => {
      // Vérifier l'origine pour la sécurité (optionnel en dev)
      if (event.data.type === 'UPDATE_PANIER') {
        setPanier(event.data.panier || [])
        setMontantDonne(event.data.montantDonne || 0)
      }
    }

    window.addEventListener('message', handleMessage)

    // Notifier la fenêtre parent que l'affichage client est prêt
    if (window.opener) {
      window.opener.postMessage({ type: 'CLIENT_DISPLAY_READY' }, '*')
    }

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const totalPanier = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0)
  const monnaieARendre = montantDonne > totalPanier ? montantDonne - totalPanier : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">PÂTISSERIE SHINE</h1>
          <p className="text-2xl text-gray-600">Votre Commande</p>
        </div>

        {/* Contenu principal */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {panier.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6">🛒</div>
              <p className="text-3xl text-gray-400 font-medium">
                Votre panier est vide
              </p>
            </div>
          ) : (
            <>
              {/* Liste des articles */}
              <div className="space-y-4 mb-8">
                {panier.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-6 bg-gray-50 rounded-2xl border-2 border-gray-200"
                  >
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold text-gray-800">
                        {item.nom}
                      </h3>
                      <p className="text-xl text-gray-500 mt-1">
                        {formatCFA(item.prix)} × {item.quantite} {item.unite}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">
                        {formatCFA(item.prix * item.quantite)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ligne de séparation */}
              <div className="border-t-4 border-gray-300 my-8"></div>

              {/* Total */}
              <div className="space-y-4">
                <div className="flex justify-between items-center p-6 bg-blue-50 rounded-2xl">
                  <span className="text-3xl font-semibold text-gray-700">
                    TOTAL
                  </span>
                  <span className="text-5xl font-bold text-blue-600">
                    {formatCFA(totalPanier)}
                  </span>
                </div>

                {/* Montant donné et monnaie */}
                {montantDonne > 0 && (
                  <>
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-2xl text-gray-600">Espèces</span>
                      <span className="text-3xl font-semibold text-gray-700">
                        {formatCFA(montantDonne)}
                      </span>
                    </div>

                    {monnaieARendre > 0 && (
                      <div className="flex justify-between items-center p-6 bg-green-50 rounded-2xl border-2 border-green-300">
                        <span className="text-2xl font-semibold text-green-700">
                          Monnaie à rendre
                        </span>
                        <span className="text-4xl font-bold text-green-600">
                          {formatCFA(monnaieARendre)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Pied de page */}
        <div className="text-center mt-8">
          <p className="text-2xl text-gray-600">
            Merci de votre visite ! 😊
          </p>
        </div>
      </div>
    </div>
  )
}
