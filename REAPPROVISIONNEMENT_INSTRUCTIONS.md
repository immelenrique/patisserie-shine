# 📦 Instructions d'implémentation - Réapprovisionnement de Stock

## ✅ Fonction ajoutée dans productService.js

La fonction `reapprovisionner()` a été ajoutée au [productService.js](patisserie-shine/src/services/productService.js:185-250).

**Fonctionnalités:**
- Calcule automatiquement le prix moyen pondéré
- Met à jour quantite et quantite_restante
- Enregistre le mouvement dans l'historique
- Trace l'utilisateur qui fait le réapprovisionnement

## 🎯 Modifications à apporter dans StockManager.js

### 1. Ajouter l'import TrendingUp

```javascript
import { Search, Plus, Edit, Trash2, Package, Store, TrendingUp } from 'lucide-react';
```

### 2. Ajouter les états pour le modal de réapprovisionnement

Après la ligne 24 (`const [error, setError] = useState('');`), ajoutez:

```javascript
const [reapproProduct, setReapproProduct] = useState(null);
const [reapproData, setReapproData] = useState({
  quantite_ajoutee: '',
  prix_achat_total: '',
  date_achat: new Date().toISOString().split('T')[0]
});
const [reapproSearch, setReapproSearch] = useState('');
const [reapproOpen, setReapproOpen] = useState(false);
const [selectedReapproRef, setSelectedReapproRef] = useState(null);
```

### 3. Ajouter la fonction de gestion du réapprovisionnement

Après la fonction `handleDeleteProduct` (ligne 332), ajoutez:

```javascript
const handleReapprovisionner = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  setError('');

  try {
    const { product, error } = await productService.reapprovisionner(reapproProduct.id, {
      quantite_ajoutee: parseFloat(reapproData.quantite_ajoutee),
      prix_achat_total: parseFloat(reapproData.prix_achat_total),
      date_achat: reapproData.date_achat
    });

    if (error) {
      setError(error);
    } else {
      await loadProducts();

      const prixUnitaire = parseFloat(reapproData.prix_achat_total) / parseFloat(reapproData.quantite_ajoutee);
      alert(`✅ Réapprovisionnement réussi!\n\n` +
            `Produit: ${reapproProduct.nom}\n` +
            `Quantité ajoutée: ${reapproData.quantite_ajoutee} ${reapproProduct.unite?.value}\n` +
            `Prix d'achat: ${utils.formatCFA(reapproData.prix_achat_total)}\n` +
            `Prix unitaire: ${utils.formatCFA(prixUnitaire)}/${reapproProduct.unite?.value}\n` +
            `Nouveau total: ${product.quantite} ${product.unite?.value}`
      );

      setReapproProduct(null);
      setReapproData({
        quantite_ajoutee: '',
        prix_achat_total: '',
        date_achat: new Date().toISOString().split('T')[0]
      });
      setSelectedReapproRef(null);
      setReapproSearch('');
    }
  } catch (err) {
    console.error('Erreur:', err);
    setError('Erreur lors du réapprovisionnement');
  } finally {
    setSubmitting(false);
  }
};

const startReappro = (product) => {
  setReapproProduct(product);
  setReapproData({
    quantite_ajoutee: '',
    prix_achat_total: '',
    date_achat: new Date().toISOString().split('T')[0]
  });
  setSelectedReapproRef(null);
  setReapproSearch('');
  setError('');
};

const handleReapproReferentielSelect = (referentielId) => {
  if (!referentielId) {
    setSelectedReapproRef(null);
    return;
  }

  const referentiel = referentiels.find(r => r.id === parseInt(referentielId));
  if (referentiel && referentiel.nom.toLowerCase() === reapproProduct.nom.toLowerCase()) {
    setSelectedReapproRef(referentiel);

    const quantiteDefaut = referentiel.quantite_par_conditionnement;
    const prixUnitaire = referentiel.prix_unitaire;

    setReapproData(prev => ({
      ...prev,
      quantite_ajoutee: quantiteDefaut.toString(),
      prix_achat_total: (prixUnitaire * quantiteDefaut).toString()
    }));

    console.log('✅ Référentiel sélectionné pour réappro:', referentiel.nom);
  } else {
    alert(`⚠️ Ce référentiel ne correspond pas au produit "${reapproProduct.nom}"`);
  }
};

