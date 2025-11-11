// src/services/cashierDashboardService.js
import { supabase } from '../lib/supabase-client'
import { utils } from '../utils/formatters'

// Cache pour optimiser les performances
const cache = {
  data: new Map(),
  timestamps: new Map(),
  TTL: 30000, // 30 secondes de cache
  
  get(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp < this.TTL) {
      return this.data.get(key);
    }
    this.data.delete(key);
    this.timestamps.delete(key);
    return null;
  },
  
  set(key, value) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
  }
};

export const cashierDashboardService = {
  /**
   * Récupère les statistiques de vente avec gestion d'erreur robuste
   */
  async getSalesStats(params) {
    const { date, cashierId, viewMode, currentUserId, userRole } = params;
    
    // Clé de cache unique
    const cacheKey = `sales_${date}_${cashierId}_${viewMode}_${userRole}`;
    
    // Vérifier le cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData };
    }
    
    try {
      // Validation des paramètres - plus flexible
      if (!date || !viewMode) {
        console.warn('Paramètres manquants, utilisation des valeurs par défaut');
        // Utiliser des valeurs par défaut si nécessaire
        const today = new Date().toISOString().split('T')[0];
        params.date = date || today;
        params.viewMode = viewMode || 'day';
      }

      // Déterminer la plage de dates
      const dateRange = this.getDateRange(params.date, params.viewMode);
      
      // Construction de la requête optimisée SANS mode_paiement
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
          lignes_vente!inner (
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
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .eq('statut', 'validee')
        .order('created_at', { ascending: false });

      // Appliquer les filtres selon le rôle SI l'utilisateur est connecté
      if (currentUserId && userRole) {
        if (userRole === 'employe_boutique') {
          // Un employé ne voit que ses propres ventes
          query = query.eq('vendeur_id', currentUserId);
        } else if (userRole === 'admin' && cashierId && cashierId !== 'all') {
          // Un admin peut filtrer par caissier
          query = query.eq('vendeur_id', cashierId);
        }
      }

      // Limiter le nombre de résultats pour les performances
      if (params.viewMode === 'month') {
        query = query.limit(1000); // Max 1000 ventes pour un mois
      }

      const { data: ventes, error, count } = await query;

      if (error) {
        console.error('Erreur requête ventes:', error);
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      // Si trop de données, avertir l'utilisateur
      if (count > 1000) {
        console.warn(`Attention: ${count} ventes trouvées, seulement les 1000 premières sont affichées`);
      }

      // Calculer les statistiques
      const stats = this.calculateStats(ventes || []);
      const ventesParHeure = this.groupSalesByHour(ventes || []);
      const topProduits = this.getTopProducts(ventes || [], 10);
      const dernieresVentes = this.getRecentSales(ventes || [], 10);

      // Calcul des tendances (comparaison avec période précédente)
      const trends = await this.calculateTrends(dateRange, cashierId, userRole, currentUserId);

      const result = {
        ...stats,
        ventesParHeure,
        topProduits,
        dernieresVentes,
        dateRange,
        trends,
        totalRecords: count || ventes?.length || 0
      };

      // Mettre en cache
      cache.set(cacheKey, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Erreur getSalesStats:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur lors du chargement des données' 
      };
    }
  },

  /**
   * Récupère les statistiques par caissier (admin uniquement)
   */
  async getSalesByCashier(params) {
    const { date, viewMode } = params;
    
    const cacheKey = `cashiers_${date}_${viewMode}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData };
    }
    
    try {
      const dateRange = this.getDateRange(date, viewMode);
      
      // Requête optimisée SANS mode_paiement
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          vendeur_id,
          total,
          created_at,
          vendeur:profiles!ventes_vendeur_id_fkey (
            id,
            nom,
            username
          )
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .eq('statut', 'validee')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erreur requête ventes par caissier:', error);
        throw new Error(error.message);
      }

      // Grouper et calculer les statistiques par caissier
      const cashierStats = {};
      
      (ventes || []).forEach(vente => {
        const cashierId = vente.vendeur_id;
        if (!cashierId) return;
        
        const cashierName = vente.vendeur?.nom || vente.vendeur?.username || 'Non défini';
        
        if (!cashierStats[cashierId]) {
          cashierStats[cashierId] = {
            id: cashierId,
            nom: cashierName,
            totalVentes: 0,
            nombreVentes: 0,
            ticketMoyen: 0,
            premiereVente: null,
            derniereVente: null,
            ventesParHeure: {}
          };
        }
        
        const stats = cashierStats[cashierId];
        stats.totalVentes += parseFloat(vente.total || 0);
        stats.nombreVentes += 1;
        
        // Première et dernière vente
        const venteTime = new Date(vente.created_at);
        if (!stats.premiereVente || venteTime < new Date(stats.premiereVente)) {
          stats.premiereVente = vente.created_at;
        }
        if (!stats.derniereVente || venteTime > new Date(stats.derniereVente)) {
          stats.derniereVente = vente.created_at;
        }
        
        // Distribution par heure
        const heure = venteTime.getHours();
        stats.ventesParHeure[heure] = (stats.ventesParHeure[heure] || 0) + 1;
      });

      // Finaliser les calculs
      const results = Object.values(cashierStats).map(stats => {
        stats.ticketMoyen = stats.nombreVentes > 0 
          ? Math.round(stats.totalVentes / stats.nombreVentes) 
          : 0;
        
        // Identifier l'heure de pointe
        const heuresArray = Object.entries(stats.ventesParHeure);
        if (heuresArray.length > 0) {
          stats.heurePointe = heuresArray.reduce((a, b) => a[1] > b[1] ? a : b)[0] + 'h';
        }
        
        delete stats.ventesParHeure; // Retirer pour alléger la réponse
        return stats;
      });

      // Trier par chiffre d'affaires décroissant
      results.sort((a, b) => b.totalVentes - a.totalVentes);
      
      // Mettre en cache
      cache.set(cacheKey, results);

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Erreur getSalesByCashier:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur lors du chargement des données' 
      };
    }
  },

  /**
   * Récupère la liste des caissiers actifs
   */
  async getActiveCashiers() {
    const cacheKey = 'active_cashiers';
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData };
    }
    
    try {
      const { data: cashiers, error } = await supabase
        .from('profiles')
        .select('id, nom, username, role')
        .in('role', ['employe_boutique', 'admin'])
        .eq('actif', true)
        .order('nom');

      if (error) {
        console.error('Erreur récupération caissiers:', error);
        throw new Error(error.message);
      }

      const result = (cashiers || []).map(c => ({
        id: c.id,
        nom: c.nom || c.username || 'Utilisateur'
      }));
      
      // Cache plus long pour les données statiques
      cache.set(cacheKey, result);

      return { 
        success: true, 
        data: result
      };
    } catch (error) {
      console.error('Erreur getActiveCashiers:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur lors du chargement des caissiers' 
      };
    }
  },

  /**
   * Export des données au format CSV
   */
  async exportSalesData(params) {
    const { date, cashierId, viewMode, format = 'csv' } = params;
    
    try {
      // Récupérer les données complètes
      const { success, data, error } = await this.getSalesStats({
        ...params,
        currentUserId: cashierId,
        userRole: cashierId ? 'employe_boutique' : 'admin'
      });
      
      if (!success) {
        throw new Error(error);
      }

      if (format === 'csv') {
        return this.exportToCSV(data, date, viewMode);
      } else if (format === 'pdf') {
        // Pour le PDF, on pourrait utiliser une librairie comme jsPDF
        return { 
          success: false, 
          error: 'Export PDF non implémenté. Utilisez CSV pour le moment.' 
        };
      }
      
      throw new Error('Format non supporté');
    } catch (error) {
      console.error('Erreur export:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur lors de l\'export' 
      };
    }
  },

  // === Méthodes utilitaires privées ===

  /**
   * Calcule la plage de dates selon le mode de vue
   */
  getDateRange(date, viewMode) {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    let start, end;

    switch (viewMode) {
      case 'day':
        start = new Date(selectedDate);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        break;
        
      case 'week':
        // Semaine du lundi au dimanche
        const dayOfWeek = selectedDate.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(selectedDate);
        start.setDate(selectedDate.getDate() - diff);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
        
      default:
        start = new Date(selectedDate);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      startDate: start,
      endDate: end
    };
  },

  /**
   * Calcule les statistiques globales SANS mode_paiement
   */
  calculateStats(ventes) {
    const stats = {
      totalVentes: 0,
      nombreVentes: ventes.length,
      ticketMoyen: 0,
      totalCash: 0,      // On considère tout comme cash par défaut
      totalMobile: 0,    // Sera 0 car pas de colonne mode_paiement
      totalCard: 0,      // Sera 0 car pas de colonne mode_paiement
      produitsVendus: 0,
      montantMax: 0,
      montantMin: ventes.length > 0 ? Number.MAX_VALUE : 0
    };

    ventes.forEach(vente => {
      const montant = parseFloat(vente.total || 0);
      stats.totalVentes += montant;
      
      // Min/Max
      stats.montantMax = Math.max(stats.montantMax, montant);
      stats.montantMin = Math.min(stats.montantMin, montant);
      
      // TOUT est considéré comme Cash car pas de colonne mode_paiement
      stats.totalCash += montant;
      
      // Analyser montant donné vs monnaie rendue pour déduire le mode de paiement
      // Si montant_donne = total exact, possibilité de paiement mobile/carte
      // Sinon, c'est probablement du cash
      const montantDonne = parseFloat(vente.montant_donne || 0);
      const monnaieRendue = parseFloat(vente.monnaie_rendue || 0);
      
      // Heuristique simple : si pas de monnaie rendue et montant exact, peut être mobile
      // Mais sans certitude, on garde tout en cash
      
      // Compter les produits
      if (vente.lignes_vente && Array.isArray(vente.lignes_vente)) {
        vente.lignes_vente.forEach(ligne => {
          stats.produitsVendus += parseFloat(ligne.quantite || 0);
        });
      }
    });

    // Calculs finaux
    stats.ticketMoyen = stats.nombreVentes > 0 
      ? Math.round(stats.totalVentes / stats.nombreVentes)
      : 0;
      
    if (stats.nombreVentes === 0) {
      stats.montantMin = 0;
    }

    return stats;
  },

  /**
   * Groupe les ventes par heure
   */
  groupSalesByHour(ventes) {
    const ventesParHeure = {};
    
    // Initialiser les heures de 6h à 21h
    for (let h = 6; h <= 21; h++) {
      const heure = `${h.toString().padStart(2, '0')}h`;
      ventesParHeure[heure] = {
        heure,
        ventes: 0,
        montant: 0
      };
    }

    ventes.forEach(vente => {
      const date = new Date(vente.created_at);
      const hour = date.getHours();
      const heure = `${hour.toString().padStart(2, '0')}h`;
      
      if (ventesParHeure[heure]) {
        ventesParHeure[heure].ventes += 1;
        ventesParHeure[heure].montant += parseFloat(vente.total || 0);
      }
    });

    // Retourner seulement les heures avec activité pour les graphiques
    return Object.values(ventesParHeure).filter(h => 
      h.ventes > 0 || (parseInt(h.heure) >= 8 && parseInt(h.heure) <= 19)
    );
  },

  /**
   * Récupère les produits les plus vendus
   */
  getTopProducts(ventes, limit = 10) {
    const produits = {};
    
    ventes.forEach(vente => {
      if (vente.lignes_vente && Array.isArray(vente.lignes_vente)) {
        vente.lignes_vente.forEach(ligne => {
          const key = ligne.nom_produit || `Produit ${ligne.produit_id}`;
          
          if (!produits[key]) {
            produits[key] = {
              nom: key,
              quantite: 0,
              montant: 0,
              nombreVentes: 0
            };
          }
          
          produits[key].quantite += parseFloat(ligne.quantite || 0);
          produits[key].montant += parseFloat(ligne.total || 0);
          produits[key].nombreVentes += 1;
        });
      }
    });

    // Trier par montant et limiter
    return Object.values(produits)
      .sort((a, b) => b.montant - a.montant)
      .slice(0, limit);
  },

  /**
   * Récupère les dernières ventes formatées SANS mode_paiement
   */
  getRecentSales(ventes, limit = 10) {
    return ventes
      .slice(0, limit)
      .map(vente => {
        const date = new Date(vente.created_at);
        const articlesCount = vente.lignes_vente 
          ? vente.lignes_vente.reduce((sum, ligne) => sum + parseFloat(ligne.quantite || 0), 0)
          : 0;
        
        // Déduire le mode de paiement basé sur montant_donne et monnaie_rendue
        const montantDonne = parseFloat(vente.montant_donne || 0);
        const monnaieRendue = parseFloat(vente.monnaie_rendue || 0);
        const total = parseFloat(vente.total || 0);
        
        // Si monnaie rendue = 0 et montant donné = total, probable paiement exact (mobile/carte)
        // Sinon, c'est du cash
        let paiement = 'Cash';
        if (monnaieRendue === 0 && montantDonne === total && montantDonne > 0) {
          // Possibilité de paiement mobile ou carte, mais on ne peut pas être sûr
          paiement = 'Exact'; // Paiement exact, peut être mobile
        }
          
        return {
          id: vente.numero_ticket || `V${vente.id}`,
          heure: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          montant: total,
          articles: Math.round(articlesCount),
          paiement: paiement,
          vendeur: vente.vendeur?.nom || vente.vendeur?.username || 'Non défini',
          monnaieRendue: monnaieRendue
        };
      });
  },

  /**
   * Calcule les tendances par rapport à la période précédente
   */
  async calculateTrends(dateRange, cashierId, userRole, currentUserId) {
    try {
      // Calculer la période précédente
      const duration = dateRange.endDate - dateRange.startDate;
      const previousStart = new Date(dateRange.startDate - duration);
      const previousEnd = new Date(dateRange.startDate - 1);
      
      // Requête pour la période précédente SANS mode_paiement
      let query = supabase
        .from('ventes')
        .select('total')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())
        .eq('statut', 'validee');

      if (userRole === 'employe_boutique' && currentUserId) {
        query = query.eq('vendeur_id', currentUserId);
      } else if (cashierId && cashierId !== 'all') {
        query = query.eq('vendeur_id', cashierId);
      }

      const { data: previousVentes, error } = await query;

      if (error) {
        console.error('Erreur calcul tendances:', error);
        return null;
      }

      const previousTotal = (previousVentes || []).reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
      const previousCount = previousVentes?.length || 0;

      return {
        totalVentes: previousTotal,
        nombreVentes: previousCount,
        ticketMoyen: previousCount > 0 ? previousTotal / previousCount : 0
      };
    } catch (error) {
      console.error('Erreur calculateTrends:', error);
      return null;
    }
  },

  /**
   * Export au format CSV
   */
  exportToCSV(data, date, viewMode) {
    try {
      // Préparer les données pour l'export
      const rows = [];
      
      // En-têtes
      rows.push([
        'Date Export',
        new Date().toLocaleString('fr-FR')
      ].join(','));
      
      rows.push([
        'Période',
        `${viewMode === 'day' ? 'Jour' : viewMode === 'week' ? 'Semaine' : 'Mois'} du ${date}`
      ].join(','));
      
      rows.push(''); // Ligne vide
      
      // Statistiques générales
      rows.push('--- STATISTIQUES GÉNÉRALES ---');
      rows.push(['Chiffre d\'affaires', utils.formatCFA(data.totalVentes)].join(','));
      rows.push(['Nombre de ventes', data.nombreVentes].join(','));
      rows.push(['Ticket moyen', utils.formatCFA(data.ticketMoyen)].join(','));
      rows.push(['Articles vendus', data.produitsVendus].join(','));
      
      rows.push(''); // Ligne vide
      
      // Top produits
      rows.push('--- TOP 10 PRODUITS ---');
      rows.push(['Rang', 'Produit', 'Quantité', 'Montant'].join(','));
      data.topProduits?.forEach((p, i) => {
        rows.push([
          i + 1,
          `"${p.nom}"`,
          p.quantite,
          utils.formatCFA(p.montant)
        ].join(','));
      });
      
      rows.push(''); // Ligne vide
      
      // Ventes par heure
      rows.push('--- VENTES PAR HEURE ---');
      rows.push(['Heure', 'Nombre de ventes', 'Montant'].join(','));
      data.ventesParHeure?.forEach(h => {
        rows.push([
          h.heure,
          h.ventes,
          utils.formatCFA(h.montant)
        ].join(','));
      });

      // Créer le CSV
      const csv = rows.join('\n');
      
      // Créer et télécharger le fichier
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const filename = `ventes_${viewMode}_${date}_${new Date().getTime()}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      return { success: true, filename };
    } catch (error) {
      console.error('Erreur export CSV:', error);
      return { 
        success: false, 
        error: error.message || 'Erreur lors de l\'export CSV' 
      };
    }
  },

  /**
   * Nettoie le cache (à appeler lors de la déconnexion)
   */
  clearCache() {
    cache.clear();
  }
};
