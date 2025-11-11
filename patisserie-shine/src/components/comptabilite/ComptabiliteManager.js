"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { comptabiliteService, caisseService } from '../../services';
import { utils } from '../../utils/formatters';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, Download, FileText, PieChart, Calculator, Receipt } from 'lucide-react';
import { Card, StatCard,Modal } from '../ui';

export default function ComptabiliteManager({ currentUser }) {
  const [rapportMensuel, setRapportMensuel] = useState(null);
  const [evolutionMensuelle, setEvolutionMensuelle] = useState([]);
  const [produitsTop, setProduitsTop] = useState([]);
  const [ventesJour, setVentesJour] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState([]);
  const [selectedVente, setSelectedVente] = useState(null);
  const [showTicket, setShowTicket] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('mensuel');
  const [periodeSelectionnee, setPeriodeSelectionnee] = useState({
    mois: new Date().getMonth() + 1,
    annee: new Date().getFullYear()
  });
  const [periodePersonnalisee, setPeriodePersonnalisee] = useState({
    debut: new Date().toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [periodeSelectionnee]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculer les dates de début et fin du mois
      const dateDebut = new Date(periodeSelectionnee.annee, periodeSelectionnee.mois - 1, 1).toISOString().split('T')[0];
      const dateFin = new Date(periodeSelectionnee.annee, periodeSelectionnee.mois, 0).toISOString().split('T')[0];

      const [rapportResult, evolutionResult, produitsResult, ventesResult] = await Promise.all([
        comptabiliteService.getRapportComptable(dateDebut, dateFin),
        comptabiliteService.getEvolutionMensuelle(periodeSelectionnee.annee),
        caisseService.getProduitsTopVentes(10, 'mois'),
        caisseService.getVentesJour()
      ]);

      if (rapportResult.error) throw new Error(rapportResult.error);
      if (evolutionResult.error) throw new Error(evolutionResult.error);
      if (produitsResult.error) throw new Error(produitsResult.error);
      if (ventesResult.error) throw new Error(ventesResult.error);

      setRapportMensuel(rapportResult);
      setEvolutionMensuelle(evolutionResult.evolution);
      setProduitsTop(produitsResult.produits);
      setVentesJour(ventesResult.ventes);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exporterRapport = async (format = 'csv') => {
    try {
      const dateDebut = new Date(periodeSelectionnee.annee, periodeSelectionnee.mois - 1, 1).toISOString().split('T')[0];
      const dateFin = new Date(periodeSelectionnee.annee, periodeSelectionnee.mois, 0).toISOString().split('T')[0];

      const { success, content, filename, error } = await comptabiliteService.exporterDonneesComptables(
        dateDebut, 
        dateFin, 
        format
      );

      if (!success) {
        alert('Erreur lors de l\'export : ' + error);
        return;
      }

      // Télécharger le fichier
      const blob = new Blob([content], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors de l\'export : ' + err.message);
    }
  };
const viewTicket = async (venteId) => {
  try {
    const { data: vente, error: venteError } = await supabase
      .from('ventes')
      .select(`
        *,
        vendeur:vendeur_id(nom, username),
        lignes_vente(
          *,
          nom_produit,
          quantite,
          prix_unitaire,
          total,
          produit:produit_id(nom)
        )
      `)
      .eq('id', venteId)
      .single();

    if (venteError) throw venteError;

    setSelectedVente(vente);
    setShowTicket(true);
  } catch (error) {
    console.error('Erreur chargement ticket:', error);
    alert('Erreur lors du chargement du ticket');
  }
};

  const genererRapportPersonnalise = async () => {
    setLoading(true);
    try {
      const rapportResult = await comptabiliteService.getRapportComptable(
        periodePersonnalisee.debut,
        periodePersonnalisee.fin
      );

      if (rapportResult.error) throw new Error(rapportResult.error);

      setRapportMensuel(rapportResult);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const imprimerRapport = () => {
    window.print();
  };

  const moisNoms = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
        <span className="ml-2">Chargement des données comptables...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-8 h-8 text-orange-600 mr-3" />
            Comptabilité
          </h1>
          <p className="text-gray-600">Suivi financier et analyse des performances</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <select
              value={periodeSelectionnee.mois}
              onChange={(e) => setPeriodeSelectionnee({...periodeSelectionnee, mois: parseInt(e.target.value)})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {moisNoms.map((mois, index) => (
                <option key={index} value={index + 1}>{mois}</option>
              ))}
            </select>
            <select
              value={periodeSelectionnee.annee}
              onChange={(e) => setPeriodeSelectionnee({...periodeSelectionnee, annee: parseInt(e.target.value)})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {[2023, 2024, 2025, 2026].map(annee => (
                <option key={annee} value={annee}>{annee}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => exporterRapport('csv')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('mensuel')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mensuel'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Rapport Mensuel
          </button>
          <button
            onClick={() => setActiveTab('evolution')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'evolution'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Évolution Annuelle
          </button>
          <button
            onClick={() => setActiveTab('ventes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ventes'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Receipt className="w-4 h-4 inline mr-2" />
            Ventes Détaillées
          </button>
          <button
            onClick={() => setActiveTab('personnalise')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'personnalise'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Période Personnalisée
          </button>
        </nav>
      </div>

      {/* Contenu selon l'onglet actif */}
      {activeTab === 'mensuel' && rapportMensuel && (
        <div className="space-y-6">
          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Chiffre d'Affaires"
              value={utils.formatCFA(rapportMensuel.finances?.chiffre_affaires || 0)}
              change="Total des ventes"
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Dépenses"
              value={utils.formatCFA(rapportMensuel.finances?.depenses || 0)}
              change="Coût des ingrédients"
              icon={TrendingDown}
              color="red"
            />
            <StatCard
              title="Marge Brute"
              value={utils.formatCFA(rapportMensuel.finances?.marge_brute || 0)}
              change={`${rapportMensuel.finances?.pourcentage_marge || 0}% de marge`}
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="Transactions"
              value={rapportMensuel.ventes?.nombre_transactions || 0}
              change={`Ticket moyen: ${utils.formatCFA(rapportMensuel.ventes?.ticket_moyen || 0)}`}
              icon={BarChart3}
              color="purple"
            />
          </div>

          {/* Détails financiers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Résumé financier */}
            <Card>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Résumé Financier</h3>
                <p className="text-sm text-gray-500">
                  {moisNoms[periodeSelectionnee.mois - 1]} {periodeSelectionnee.annee}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Chiffre d'affaires:</span>
                  <span className="font-semibold text-green-600">
                    {utils.formatCFA(rapportMensuel.finances?.chiffre_affaires || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Coût des ingrédients:</span>
                  <span className="font-semibold text-red-600">
                    -{utils.formatCFA(rapportMensuel.finances?.depenses || 0)}
                  </span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Marge brute:</span>
                    <span className="font-bold text-lg text-blue-600">
                      {utils.formatCFA(rapportMensuel.finances?.marge_brute || 0)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 text-right">
                    ({rapportMensuel.finances?.pourcentage_marge || 0}% de marge)
                  </div>
                </div>
                
                {/* Barre de progression de la marge */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Rentabilité</span>
                    <span>{rapportMensuel.finances?.pourcentage_marge || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(rapportMensuel.finances?.pourcentage_marge || 0, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Produits les plus vendus */}
            <Card>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Produits les Plus Vendus</h3>
                <p className="text-sm text-gray-500">Top 5 du mois</p>
              </div>
              <div className="p-6">
                {produitsTop.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    Aucune donnée de vente
                  </div>
                ) : (
                  <div className="space-y-4">
                    {produitsTop.slice(0, 5).map((produit, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-orange-600 font-semibold text-sm">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{produit.nom_produit}</p>
                            <p className="text-sm text-gray-500">{produit.quantite_vendue} vendus</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {utils.formatCFA(produit.chiffre_affaires)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Analyse des ventes */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Analyse des Ventes</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {rapportMensuel.ventes?.nombre_transactions || 0}
                </div>
                <div className="text-sm text-gray-500">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {rapportMensuel.ventes?.articles_vendus || 0}
                </div>
                <div className="text-sm text-gray-500">Articles vendus</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {utils.formatCFA(rapportMensuel.ventes?.ticket_moyen || 0)}
                </div>
                <div className="text-sm text-gray-500">Ticket moyen</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'evolution' && (
        <div className="space-y-6">
          {/* Graphique d'évolution */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Évolution du Chiffre d'Affaires {periodeSelectionnee.annee}</h3>
            </div>
            <div className="p-6">
              {evolutionMensuelle.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  Aucune donnée d'évolution disponible
                </div>
              ) : (
                <div className="space-y-4">
                  {evolutionMensuelle.map((mois, index) => {
                    const maxCA = Math.max(...evolutionMensuelle.map(m => m.chiffre_affaires || 0));
                    const largeur = maxCA > 0 ? ((mois.chiffre_affaires || 0) / maxCA) * 100 : 0;
                    
                    return (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="w-24 text-sm font-medium text-gray-700">
                          {moisNoms[mois.mois - 1]}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-orange-400 to-orange-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${largeur}%` }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                            {utils.formatCFA(mois.chiffre_affaires || 0)}
                          </div>
                        </div>
                        <div className="w-20 text-sm text-gray-500 text-right">
                          {mois.nb_ventes || 0} ventes
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Comparaison et tendances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Performance Mensuelle</h3>
              </div>
              <div className="p-6">
                {evolutionMensuelle.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Meilleur mois:</span>
                      <span className="font-semibold">
                        {(() => {
                          const meilleur = evolutionMensuelle.reduce((max, m) => 
                            (m.chiffre_affaires || 0) > (max.chiffre_affaires || 0) ? m : max
                          );
                          return `${moisNoms[meilleur.mois - 1]} (${utils.formatCFA(meilleur.chiffre_affaires || 0)})`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Moyenne mensuelle:</span>
                      <span className="font-semibold">
                        {utils.formatCFA(
                          evolutionMensuelle.reduce((sum, m) => sum + (m.chiffre_affaires || 0), 0) / 
                          evolutionMensuelle.length
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total année:</span>
                      <span className="font-semibold text-green-600">
                        {utils.formatCFA(
                          evolutionMensuelle.reduce((sum, m) => sum + (m.chiffre_affaires || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Tendances</h3>
              </div>
              <div className="p-6">
                {evolutionMensuelle.length >= 2 && (
                  <div className="space-y-3">
                    {(() => {
                      const dernierMois = evolutionMensuelle[evolutionMensuelle.length - 1];
                      const avantDernierMois = evolutionMensuelle[evolutionMensuelle.length - 2];
                      const variation = ((dernierMois.chiffre_affaires || 0) - (avantDernierMois.chiffre_affaires || 0));
                      const pourcentageVariation = avantDernierMois.chiffre_affaires > 0 ? 
                        (variation / avantDernierMois.chiffre_affaires) * 100 : 0;
                      
                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Évolution mois dernier:</span>
                            <span className={`font-semibold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variation >= 0 ? '+' : ''}{utils.formatCFA(variation)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pourcentage:</span>
                            <span className={`font-semibold ${pourcentageVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {pourcentageVariation >= 0 ? '+' : ''}{pourcentageVariation.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'ventes' && (
        <div className="space-y-6">
          {/* Statistiques des ventes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Ventes Aujourd'hui"
              value={ventesJour.length}
              icon={Receipt}
              color="blue"
            />
            <StatCard
              title="CA Aujourd'hui"
              value={utils.formatCFA(ventesJour.reduce((sum, v) => sum + (v.total || 0), 0))}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Articles Vendus"
              value={ventesJour.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.quantite, 0) || 0), 0)}
              icon={PieChart}
              color="orange"
            />
            <StatCard
              title="Ticket Moyen"
              value={ventesJour.length > 0 ? 
                utils.formatCFA(ventesJour.reduce((sum, v) => sum + (v.total || 0), 0) / ventesJour.length) : 
                utils.formatCFA(0)
              }
              icon={Calculator}
              color="purple"
            />
          </div>

          {/* Tableau détaillé des ventes */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Détail des Ventes du Jour</h3>
              <p className="text-sm text-gray-500">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heure</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donné</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rendu</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ventesJour.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        Aucune vente aujourd'hui
                      </td>
                    </tr>
                  ) : (
                    ventesJour.map((vente) => (
                      <tr key={vente.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{vente.numero_ticket}</td>
                        <td className="px-6 py-4">{new Date(vente.created_at).toLocaleTimeString('fr-FR')}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {vente.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{item.nom_produit} ×{item.quantite}</span>
                                <span className="text-gray-500">{utils.formatCFA(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-green-600">
                          {utils.formatCFA(vente.total)}
                        </td>
                        <td className="px-6 py-4">{utils.formatCFA(vente.montant_donne)}</td>
                        <td className="px-6 py-4">{utils.formatCFA(vente.monnaie_rendue)}</td>
                        <td className="px-6 py-4">{vente.vendeur?.nom}</td>
                       <td className="px-6 py-4">  {/* AJOUTER CE BLOC */}
                        <button
                          onClick={() => viewTicket(vente.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Voir ticket
                        </button>
                      </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'personnalise' && (
        <div className="space-y-6">
          {/* Sélection de période */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Période Personnalisée</h3>
              <p className="text-sm text-gray-500">Générez un rapport sur une période de votre choix</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
                  <input
                    type="date"
                    value={periodePersonnalisee.debut}
                    onChange={(e) => setPeriodePersonnalisee({...periodePersonnalisee, debut: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
                  <input
                    type="date"
                    value={periodePersonnalisee.fin}
                    onChange={(e) => setPeriodePersonnalisee({...periodePersonnalisee, fin: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <button
                    onClick={genererRapportPersonnalise}
                    disabled={loading}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {loading ? 'Génération...' : 'Générer Rapport'}
                  </button>
                </div>
              </div>
              
              {/* Boutons de période rapide */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const aujourd = new Date().toISOString().split('T')[0];
                    setPeriodePersonnalisee({debut: aujourd, fin: aujourd});
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={() => {
                    const aujourd = new Date();
                    const semaineDerniere = new Date(aujourd.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setPeriodePersonnalisee({
                      debut: semaineDerniere.toISOString().split('T')[0],
                      fin: aujourd.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                >
                  7 derniers jours
                </button>
                <button
                  onClick={() => {
                    const aujourd = new Date();
                    const moisDernier = new Date(aujourd.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setPeriodePersonnalisee({
                      debut: moisDernier.toISOString().split('T')[0],
                      fin: aujourd.toISOString().split('T')[0]
                    });
                  }}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                >
                  30 derniers jours
                </button>
              </div>
            </div>
          </Card>

          {/* Résultats du rapport personnalisé */}
          {rapportMensuel && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold">Résultats Financiers</h3>
                  <p className="text-sm text-gray-500">
                    Du {utils.formatDate(periodePersonnalisee.debut)} au {utils.formatDate(periodePersonnalisee.fin)}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chiffre d'affaires:</span>
                    <span className="font-semibold text-green-600">
                      {utils.formatCFA(rapportMensuel.finances?.chiffre_affaires || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dépenses:</span>
                    <span className="font-semibold text-red-600">
                      {utils.formatCFA(rapportMensuel.finances?.depenses || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-4">
                    <span className="font-medium">Marge brute:</span>
                    <span className="font-bold text-blue-600">
                      {utils.formatCFA(rapportMensuel.finances?.marge_brute || 0)}
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-2">
                      Taux de marge: {rapportMensuel.finances?.pourcentage_marge || 0}%
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(rapportMensuel.finances?.pourcentage_marge || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold">Activité Commerciale</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nombre de ventes:</span>
                    <span className="font-semibold">{rapportMensuel.ventes?.nombre_transactions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Articles vendus:</span>
                    <span className="font-semibold">{rapportMensuel.ventes?.articles_vendus || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ticket moyen:</span>
                    <span className="font-semibold">
                      {utils.formatCFA(rapportMensuel.ventes?.ticket_moyen || 0)}
                    </span>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <button
                      onClick={() => exporterRapport('csv')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter CSV
                    </button>
                    <button
                      onClick={() => exporterRapport('json')}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter JSON
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Actions rapides et outils */}
      <div className="print:hidden">
        <Card>
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Actions Rapides</h3>
            <p className="text-sm text-gray-500">Outils d'export et d'impression</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => exporterRapport('csv')}
                className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => exporterRapport('json')}
                className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export JSON
              </button>
              <button
                onClick={imprimerRapport}
                className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center justify-center transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Imprimer
              </button>
              <button
                onClick={loadData}
                className="bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 flex items-center justify-center transition-colors"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Actualiser
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Informations importantes pour l'impression */}
      <div className="hidden print:block">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">RAPPORT COMPTABLE</h1>
          <h2 className="text-xl">Pâtisserie Shine</h2>
          <p className="text-gray-600">
            Période: {moisNoms[periodeSelectionnee.mois - 1]} {periodeSelectionnee.annee}
          </p>
          <p className="text-sm text-gray-500">
            Généré le {new Date().toLocaleDateString('fr-FR')} par {currentUser?.nom}
          </p>
        </div>
        
        {rapportMensuel && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">Résumé Financier</h3>
                <table className="w-full">
                  <tr>
                    <td>Chiffre d'affaires:</td>
                    <td className="text-right font-semibold">{utils.formatCFA(rapportMensuel.finances?.chiffre_affaires || 0)}</td>
                  </tr>
                  <tr>
                    <td>Dépenses:</td>
                    <td className="text-right font-semibold">{utils.formatCFA(rapportMensuel.finances?.depenses || 0)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="font-semibold">Marge brute:</td>
                    <td className="text-right font-bold">{utils.formatCFA(rapportMensuel.finances?.marge_brute || 0)}</td>
                  </tr>
                  <tr>
                    <td>Taux de marge:</td>
                    <td className="text-right">{rapportMensuel.finances?.pourcentage_marge || 0}%</td>
                  </tr>
                </table>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">Activité</h3>
                <table className="w-full">
                  <tr>
                    <td>Transactions:</td>
                    <td className="text-right font-semibold">{rapportMensuel.ventes?.nombre_transactions || 0}</td>
                  </tr>
                  <tr>
                    <td>Articles vendus:</td>
                    <td className="text-right font-semibold">{rapportMensuel.ventes?.articles_vendus || 0}</td>
                  </tr>
                  <tr>
                    <td>Ticket moyen:</td>
                    <td className="text-right font-semibold">{utils.formatCFA(rapportMensuel.ventes?.ticket_moyen || 0)}</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    {showTicket && selectedVente && (
        <Modal
          isOpen={showTicket}
          onClose={() => {
            setShowTicket(false);
            setSelectedVente(null);
          }}
          title={`Ticket #${selectedVente.numero_ticket}`}
        >
          <div className="font-mono text-xs space-y-1 bg-gray-50 p-3 rounded">
            <div className="text-center border-b pb-2 mb-2">
              <div className="font-bold text-base">PÂTISSERIE SHINE</div>
              <div>{new Date(selectedVente.created_at).toLocaleString('fr-FR')}</div>
              <div>Ticket #{selectedVente.numero_ticket}</div>
            </div>
            
            {selectedVente.lignes_vente?.map((ligne, index) => (
              <div key={index}>
                <div>{ligne.nom_produit}</div>
                <div className="flex justify-between pl-4">
                  <span>{ligne.quantite} x {utils.formatCFA(ligne.prix_unitaire)}</span>
                  <span>{utils.formatCFA(ligne.total)}</span>
                </div>
              </div>
            ))}
            
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{utils.formatCFA(selectedVente.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Espèces</span>
                <span>{utils.formatCFA(selectedVente.montant_donne)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rendu</span>
                <span>{utils.formatCFA(selectedVente.monnaie_rendue)}</span>
              </div>
            </div>
            
            <div className="text-center border-t pt-2 mt-2">
              <div>Servi par: {selectedVente.vendeur?.nom}</div>
              <div className="mt-1">MERCI DE VOTRE VISITE</div>
            </div>
          </div>
        </Modal>
      )}
      {/* FIN du Modal Ticket */}
      
  


    </div>
  );
}
