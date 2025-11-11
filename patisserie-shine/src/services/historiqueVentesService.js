// src/services/historiqueVentesService.js
import { supabase } from '../lib/supabase-client'
import { utils } from '../utils/formatters'

export const historiqueVentesService = {
  /**
   * Récupère l'historique des ventes avec filtres
   */
  async getHistoriqueVentes(params) {
    const { dateDebut, dateFin, employeId, currentUserId, userRole } = params;

    try {
      // Validation des paramètres
      if (!dateDebut || !dateFin) {
        throw new Error('Les dates de début et de fin sont requises');
      }

      // Construire la plage de dates
      const startDate = new Date(dateDebut);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);

      // Construction de la requête
      let query = supabase
        .from('ventes')
        .select(`
          id,
          numero_ticket,
          total,
          montant_donne,
          monnaie_rendue,
          vendeur_id,
          statut,
          created_at,
          lignes_vente (
            id,
            produit_id,
            nom_produit,
            quantite,
            prix_unitaire,
            total
          ),
          vendeur:profiles!ventes_vendeur_id_fkey (
            id,
            nom,
            username
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('statut', 'validee')
        .order('created_at', { ascending: false });

      // Appliquer les filtres de permission
      if (userRole === 'employe_boutique') {
        // Un employé ne voit que ses propres ventes
        query = query.eq('vendeur_id', currentUserId);
      } else if (userRole === 'admin' && employeId) {
        // Un admin peut filtrer par employé spécifique
        query = query.eq('vendeur_id', employeId);
      }
      // Si admin et pas d'employeId, on voit tout

      const { data: ventes, error } = await query;

      if (error) {
        console.error('Erreur requête ventes:', error);
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      // Formater les données
      const ventesFormatees = (ventes || []).map(vente => {
        const nombreArticles = vente.lignes_vente?.reduce(
          (sum, ligne) => sum + parseFloat(ligne.quantite || 0),
          0
        ) || 0;

        return {
          id: vente.id,
          numero_ticket: vente.numero_ticket,
          created_at: vente.created_at,
          vendeur_nom: vente.vendeur?.nom || vente.vendeur?.username || 'Non défini',
          vendeur_id: vente.vendeur_id,
          total: parseFloat(vente.total || 0),
          montant_donne: parseFloat(vente.montant_donne || 0),
          monnaie_rendue: parseFloat(vente.monnaie_rendue || 0),
          nombre_articles: Math.round(nombreArticles),
          items: vente.lignes_vente?.map(ligne => ({
            nom_produit: ligne.nom_produit,
            quantite: parseFloat(ligne.quantite || 0),
            prix_unitaire: parseFloat(ligne.prix_unitaire || 0),
            total: parseFloat(ligne.total || 0)
          })) || []
        };
      });

      // Calculer les statistiques
      const stats = this.calculateStats(ventesFormatees);

      return {
        success: true,
        data: {
          ventes: ventesFormatees,
          stats
        }
      };
    } catch (error) {
      console.error('Erreur getHistoriqueVentes:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement de l\'historique'
      };
    }
  },

  /**
   * Récupère la liste des employés (caissiers)
   */
  async getEmployes() {
    try {
      const { data: employes, error } = await supabase
        .from('profiles')
        .select('id, nom, username, role')
        .in('role', ['employe_boutique', 'admin'])
        .eq('actif', true)
        .order('nom');

      if (error) {
        console.error('Erreur récupération employés:', error);
        throw new Error(error.message);
      }

      const result = (employes || []).map(emp => ({
        id: emp.id,
        nom: emp.nom || emp.username || 'Utilisateur'
      }));

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Erreur getEmployes:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors du chargement des employés'
      };
    }
  },

  /**
   * Calcule les statistiques à partir des ventes
   */
  calculateStats(ventes) {
    const stats = {
      totalVentes: 0,
      nombreVentes: ventes.length,
      ticketMoyen: 0,
      totalArticles: 0
    };

    ventes.forEach(vente => {
      stats.totalVentes += vente.total;
      stats.totalArticles += vente.nombre_articles;
    });

    stats.ticketMoyen = stats.nombreVentes > 0
      ? Math.round(stats.totalVentes / stats.nombreVentes)
      : 0;

    return stats;
  },

  /**
   * Exporte l'historique au format CSV
   */
  async exportHistorique(params) {
    try {
      const { success, data, error } = await this.getHistoriqueVentes(params);

      if (!success) {
        throw new Error(error);
      }

      const { ventes, stats } = data;

      // Préparer les données CSV
      const rows = [];

      // En-tête
      rows.push([
        'Date Export',
        new Date().toLocaleString('fr-FR')
      ].join(','));

      rows.push([
        'Période',
        `Du ${new Date(params.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(params.dateFin).toLocaleDateString('fr-FR')}`
      ].join(','));

      rows.push(''); // Ligne vide

      // Statistiques
      rows.push('--- STATISTIQUES ---');
      rows.push(['Chiffre d\'affaires', utils.formatCFA(stats.totalVentes)].join(','));
      rows.push(['Nombre de ventes', stats.nombreVentes].join(','));
      rows.push(['Ticket moyen', utils.formatCFA(stats.ticketMoyen)].join(','));
      rows.push(['Total articles vendus', stats.totalArticles].join(','));

      rows.push(''); // Ligne vide

      // En-têtes du tableau
      rows.push([
        'N° Ticket',
        'Date',
        'Heure',
        'Vendeur',
        'Articles',
        'Total',
        'Montant Donné',
        'Monnaie Rendue',
        'Type Paiement'
      ].join(','));

      // Données des ventes
      ventes.forEach(vente => {
        const date = new Date(vente.created_at);
        const typePaiement = vente.monnaie_rendue === 0 ? 'Exact' : 'Espèces';

        rows.push([
          vente.numero_ticket,
          date.toLocaleDateString('fr-FR'),
          date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          `"${vente.vendeur_nom}"`,
          vente.nombre_articles,
          vente.total,
          vente.montant_donne,
          vente.monnaie_rendue,
          typePaiement
        ].join(','));
      });

      rows.push(''); // Ligne vide

      // Détail par produit
      rows.push('--- DÉTAIL PAR PRODUIT ---');
      rows.push(['N° Ticket', 'Produit', 'Quantité', 'Prix Unitaire', 'Total'].join(','));

      ventes.forEach(vente => {
        vente.items.forEach(item => {
          rows.push([
            vente.numero_ticket,
            `"${item.nom_produit}"`,
            item.quantite,
            item.prix_unitaire,
            item.total
          ].join(','));
        });
      });

      // Créer le fichier CSV
      const csv = rows.join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const filename = `historique_ventes_${params.dateDebut}_${params.dateFin}_${new Date().getTime()}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      console.error('Erreur export historique:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'export'
      };
    }
  }
};
