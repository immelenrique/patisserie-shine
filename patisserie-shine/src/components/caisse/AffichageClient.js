'use client'

import { useEffect, useState } from 'react'
import { utils } from '../../utils/formatters'

const formatCFA = utils.formatCFA

export default function AffichageClient() {
  const [panier, setPanier] = useState([])
  const [montantDonne, setMontantDonne] = useState(0)

  useEffect(() => {
    // Écouter les messages de la fenêtre principale
    const handleMessage = (event) => {
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

    // Empêcher la fermeture accidentelle
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const totalPanier = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0)
  const monnaieARendre = montantDonne > totalPanier ? montantDonne - totalPanier : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex flex-col">
      {/* En-tête fixe */}
      <div className="bg-gradient-to-r from-orange-600 to-yellow-500 text-white py-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-wider mb-1">PÂTISSERIE SHINE</h1>
          <p className="text-2xl font-light tracking-wide">Votre Commande</p>
        </div>
      </div>

      {/* Contenu principal avec scroll */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {panier.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-7xl mb-6">🛒</div>
              <p className="text-3xl text-gray-400 font-semibold">
                En attente de commande...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Liste des articles */}
              <div className="space-y-5">
                {panier.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl shadow-lg p-5 border-3 border-orange-200"
                  >
                    <div className="flex justify-between items-center gap-6">
                      {/* Numéro de ligne */}
                      <div className="flex-shrink-0 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold">{index + 1}</span>
                      </div>

                      {/* Informations produit */}
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800 mb-1">
                          {item.nom}
                        </h3>
                        <div className="flex items-center gap-3 text-lg text-gray-600">
                          <span className="font-semibold">{formatCFA(item.prix)}</span>
                          <span className="text-orange-500 font-bold">×</span>
                          <span className="font-semibold">{item.quantite} {item.unite}</span>
                        </div>
                      </div>

                      {/* Prix total de la ligne */}
                      <div className="flex-shrink-0 text-right bg-orange-50 rounded-xl px-6 py-3 border-2 border-orange-300">
                        <p className="text-3xl font-black text-orange-600">
                          {formatCFA(item.prix * item.quantite)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ligne de séparation */}
              <div className="border-t-4 border-orange-300 my-6"></div>

              {/* Section Total */}
              <div className="space-y-4">
                {/* Total à payer */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl shadow-xl p-6">
                  <div className="flex justify-between items-center text-white">
                    <span className="text-3xl font-bold tracking-wide">
                      TOTAL À PAYER
                    </span>
                    <span className="text-5xl font-black">
                      {formatCFA(totalPanier)}
                    </span>
                  </div>
                </div>

                {/* Montant donné */}
                {montantDonne > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-5 border-3 border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-semibold text-gray-700">
                        Espèces reçues
                      </span>
                      <span className="text-3xl font-bold text-gray-800">
                        {formatCFA(montantDonne)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Monnaie à rendre */}
                {monnaieARendre > 0 && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-xl p-6 border-3 border-green-400 animate-pulse">
                    <div className="flex justify-between items-center text-white">
                      <span className="text-3xl font-bold tracking-wide">
                        MONNAIE À RENDRE
                      </span>
                      <span className="text-5xl font-black">
                        {formatCFA(monnaieARendre)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pied de page fixe */}
      <div className="bg-gradient-to-r from-orange-600 to-yellow-500 text-white py-4 text-center shadow-2xl">
        <p className="text-2xl font-semibold">
          Merci de votre visite ! 🎂✨
        </p>
      </div>
    </div>
  )
}