const handleReapproQuantiteChange = (nouvelleQuantite) => {
  setReapproData(prev => {
    const newData = {
      ...prev,
      quantite_ajoutee: nouvelleQuantite
    };

    if (selectedReapproRef && nouvelleQuantite) {
      const prixUnitaire = selectedReapproRef.prix_unitaire;
      const quantiteNum = parseFloat(nouvelleQuantite);
      if (!isNaN(quantiteNum) && quantiteNum > 0) {
        newData.prix_achat_total = (prixUnitaire * quantiteNum).toString();
      }
    }

    return newData;
  });
};
```

### 4. Ajouter le bouton "Réapprovisionner" dans le tableau

Dans la section Actions (ligne 820), **remplacez**:

```javascript
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <div className="flex space-x-2">
    {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
      <button
        onClick={() => startEdit(product)}
        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
        title="Modifier"
      >
        <Edit className="h-4 w-4" />
      </button>
    )}
    {currentUser.role === 'admin' && (
      <button
        onClick={() => handleDeleteProduct(product.id, product.nom)}
        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
        title="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    )}
  </div>
</td>
```

**Par**:

```javascript
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <div className="flex space-x-2">
    {(currentUser.role === 'admin' || currentUser.role === 'employe_production') && (
      <>
        <button
          onClick={() => startReappro(product)}
          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
          title="Réapprovisionner"
        >
          <TrendingUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => startEdit(product)}
          className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded transition-colors"
          title="Modifier"
        >
          <Edit className="h-4 w-4" />
        </button>
      </>
    )}
    {currentUser.role === 'admin' && (
      <button
        onClick={() => handleDeleteProduct(product.id, product.nom)}
        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
        title="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    )}
  </div>
</td>
```

### 5. Ajouter le modal de réapprovisionnement

**Juste avant le dernier `</div>` de fermeture** (ligne 1169), ajoutez:

```javascript
      {/* Modal Réapprovisionnement */}
      <Modal
        isOpen={reapproProduct !== null}
        onClose={() => {
          setReapproProduct(null);
          setReapproData({
            quantite_ajoutee: '',
            prix_achat_total: '',
            date_achat: new Date().toISOString().split('T')[0]
          });
          setSelectedReapproRef(null);
          setReapproSearch('');
          setError('');
        }}
        title={`Réapprovisionner - ${reapproProduct?.nom}`}
        size="lg"
      >
        <form onSubmit={handleReapprovisionner} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 text-sm">{error}</div>
            </div>
          )}

          {/* Info produit actuel */}
          {reapproProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">📊 Stock actuel</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Stock restant:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite_restante} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-blue-600">Stock total:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-blue-600">Prix unitaire actuel:</span>
                  <span className="ml-2 font-semibold">{utils.formatCFA(reapproProduct.prix_achat)}</span>
                </div>
                <div>
                  <span className="text-blue-600">Valeur stock:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {utils.formatCFA(reapproProduct.prix_achat * reapproProduct.quantite_restante)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recherche référentiel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher dans le référentiel (optionnel)
            </label>
            <div className="relative">
              <input
                type="text"
                value={reapproSearch || (selectedReapproRef ? `[${selectedReapproRef.reference}] ${selectedReapproRef.nom}` : "")}
                onChange={(e) => {
                  setReapproSearch(e.target.value);
                  setReapproOpen(true);
                }}
                onFocus={() => setReapproOpen(true)}
                onBlur={() => setTimeout(() => setReapproOpen(false), 200)}
                disabled={submitting}
                placeholder="Sélectionner depuis le référentiel..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />

              {reapproOpen && referentiels.filter(ref =>
                ref && ref.reference && ref.nom &&
                ref.nom.toLowerCase() === reapproProduct?.nom.toLowerCase() &&
                `${ref.reference} ${ref.nom}`.toLowerCase().includes((reapproSearch || '').toLowerCase())
              ).length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow">
                  {referentiels.filter(ref =>
                    ref && ref.reference && ref.nom &&
                    ref.nom.toLowerCase() === reapproProduct?.nom.toLowerCase() &&
                    `${ref.reference} ${ref.nom}`.toLowerCase().includes((reapproSearch || '').toLowerCase())
                  ).map(ref => (
                    <li
                      key={ref.id}
                      onClick={() => {
                        handleReapproReferentielSelect(ref.id);
                        setReapproSearch(`[${ref.reference}] ${ref.nom}`);
                        setReapproOpen(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    >
                      <div className="font-medium">[{ref.reference}] {ref.nom}</div>
                      <div className="text-xs text-gray-500">
                        {ref.quantite_par_conditionnement} {ref.unite_mesure} - {utils.formatCFA(ref.prix_unitaire)}/unité
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedReapproRef && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-medium text-green-800">✅ Référentiel sélectionné</h4>
                    <p className="text-xs text-green-700 mt-1">
                      Prix: {utils.formatCFA(selectedReapproRef.prix_unitaire)}/{selectedReapproRef.unite_mesure}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReapproRef(null);
                      setReapproSearch('');
                      setReapproData(prev => ({
                        ...prev,
                        quantite_ajoutee: '',
                        prix_achat_total: ''
                      }));
                    }}
                    className="text-xs text-green-600 hover:text-green-800"
                  >
                    ✕ Effacer
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité à ajouter *
                {selectedReapproRef && (
                  <span className="text-xs text-green-600 ml-2">
                    (Prix recalculé auto)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={reapproData.quantite_ajoutee}
                onChange={(e) => handleReapproQuantiteChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 20"
                required
                disabled={submitting}
              />
              {reapproData.quantite_ajoutee && reapproProduct && (
                <p className="text-xs text-blue-600 mt-1">
                  Nouveau total: {parseFloat(reapproProduct.quantite) + parseFloat(reapproData.quantite_ajoutee || 0)} {reapproProduct.unite?.value}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix d'achat TOTAL de ce réapprovisionnement (CFA) *
              </label>
              <input
                type="number"
                step="0.01"
                value={reapproData.prix_achat_total}
                onChange={(e) => setReapproData({...reapproData, prix_achat_total: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 15000"
                required
                disabled={submitting || (selectedReapproRef && true)}
              />
              {reapproData.prix_achat_total && reapproData.quantite_ajoutee && (
                <p className="text-xs text-blue-600 mt-1">
                  Prix unitaire: {utils.formatCFA(parseFloat(reapproData.prix_achat_total) / parseFloat(reapproData.quantite_ajoutee))}/{reapproProduct?.unite?.value}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date d'achat *</label>
              <input
                type="date"
                value={reapproData.date_achat}
                onChange={(e) => setReapproData({...reapproData, date_achat: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Aperçu du calcul */}
          {reapproData.quantite_ajoutee && reapproData.prix_achat_total && reapproProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 mb-3">📊 Aperçu du nouveau stock</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-green-700">Quantité actuelle:</span>
                  <span className="ml-2 font-semibold">{reapproProduct.quantite} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-green-700">Quantité ajoutée:</span>
                  <span className="ml-2 font-semibold text-green-600">+{reapproData.quantite_ajoutee} {reapproProduct.unite?.value}</span>
                </div>
                <div>
                  <span className="text-green-700">Nouveau total:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {parseFloat(reapproProduct.quantite) + parseFloat(reapproData.quantite_ajoutee)} {reapproProduct.unite?.value}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Nouvelle valeur stock:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {utils.formatCFA(
                      (parseFloat(reapproProduct.prix_achat) * parseFloat(reapproProduct.quantite) +
                       parseFloat(reapproData.prix_achat_total))
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="spinner w-4 h-4 inline mr-2"></div>
                  Réapprovisionnement...
                </>
              ) : (
                '✓ Confirmer le réapprovisionnement'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setReapproProduct(null);
                setReapproData({
                  quantite_ajoutee: '',
                  prix_achat_total: '',
                  date_achat: new Date().toISOString().split('T')[0]
                });
                setSelectedReapproRef(null);
                setReapproSearch('');
                setError('');
              }}
              disabled={submitting}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </Modal>
```

## 🎉 Résultat

Avec ces modifications, vous aurez:

✅ **Bouton vert "Réapprovisionner"** (icône TrendingUp) dans chaque ligne du tableau
✅ **Modal intuitif** qui affiche le stock actuel
✅ **Recherche référentiel** pour auto-compléter quantité et prix
✅ **Calcul automatique** du prix moyen pondéré
✅ **Aperçu en temps réel** du nouveau stock
✅ **Historique tracé** dans `mouvements_stock`

Le workflow devient:
1. Cliquer sur 🔼 (Réapprovisionner)
2. Optionnel: Rechercher dans référentiel
3. Saisir quantité + prix
4. Valider → Stock mis à jour automatiquement!

Plus besoin de calculer manuellement le nouveau total! 🎯
