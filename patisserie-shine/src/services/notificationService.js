import { supabase } from '../lib/supabase-client'

export const notificationService = {
  // Envoyer une notification
  async send(destinataireId, type, message, details = null, lien = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          destinataire_id: destinataireId,
          emetteur_id: user?.id,
          type: type,
          message: message,
          details: details,
          lien: lien,
          lu: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, notification: data };
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Notifier tous les admins
  async notifyAdmins(type, message, details = null, lien = null) {
    try {
      // Récupérer tous les admins actifs
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('actif', true);

      if (adminError) throw adminError;

      // Envoyer une notification à chaque admin
      const notifications = await Promise.all(
        admins.map(admin => 
          this.send(admin.id, type, message, details, lien)
        )
      );

      return { success: true, count: notifications.length };
    } catch (error) {
      console.error('Erreur notification admins:', error);
      return { success: false, error: error.message };
    }
  },

  // Notifier pour une nouvelle demande
  async notifyNewDemande(demandeId, demandeurNom, nombreProduits, destination) {
    const message = `Nouvelle demande de ${demandeurNom}`;
    const details = `${nombreProduits} produit(s) pour ${destination}`;
    const lien = `/demandes#${demandeId}`;
    
    return await this.notifyAdmins('demande_nouvelle', message, details, lien);
  },

  // Notifier la validation d'une demande
  async notifyDemandeValidated(demandeurId, valideurNom, demandeId) {
    const message = `Votre demande a été validée par ${valideurNom}`;
    const details = `Les produits ont été ajoutés au stock de destination`;
    const lien = `/demandes#${demandeId}`;
    
    return await this.send(demandeurId, 'demande_validee', message, details, lien);
  },

  // Notifier le refus d'une demande
  async notifyDemandeRejected(demandeurId, valideurNom, demandeId, raison = null) {
    const message = `Votre demande a été refusée par ${valideurNom}`;
    const details = raison || `Veuillez vérifier les stocks disponibles`;
    const lien = `/demandes#${demandeId}`;
    
    return await this.send(demandeurId, 'demande_refusee', message, details, lien);
  },

  // Notifier stock faible
  async notifyLowStock(produitNom, quantiteRestante, type = 'principal') {
    const message = `Stock faible: ${produitNom}`;
    const details = `Il reste seulement ${quantiteRestante} unités en stock ${type}`;
    const lien = type === 'principal' ? '/stock' : `/stock-${type}`;
    
    return await this.notifyAdmins('stock_faible', message, details, lien);
  }
};
