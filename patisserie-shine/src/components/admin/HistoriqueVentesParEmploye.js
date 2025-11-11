// src/components/admin/HistoriqueVentesParEmploye.js
"use client";

import { useState, useEffect } from 'react';
import { historiqueVentesService } from '../../services';
import { utils } from '../../utils/formatters';
import { 
  User, 
  Calendar, 
  Receipt, 
  ShoppingCart, 
  TrendingUp,
  Eye,
  Search,
  Download,
  Clock,
  DollarSign
} from 'lucide-react';
import { Card, Modal } from '../ui';

export default function HistoriqueEmployeVentes({ currentUser }) {
  // États
  const [employes, setEmployes] = useState([]);
  const [employeSelectionne, setEmployeSelectionne] = useState('');
  const [dateSelectionnee, setDateSelectionnee] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [ventes, setVentes] = useState([]);
  const [statistiques, setStatistiques] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [venteSelectionnee, setVenteSelectionnee] = useState(null);
  const [showFactureModal, setShowFactureModal] = useState(false);

  // Charger la liste des employés au montage
  useEffect(() => {
    loadEmployes();
  }, []);

  // Charger les employés vendeurs
  const loadEmployes = async () => {
    try {
      const { employes: emp, error } = await historiqueVentesService.getEmployesVendeurs();
      if (error) {
        setError(error);
      } else {
        setEmployes(emp);
      }
    } catch (err) {
      console.error('Erreur chargement employés:', err);
      setError('Erreur lors du chargement des employés');
    }
  };

  // Charger l'historique quand employé ou date change
  useEffect(() => {
    if (employeSelectionne && dateSelectionnee) {
      loadHistorique();
    }
  }, [employeSelectionne, dateSelectionnee]);

  // Charger l'historique des ventes
  const loadHistorique = async () => {
    if (!employeSelectionne || !dateSelectionnee) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { ventes: v, statistiques: s, error } = 
        await historiqueVentesService.getHistoriqueEmployeParDate(
          employeSelectionne, 
          dateSelectionnee
        );

      if (error) {
        setError(error);
        setVentes([]);
        setStatistiques(null);
      } else {
        setVentes(v);
        setStatistiques(s);
      }
    } catch (err) {
      console.error('Erreur chargement historique:', err);
      setError('Erreur lors du chargement de l\'historique');
      setVentes([]);
      setStatistiques(null);
    } finally {
      setLoading(false);
    }
  };

  // Afficher la facture d'une vente
  const afficherFacture = async (venteId) => {
    try {
      setLoading(true);
      const { vente, error } = await historiqueVentesService.getDetailsVente(venteId);
      
      if (error) {
        alert('Erreur lors du chargement de la facture : ' + error);
        return;
      }

      setVenteSelectionnee(vente);
      setShowFactureModal(true);
    } catch (err) {
      console.error('Erreur affichage facture:', err);
      alert('Erreur lors de l\'affichage de la facture');
    } finally {
      setLoading(false);
    }
  };

  // Imprimer la facture
  const imprimerFacture = () => {
    if (!venteSelectionnee) return;

    const contenuFacture = `
      <html>
        <head>
          <title>Facture ${venteSelectionnee.numero_ticket}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 14px; 
              margin: 0; 
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #000; 
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .header h1 { margin: 0; font-size: 20px; }
            .header p { margin: 5px 0; font-size: 12px; }
            .section { margin: 15px 0; }
            .ligne { 
              display: flex; 
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px dashed #ccc;
            }
            .ligne.total {
              font-weight: bold;
              font-size: 16px;
              border-top: 2px solid #000;
              border-bottom: 2px solid #000;
              margin-top: 10px;
            }
            .produit-nom { flex: 2; }
            .produit-qte { flex: 1; text-align: center; }
            .produit-prix { flex: 1; text-align: right; }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #000;
              font-size: 12px;
            }
            @media print { 
              body { padding: 10px; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="header">
            <h1>🧁 PÂTISSERIE SHINE</h1>
            <p>Facture N° ${venteSelectionnee.numero_ticket}</p>
            <p>${new Date(venteSelectionnee.created_at).toLocaleString('fr-FR')}</p>
            <p>Vendeur: ${venteSelectionnee.vendeur?.nom || 'N/A'}</p>
          </div>

          <div class="section">
            <div class="ligne" style="font-weight: bold; border-bottom: 2px solid #000;">
              <span class="produit-nom">Article</span>
              <span class="produit-qte">Qté</span>
              <span class="produit-prix">Prix</span>
            </div>
            ${(venteSelectionnee.items || []).map(item => `
              <div class="ligne">
                <span class="produit-nom">${item.nom_produit}</span>
                <span class="produit-qte">${item.quantite}</span>
                <span class="produit-prix">${utils.formatCFA(item.total)}</span>
              </div>
            `).join('')}
          </div>

          <div class="section">
            <div class="ligne total">
              <span>TOTAL</span>
              <span>${utils.formatCFA(venteSelectionnee.total)}</span>
            </div>
            <div class="ligne">
              <span>Montant donné</span>
              <span>${utils.formatCFA(venteSelectionnee.montant_donne)}</span>
            </div>
            <div class="ligne">
              <span>Monnaie rendue</span>
              <span>${utils.formatCFA(venteSelectionnee.monnaie_rendue)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Merci de votre visite !</p>
            <p>À bientôt 😊</p>
          </div>
        </body>
      </html>
    `;

    const fenetreImpression = window.open('', '_blank');
    fenetreImpression.document.write(contenuFacture);
    fenetreImpression.document.close();
  };

  // Employé sélectionné (objet complet)
  const employeActuel = employes.find(e => e.id === employeSelectionne);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Receipt className="w-8 h-8 text-orange-600 mr-3" />
            Historique des Ventes par Employé
          </h2>
          <p className="text-gray-600">Consultation des ventes et factures</p>
        </div>
      </div>

      {/* Filtres */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sélection employé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2 text-gray-500" />
              Employé
            </label>
            <select
              value={employeSelectionne}
              onChange={(e) => setEmployeSelectionne(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            >
              <option value="">-- Sélectionner un employé --</option>
              {employes.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nom} ({emp.role === 'admin' ? 'Admin' : 'Employé Boutique'})
                </option>
              ))}
            </select>
          </div>

          {/* Sélection date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
              Date
            </label>
            <input
              type="date"
              value={dateSelectionnee}
              onChange={(e) => setDateSelectionnee(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </Card>

      {/* Statistiques du jour */}
      {statistiques && employeSelectionne && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total du jour</p>
                <p className="text-2xl font-bold text-green-800">
                  {utils.formatCFA(statistiques.total_jour)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Nombre de ventes</p>
                <p className="text-2xl font-bold text-blue-800">
                  {statistiques.nombre_ventes}
                </p>
              </div>
              <Receipt className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Ticket moyen</p>
                <p className="text-2xl font-bold text-purple-800">
                  {utils.formatCFA(statistiques.ticket_moyen)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Articles vendus</p>
                <p className="text-2xl font-bold text-orange-800">
                  {statistiques.total_articles}
                </p>
              </div>
              <ShoppingCart className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </Card>
        </div>
      )}

      {/* Liste des ventes */}
      {loading ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-600">Chargement de l'historique...</p>
          </div>
        </Card>
      ) : !employeSelectionne ? (
        <Card className="p-12 text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Sélectionnez un employé
          </h3>
          <p className="text-gray-500">
            Choisissez un employé et une date pour voir son historique de ventes
          </p>
        </Card>
      ) : ventes.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune vente trouvée
          </h3>
          <p className="text-gray-500">
            {employeActuel?.nom} n'a effectué aucune vente le{' '}
            {new Date(dateSelectionnee).toLocaleDateString('fr-FR')}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-orange-600" />
              Historique des ventes - {employeActuel?.nom}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({new Date(dateSelectionnee).toLocaleDateString('fr-FR')})
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Heure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Receipt className="w-4 h-4 inline mr-1" />
                    N° Ticket
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <ShoppingCart className="w-4 h-4 inline mr-1" />
                    Articles
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Montant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ventes.map((vente) => (
                  <tr key={vente.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(vente.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 font-mono">
                        {vente.numero_ticket}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {vente.nombre_articles} article{vente.nombre_articles > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-bold text-green-600">
                        {utils.formatCFA(vente.total)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => afficherFacture(vente.id)}
                        className="inline-flex items-center px-3 py-2 border border-orange-300 rounded-lg text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Voir Facture
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Facture */}
      <Modal
        isOpen={showFactureModal}
        onClose={() => {
          setShowFactureModal(false);
          setVenteSelectionnee(null);
        }}
        title="Détail de la Facture"
        size="lg"
      >
        {venteSelectionnee && (
          <div className="space-y-6">
            {/* En-tête facture */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  🧁 Pâtisserie Shine
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Facture N° {venteSelectionnee.numero_ticket}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Date et heure</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(venteSelectionnee.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Vendeur</p>
                  <p className="font-semibold text-gray-900">
                    {venteSelectionnee.vendeur?.nom || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Liste des articles */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Articles
              </h4>
              <div className="space-y-2">
                {(venteSelectionnee.items || []).map((item, index) => (
                  <div 
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.nom_produit}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.quantite} × {utils.formatCFA(item.prix_unitaire)}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900">
                      {utils.formatCFA(item.total)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totaux */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex justify-between items-center text-xl font-bold">
                <span className="text-gray-900">TOTAL</span>
                <span className="text-green-600">
                  {utils.formatCFA(venteSelectionnee.total)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Montant donné</span>
                <span className="text-gray-900">
                  {utils.formatCFA(venteSelectionnee.montant_donne)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Monnaie rendue</span>
                <span className="text-gray-900">
                  {utils.formatCFA(venteSelectionnee.monnaie_rendue)}
                </span>
              </div>
            </div>

            {/* Bouton impression */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowFactureModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={imprimerFacture}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Imprimer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
