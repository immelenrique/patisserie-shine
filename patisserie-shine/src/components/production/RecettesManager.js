"use client";

import { useState, useEffect } from 'react';
import { Plus, ChefHat, Calculator, Trash2, Package, Copy, DollarSign } from 'lucide-react';
import Select from 'react-select';
import { Card, Modal, useSaisie } from '../ui';
import { supabase } from '../../lib/supabase-client';
import { recetteService, productService } from '../../services';
import { utils } from '../../utils/formatters'; 

export default function RecettesManager({ currentUser }) {
  const [recettes, setRecettes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalculModal, setShowCalculModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [calculData, setCalculData] = useState({
    nom_produit: '',
    quantite: ''
  });
  const [besoins, setBesoins] = useState([]);
  
  // Fiches de recette : rendement par fournée, marge acceptée, produit fini (partie 9)
  const [fiches, setFiches] = useState({});
  const [fiche, setFiche] = useState({ rendement: '', marge_moins: '', marge_plus: '', produit_fini: '' });
  const [enEdition, setEnEdition] = useState(false);
  const [fenetreSaisie, demander] = useSaisie();
  // Les recettes décident des matières retirées à l'atelier : seuls le propriétaire et les gérants les modifient
  const peutModifier = currentUser?.role === 'admin';

  // Nouveau state pour le prix de vente
  const [prixVenteRecette, setPrixVenteRecette] = useState('');
  const [definirPrixVente, setDefinirPrixVente] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

 // Dans RecettesManager.js, corrigez la fonction loadData :

const loadData = async () => {
  setLoading(true);
  try {
    // Charger les recettes
    const { recettes: recettesData, error: recettesError } = await recetteService.getAll();
    
    if (recettesError) {
      console.error('Erreur chargement recettes:', recettesError);
      setRecettes([]);
    } else {
      setRecettes(recettesData || []);
    }

    const { data: fichesData, error: fichesError } = await supabase.from('recettes_fiches').select('*');
    if (fichesError) console.warn('Fiches de recette indisponibles:', fichesError.message);
    setFiches(Object.fromEntries((fichesData || []).map(f => [f.nom_produit, f])));

    // IMPORTANT: Charger les produits avec le STOCK ATELIER (pas le stock principal)
    // car c'est dans l'atelier que se fait la production

    // 1. Charger les produits
    const { data: produitsData, error: produitsError } = await supabase
      .from('produits')
      .select(`
        *,
        unite:unites(id, value, label)
      `)
      .order('nom', { ascending: true });

    if (produitsError) {
      console.error('Erreur chargement produits:', produitsError);
      setProducts([]);
    } else {
      // 2. Charger le stock atelier séparément
      const { data: stockAtelierData, error: stockAtelierError } = await supabase
        .from('stock_atelier')
        .select('produit_id, quantite_disponible');

      if (stockAtelierError) {
        console.error('Erreur chargement stock atelier:', stockAtelierError);
      }

      // 3. Combiner les données
      const stockAtelierMap = (stockAtelierData || []).reduce((acc, item) => {
        acc[item.produit_id] = item.quantite_disponible;
        return acc;
      }, {});

      const produitsAvecStockAtelier = (produitsData || []).map(p => ({
        ...p,
        quantite_atelier: stockAtelierMap[p.id] || 0
      }));

      console.log('Produits chargés pour recettes:', produitsAvecStockAtelier.length);
      console.log('Exemple produit:', produitsAvecStockAtelier[0]);
      setProducts(produitsAvecStockAtelier);
    }

  } catch (err) {
    console.error('Erreur générale dans RecettesManager:', err);
    setProducts([]); // S'assurer que products est toujours un tableau
    setRecettes([]);
  } finally {
    setLoading(false);
  }
};

  const ajouterIngredient = () => {
    setIngredients([...ingredients, {
      id: Date.now(),
      produit_ingredient_id: '',
      quantite_necessaire: ''
    }]);
  };

  const ajouterPlusieursProduits = () => {
    const nouveauxIngredients = [];
    for (let i = 0; i < 3; i++) {
      nouveauxIngredients.push({
        id: Date.now() + i,
        produit_ingredient_id: '',
        quantite_necessaire: ''
      });
    }
    setIngredients([...ingredients, ...nouveauxIngredients]);
  };

  const supprimerIngredient = (id) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const updateIngredient = (id, field, value) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const dupliquerIngredient = (id) => {
    const ingredient = ingredients.find(ing => ing.id === id);
    if (ingredient) {
      setIngredients([...ingredients, {
        ...ingredient,
        id: Date.now(),
        quantite_necessaire: ''
      }]);
    }
  };

  // Calculer le coût total de la recette
  const calculerCoutRecette = () => {
    if (!Array.isArray(products) || products.length === 0) return 0;

    const ingredientsValides = getIngredientsValides();
    return ingredientsValides.reduce((sum, ing) => {
      const produit = products.find(p => p.id === parseInt(ing.produit_ingredient_id));
      // prix_achat est déjà un prix à l'unité
      if (produit && produit.prix_achat) {
        return sum + (produit.prix_achat * parseFloat(ing.quantite_necessaire));
      }
      return sum;
    }, 0);
  };

  // Calculer la marge si prix de vente défini
  const calculerMargeRecette = () => {
    if (!prixVenteRecette) return { marge: 0, pourcentage: 0 };
    
    const coutTotal = calculerCoutRecette();
    const prixVente = parseFloat(prixVenteRecette);
    const marge = prixVente - coutTotal;
    const pourcentageMarge = coutTotal > 0 ? (marge / coutTotal) * 100 : 0;
    
    return {
      marge: marge,
      pourcentage: pourcentageMarge
    };
  };

  //  handleSaveRecette dans RecettesManager.js

  const handleSaveRecette = async () => {
  if (!selectedProduit || ingredients.length === 0) {
    alert('Veuillez sélectionner un produit et ajouter au moins un ingrédient');
    return;
  }

  const ingredientsValides = ingredients.filter(ing => 
    ing.produit_ingredient_id && ing.quantite_necessaire && parseFloat(ing.quantite_necessaire) > 0
  );

  if (ingredientsValides.length === 0) {
    alert('Veuillez remplir au moins un ingrédient avec une quantité valide');
    return; // 🔧 CORRECTION : il manquait ce return !
  }

  try {
    // Obtenir l'utilisateur actuel
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Utilisateur non connecté');
      return;
    }

    const rendement = parseFloat(String(fiche.rendement).replace(',', '.'));
    const margeMoins = parseFloat(String(fiche.marge_moins || 0).replace(',', '.'));
    const margePlus = parseFloat(String(fiche.marge_plus || 0).replace(',', '.'));
    if (!(rendement > 0) || margeMoins < 0 || margePlus < 0 || margeMoins >= rendement || String(fiche.produit_fini).trim().length < 2) {
      alert('Indiquez le rendement (produits par fournée), la marge acceptée et le nom du produit fini.');
      return;
    }
    if (!enEdition && recettesGroupees[selectedProduit.trim()]) {
      const r = await demander({
        titre: 'Recette existante', message: `Une recette existe déjà pour « ${selectedProduit} ». La remplacer ? L'ancienne version reste dans l'historique.`,
        confirmer: 'Remplacer'
      });
      if (!r) return;
    }

    // Ingrédients (par fournée) et fiche remplacés ensemble par la base, qui garde l'ancienne version
    const { error: erreurRecette } = await supabase.rpc('recette_enregistrer', {
      p_nom: selectedProduit.trim(),
      p_lignes: ingredientsValides.map(ing => ({ produit_id: parseInt(ing.produit_ingredient_id), quantite: parseFloat(ing.quantite_necessaire) })),
      p_rendement: rendement, p_marge_moins: margeMoins, p_marge_plus: margePlus, p_produit_fini: String(fiche.produit_fini).trim()
    });
    if (erreurRecette) {
      alert('Recette non enregistrée : ' + erreurRecette.message);
      return;
    }

    // Si prix de vente défini, l'enregistrer dans prix_vente_recettes
    if (definirPrixVente && prixVenteRecette && parseFloat(prixVenteRecette) > 0) {
      console.log('💰 Sauvegarde prix recette:', selectedProduit, prixVenteRecette);
      
      try {
        // Supprimer l'ancien prix si existe
        await supabase
          .from('prix_vente_recettes')
          .delete()
          .eq('nom_produit', selectedProduit);

        // Insérer le nouveau prix
        const { data: prixData, error: prixError } = await supabase
          .from('prix_vente_recettes')
          .insert({
            nom_produit: selectedProduit,
            prix_vente: parseFloat(prixVenteRecette),
            defini_par: user.id,
            actif: true
          })
          .select();

        if (prixError) {
          console.error('❌ Erreur sauvegarde prix:', prixError);
          alert('Recette créée mais erreur prix: ' + prixError.message);
        } else {
          console.log('✅ Prix de vente recette sauvegardé:', prixData);
        }
      } catch (prixErr) {
        console.error('❌ Exception prix vente recette:', prixErr);
        alert('Recette créée mais exception prix: ' + prixErr.message);
      }
    }

    // Recharger les données et fermer le modal
    await loadData();
    setShowAddModal(false);
    setSelectedProduit('');
    setIngredients([]);
    setPrixVenteRecette('');
    setDefinirPrixVente(false);
    
    // Message de succès
    let message = `Recette enregistrée : ${ingredientsValides.length} ingrédient(s) par fournée, environ ${rendement} produit(s) (-${margeMoins} / +${margePlus}).`;
    if (definirPrixVente && prixVenteRecette) {
      message += `\n\nPrix de vente défini: ${utils.formatCFA(parseFloat(prixVenteRecette))}`;
      const marge = calculerMargeRecette();
      message += `\nMarge: ${utils.formatCFA(marge.marge)} (${Math.round(marge.pourcentage)}%)`;
    }
    
    alert(message);

  } catch (err) {
    console.error('Erreur générale:', err);
    alert('Erreur lors de la création de la recette: ' + err.message);
  }
}; // 🔧 FERMETURE de handleSaveRecette

// 🔧 FONCTION SÉPARÉE handleCalculBesoins (HORS de handleSaveRecette)
const handleCalculBesoins = async (e) => {
  e.preventDefault();
  try {
    const { besoins, error } = await recetteService.calculerBesoins(
      calculData.nom_produit,
      parseFloat(calculData.quantite)
    );

    if (error) {
      alert('Erreur lors du calcul: ' + error);
    } else {
      setBesoins(besoins);
    }
  } catch (err) {
    console.error('Erreur:', err);
    alert('Erreur lors du calcul');
  }
};

  const ouvrirEdition = (nomProduit, lignes) => {
    const f = fiches[nomProduit];
    setSelectedProduit(nomProduit);
    setIngredients(lignes.map((l, i) => ({ id: Date.now() + i, produit_ingredient_id: String(l.produit_ingredient_id), quantite_necessaire: String(l.quantite_necessaire) })));
    setFiche(f ? { rendement: String(f.rendement), marge_moins: String(f.marge_moins), marge_plus: String(f.marge_plus), produit_fini: f.produit_fini }
               : { rendement: '', marge_moins: '', marge_plus: '', produit_fini: '' });
    setEnEdition(true);
    setPrixVenteRecette('');
    setDefinirPrixVente(false);
    setShowAddModal(true);
  };

  const supprimerRecette = async (nomProduit) => {
    const r = await demander({
      titre: 'Supprimer la recette', message: `« ${nomProduit} » ne pourra plus être produite. Elle reste dans l'historique.`,
      champs: [{ nom: 'motif', label: 'Motif', obligatoire: true }], confirmer: 'Supprimer', danger: true
    });
    if (!r) return;
    const { error } = await supabase.rpc('recette_supprimer', { p_nom: nomProduit, p_motif: r.motif });
    if (error) return alert('Suppression impossible : ' + error.message);
    loadData();
  };

  // Grouper les recettes par produit
  const recettesGroupees = recettes.reduce((acc, recette) => {
    if (!acc[recette.nom_produit]) {
      acc[recette.nom_produit] = [];
    }
    acc[recette.nom_produit].push(recette);
    return acc;
  }, {});

  const getIngredientsValides = () => {
    if (!Array.isArray(ingredients)) return [];

    return ingredients.filter(ing =>
      ing.produit_ingredient_id && ing.quantite_necessaire && parseFloat(ing.quantite_necessaire) > 0
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recettes de Production</h2>
          <p className="text-gray-600">Définissez les ingrédients nécessaires pour chaque produit fini</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowCalculModal(true)}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Calculator className="h-5 w-5" />
            <span>Calculer Besoins</span>
          </button>
          {peutModifier && <button
            onClick={() => {
              setSelectedProduit('');
              setIngredients([]);
              setFiche({ rendement: '', marge_moins: '', marge_plus: '', produit_fini: '' });
              setEnEdition(false);
              setPrixVenteRecette('');
              setDefinirPrixVente(false);
              ajouterIngredient();
              setShowAddModal(true);
            }}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle Recette</span>
          </button>}
        </div>
      </div>

      {/* Liste des recettes par produit */}
      <div className="space-y-6">
        {Object.keys(recettesGroupees).length === 0 ? (
          <Card className="p-8 text-center">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune recette créée</h3>
            <p className="text-gray-500 mb-4">Commencez par créer une recette pour vos produits finis</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200"
            >
              Créer ma première recette
            </button>
          </Card>
        ) : (
          Object.entries(recettesGroupees).map(([nomProduit, ingredients]) => {
            const coutTotal = ingredients.reduce((sum, ing) => sum + (ing.cout_ingredient || 0), 0);
            const peutProduire = ingredients.every(ing => ing.ingredient_disponible);
            
            return (
              <Card key={nomProduit} className="overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <ChefHat className="h-6 w-6 mr-2 text-orange-500" />
                        {nomProduit}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Coût d'une fournée : <span className="font-semibold text-orange-600">{utils.formatCFA(coutTotal)}</span>
                      </p>
                      {fiches[nomProduit] ? (
                        <p className="text-sm text-gray-700 mt-1">
                          Donne environ <b>{fiches[nomProduit].rendement}</b> « {fiches[nomProduit].produit_fini} » par fournée
                          (marge acceptée : -{fiches[nomProduit].marge_moins} / +{fiches[nomProduit].marge_plus})
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-orange-800 mt-1">
                          Rendement à indiquer : la production avec cette recette est impossible tant qu'il manque.
                        </p>
                      )}
                      {peutModifier && (
                        <div className="flex gap-3 mt-2">
                          <button onClick={() => ouvrirEdition(nomProduit, ingredients)} className="text-sm font-medium text-orange-800 underline min-h-[32px]">Modifier</button>
                          <button onClick={() => supprimerRecette(nomProduit)} className="text-sm font-medium text-red-700 underline min-h-[32px]">Supprimer</button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        peutProduire ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''}
                      </span>
                      <p className={`text-sm mt-1 ${peutProduire ? 'text-green-600' : 'text-red-600'}`}>
                        {peutProduire ? '✓ Peut être produit' : '✗ Stock atelier insuffisant'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ingredients.map((ingredient) => (
                      <div 
                        key={ingredient.recette_id} 
                        className={`p-4 rounded-lg border-2 ${
                          ingredient.ingredient_disponible 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center">
                            <Package className="w-5 h-5 text-gray-500 mr-2" />
                            <div>
                              <h4 className="font-medium text-gray-900">{ingredient.ingredient_nom}</h4>
                              <p className="text-sm text-gray-600">
                                {ingredient.quantite_necessaire} {ingredient.unite}
                              </p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            ingredient.ingredient_disponible 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {ingredient.ingredient_disponible ? '✓' : '✗'}
                          </span>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Stock atelier:</span>
                            <span>{ingredient.stock_atelier_disponible || 0} {ingredient.unite}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Coût:</span>
                            <span>{utils.formatCFA(ingredient.cout_ingredient || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {fenetreSaisie}
      {/* Modal Nouvelle Recette */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => {
          setShowAddModal(false);
          setEnEdition(false);
          setSelectedProduit('');
          setIngredients([]);
          setPrixVenteRecette('');
          setDefinirPrixVente(false);
          setTimeout(() => ajouterIngredient(), 100);
        }} 
        title={enEdition ? `Modifier la recette « ${selectedProduit} »` : 'Créer une Nouvelle Recette'} 
        size="xl"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du produit fini *
            </label>
            <input
              type="text"
              value={selectedProduit}
              readOnly={enEdition}
              onChange={(e) => setSelectedProduit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Croissants au Beurre (pour 12 pièces)"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Nom de la recette (les quantités ci-dessous sont pour une fournée)
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-sm">Produits par fournée *
              <input type="number" min="0" step="any" value={fiche.rendement} onChange={(e) => setFiche(f => ({ ...f, rendement: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex. 120" />
            </label>
            <label className="text-sm">Marge en moins
              <input type="number" min="0" step="any" value={fiche.marge_moins} onChange={(e) => setFiche(f => ({ ...f, marge_moins: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex. 3" />
            </label>
            <label className="text-sm">Marge en plus
              <input type="number" min="0" step="any" value={fiche.marge_plus} onChange={(e) => setFiche(f => ({ ...f, marge_plus: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex. 2" />
            </label>
            <label className="text-sm">Produit fini (nom en boutique) *
              <input type="text" value={fiche.produit_fini} onChange={(e) => setFiche(f => ({ ...f, produit_fini: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="ex. Cake nature" />
            </label>
          </div>
          <p className="text-xs text-gray-600">Une production hors de la marge (par fournée : rendement - marge à rendement + marge) est signalée au propriétaire.</p>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Ingrédients nécessaires * 
                <span className="text-green-600 ml-2">({getIngredientsValides().length} valide{getIngredientsValides().length > 1 ? 's' : ''})</span>
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={ajouterIngredient}
                  className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
                <button
                  type="button"
                  onClick={ajouterPlusieursProduits}
                  className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>+3</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {ingredients.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun ingrédient ajouté</p>
                  <p className="text-sm">Cliquez sur "Ajouter" pour commencer</p>
                </div>
              ) : (
                ingredients.map((ingredient, index) => {
                  const produitSelectionne = Array.isArray(products) 
                  ? products.find(p => p && p.id === parseInt(ingredient.produit_ingredient_id))
                  : null;
                  const estValide = ingredient.produit_ingredient_id && ingredient.quantite_necessaire && parseFloat(ingredient.quantite_necessaire) > 0;
                  
                  return (
                    <div 
                      key={ingredient.id} 
                      className={`grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border-2 ${
                        estValide ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Ingrédient {index + 1} {estValide && <span className="text-green-600">✓</span>}
                        </label>
                        <Select
                          value={
                            ingredient.produit_ingredient_id
                              ? {
                                  value: ingredient.produit_ingredient_id,
                                  label: products.find(p => p.id === parseInt(ingredient.produit_ingredient_id))?.nom || 'Sélectionné'
                                }
                              : null
                          }
                          onChange={(selectedOption) => updateIngredient(ingredient.id, 'produit_ingredient_id', selectedOption?.value || '')}
                          options={Array.isArray(products) ? products.map(product => ({
                            value: product.id,
                            label: `${product.nom} (${product.unite?.label}) - Stock: ${utils.formatNumber(product.quantite_atelier || 0, 1)}`,
                            product: product
                          })) : []}
                          placeholder="Tapez pour rechercher un ingrédient..."
                          isClearable
                          isSearchable
                          noOptionsMessage={() => "Aucun ingrédient trouvé"}
                          className="text-sm"
                          styles={{
                            control: (base) => ({
                              ...base,
                              borderColor: '#d1d5db',
                              '&:hover': { borderColor: '#f97316' },
                              boxShadow: 'none',
                              '&:focus-within': {
                                borderColor: '#f97316',
                                boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.2)'
                              }
                            })
                          }}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ingredient.quantite_necessaire}
                          onChange={(e) => updateIngredient(ingredient.id, 'quantite_necessaire', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                          placeholder="0.0"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {produitSelectionne ? produitSelectionne.unite?.value : 'unité'}
                        </div>
                      </div>
                      
                      <div className="flex items-end space-x-1">
                        <button
                          type="button"
                          onClick={() => dupliquerIngredient(ingredient.id)}
                          className="text-blue-500 hover:text-blue-700 p-1 border border-blue-300 rounded hover:bg-blue-50"
                          title="Dupliquer cet ingrédient"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => supprimerIngredient(ingredient.id)}
                          className="text-red-500 hover:text-red-700 p-1 border border-red-300 rounded hover:bg-red-50"
                          title="Supprimer cet ingrédient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {produitSelectionne && (
                        <div className="md:col-span-4 mt-2 pt-2 border-t border-gray-300">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                            <div>
                              <strong>Stock atelier:</strong> {utils.formatNumber(produitSelectionne.quantite_atelier || 0, 1)} {produitSelectionne.unite?.value}
                            </div>
                            <div>
                              <strong>Prix:</strong> {utils.formatCFA(produitSelectionne.prix_achat || 0)} / {produitSelectionne.unite?.value}
                            </div>
                            <div>
                              <strong>Coût estimé:</strong>
                              {ingredient.quantite_necessaire && produitSelectionne.prix_achat ?
                                utils.formatCFA(parseFloat(ingredient.quantite_necessaire) * produitSelectionne.prix_achat)
                                : ' - '}
                            </div>
                            <div className={`font-medium ${produitSelectionne.quantite_atelier <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {produitSelectionne.quantite_atelier <= 0 ? '⚠ Rupture atelier' : '✓ Disponible atelier'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            {ingredients.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span>Total ingrédients: {ingredients.length}</span>
                  <span className="font-medium text-blue-800">
                    Valides: {getIngredientsValides().length} | 
                    Coût estimé: {utils.formatCFA(calculerCoutRecette())}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Nouvelle section: Prix de vente */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                id="definir_prix_vente"
                checked={definirPrixVente}
                onChange={(e) => {
                  setDefinirPrixVente(e.target.checked);
                  if (!e.target.checked) setPrixVenteRecette('');
                }}
                className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="definir_prix_vente" className="flex items-center text-sm font-medium text-gray-700">
                <DollarSign className="w-4 h-4 mr-2 text-orange-600" />
                Définir le prix de vente pour ce produit
              </label>
            </div>

            {definirPrixVente && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-orange-700 mb-2">
                      Prix de vente unitaire (CFA) *
                    </label>
                    <input
                      type="number"
                      step="25"
                      min="0"
                      value={prixVenteRecette}
                      onChange={(e) => setPrixVenteRecette(e.target.value)}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="2500"
                      required={definirPrixVente}
                    />
                  </div>

                  {prixVenteRecette && getIngredientsValides().length > 0 && (
                    <div className="self-end">
                      <div className="bg-white border border-orange-300 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-orange-700 mb-2">Marge calculée</h4>
                        <div className="text-xs space-y-1">
                          <div>Coût de production: {utils.formatCFA(calculerCoutRecette())}</div>
                          <div>Prix de vente: {utils.formatCFA(parseFloat(prixVenteRecette))}</div>
                          <div className="border-t pt-1">
                            <div className={`font-semibold ${calculerMargeRecette().marge >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Marge: {calculerMargeRecette().marge >= 0 ? '+' : ''}{utils.formatCFA(calculerMargeRecette().marge)}
                            </div>
                            <div className={`text-xs ${calculerMargeRecette().pourcentage >= 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {Math.round(calculerMargeRecette().pourcentage)}% de marge
                              {calculerMargeRecette().pourcentage < 20 && ' (⚠️ Faible)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-orange-700">
                  ✓ Le prix sera automatiquement disponible pour les productions destinées à la boutique
                  <br />
                  ✓ Produits vendables directement en caisse après production
                </div>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">💡 Conseils pour une recette optimale</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Les quantités sont celles d'une fournée ; « produits par fournée » dit ce qu'elle donne environ</li>
              <li>• Utilisez le bouton "Dupliquer" pour des ingrédients similaires</li>
              <li>• Le coût est calculé automatiquement selon vos prix d'achat</li>
              <li>• Seuls les ingrédients valides (complets) seront sauvegardés</li>
              <li>• {definirPrixVente ? '✓ Prix de vente défini pour vente directe' : '📝 Définissez le prix de vente pour vendre en boutique'}</li>
            </ul>
          </div>

          <div className="flex space-x-4 pt-4">
            <button 
              onClick={handleSaveRecette}
              disabled={!selectedProduit || getIngredientsValides().length === 0 || (definirPrixVente && !prixVenteRecette)}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {enEdition ? 'Enregistrer' : 'Créer la recette'} ({getIngredientsValides().length} ingrédient{getIngredientsValides().length > 1 ? 's' : ''})
              {definirPrixVente && prixVenteRecette && ` + Prix ${utils.formatCFA(parseFloat(prixVenteRecette))}`}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setSelectedProduit('');
                setIngredients([]);
                setPrixVenteRecette('');
                setDefinirPrixVente(false);
                setTimeout(() => ajouterIngredient(), 100);
              }}
              className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Calcul Besoins - Inchangé */}
      <Modal 
        isOpen={showCalculModal} 
        onClose={() => {
          setShowCalculModal(false);
          setBesoins([]);
        }} 
        title="Calculer les Besoins de Production" 
        size="lg"
      >
        <form onSubmit={handleCalculBesoins} className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Produit à fabriquer *</label>
              <select
                value={calculData.nom_produit}
                onChange={(e) => setCalculData({...calculData, nom_produit: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Choisir un produit</option>
                {Object.keys(recettesGroupees).map((produit) => (
                  <option key={produit} value={produit}>
                    {produit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantité à produire *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={calculData.quantite}
                onChange={(e) => setCalculData({...calculData, quantite: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="2 (pour doubler la recette)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Multiplicateur de la recette (ex: 2 = double portion)
              </p>
            </div>
          </div>
          
          <button type="submit" className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200">
            Calculer les besoins
          </button>
        </form>

        {besoins.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-4">Besoins calculés pour {calculData.quantite}x "{calculData.nom_produit}" :</h4>
            <div className="space-y-3">
              {besoins.map((besoin, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-2 ${
                    besoin.quantite_manquante > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="font-medium text-gray-900">{besoin.ingredient_nom}</h5>
                      <p className="text-sm text-gray-600">
                        Nécessaire: <strong>{utils.formatNumber(besoin.quantite_necessaire, 2)} {besoin.unite}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Stock atelier: <strong>{utils.formatNumber(besoin.quantite_disponible, 2)} {besoin.unite}</strong>
                      </p>
                      {besoin.quantite_manquante > 0 ? (
                        <p className="text-sm font-medium text-red-600">
                          ⚠ Manque: <strong>{utils.formatNumber(besoin.quantite_manquante, 2)} {besoin.unite}</strong>
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-green-600">
                          ✓ Stock suffisant
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Actions recommandées :</h5>
                <ul className="text-sm text-blue-800 space-y-1">
                  {besoins.filter(b => b.quantite_manquante > 0).length > 0 ? (
                    <>
                      <li>• Créer des demandes pour les ingrédients manquants</li>
                      <li>• Faire valider les demandes pour alimenter le stock atelier</li>
                      <li>• Relancer ce calcul après réapprovisionnement</li>
                    </>
                  ) : (
                    <li>• ✅ Vous pouvez lancer la production immédiatement !</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
