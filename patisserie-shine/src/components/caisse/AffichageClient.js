'use client'

import { useEffect, useState } from 'react'
import { utils } from '../../utils/formatters'

const formatCFA = utils.formatCFA

export default function AffichageClient() {
  const [panier, setPanier] = useState([])
  const [montantDonne, setMontantDonne] = useState(0)
  const [showHelp, setShowHelp] = useState(true)

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

    // Masquer l'aide après 8 secondes
    const timer = setTimeout(() => setShowHelp(false), 8000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timer)
    }
  }, [])

  const totalPanier = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0)
  const monnaieARendre = montantDonne > totalPanier ? montantDonne - totalPanier : 0

  // Calcul dynamique des tailles en fonction du nombre d'articles
  const getScaleClasses = () => {
    const count = panier.length

    if (count <= 3) {
      return {
        itemCard: 'p-4',
        badge: 'w-10 h-10 text-lg',
        productName: 'text-xl',
        productDetails: 'text-base',
        productPrice: 'text-2xl px-5 py-2',
        spacing: 'space-y-3',
        totalLabel: 'text-2xl',
        totalAmount: 'text-4xl',
        moneyLabel: 'text-xl',
        moneyAmount: 'text-2xl',
        containerPadding: 'p-6'
      }
    } else if (count <= 5) {
      return {
        itemCard: 'p-3',
        badge: 'w-8 h-8 text-base',
        productName: 'text-lg',
        productDetails: 'text-sm',
        productPrice: 'text-xl px-4 py-2',
        spacing: 'space-y-2',
        totalLabel: 'text-xl',
        totalAmount: 'text-3xl',
        moneyLabel: 'text-lg',
        moneyAmount: 'text-xl',
        containerPadding: 'p-4'
      }
    } else if (count <= 8) {
      return {
        itemCard: 'p-2',
        badge: 'w-7 h-7 text-sm',
        productName: 'text-base',
        productDetails: 'text-xs',
        productPrice: 'text-lg px-3 py-1',
        spacing: 'space-y-1',
        totalLabel: 'text-lg',
        totalAmount: 'text-2xl',
        moneyLabel: 'text-base',
        moneyAmount: 'text-lg',
        containerPadding: 'p-3'
      }
    } else {
      return {
        itemCard: 'p-1.5',
        badge: 'w-6 h-6 text-xs',
        productName: 'text-sm',
        productDetails: 'text-xs',
        productPrice: 'text-base px-2 py-1',
        spacing: 'space-y-1',
        totalLabel: 'text-base',
        totalAmount: 'text-xl',
        moneyLabel: 'text-sm',
        moneyAmount: 'text-base',
        containerPadding: 'p-2'
      }
    }
  }

  const scale = getScaleClasses()

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex flex-col relative">
      {/* Aide au démarrage */}
      {showHelp && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-pulse">
          <p className="text-lg font-semibold mb-2">💡 Premier démarrage</p>
          <p className="text-sm">• Déplacez cette fenêtre sur le 2e écran</p>
          <p className="text-sm">• Appuyez sur <kbd className="bg-white text-blue-600 px-2 py-1 rounded font-bold">F11</kbd> pour le plein écran</p>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-3 bg-white text-blue-600 px-4 py-1 rounded text-sm font-semibold hover:bg-blue-50"
          >
            Compris !
          </button>
        </div>
      )}

      {/* En-tête fixe */}
      <div className="bg-gradient-to-r from-orange-600 to-yellow-500 text-white py-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-wider mb-1">PÂTISSERIE SHINE</h1>
          <p className="text-2xl font-light tracking-wide">Votre Commande</p>
        </div>
      </div>

      {/* Contenu principal sans scroll */}
      <div className={`flex-1 overflow-hidden ${scale.containerPadding}`}>
        <div className="h-full max-w-6xl mx-auto flex flex-col">
          {panier.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-7xl mb-6">🛒</div>
              <p className="text-3xl text-gray-400 font-semibold">
                En attente de commande...
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-2">
              {/* Liste des articles */}
              <div className={`flex-1 overflow-hidden ${scale.spacing}`}>
                {panier.map((item, index) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl shadow-lg ${scale.itemCard} border-3 border-orange-200`}
                  >
                    <div className="flex justify-between items-center gap-4">
                      {/* Numéro de ligne */}
                      <div className={`flex-shrink-0 ${scale.badge} bg-orange-500 text-white rounded-full flex items-center justify-center`}>
                        <span className="font-bold">{index + 1}</span>
                      </div>

                      {/* Informations produit */}
                      <div className="flex-1">
                        <h3 className={`${scale.productName} font-bold text-gray-800 mb-1`}>
                          {item.nom}
                        </h3>
                        <div className={`flex items-center gap-3 ${scale.productDetails} text-gray-600`}>
                          <span className="font-semibold">{formatCFA(item.prix)}</span>
                          <span className="text-orange-500 font-bold">×</span>
                          <span className="font-semibold">{item.quantite} {item.unite}</span>
                        </div>
                      </div>

                      {/* Prix total de la ligne */}
                      <div className={`flex-shrink-0 text-right bg-orange-50 rounded-xl ${scale.productPrice} border-2 border-orange-300`}>
                        <p className="font-black text-orange-600">
                          {formatCFA(item.prix * item.quantite)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ligne de séparation */}
              <div className="border-t-2 border-orange-300"></div>

              {/* Section Total */}
              <div className="flex-shrink-0 space-y-2">
                {/* Total à payer */}
                <div className={`bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl shadow-xl ${scale.itemCard}`}>
                  <div className="flex justify-between items-center text-white">
                    <span className={`${scale.totalLabel} font-bold tracking-wide`}>
                      TOTAL À PAYER
                    </span>
                    <span className={`${scale.totalAmount} font-black`}>
                      {formatCFA(totalPanier)}
                    </span>
                  </div>
                </div>

                {/* Montant donné */}
                {montantDonne > 0 && (
                  <div className={`bg-white rounded-xl shadow-lg ${scale.itemCard} border-2 border-gray-200`}>
                    <div className="flex justify-between items-center">
                      <span className={`${scale.moneyLabel} font-semibold text-gray-700`}>
                        Espèces reçues
                      </span>
                      <span className={`${scale.moneyAmount} font-bold text-gray-800`}>
                        {formatCFA(montantDonne)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Monnaie à rendre */}
                {monnaieARendre > 0 && (
                  <div className={`bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-xl ${scale.itemCard} border-2 border-green-400 animate-pulse`}>
                    <div className="flex justify-between items-center text-white">
                      <span className={`${scale.totalLabel} font-bold tracking-wide`}>
                        MONNAIE À RENDRE
                      </span>
                      <span className={`${scale.totalAmount} font-black`}>
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
