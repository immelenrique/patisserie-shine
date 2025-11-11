// src/components/caisse/HistoriqueEmployeVentes.js
"use client";

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Eye,
  Filter,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, Modal } from '../ui';
import { historiqueVentesService } from '../../services';
import { utils } from '../../utils/formatters';

export default function HistoriqueEmployeVentes({ currentUser }) {
  // États
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtres
  const [dateDebut, setDateDebut] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 jours en arrière par défaut
    return date.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmploye, setSelectedEmploye] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Liste des employés
  const [employes, setEmployes] = useState([]);

  // Modal détails vente
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedVente, setSelectedVente] = useState(null);

  // Statistiques
  const [stats, setStats] = useState({
    totalVentes: 0,
    nombreVentes: 0,
    ticketMoyen: 0
  });

  // Charger les employés au montage
  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.username === 'proprietaire') {
      loadEmployes();
    }
  }, [currentUser]);

  // Charger les ventes quand les filtres changent
  useEffect(() => {
    loadVentes();
  }, [dateDebut, dateFin, selectedEmploye]);

  // Charger la liste des employés
  const loadEmployes = async () => {
    try {
      const { success, data } = await historiqueVentesService.getEmployes();
      if (success) {
        setEmployes(data || []);
      }
    } catch (err) {
      console.error('Erreur chargement employés:', err);
    }
  };

  // Charger les ventes
  const loadVentes = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        dateDebut,
        dateFin,
        employeId: selectedEmploye === 'all' ? null :
                   selectedEmploye === 'me' ? currentUser?.id :
                   selectedEmploye,
        currentUserId: currentUser?.id,
        userRole: currentUser?.role
      };

      const { success, data, error } = await historiqueVentesService.getHistoriqueVentes(params);

      if (!success) {
        throw new Error(error);
      }

      setVentes(data.ventes || []);
      setStats(data.stats || { totalVentes: 0, nombreVentes: 0, ticketMoyen: 0 });
      setCurrentPage(1); // Reset à la première page
    } catch (err) {
      console.error('Erreur chargement ventes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les ventes par recherche
  const ventesFiltrees = ventes.filter(vente => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      vente.numero_ticket?.toLowerCase().includes(search) ||
      vente.vendeur_nom?.toLowerCase().includes(search) ||
      vente.items?.some(item => item.nom_produit?.toLowerCase().includes(search))
    );
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const ventesActuelles = ventesFiltrees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ventesFiltrees.length / itemsPerPage);

  // Afficher les détails d'une vente
  const handleShowDetails = (vente) => {
    setSelectedVente(vente);
    setShowDetailsModal(true);
  };

  // Export des données
  const handleExport = async () => {
    try {
      const params = {
        dateDebut,
        dateFin,
        employeId: selectedEmploye === 'all' ? null :
                   selectedEmploye === 'me' ? currentUser?.id :
                   selectedEmploye
      };

      const { success, error } = await historiqueVentesService.exportHistorique(params);

      if (!success) {
        alert(`Erreur export: ${error}`);
      } else {
        alert('Export réalisé avec succès !');
      }
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Permission de voir les ventes de tous les employés
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'proprietaire';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Historique des Ventes
          </h2>

          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Date début */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date début
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date fin
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Sélection employé (admin uniquement) */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employé
                </label>
                <select
                  value={selectedEmploye}
                  onChange={(e) => setSelectedEmploye(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Tous les employés</option>
                  <option value="me">Mes ventes uniquement</option>
                  {employes.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recherche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ticket, produit, vendeur..."
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-between items-center">
            <button
              onClick={loadVentes}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement...
                </>
              ) : (
                <>
                  <Filter className="w-4 h-4" />
                  Appliquer les filtres
                </>
              )}
            </button>

            <button
              onClick={handleExport}
              disabled={loading || ventes.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          </div>
        </div>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-1">Chiffre d'Affaires</p>
            <p className="text-2xl font-bold text-green-600">
              {utils.formatCFA(stats.totalVentes)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-1">Nombre de Ventes</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.nombreVentes}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-1">Ticket Moyen</p>
            <p className="text-2xl font-bold text-purple-600">
              {utils.formatCFA(stats.ticketMoyen)}
            </p>
          </div>
        </Card>
      </div>

      {/* Tableau des ventes */}
      <Card>
        <div className="overflow-x-auto">
          {error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadVentes}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Réessayer
              </button>
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Chargement des ventes...</p>
            </div>
          ) : ventesActuelles.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune vente trouvée pour cette période</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Heure</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendeur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Articles</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paiement</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ventesActuelles.map((vente) => (
                    <tr key={vente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {vente.numero_ticket}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(vente.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                        <br />
                        <span className="text-gray-400">
                          {new Date(vente.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{vente.vendeur_nom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {vente.nombre_articles} article{vente.nombre_articles > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 font-semibold text-green-600">
                        {utils.formatCFA(vente.total)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          vente.monnaie_rendue === 0
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {vente.monnaie_rendue === 0 ? 'Exact' : 'Espèces'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleShowDetails(vente)}
                          className="text-blue-600 hover:text-blue-800 transition"
                          title="Voir les détails"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, ventesFiltrees.length)} sur {ventesFiltrees.length} ventes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Modal détails vente */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={`Détails de la vente ${selectedVente?.numero_ticket}`}
      >
        {selectedVente && (
          <div className="space-y-4">
            {/* Informations générales */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Date et heure</p>
                <p className="font-medium">
                  {new Date(selectedVente.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendeur</p>
                <p className="font-medium">{selectedVente.vendeur_nom}</p>
              </div>
            </div>

            {/* Articles */}
            <div>
              <h4 className="font-semibold mb-3">Articles vendus</h4>
              <div className="space-y-2">
                {selectedVente.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{item.nom_produit}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantite} × {utils.formatCFA(item.prix_unitaire)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {utils.formatCFA(item.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totaux */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-green-600">
                  {utils.formatCFA(selectedVente.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Montant donné</span>
                <span>{utils.formatCFA(selectedVente.montant_donne)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Monnaie rendue</span>
                <span>{utils.formatCFA(selectedVente.monnaie_rendue)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
