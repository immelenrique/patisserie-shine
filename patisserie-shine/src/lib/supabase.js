// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine (VERSION COMPLÈTE CORRIGÉE)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ===================== SERVICES D'AUTHENTIFICATION =====================
// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  // Connexion par email
  async signInWithUsername(username, password) {
    try {
      // Conversion username vers email pour Supabase Auth
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('Erreur d\'authentification:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur profil:', profileError)
        return { user: data.user, profile: null, error: profileError.message }
      }
      
      return { user: data.user, profile, error: null }
    } catch (error) {
      console.error('Erreur dans signInWithUsername:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        return { user: null, profile: null, error: error?.message || 'Pas d\'utilisateur connecté' }
      }
      
      // Récupérer le profil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur récupération profil:', profileError)
        return { user, profile: null, error: profileError.message }
      }
      
      return { user, profile, error: null }
    } catch (error) {
      console.error('Erreur getCurrentUser:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Déconnexion
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Erreur déconnexion:', error)
      return { error: error.message }
    }
  },

  // Changer le mot de passe initial
  async changeInitialPassword(newPassword, userId) {
    try {
      let userIdToUse = userId;
      
      if (!userIdToUse) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userIdToUse = user.id;
        }
      }
      
      if (!userIdToUse) {
        return { success: false, error: 'Utilisateur non identifié' }
      }

      const response = await fetch('/api/auth/change-initial-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userIdToUse,
          newPassword: newPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Erreur lors du changement de mot de passe' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('Erreur dans changeInitialPassword:', error)
      return { success: false, error: error.message }
    }
  },

  // Marquer le changement de mot de passe comme effectué
  async markPasswordChangeComplete() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          force_password_change: false,
          last_password_change: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Erreur mise à jour profil:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Erreur dans markPasswordChangeComplete:', error)
      return { success: false, error: error.message }
    }
  },

  // Vérifier si le changement de mot de passe est requis
  async checkPasswordChangeRequired() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { required: false, error: 'Utilisateur non connecté' }
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('force_password_change, last_password_change')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Erreur vérification changement mot de passe:', error)
        return { required: false, error: error.message }
      }

      const isRequired = profile.force_password_change === true || 
                        profile.last_password_change === null

      return { required: isRequired, error: null }
    } catch (error) {
      console.error('Erreur dans checkPasswordChangeRequired:', error)
      return { required: false, error: error.message }
    }
  },

  // Connexion avec vérification du changement de mot de passe
  async signInWithPasswordCheck(username, password) {
    try {
      const loginResult = await this.signInWithUsername(username, password)
      
      if (loginResult.error || !loginResult.profile) {
        return loginResult
      }

      const passwordCheckResult = await this.checkPasswordChangeRequired()
      
      return {
        ...loginResult,
        passwordChangeRequired: passwordCheckResult.required || false
      }
    } catch (error) {
      console.error('Erreur dans signInWithPasswordCheck:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Test de la session actuelle
  async testSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        return { valid: false, error: error.message }
      }
      
      if (!session) {
        return { valid: false, error: 'Aucune session active' }
      }
      
      return { 
        valid: true, 
        session: {
          user_id: session.user?.id,
          expires_at: session.expires_at,
          token_preview: session.access_token?.substring(0, 20) + '...'
        },
        error: null 
      }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  },

  // Rafraîchir la session
  async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true, session: data.session, error: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
// ===================== SERVICES RÉFÉRENTIEL =====================
export const referentielService = {
  // Récupérer tous les éléments du référentiel
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('actif', true)
        .order('nom')
      
      if (error) {
        console.error('Erreur getAll référentiel:', error)
        return { referentiels: [], error: error.message }
      }
      
      return { referentiels: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll référentiel:', error)
      return { referentiels: [], error: error.message }
    }
  },

  // Rechercher dans le référentiel
  async search(terme) {
    try {
      const { data, error } = await supabase.rpc('rechercher_referentiel', {
        terme_recherche: terme
      })
      
      if (error) {
        console.error('Erreur search référentiel:', error)
        return { referentiels: [], error: error.message }
      }
      
      return { referentiels: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans search référentiel:', error)
      return { referentiels: [], error: error.message }
    }
  },

  // Créer un nouvel élément
  async create(referentielData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { referentiel: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si la référence existe déjà
      const { data: existingRef } = await supabase
        .from('referentiel_produits')
        .select('id')
        .eq('reference', referentielData.reference.toUpperCase())
        .maybeSingle()

      if (existingRef) {
        return { referentiel: null, error: `La référence "${referentielData.reference}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('referentiel_produits')
        .insert({
          reference: referentielData.reference.toUpperCase(),
          nom: referentielData.nom,
          type_conditionnement: referentielData.type_conditionnement,
          unite_mesure: referentielData.unite_mesure,
          quantite_par_conditionnement: parseFloat(referentielData.quantite_par_conditionnement),
          prix_achat_total: parseFloat(referentielData.prix_achat_total),
          actif: true
        })
        .select()
        .single()

      if (error) {
        console.error('Erreur create référentiel:', error)
        return { referentiel: null, error: error.message }
      }

      return { referentiel: data, error: null }
    } catch (error) {
      console.error('Erreur dans create référentiel:', error)
      return { referentiel: null, error: error.message }
    }
  },

  // Mettre à jour un élément
  async update(referentielId, referentielData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { referentiel: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si la nouvelle référence existe déjà (sauf pour l'élément courant)
      const { data: existingRef } = await supabase
        .from('referentiel_produits')
        .select('id')
        .eq('reference', referentielData.reference.toUpperCase())
        .neq('id', referentielId)
        .maybeSingle()

      if (existingRef) {
        return { referentiel: null, error: `La référence "${referentielData.reference}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('referentiel_produits')
        .update({
          reference: referentielData.reference.toUpperCase(),
          nom: referentielData.nom,
          type_conditionnement: referentielData.type_conditionnement,
          unite_mesure: referentielData.unite_mesure,
          quantite_par_conditionnement: parseFloat(referentielData.quantite_par_conditionnement),
          prix_achat_total: parseFloat(referentielData.prix_achat_total),
          updated_at: new Date().toISOString()
        })
        .eq('id', referentielId)
        .select()
        .single()

      if (error) {
        console.error('Erreur update référentiel:', error)
        return { referentiel: null, error: error.message }
      }

      return { referentiel: data, error: null }
    } catch (error) {
      console.error('Erreur dans update référentiel:', error)
      return { referentiel: null, error: error.message }
    }
  },

  // Supprimer un élément (désactivation logique)
  async delete(referentielId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      // Vérifier si des produits utilisent cette référence
      const { data: produitsUtilisant } = await supabase
        .from('produits')
        .select('id, nom')
        .eq('reference_referentiel_id', referentielId)
        .limit(5)

      if (produitsUtilisant && produitsUtilisant.length > 0) {
        const nomsLimites = produitsUtilisant.map(p => p.nom).join(', ')
        return { 
          success: false, 
          error: `Cette référence est utilisée par ${produitsUtilisant.length} produit(s) : ${nomsLimites}${produitsUtilisant.length === 5 ? '...' : ''}` 
        }
      }

      // Désactivation logique
      const { error } = await supabase
        .from('referentiel_produits')
        .update({
          actif: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', referentielId)

      if (error) {
        console.error('Erreur delete référentiel:', error)
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Élément supprimé avec succès' }
    } catch (error) {
      console.error('Erreur dans delete référentiel:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir un élément par référence (pour auto-complétion)
  async getByReference(reference) {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('*')
        .eq('reference', reference.toUpperCase())
        .eq('actif', true)
        .maybeSingle()

      if (error) {
        console.error('Erreur getByReference:', error)
        return { referentiel: null, error: error.message }
      }

      return { referentiel: data, error: null }
    } catch (error) {
      console.error('Erreur dans getByReference:', error)
      return { referentiel: null, error: error.message }
    }
  },

  // Importer depuis CSV
  async importFromCSV(csvFile) {
    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        return { success: false, error: 'Fichier CSV vide ou invalide' }
      }

      // Parser le CSV (format attendu : reference,nom,type_conditionnement,unite_mesure,quantite,prix_total)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const expectedHeaders = ['reference', 'nom', 'type_conditionnement', 'unite_mesure', 'quantite_par_conditionnement', 'prix_achat_total']
      
      // Vérifier les headers
      const hasRequiredHeaders = expectedHeaders.every(h => 
        headers.some(header => header.includes(h.replace('_', '')) || header === h)
      )

      if (!hasRequiredHeaders) {
        return { 
          success: false, 
          error: `Headers requis: ${expectedHeaders.join(', ')}. Headers trouvés: ${headers.join(', ')}` 
        }
      }

      let imported = 0
      let errors = 0
      const errorDetails = []

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim())
          
          if (values.length < 6) continue

          const referentielData = {
            reference: values[0],
            nom: values[1],
            type_conditionnement: values[2] || 'sac',
            unite_mesure: values[3] || 'kg',
            quantite_par_conditionnement: parseFloat(values[4]) || 1,
            prix_achat_total: parseFloat(values[5]) || 0
          }

          const result = await this.create(referentielData)
          
          if (result.error) {
            errors++
            errorDetails.push(`Ligne ${i + 1}: ${result.error}`)
          } else {
            imported++
          }
        } catch (lineError) {
          errors++
          errorDetails.push(`Ligne ${i + 1}: Erreur de format`)
        }
      }

      return { 
        success: true, 
        imported, 
        errors, 
        errorDetails: errorDetails.slice(0, 10) // Limiter à 10 erreurs affichées
      }
    } catch (error) {
      console.error('Erreur dans importFromCSV:', error)
      return { success: false, error: error.message }
    }
  },

  // Exporter vers CSV
  async exportToCSV() {
    try {
      const { referentiels, error } = await this.getAll()
      
      if (error) {
        return { success: false, error }
      }

      const headers = [
        'reference',
        'nom', 
        'type_conditionnement',
        'unite_mesure',
        'quantite_par_conditionnement',
        'prix_achat_total',
        'prix_unitaire'
      ]

      const csvLines = [headers.join(',')]
      
      referentiels.forEach(item => {
        const line = [
          item.reference,
          `"${item.nom}"`, // Guillemets pour les noms avec virgules
          item.type_conditionnement,
          item.unite_mesure,
          item.quantite_par_conditionnement,
          item.prix_achat_total,
          item.prix_unitaire
        ]
        csvLines.push(line.join(','))
      })

      const csvContent = csvLines.join('\n')
      
      return { success: true, csvContent }
    } catch (error) {
      console.error('Erreur dans exportToCSV:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir les statistiques du référentiel
  async getStatistics() {
    try {
      const { data, error } = await supabase
        .from('referentiel_produits')
        .select('prix_achat_total, quantite_par_conditionnement, type_conditionnement')
        .eq('actif', true)

      if (error) {
        return { stats: null, error: error.message }
      }

      const stats = {
        total_elements: data.length,
        valeur_totale: data.reduce((sum, item) => sum + (item.prix_achat_total || 0), 0),
        prix_moyen: data.length > 0 ? data.reduce((sum, item) => sum + (item.prix_achat_total || 0), 0) / data.length : 0,
        conditionnements: {}
      }

      // Compter par type de conditionnement
      data.forEach(item => {
        const type = item.type_conditionnement || 'non_defini'
        stats.conditionnements[type] = (stats.conditionnements[type] || 0) + 1
      })

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getStatistics:', error)
      return { stats: null, error: error.message }
    }
  }
}

// ===================== SERVICES UNITÉS =====================
export const uniteService = {
  // Récupérer toutes les unités
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('unites')
        .select('*')
        .order('label')
      
      if (error) {
        console.error('Erreur getAll unites:', error)
        return { unites: [], error: error.message }
      }
      
      return { unites: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll unites:', error)
      return { unites: [], error: error.message }
    }
  },

  // Créer une unité
  async create(uniteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { unite: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si l'unité existe déjà
      const { data: existingUnite } = await supabase
        .from('unites')
        .select('id')
        .eq('value', uniteData.value)
        .maybeSingle()

      if (existingUnite) {
        return { unite: null, error: `L'unité "${uniteData.value}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('unites')
        .insert({
          value: uniteData.value,
          label: uniteData.label
        })
        .select()
        .single()
      
      if (error) {
        console.error('Erreur create unite:', error)
        return { unite: null, error: error.message }
      }
      
      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans create unite:', error)
      return { unite: null, error: error.message }
    }
  },

  // Supprimer une unité
  async delete(uniteId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      // Vérifier qu'aucun produit n'utilise cette unité
      const { data: produitsUtilisant, error: checkError } = await supabase
        .from('produits')
        .select('id')
        .eq('unite_id', uniteId)
        .limit(1)

      if (checkError) {
        return { success: false, error: checkError.message }
      }

      if (produitsUtilisant && produitsUtilisant.length > 0) {
        return { success: false, error: 'Cette unité est utilisée par des produits existants' }
      }

      const { error } = await supabase
        .from('unites')
        .delete()
        .eq('id', uniteId)

      if (error) {
        console.error('Erreur delete unite:', error)
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Unité supprimée avec succès' }
    } catch (error) {
      console.error('Erreur dans delete unite:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour une unité
  async update(uniteId, uniteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { unite: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si le nouveau code existe déjà (sauf pour l'unité courante)
      const { data: existingUnite } = await supabase
        .from('unites')
        .select('id')
        .eq('value', uniteData.value)
        .neq('id', uniteId)
        .maybeSingle()

      if (existingUnite) {
        return { unite: null, error: `L'unité "${uniteData.value}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('unites')
        .update({
          value: uniteData.value,
          label: uniteData.label,
        
        })
        .eq('id', uniteId)
        .select()
        .single()

      if (error) {
        console.error('Erreur update unite:', error)
        return { unite: null, error: error.message }
      }

      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans update unite:', error)
      return { unite: null, error: error.message }
    }
  },

  // Créer les unités de base si elles n'existent pas
  async createBasicUnitsIfEmpty() {
    try {
      // Vérifier s'il y a déjà des unités
      const { data: existingUnits } = await supabase
        .from('unites')
        .select('id')
        .limit(1)

      if (existingUnits && existingUnits.length > 0) {
        return { success: true, message: 'Les unités existent déjà' }
      }

      // Créer les unités de base
      const basicUnits = [
        { value: 'kg', label: 'Kilogrammes' },
        { value: 'g', label: 'Grammes' },
        { value: 'L', label: 'Litres' },
        { value: 'ml', label: 'Millilitres' },
        { value: 'pcs', label: 'Pièces' },
        { value: 'unite', label: 'Unité' },
        { value: 'ccafe', label: 'Cuillères à café' },
        { value: 'csoup', label: 'Cuillères à soupe' },
        { value: 'tasse', label: 'Tasses' },
        { value: 'boites', label: 'Boîtes' },
        { value: 'sacs', label: 'Sacs' },
        { value: 'sachets', label: 'Sachets' }
      ]

      const { data, error } = await supabase
        .from('unites')
        .insert(basicUnits)
        .select()

      if (error) {
        console.error('Erreur création unités de base:', error)
        return { success: false, error: error.message }
      }

      return { 
        success: true, 
        message: `${data.length} unités de base créées avec succès`,
        unites: data 
      }
    } catch (error) {
      console.error('Erreur dans createBasicUnitsIfEmpty:', error)
      return { success: false, error: error.message }
    }
  }
}
export const prixService = {
  // Synchroniser tous les prix
  async synchroniserTousLesPrix() {
    try {
      console.log('🔄 Synchronisation des prix...');
      
      // 1. Récupérer tous les produits en stock boutique
      const { data: stockBoutique } = await supabase
        .from('stock_boutique')
        .select('id, nom_produit, prix_vente');
      
      let corrections = 0;
      
      for (const item of stockBoutique || []) {
        // Récupérer le prix correct
        const { data: prixCorrect } = await supabase.rpc('get_prix_vente_produit', {
          nom_produit_param: item.nom_produit
        });
        
        if (prixCorrect && prixCorrect !== item.prix_vente) {
          // Corriger le prix
          await supabase
            .from('stock_boutique')
            .update({ 
              prix_vente: prixCorrect,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          console.log(`✅ Prix corrigé pour ${item.nom_produit}: ${item.prix_vente} → ${prixCorrect}`);
          corrections++;
        }
      }
      
      console.log(`🎉 ${corrections} prix synchronisés`);
      return { success: true, corrections };
    } catch (error) {
      console.error('❌ Erreur synchronisation:', error);
      return { success: false, error: error.message };
    }
  }
};
// ===================== SERVICES PRODUITS =====================
export const productService = {
  // Récupérer tous les produits
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
      return { products: [], error: error.message }
    }
  },
  async mettreAJourStockBoutique(productionData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Vérifier si le produit a un prix de vente défini
    const { data: prixVente } = await supabase
      .from('prix_vente')
      .select('prix_vente')
      .eq('produit_id', productionData.produit_id)
      .single()

    if (!prixVente || !prixVente.prix_vente) {
      console.warn(`Produit ${productionData.produit} sans prix de vente défini, non ajouté à la boutique`)
      return { success: false, error: 'Prix de vente non défini pour ce produit' }
    }

    // Ajouter/mettre à jour le stock boutique
    const { data: stockExistant } = await supabase
      .from('stock_boutique')
      .select('id, quantite_disponible')
      .eq('produit_id', productionData.produit_id)
      .single()

    if (stockExistant) {
      // Mettre à jour stock existant
      const { error: updateError } = await supabase
        .from('stock_boutique')
        .update({
          quantite_disponible: (stockExistant.quantite_disponible || 0) + productionData.quantite,
          prix_vente: prixVente.prix_vente,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockExistant.id)

      if (updateError) {
        console.error('Erreur mise à jour stock boutique:', updateError)
        return { success: false, error: updateError.message }
      }
    } else {
      // Créer nouvelle entrée stock boutique
      const { error: insertError } = await supabase
        .from('stock_boutique')
        .insert({
          produit_id: productionData.produit_id,
          quantite_disponible: productionData.quantite,
          quantite_vendue: 0,
          prix_vente: prixVente.prix_vente
        })

      if (insertError) {
        console.error('Erreur création stock boutique:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    // Enregistrer l'entrée boutique
    await supabase
      .from('entrees_boutique')
      .insert({
        produit_id: productionData.produit_id,
        quantite: productionData.quantite,
        source: 'production',
        type_entree: 'production',
        prix_vente: prixVente.prix_vente
      })

    return { success: true, message: 'Stock boutique mis à jour avec succès' }
  } catch (error) {
    console.error('Erreur dans mettreAJourStockBoutique:', error)
    return { success: false, error: error.message }
  }
},

  // Créer un nouveau produit AVEC enregistrement automatique de la dépense
  async create(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { product: null, error: 'Utilisateur non connecté' }
      }

      // 1. Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user.id
        })
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (produitError) {
        console.error('Erreur create produit:', produitError)
        return { product: null, error: produitError.message }
      }

      // 2. Enregistrer automatiquement la dépense comptable
      try {
        const depenseResult = await comptabiliteService.enregistrerDepenseStock(
          { ...productData, unite: produit.unite }, 
          user.id
        )
        
        if (depenseResult.depense) {
          // Mettre à jour la référence produit dans la dépense
          await supabase
            .from('depenses_comptables')
            .update({ reference_produit_id: produit.id })
            .eq('id', depenseResult.depense.id)
          
          console.log(`💰 Dépense enregistrée: ${utils.formatCFA((productData.prix_achat || 0) * (productData.quantite || 0))}`)
        }
      } catch (depenseError) {
        console.warn('Erreur enregistrement dépense (produit créé quand même):', depenseError)
        // On ne bloque pas la création du produit si l'enregistrement de la dépense échoue
      }

      // 3. Enregistrer le mouvement de stock (optionnel)
      try {
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: produit.id,
            type_mouvement: 'entree',
            quantite: productData.quantite,
            quantite_avant: 0,
            quantite_apres: productData.quantite,
            utilisateur_id: user.id,
            raison: 'Création nouveau produit',
            commentaire: `Nouveau produit: ${productData.nom} - ${productData.quantite} ${produit.unite?.label}`
          })
      } catch (mouvementError) {
        console.warn('Erreur enregistrement mouvement:', mouvementError)
        // Non bloquant
      }
      
      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans create produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Mettre à jour un produit
  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite_restante,
          unite_id: productData.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Obtenir les produits en stock faible
  async getLowStock() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .lt('quantite_restante', 10)
        .order('quantite_restante')
      
      if (error) {
        console.error('Erreur getLowStock:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getLowStock:', error)
      return { products: [], error: error.message }
    }
  },

  // Définir le prix de vente d'un produit
  async definirPrixVente(produitId, prixVente) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      // Récupérer les infos du produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .select('nom, prix_achat, unite:unites(label)')
        .eq('id', produitId)
        .single()
      
      if (produitError || !produit) {
        return { success: false, error: 'Produit introuvable' }
      }

      // Calculer la marge
      const marge = prixVente - (produit.prix_achat || 0)
      const pourcentageMarge = produit.prix_achat > 0 ? (marge / produit.prix_achat) * 100 : 0

      // Mettre à jour ou créer l'entrée dans prix_vente_produits
      const { data, error } = await supabase
        .from('prix_vente_produits')
        .upsert({
          produit_id: produitId,
          prix: prixVente,
          marge_pourcentage: Math.round(pourcentageMarge * 100) / 100,
          actif: true
        })
        .select()

      if (error) {
        console.error('Erreur définition prix vente:', error)
        return { success: false, error: error.message }
      }

      return { 
        success: true, 
        message: `Prix de vente défini: ${utils.formatCFA(prixVente)} (marge: ${Math.round(pourcentageMarge)}%)`,
        data: {
          produit: produit.nom,
          prix_achat: produit.prix_achat,
          prix_vente: prixVente,
          marge: marge,
          pourcentage_marge: pourcentageMarge
        }
      }
    } catch (error) {
      console.error('Erreur dans definirPrixVente:', error)
      return { success: false, error: error.message }
    }
    
  },
async createWithPriceOption(productData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { product: null, error: 'Utilisateur non connecté' }
    }

    console.log('🔧 Création produit avec données:', productData);

    // 1. Créer le produit dans le stock principal
    const { data: produit, error: produitError } = await supabase
      .from('produits')
      .insert({
        nom: productData.nom,
        date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
        prix_achat: productData.prix_achat, // Prix unitaire
        quantite: productData.quantite,
        quantite_restante: productData.quantite,
        unite_id: productData.unite_id,
        created_by: user.id
      })
      .select(`
        *,
        unite:unites(id, value, label)
      `)
      .single()
    
    if (produitError) {
      console.error('❌ Erreur create produit:', produitError)
      return { product: null, error: produitError.message }
    }

    console.log('✅ Produit créé:', produit);

    // 2. Si prix de vente défini, l'enregistrer IMMÉDIATEMENT
    if (productData.definir_prix_vente && productData.prix_vente) {
      console.log('💰 Sauvegarde prix de vente:', productData.prix_vente);
      
      try {
        // CORRECTION CRITIQUE: Calculer correctement la marge
        const prixAchatUnitaire = productData.prix_achat; // Déjà unitaire
        const prixVente = parseFloat(productData.prix_vente);
        const marge = prixVente - prixAchatUnitaire;
        const pourcentageMarge = prixAchatUnitaire > 0 ? (marge / prixAchatUnitaire) * 100 : 0;

        console.log('📊 Calculs marge:', {
          prixAchatUnitaire,
          prixVente,
          marge,
          pourcentageMarge
        });

        const { data: prixData, error: prixError } = await supabase
          .from('prix_vente_produits')
          .insert({
            produit_id: produit.id,
            prix: prixVente,  // IMPORTANT: utiliser 'prix' pas 'prix_vente'
            marge_pourcentage: Math.round(pourcentageMarge * 100) / 100,
            actif: true
          })
          .select()
        
        if (prixError) {
          console.error('❌ Erreur sauvegarde prix:', prixError);
          console.warn('Produit créé mais sans prix de vente');
        } else {
          console.log('✅ Prix de vente sauvegardé:', prixData);
          
          // VÉRIFICATION IMMÉDIATE
          const { data: verification } = await supabase
            .from('prix_vente_produits')
            .select('*')
            .eq('produit_id', produit.id);
          
          console.log('🔍 Vérification immédiate prix:', verification);
        }
      } catch (prixErr) {
        console.error('❌ Exception prix vente:', prixErr);
      }
    }

    // 3. Enregistrer la dépense comptable
    try {
      const depenseResult = await comptabiliteService.enregistrerDepenseStock(
        { 
          ...productData, 
          prix_achat: productData.prix_achat_total || (productData.prix_achat * productData.quantite),
          unite: produit.unite 
        }, 
        user.id
      )
      
      if (depenseResult.depense) {
        await supabase
          .from('depenses_comptables')
          .update({ reference_produit_id: produit.id })
          .eq('id', depenseResult.depense.id)
      }
    } catch (depenseError) {
      console.warn('Erreur enregistrement dépense:', depenseError)
    }

    return { product: produit, error: null }
  } catch (error) {
    console.error('❌ Erreur dans createWithPriceOption:', error)
    return { product: null, error: error.message }
  }
},

// Définir prix de vente pour un produit recette
async definirPrixVenteRecette(nomProduit, prixVente) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Créer une entrée dans une table prix_vente_recettes 
    // (ou utiliser une table générique pour les prix)
    const { data, error } = await supabase
      .from('prix_vente_recettes')
      .upsert({
        nom_produit: nomProduit,
        prix_vente: prixVente,
        defini_par: user.id,
        actif: true
      })
      .select()

    if (error) {
      console.error('Erreur définition prix recette:', error)
      return { success: false, error: error.message }
    }

    return { 
      success: true, 
      message: `Prix de vente défini pour ${nomProduit}: ${utils.formatCFA(prixVente)}`
    }
  } catch (error) {
    console.error('Erreur dans definirPrixVenteRecette:', error)
    return { success: false, error: error.message }
  }
},


// Définir prix de vente pour un produit recette
async definirPrixVenteRecette(nomProduit, prixVente) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Créer une entrée dans une table prix_vente_recettes 
    // (ou utiliser une table générique pour les prix)
    const { data, error } = await supabase
      .from('prix_vente_recettes')
      .upsert({
        nom_produit: nomProduit,
        prix_vente: prixVente,
        defini_par: user.id,
        actif: true
      })
      .select()

    if (error) {
      console.error('Erreur définition prix recette:', error)
      return { success: false, error: error.message }
    }

    return { 
      success: true, 
      message: `Prix de vente défini pour ${nomProduit}: ${utils.formatCFA(prixVente)}`
    }
  } catch (error) {
    console.error('Erreur dans definirPrixVenteRecette:', error)
    return { success: false, error: error.message }
  }
},


      

  // Obtenir les prix de vente définis
 async getPrixVente() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_produits') // Nom correct selon le schéma
        .select(`
          *,
          produit:produits(nom, prix_achat, unite:unites(label))
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getPrixVente:', error)
        return { prix: [], error: error.message }
      }
      
      // Reformater les données pour correspondre au code existant
      const prixFormates = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        prix_vente: item.prix,
        marge: item.prix - (item.produit?.prix_achat || 0),
        pourcentage_marge: item.marge_pourcentage || 0,
        produit: item.produit,
        created_at: item.created_at
      }))
      
      return { prix: prixFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVente:', error)
      return { prix: [], error: error.message }
    }
  }
}

// ===================== SERVICES DEMANDES =====================
// Service complet pour les demandes (à remplacer dans supabase.js)
export const demandeService = {
  // Récupérer toutes les demandes (individuelles et groupées)
  async getAll() {
    try {
      // Récupérer les demandes individuelles (sans demande_groupee_id)
      const { data: demandesIndividuelles, error: erreurIndividuelles } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
        `)
        .is('demande_groupee_id', null)
        .order('created_at', { ascending: false });

      // Récupérer les demandes groupées avec leurs lignes
      const { data: demandesGroupees, error: erreurGroupees } = await supabase
        .from('demandes_groupees')
        .select(`
          *,
          demandeur:profiles!demandes_groupees_demandeur_id_fkey(nom),
          valideur:profiles!demandes_groupees_valideur_id_fkey(nom),
          lignes:demandes(
            *,
            produit:produits(id, nom, quantite_restante, unite:unites(label))
          )
        `)
        .order('created_at', { ascending: false });

      let toutesLesDemandes = [];

      // Ajouter les demandes individuelles
      if (demandesIndividuelles) {
        toutesLesDemandes = [...demandesIndividuelles];
      }

      // Transformer et ajouter les demandes groupées
      if (demandesGroupees) {
        const demandesGroupeesFormatees = demandesGroupees.map(dg => ({
          id: `groupe_${dg.id}`,
          type: 'groupee',
          demande_groupee_id: dg.id,
          destination: dg.destination,
          statut: dg.statut,
          commentaire: dg.commentaire,
          nombre_produits: dg.nombre_produits,
          created_at: dg.created_at,
          updated_at: dg.updated_at,
          demandeur: dg.demandeur,
          valideur: dg.valideur,
          date_validation: dg.date_validation,
          details_validation: dg.details_validation,
          lignes: dg.lignes || [],
          // Pour compatibilité avec l'affichage existant
          produit: dg.lignes && dg.lignes.length > 0 ? {
            nom: `${dg.lignes.length} produit${dg.lignes.length > 1 ? 's' : ''}`,
            quantite_restante: null,
            unite: { label: 'divers' }
          } : null,
          quantite: dg.lignes ? dg.lignes.reduce((sum, l) => sum + (l.quantite || 0), 0) : 0
        }));

        toutesLesDemandes = [...toutesLesDemandes, ...demandesGroupeesFormatees];
      }

      // Trier par date de création (plus récent en premier)
      toutesLesDemandes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (erreurIndividuelles || erreurGroupees) {
        console.error('Erreurs lors du chargement des demandes:', {
          individuelles: erreurIndividuelles,
          groupees: erreurGroupees
        });
        return { 
          demandes: toutesLesDemandes, 
          error: erreurIndividuelles?.message || erreurGroupees?.message 
        };
      }
      
      return { demandes: toutesLesDemandes, error: null };
    } catch (error) {
      console.error('Erreur dans getAll demandes:', error);
      return { demandes: [], error: error.message };
    }
  },

  // Créer une demande groupée multi-produits
  async createGrouped(demandeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { demande: null, error: 'Utilisateur non connecté' };
      }

      if (!demandeData.produits || demandeData.produits.length === 0) {
        return { demande: null, error: 'Aucun produit sélectionné' };
      }

      console.log('🔄 Création demande groupée:', demandeData);

      // Vérifier le stock pour tous les produits
      const verificationsStock = await Promise.all(
        demandeData.produits.map(async (item) => {
          const { data: produit, error } = await supabase
            .from('produits')
            .select('nom, quantite_restante')
            .eq('id', item.produit_id)
            .single();

          if (error || !produit) {
            return { 
              produit_id: item.produit_id, 
              valide: false, 
              erreur: 'Produit introuvable' 
            };
          }

          if (produit.quantite_restante < item.quantite) {
            return { 
              produit_id: item.produit_id, 
              valide: false, 
              erreur: `Stock insuffisant pour ${produit.nom} (demandé: ${item.quantite}, disponible: ${produit.quantite_restante})` 
            };
          }

          return { 
            produit_id: item.produit_id, 
            valide: true, 
            nom: produit.nom 
          };
        })
      );

      // Vérifier s'il y a des erreurs de stock
      const erreursStock = verificationsStock.filter(v => !v.valide);
      if (erreursStock.length > 0) {
        const messagesErreur = erreursStock.map(e => e.erreur).join('\n');
        return { demande: null, error: `Erreurs de stock:\n${messagesErreur}` };
      }

      // Créer la demande groupée
      const { data: demandeGroupee, error: demandeError } = await supabase
        .from('demandes_groupees')
        .insert({
          destination: demandeData.destination,
          commentaire: demandeData.commentaire || null,
          demandeur_id: user.id,
          statut: 'en_attente',
          nombre_produits: demandeData.produits.length
        })
        .select()
        .single();

      if (demandeError) {
        console.error('Erreur création demande groupée:', demandeError);
        return { demande: null, error: demandeError.message };
      }

      // Créer les lignes de demande individuelles
      const lignesDemande = demandeData.produits.map(item => ({
        demande_groupee_id: demandeGroupee.id,
        produit_id: item.produit_id,
        quantite: item.quantite,
        demandeur_id: user.id,
        destination: demandeData.destination,
        statut: 'en_attente'
      }));

      const { data: lignesCreees, error: lignesError } = await supabase
        .from('demandes')
        .insert(lignesDemande)
        .select(`
          *,
          produit:produits(nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom)
        `);

      if (lignesError) {
        console.error('Erreur création lignes demande:', lignesError);
        
        // Nettoyer la demande groupée en cas d'erreur
        await supabase
          .from('demandes_groupees')
          .delete()
          .eq('id', demandeGroupee.id);

        return { demande: null, error: lignesError.message };
      }

      console.log('✅ Demande groupée créée avec succès:', {
        demande_groupee_id: demandeGroupee.id,
        nombre_lignes: lignesCreees.length
      });

      return { 
        demande: {
          ...demandeGroupee,
          lignes: lignesCreees
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Erreur dans createGrouped:', error);
      return { demande: null, error: error.message };
    }
  },

  // Valider une demande groupée complète
  async validateGrouped(demandeGroupeeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' };
      }

      console.log('🔄 Validation demande groupée:', demandeGroupeeId);

      // Utiliser la fonction SQL pour valider toute la demande groupée
      const { data: resultat, error } = await supabase.rpc('valider_demande_groupee_complete', {
        p_demande_groupee_id: demandeGroupeeId,
        p_valideur_id: user.id
      });

      if (error) {
        console.error('Erreur RPC validation groupée:', error);
        return { result: null, error: error.message };
      }

      console.log('✅ Validation groupée terminée:', resultat);

      // Construire le message de résultat
      const succes = resultat.succes_total || 0;
      const echecs = resultat.echecs_total || 0;
      const total = succes + echecs;

      let messageFinal = `🎯 Validation demande groupée terminée\n\n`;
      messageFinal += `📊 Résultats: ${succes}/${total} produits validés\n\n`;

      if (succes > 0) {
        messageFinal += `✅ ${succes} produit${succes > 1 ? 's' : ''} validé${succes > 1 ? 's' : ''} avec succès\n`;
      }

      if (echecs > 0) {
        messageFinal += `❌ ${echecs} échec${echecs > 1 ? 's' : ''}\n`;
        
        // Ajouter les détails des échecs
        const details = resultat.details || [];
        const echecsDetails = details.filter(d => !d.succes);
        if (echecsDetails.length > 0) {
          messageFinal += `\nDétails des échecs:\n`;
          echecsDetails.forEach(e => {
            messageFinal += `• ${e.produit_nom}: ${e.message}\n`;
          });
        }
      }

      return {
        result: {
          success: echecs === 0,
          total_produits: total,
          succes_count: succes,
          echecs_count: echecs,
          details: resultat.details
        },
        error: null,
        message: messageFinal
      };

    } catch (error) {
      console.error('❌ Erreur générale dans validateGrouped:', error);
      return { result: null, error: `Erreur lors de la validation: ${error.message}` };
    }
  },

  // Créer une demande individuelle (méthode existante)
  async create(demandeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('demandes')
        .insert({
          produit_id: demandeData.produit_id,
          quantite: demandeData.quantite,
          destination: demandeData.destination,
          demandeur_id: user?.id
        })
        .select(`
          *,
          produit:produits(nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom)
        `)
        .single();
      
      if (error) {
        console.error('Erreur create demande:', error);
        return { demande: null, error: error.message };
      }
      
      return { demande: data, error: null };
    } catch (error) {
      console.error('Erreur dans create demande:', error);
      return { demande: null, error: error.message };
    }
  },

  // Valider une demande individuelle avec gestion boutique
  async validateWithBoutiqueCheck(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' };
      }

      // Récupérer les informations de la demande
      const { data: demande, error: demandeError } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(
            id, nom, prix_achat,
            unite:unites(label)
          )
        `)
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .single();

      if (demandeError || !demande) {
        return { result: null, error: 'Demande introuvable ou déjà traitée' };
      }

      console.log('🔍 Validation demande:', demande);

      // Validation de la demande (marquer comme validée)
      const { error: updateError } = await supabase
        .from('demandes')
        .update({
          statut: 'validee',
          valideur_id: user.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeId)
        .eq('statut', 'en_attente');

      if (updateError) {
        console.error('❌ Erreur validation demande:', updateError);
        return { result: null, error: updateError.message };
      }

      // Vérifier le stock principal et le décrémenter
      const { data: produitActuel, error: produitError } = await supabase
        .from('produits')
        .select('quantite_restante')
        .eq('id', demande.produit_id)
        .single();

      if (produitError || !produitActuel) {
        return { result: null, error: 'Produit introuvable' };
      }

      if (produitActuel.quantite_restante < demande.quantite) {
        return { result: null, error: 'Stock insuffisant dans le stock principal' };
      }

      // Décrémenter le stock principal
      const { error: stockError } = await supabase
        .from('produits')
        .update({
          quantite_restante: produitActuel.quantite_restante - demande.quantite,
          updated_at: new Date().toISOString()
        })
        .eq('id', demande.produit_id);

      if (stockError) {
        console.error('❌ Erreur mise à jour stock principal:', stockError);
        return { result: null, error: 'Erreur lors de la mise à jour du stock principal' };
      }

      // Traitement selon la destination
      let messageSpecifique = '';

      if (demande.destination === 'Boutique') {
        // Traitement boutique avec prix
        try {
          console.log('🏪 Traitement demande vers boutique pour produit:', demande.produit_id);
          
          // Récupérer le prix de vente officiel
          const { data: prixVenteOfficial, error: prixError } = await supabase
            .from('prix_vente_produits')
            .select('prix, actif')
            .eq('produit_id', demande.produit_id)
            .eq('actif', true)
            .single();

          if (prixError || !prixVenteOfficial) {
            console.warn('⚠️ Aucun prix de vente officiel défini pour ce produit');
            
            // Continuer sans prix (à définir plus tard)
            const { data: stockExistant } = await supabase
              .from('stock_boutique')
              .select('id, quantite_disponible')
              .eq('produit_id', demande.produit_id)
              .single();

            if (stockExistant) {
              await supabase
                .from('stock_boutique')
                .update({
                  quantite_disponible: (stockExistant.quantite_disponible || 0) + demande.quantite,
                  updated_at: new Date().toISOString()
                })
                .eq('id', stockExistant.id);
            } else {
              await supabase
                .from('stock_boutique')
                .insert({
                  produit_id: demande.produit_id,
                  quantite_disponible: demande.quantite,
                  quantite_vendue: 0,
                  transfere_par: user.id
                });
            }

            messageSpecifique = '🏪 Produit ajouté au stock boutique. ⚠️ Définissez le prix dans "Prix Vente"';
          } else {
            // Traitement avec prix officiel
            const prixVenteCorrect = prixVenteOfficial.prix;
            console.log('✅ Prix de vente officiel récupéré:', utils.formatCFA(prixVenteCorrect));

            // Vérifier si le produit existe déjà en boutique
            const { data: stockExistant } = await supabase
              .from('stock_boutique')
              .select('id, quantite_disponible, prix_vente')
              .eq('produit_id', demande.produit_id)
              .single();

            if (stockExistant) {
              // Mise à jour avec correction automatique de prix
              const updateData = {
                quantite_disponible: (stockExistant.quantite_disponible || 0) + demande.quantite,
                prix_vente: prixVenteCorrect,
                updated_at: new Date().toISOString()
              };

              const { error: updateError } = await supabase
                .from('stock_boutique')
                .update(updateData)
                .eq('id', stockExistant.id);

              if (updateError) {
                console.error('❌ Erreur mise à jour stock boutique:', updateError);
                messageSpecifique = '⚠️ Erreur mise à jour stock boutique';
              } else {
                messageSpecifique = `🏪 Stock boutique mis à jour avec prix: ${utils.formatCFA(prixVenteCorrect)}`;
              }
            } else {
              // Création avec le prix correct
              const insertData = {
                produit_id: demande.produit_id,
                nom_produit: demande.produit?.nom,
                quantite_disponible: demande.quantite,
                quantite_vendue: 0,
                prix_vente: prixVenteCorrect,
                transfere_par: user.id
              };

              const { error: insertError } = await supabase
                .from('stock_boutique')
                .insert(insertData);

              if (insertError) {
                console.error('❌ Erreur création stock boutique:', insertError);
                messageSpecifique = '⚠️ Erreur création stock boutique';
              } else {
                messageSpecifique = `🏪 Produit ajouté au stock boutique avec prix: ${utils.formatCFA(prixVenteCorrect)}`;
              }
            }

            // Enregistrer l'entrée boutique
            await supabase
              .from('entrees_boutique')
              .insert({
                produit_id: demande.produit_id,
                quantite: demande.quantite,
                source: 'Demande',
                type_entree: 'Transfert',
                prix_vente: prixVenteCorrect,
                ajoute_par: user.id
              });
          }

        } catch (boutiqueErr) {
          console.error('❌ Erreur traitement boutique:', boutiqueErr);
          messageSpecifique = '⚠️ Erreur lors de l\'ajout au stock boutique';
        }

      } else if (demande.destination === 'Production') {
        // Traitement stock atelier
        try {
          const { error: atelierError } = await supabase.rpc('ajouter_au_stock_atelier', {
            p_produit_id: demande.produit_id,
            p_quantite: demande.quantite,
            p_transfere_par: user.id
          });

          if (atelierError) {
            console.error('❌ Erreur ajout stock atelier:', atelierError);
            messageSpecifique = '⚠️ Erreur ajout stock atelier';
          } else {
            messageSpecifique = `✅ ${demande.quantite} ${demande.produit?.unite?.label || 'unités'} ajouté(es) au stock atelier`;
          }
        } catch (atelierErr) {
          console.error('❌ Exception stock atelier:', atelierErr);
          messageSpecifique = '⚠️ Erreur ajout stock atelier';
        }

      } else {
        // Autres destinations
        messageSpecifique = `📦 Stock réservé pour: ${demande.destination}`;
      }

      // Enregistrer le mouvement de stock
      try {
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: demande.produit_id,
            type_mouvement: 'sortie',
            quantite: demande.quantite,
            quantite_avant: produitActuel.quantite_restante,
            quantite_apres: produitActuel.quantite_restante - demande.quantite,
            utilisateur_id: user.id,
            reference_id: demandeId,
            reference_type: 'demande',
            raison: `Validation demande vers ${demande.destination}`,
            commentaire: `${demande.produit?.nom || 'Produit'} - ${demande.quantite} ${demande.produit?.unite?.label || 'unités'}`
          });
      } catch (mouvementError) {
        console.warn('⚠️ Erreur enregistrement mouvement stock:', mouvementError);
      }

      // Retourner le résultat de succès
      const messageFinal = `✅ Demande validée avec succès !\n\n` +
                          `📦 Produit: ${demande.produit?.nom || 'Inconnu'}\n` +
                          `📊 Quantité: ${demande.quantite} ${demande.produit?.unite?.label || 'unités'}\n` +
                          `🎯 Destination: ${demande.destination}\n\n` +
                          `${messageSpecifique}`;

      return { 
        result: { success: true }, 
        error: null,
        message: messageFinal
      };

    } catch (error) {
      console.error('❌ Erreur générale dans validateWithBoutiqueCheck:', error);
      return { result: null, error: `Erreur lors de la validation: ${error.message}` };
    }
  },

  // Valider une demande individuelle (méthode existante)
  async validate(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' };
      }

      const { data, error } = await supabase.rpc('valider_demande', {
        demande_id_input: demandeId.toString(),
        p_valideur_id: user.id
      });
      
      if (error) {
        console.error('Erreur RPC valider_demande:', error);
        return { result: null, error: error.message };
      }
      
      return { result: data, error: null };
    } catch (error) {
      console.error('Erreur dans validate demande:', error);
      return { result: null, error: error.message };
    }
  },

  // Refuser une demande individuelle
  async reject(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: user?.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .select()
        .single();
      
      if (error) {
        console.error('Erreur reject demande:', error);
        return { demande: null, error: error.message };
      }
      
      return { demande: data, error: null };
    } catch (error) {
      console.error('Erreur dans reject demande:', error);
      return { demande: null, error: error.message };
    }
  },

  // Obtenir les statistiques des demandes
  async getStatistics() {
    try {
      const [demandesIndividuelles, demandesGroupees] = await Promise.all([
        supabase
          .from('demandes')
          .select('statut, created_at, destination')
          .is('demande_groupee_id', null),
        supabase
          .from('demandes_groupees')
          .select('statut, created_at, destination, nombre_produits')
      ]);

      const stats = {
        total_demandes_individuelles: demandesIndividuelles.data?.length || 0,
        total_demandes_groupees: demandesGroupees.data?.length || 0,
        en_attente_individuelles: demandesIndividuelles.data?.filter(d => d.statut === 'en_attente').length || 0,
        en_attente_groupees: demandesGroupees.data?.filter(d => d.statut === 'en_attente').length || 0,
        validees_individuelles: demandesIndividuelles.data?.filter(d => d.statut === 'validee').length || 0,
        validees_groupees: demandesGroupees.data?.filter(d => d.statut === 'validee').length || 0,
        refusees_individuelles: demandesIndividuelles.data?.filter(d => d.statut === 'refusee').length || 0,
        refusees_groupees: demandesGroupees.data?.filter(d => d.statut === 'refusee').length || 0,
        destinations: {}
      };

      // Calculer les statistiques par destination
      const toutesDestinations = [
        ...(demandesIndividuelles.data || []),
        ...(demandesGroupees.data || [])
      ];

      toutesDestinations.forEach(demande => {
        const dest = demande.destination || 'Non spécifié';
        stats.destinations[dest] = (stats.destinations[dest] || 0) + 1;
      });

      // Calculer le nombre total de produits demandés (en comptant les produits dans les demandes groupées)
      const totalProduitsGroupees = demandesGroupees.data?.reduce((sum, dg) => sum + (dg.nombre_produits || 0), 0) || 0;
      stats.total_produits_demandes = stats.total_demandes_individuelles + totalProduitsGroupees;

      return { stats, error: null };
    } catch (error) {
      console.error('Erreur dans getStatistics:', error);
      return { 
        stats: {
          total_demandes_individuelles: 0,
          total_demandes_groupees: 0,
          en_attente_individuelles: 0,
          en_attente_groupees: 0,
          validees_individuelles: 0,
          validees_groupees: 0,
          refusees_individuelles: 0,
          refusees_groupees: 0,
          total_produits_demandes: 0,
          destinations: {}
        }, 
        error: error.message 
      };
    }
  }
};
// ===================== SERVICES PRODUCTION =====================
// src/lib/supabase.js - CORRECTION de la méthode createProduction

// ===================== SERVICES PRODUCTION (CORRECTION) =====================
export const productionService = {
  // Récupérer toutes les productions
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll productions:', error)
        return { productions: [], error: error.message }
      }
      
      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll productions:', error)
      return { productions: [], error: error.message }
    }
  },

  // 🔧 CORRECTION PRINCIPALE: Créer une production avec prix recette
  async createProduction(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { production: null, error: 'Utilisateur non connecté' }
      }

      console.log('🏭 Début création production:', productionData);

      // ÉTAPE 1: Récupérer le prix depuis prix_vente_recettes (CORRECTION)
      let prixVenteRecette = null;
      if (productionData.destination === 'Boutique') {
        console.log('🔍 Recherche prix pour recette:', productionData.produit);
        
        const { data: prixData, error: prixError } = await supabase
          .from('prix_vente_recettes') // 🔧 CORRECTION: Bonne table
          .select('prix_vente, actif')
          .eq('nom_produit', productionData.produit)
          .eq('actif', true)
          .single();
        
        if (prixError) {
          console.warn('⚠️ Erreur récupération prix recette:', prixError);
        } else if (prixData && prixData.prix_vente) {
          prixVenteRecette = parseFloat(prixData.prix_vente);
          console.log(`✅ Prix récupéré depuis prix_vente_recettes: ${utils.formatCFA(prixVenteRecette)}`);
        } else {
          console.warn(`⚠️ Prix trouvé mais invalide:`, prixData);
        }

        if (!prixVenteRecette) {
          console.warn(`⚠️ Aucun prix défini pour la recette: ${productionData.produit}`);
          return { 
            production: null, 
            error: `Aucun prix de vente défini pour la recette "${productionData.produit}". Veuillez d'abord définir le prix dans la création de recette.` 
          };
        }
      }

      // ÉTAPE 2: Créer l'entrée production
      const { data: production, error: productionError } = await supabase
        .from('productions')
        .insert({
          produit: productionData.produit,
          quantite: productionData.quantite,
          destination: productionData.destination || 'Boutique',
          date_production: productionData.date_production || new Date().toISOString().split('T')[0],
          producteur_id: user.id,
          statut: 'termine'
        })
        .select()
        .single();

      if (productionError) {
        console.error('❌ Erreur création production:', productionError);
        return { production: null, error: productionError.message };
      }

      console.log('✅ Production créée:', production);

      // ÉTAPE 3: Si destination = Boutique, ajouter au stock boutique avec le PRIX CORRECT
      if (productionData.destination === 'Boutique' && prixVenteRecette) {
        console.log('🏪 Ajout au stock boutique avec prix:', utils.formatCFA(prixVenteRecette));
        
        try {
          // Vérifier si le produit existe déjà en boutique
          const { data: stockExistant } = await supabase
            .from('stock_boutique')
            .select('id, quantite_disponible, prix_vente')
            .eq('nom_produit', productionData.produit)
            .single();

          if (stockExistant) {
            // Mettre à jour stock existant AVEC LE PRIX CORRECT
            const { error: updateError } = await supabase
              .from('stock_boutique')
              .update({
                quantite_disponible: (stockExistant.quantite_disponible || 0) + productionData.quantite,
                prix_vente: prixVenteRecette, // 🔧 FORCER le prix de la recette
                updated_at: new Date().toISOString()
              })
              .eq('id', stockExistant.id);

            if (updateError) {
              console.error('❌ Erreur mise à jour stock boutique:', updateError);
            } else {
              console.log(`✅ Stock boutique mis à jour avec prix: ${utils.formatCFA(prixVenteRecette)}`);
            }
          } else {
            // Créer nouvelle entrée avec le prix correct
            const { error: insertError } = await supabase
              .from('stock_boutique')
              .insert({
                nom_produit: productionData.produit,
                quantite_disponible: productionData.quantite,
                quantite_vendue: 0,
                prix_vente: prixVenteRecette, // 🔧 Prix de la recette
                transfere_par: user.id
              });

            if (insertError) {
              console.error('❌ Erreur création stock boutique:', insertError);
            } else {
              console.log(`✅ Nouveau stock boutique créé avec prix: ${utils.formatCFA(prixVenteRecette)}`);
            }
          }

          // Enregistrer l'entrée boutique
          await supabase
            .from('entrees_boutique')
            .insert({
              nom_produit: productionData.produit,
              quantite: productionData.quantite,
              source: 'Production',
              type_entree: 'Production',
              prix_vente: prixVenteRecette, // 🔧 Prix de la recette
              ajoute_par: user.id
            });

        } catch (boutiqueError) {
          console.error('❌ Erreur traitement boutique:', boutiqueError);
          // Ne pas faire échouer toute la production pour ça
        }
      }

      // ÉTAPE 4: Calculer et déduire les ingrédients du stock atelier
      try {
        console.log('📦 Déduction des ingrédients du stock atelier...');
        
        // Récupérer la recette
        const { data: recettes, error: recetteError } = await supabase
          .from('recettes')
          .select(`
            quantite_necessaire,
            produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
              id, nom, prix_achat, quantite
            )
          `)
          .eq('nom_produit', productionData.produit);

        if (!recetteError && recettes && recettes.length > 0) {
          let coutTotal = 0;

          for (const recette of recettes) {
            const quantiteNecessaire = recette.quantite_necessaire * productionData.quantite;
            const produitId = recette.produit_ingredient?.id;

            if (produitId) {
              // Enregistrer la consommation
              await supabase
                .from('consommations_atelier')
                .insert({
                  production_id: production.id,
                  produit_id: produitId,
                  quantite_consommee: quantiteNecessaire,
                  cout_unitaire: recette.produit_ingredient?.prix_achat || 0
                });

              // Calculer le coût
              if (recette.produit_ingredient?.prix_achat && recette.produit_ingredient?.quantite) {
                const coutUnitaire = recette.produit_ingredient.prix_achat / recette.produit_ingredient.quantite;
                coutTotal += coutUnitaire * quantiteNecessaire;
              }

              // Mettre à jour le stock atelier
              await supabase.rpc('consommer_ingredient_atelier', {
                p_produit_id: produitId,
                p_quantite: quantiteNecessaire
              });
            }
          }

          // Mettre à jour le coût de la production
          if (coutTotal > 0) {
            await supabase
              .from('productions')
              .update({ cout_ingredients: coutTotal })
              .eq('id', production.id);
          }
        }
      } catch (ingredientError) {
        console.warn('⚠️ Erreur déduction ingrédients:', ingredientError);
        // Non bloquant
      }

      return { 
        production: {
          id: production.id,
          message: `Production créée avec succès. ${productionData.destination === 'Boutique' && prixVenteRecette ? `Prix boutique: ${utils.formatCFA(prixVenteRecette)}` : ''}`
        }, 
        error: null 
      };

    } catch (error) {
      console.error('❌ Erreur générale dans createProduction:', error);
      return { production: null, error: error.message };
    }
  },

  // Ancienne méthode create (maintenant alias vers createProduction)
  async create(productData) {
    return this.createProduction(productData);
  }
}
// ===================== SERVICES RECETTES =====================
export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          id,
          nom_produit,
          produit_ingredient_id,
          quantite_necessaire,
          created_at,
          updated_at,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, prix_achat, quantite,
            unite:unites(id, value, label)
          )
        `)
        .order('nom_produit', { ascending: true })
      
      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }
      
      const recettesFormatees = (data || []).map(recette => ({
        recette_id: `recette_${recette.id}`,
        nom_produit: recette.nom_produit,
        produit_ingredient_id: recette.produit_ingredient_id,
        ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
        quantite_necessaire: recette.quantite_necessaire,
        unite: recette.produit_ingredient?.unite?.label || '',
        prix_achat: recette.produit_ingredient?.prix_achat || 0,
        quantite_achat: recette.produit_ingredient?.quantite || 1,
        cout_ingredient: recette.produit_ingredient?.quantite > 0 ? 
          Math.round((recette.produit_ingredient.prix_achat / recette.produit_ingredient.quantite) * recette.quantite_necessaire * 100) / 100 : 0,
        created_at: recette.created_at,
        updated_at: recette.updated_at
      }))
      
      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Obtenir les produits avec recettes
  async getProduitsRecettes() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select('nom_produit')
        .order('nom_produit')
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error)
        return { produits: [], error: error.message }
      }
      
      const nomsUniques = [...new Set((data || []).map(item => item.nom_produit))].sort()
      return { produits: nomsUniques, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error)
      return { produits: [], error: error.message }
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { recette: null, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase
        .from('recettes')
        .insert({
          nom_produit: recetteData.nom_produit,
          produit_ingredient_id: recetteData.produit_ingredient_id,
          quantite_necessaire: recetteData.quantite_necessaire,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Erreur create recette:', error)
        return { recette: null, error: error.message }
      }

      return { recette: data, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recette: null, error: error.message }
    }
  },

  // Obtenir les recettes pour un produit spécifique
  async getRecettesProduit(nomProduit) {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          *,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, prix_achat, quantite,
            unite:unites(id, value, label)
          )
        `)
        .eq('nom_produit', nomProduit)
        .order('created_at')

      if (error) {
        console.error('Erreur getRecettesProduit:', error)
        return { recettes: [], error: error.message }
      }

      return { recettes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getRecettesProduit:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Vérifier disponibilité des ingrédients dans l'atelier
  async verifierDisponibiliteIngredients(nomProduit, quantite) {
    try {
      // Essayer d'abord avec la fonction RPC
      try {
        const { data, error } = await supabase.rpc('verifier_ingredients_atelier', {
          p_nom_produit: nomProduit,
          p_quantite_a_produire: quantite
        })

        if (!error && data) {
          const details = data || []
          const disponible = details.length > 0 && details.every(d => d.suffisant)
          return { details, disponible, error: null }
        }
      } catch (rpcError) {
        console.warn('RPC verifier_ingredients_atelier échouée, méthode alternative:', rpcError)
      }

      // Méthode alternative : vérifier manuellement
      const recettesResult = await this.getRecettesProduit(nomProduit)
      
      if (recettesResult.error) {
        return { details: [], disponible: false, error: recettesResult.error }
      }

      const recettes = recettesResult.recettes || []
      const details = recettes.map(recette => {
        const quantiteNecessaire = (recette.quantite_necessaire || 0) * quantite
        return {
          ingredient: recette.produit_ingredient?.nom || 'Inconnu',
          quantite_necessaire: quantiteNecessaire,
          stock_disponible: 0, // Par défaut, pas de stock atelier
          unite: recette.produit_ingredient?.unite?.label || '',
          suffisant: false // Par défaut, pas suffisant sans stock atelier
        }
      })

      return { 
        details, 
        disponible: false, // Par défaut, pas disponible sans données de stock atelier
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans verifierDisponibiliteIngredients:', error)
      return { details: [], disponible: false, error: error.message }
    }
  },

  // Calculer stock nécessaire
  async calculerStockNecessaire(nomProduit, quantite) {
    try {
      // Essayer d'abord avec la fonction RPC
      try {
        const { data, error } = await supabase.rpc('calculer_stock_necessaire', {
          p_nom_produit: nomProduit,
          p_quantite_a_produire: quantite
        })

        if (!error && data) {
          return { besoins: data || [], error: null }
        }
      } catch (rpcError) {
        console.warn('RPC calculer_stock_necessaire échouée, méthode alternative:', rpcError)
      }

      // Méthode alternative : calculer manuellement
      const recettesResult = await this.getRecettesProduit(nomProduit)
      
      if (recettesResult.error) {
        return { besoins: [], error: recettesResult.error }
      }

      const recettes = recettesResult.recettes || []
      const besoins = recettes.map(recette => {
        const quantiteNecessaire = (recette.quantite_necessaire || 0) * quantite
        return {
          ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
          quantite_necessaire: quantiteNecessaire,
          quantite_disponible: 0, // Par défaut, pas de stock atelier
          quantite_manquante: quantiteNecessaire, // Tout est manquant par défaut
          unite: recette.produit_ingredient?.unite?.label || ''
        }
      })

      return { besoins, error: null }
    } catch (error) {
      console.error('Erreur dans calculerStockNecessaire:', error)
      return { besoins: [], error: error.message }
    }
  }
}

// ===================== SERVICES STOCK ATELIER =====================
export const stockAtelierService = {
  // Récupérer l'état du stock atelier
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_atelier_simple')
        .select('*')
        .order('nom_produit')
        
      if (error) {
        console.error('Erreur getStockAtelier:', error)
        return { stock: [], error: error.message }
      }
      
      return { stock: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des transferts
  async getHistoriqueTransferts() {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          created_at,
          produit:produits(nom, unite:unites(label)),
          transfere_par_profile:profiles!stock_atelier_transfere_par_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { transferts: [], error: error.message }
      }
      
      return { transferts: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { transferts: [], error: error.message }
    }
  }
}

// ===================== SERVICES STOCK BOUTIQUE =====================
export const stockBoutiqueService = {
  // Récupérer l'état du stock boutique (VERSION FINALE CORRIGÉE)
async getStockBoutique() {
  try {
    console.log('🔄 Récupération stock boutique avec type_produit...');
    
    // Requête directe pour s'assurer d'avoir type_produit
    const { data, error } = await supabase
      .from('stock_boutique')
      .select(`
        id,
        produit_id,
        quantite_disponible,
        quantite_vendue,
        quantite_utilisee,
        prix_vente,
        type_produit,
        nom_produit,
        transfere_par,
        created_at,
        updated_at,
        produits (
          nom,
          unites (
            label
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur récupération stock_boutique:', error);
      return { stock: [], error: error.message };
    }
    
    // Formater les données en s'assurant d'inclure type_produit
    const stockFormate = (data || []).map(item => {
      const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0) - (item.quantite_utilisee || 0);
      
      return {
        id: item.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit || item.produits?.nom || `Produit ${item.produit_id}`,
        unite: item.produits?.unites?.label || 'unité',
        quantite_disponible: item.quantite_disponible || 0,
        quantite_vendue: item.quantite_vendue || 0,
        quantite_utilisee: item.quantite_utilisee || 0,
        stock_reel: stockReel,
        prix_vente: item.prix_vente || 0,
        valeur_stock: stockReel * (item.prix_vente || 0),
        statut_stock: this.calculateStockStatus(stockReel),
        prix_defini: (item.prix_vente && item.prix_vente > 0),
        type_produit: item.type_produit, // ✅ IMPORTANT : Inclure type_produit
        transfere_par: item.transfere_par,
        created_at: item.created_at,
        updated_at: item.updated_at,
        derniere_maj: item.updated_at
      };
    });
    
    console.log('✅ Stock formaté avec types:', stockFormate.map(s => ({ 
      nom: s.nom_produit, 
      type: s.type_produit 
    })));
    
    return { stock: stockFormate, error: null };
    
  } catch (error) {
    console.error('Erreur dans getStockBoutique:', error);
    return { stock: [], error: error.message };
  }
},

  // Fonction utilitaire pour calculer le statut du stock
  calculateStockStatus(stockReel) {
    if (stockReel <= 0) return 'rupture'
    if (stockReel <= 5) return 'critique'
    if (stockReel <= 10) return 'faible'
    return 'normal'
  },
  async synchroniserPrixRecettes() {
  try {
    console.log('🔄 Synchronisation forcée des prix recettes...');
    
    // Récupérer tous les prix de recettes actifs
    const { data: prixRecettes, error: prixError } = await supabase
      .from('prix_vente_recettes')
      .select('nom_produit, prix_vente')
      .eq('actif', true);
    
    if (prixError || !prixRecettes) {
      return { success: false, error: 'Erreur récupération prix recettes' };
    }
    
    let corrections = 0;
    
    // Mettre à jour chaque produit en boutique
    for (const prixRecette of prixRecettes) {
      const { data: stockBoutique } = await supabase
        .from('stock_boutique')
        .select('id, prix_vente')
        .eq('nom_produit', prixRecette.nom_produit)
        .single();
      
      if (stockBoutique && stockBoutique.prix_vente !== prixRecette.prix_vente) {
        // Corriger le prix
        const { error: updateError } = await supabase
          .from('stock_boutique')
          .update({ 
            prix_vente: prixRecette.prix_vente,
            updated_at: new Date().toISOString()
          })
          .eq('id', stockBoutique.id);
        
        if (!updateError) {
          console.log(`✅ Prix corrigé pour ${prixRecette.nom_produit}: ${utils.formatCFA(stockBoutique.prix_vente)} → ${utils.formatCFA(prixRecette.prix_vente)}`);
          corrections++;
        }
      }
    }
    
    console.log(`🎉 ${corrections} prix synchronisés`);
    return { success: true, corrections };
  } catch (error) {
    console.error('Erreur synchronisation:', error);
    return { success: false, error: error.message };
  }
},

  // Méthode de fallback avec requête directe
  async getStockBoutiqueDirecte() {
    try {
      console.log('🔄 Utilisation de la méthode directe pour stock boutique')
      
      const { data, error } = await supabase
        .from('stock_boutique')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          quantite_vendue,
          prix_vente,
          transfere_par,
          created_at,
          updated_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur requête directe stock boutique:', error)
        return { stock: [], error: error.message }
      }
      
      const stockFormate = (data || []).map(item => {
        const quantiteDisponible = item.quantite_disponible || 0
        const quantiteVendue = item.quantite_vendue || 0
        const stockReel = quantiteDisponible - quantiteVendue
        const prixVente = item.prix_vente || 0
        
        return {
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.produits?.nom || `Produit ${item.produit_id || 'Inconnu'}`,
          unite: item.produits?.unites?.label || 'unité',
          quantite_disponible: quantiteDisponible,
          quantite_vendue: quantiteVendue,
          stock_reel: stockReel,
          prix_vente: prixVente,
          valeur_stock: stockReel * prixVente,
          statut_stock: stockReel <= 0 ? 'rupture' :
                       stockReel <= 5 ? 'critique' :
                       stockReel <= 10 ? 'faible' : 'normal',
          prix_defini: prixVente > 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          derniere_maj: item.updated_at
        }
      })
      
      return { stock: stockFormate, error: null }
    } catch (error) {
      console.error('Erreur fatale dans getStockBoutiqueDirecte:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des entrées
  async getHistoriqueEntrees(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('entrees_boutique')
        .select(`
          id,
          produit_id,
          quantite,
          source,
          type_entree,
          created_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueEntrees:', error)
        return { entrees: [], error: error.message }
      }
      
      const entreesFormatees = (data || []).map(item => ({
        ...item,
        nom_produit: item.produits?.nom || 'Produit inconnu',
        unite: item.produits?.unites?.label || 'unité'
      }))
      
      return { entrees: entreesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueEntrees:', error)
      return { entrees: [], error: error.message }
    }
  },

  // Obtenir l'historique des sorties
  async getHistoriqueSorties(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('sorties_boutique')
        .select(`
          id,
          vente_id,
          produit_id,
          quantite,
          prix_unitaire,
          total,
          created_at,
          ventes (
            vendeur:profiles (
              nom
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueSorties:', error)
        return { sorties: [], error: error.message }
      }
      
      const sortiesFormatees = (data || []).map(item => ({
        ...item,
        vendeur: item.ventes?.vendeur
      }))
      
      return { sorties: sortiesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueSorties:', error)
      return { sorties: [], error: error.message }
    }
  },
   async updatePrixVente(stockId, nouveauPrix) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      if (!nouveauPrix || parseFloat(nouveauPrix) < 0) {
        return { success: false, error: 'Prix invalide' };
      }

      // Mettre à jour le prix dans stock_boutique
      const { data: stockMisAJour, error: stockError } = await supabase
        .from('stock_boutique')
        .update({
          prix_vente: parseFloat(nouveauPrix),
          updated_at: new Date().toISOString()
        })
        .eq('id', stockId)
        .select()
        .single();

      if (stockError) {
        console.error('Erreur mise à jour prix stock_boutique:', stockError);
        return { success: false, error: stockError.message };
      }

      // Synchroniser avec prix_vente_produits si le produit a un produit_id
      if (stockMisAJour.produit_id) {
        try {
          const { error: syncError } = await supabase
            .from('prix_vente_produits')
            .upsert({
              produit_id: stockMisAJour.produit_id,
              prix: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            });

          if (syncError) {
            console.warn('Erreur synchronisation prix_vente_produits:', syncError);
          }
        } catch (syncException) {
          console.warn('Exception synchronisation prix_vente_produits:', syncException);
        }
      }

      // Synchroniser avec prix_vente_recettes si c'est un produit de recette
      if (stockMisAJour.nom_produit) {
        try {
          const { error: recetteError } = await supabase
            .from('prix_vente_recettes')
            .upsert({
              nom_produit: stockMisAJour.nom_produit,
              prix_vente: parseFloat(nouveauPrix),
              actif: true,
              updated_at: new Date().toISOString()
            });

          if (recetteError) {
            console.warn('Erreur synchronisation prix_vente_recettes:', recetteError);
          }
        } catch (recetteException) {
          console.warn('Exception synchronisation prix_vente_recettes:', recetteException);
        }
      }

      return { 
        success: true, 
        message: `Prix mis à jour: ${utils.formatCFA(parseFloat(nouveauPrix))}`,
        data: stockMisAJour
      };
    } catch (error) {
      console.error('Erreur dans updatePrixVente:', error);
      return { success: false, error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Mettre à jour plusieurs prix en lot
  async updateMultiplePrices(priceUpdates) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      if (!priceUpdates || priceUpdates.length === 0) {
        return { success: false, error: 'Aucune mise à jour de prix fournie' };
      }

      let successes = 0;
      let failures = 0;
      const results = [];

      for (const update of priceUpdates) {
        const result = await this.updatePrixVente(update.stockId, update.nouveauPrix);
        
        if (result.success) {
          successes++;
        } else {
          failures++;
        }
        
        results.push({
          stockId: update.stockId,
          success: result.success,
          error: result.error
        });
      }

      return {
        success: failures === 0,
        message: `${successes} prix mis à jour avec succès, ${failures} échecs`,
        successes,
        failures,
        results
      };
    } catch (error) {
      console.error('Erreur dans updateMultiplePrices:', error);
      return { success: false, error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Synchroniser tous les prix avec les prix de recettes
  async synchroniserPrixRecettes() {
    try {
      console.log('🔄 Synchronisation forcée des prix recettes...');
      
      // Récupérer tous les prix de recettes actifs
      const { data: prixRecettes, error: prixError } = await supabase
        .from('prix_vente_recettes')
        .select('nom_produit, prix_vente')
        .eq('actif', true);
      
      if (prixError) {
        return { success: false, error: 'Erreur récupération prix recettes: ' + prixError.message };
      }

      if (!prixRecettes || prixRecettes.length === 0) {
        return { success: true, corrections: 0, message: 'Aucun prix de recette à synchroniser' };
      }
      
      let corrections = 0;
      
      // Mettre à jour chaque produit en boutique
      for (const prixRecette of prixRecettes) {
        try {
          const { data: stockBoutique, error: stockError } = await supabase
            .from('stock_boutique')
            .select('id, prix_vente')
            .eq('nom_produit', prixRecette.nom_produit)
            .single();
          
          if (!stockError && stockBoutique && stockBoutique.prix_vente !== prixRecette.prix_vente) {
            // Corriger le prix
            const { error: updateError } = await supabase
              .from('stock_boutique')
              .update({ 
                prix_vente: prixRecette.prix_vente,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockBoutique.id);
            
            if (!updateError) {
              console.log(`✅ Prix corrigé pour ${prixRecette.nom_produit}: ${utils.formatCFA(stockBoutique.prix_vente)} → ${utils.formatCFA(prixRecette.prix_vente)}`);
              corrections++;
            }
          }
        } catch (itemError) {
          console.warn(`Erreur pour ${prixRecette.nom_produit}:`, itemError);
        }
      }
      
      console.log(`🎉 ${corrections} prix synchronisés`);
      return { success: true, corrections };
    } catch (error) {
      console.error('❌ Erreur synchronisation:', error);
      return { success: false, error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Obtenir les produits sans prix défini
  async getProduitsEtsSansPrix() {
    try {
      const { data, error } = await supabase
        .from('stock_boutique')
        .select('*')
        .or('prix_vente.is.null,prix_vente.eq.0')
        .gt('quantite_disponible', 0)
        .order('nom_produit');
      
      if (error) {
        return { produits: [], error: error.message };
      }
      
      return { produits: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getProduitsEtsSansPrix:', error);
      return { produits: [], error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Définir un prix par défaut basé sur le coût
  async definirPrixParDefaut(stockId, margePercentage = 50) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      // Récupérer les informations du stock et du produit
      const { data: stockItem, error: stockError } = await supabase
        .from('stock_boutique')
        .select(`
          *,
          produits(prix_achat)
        `)
        .eq('id', stockId)
        .single();
      
      if (stockError || !stockItem) {
        return { success: false, error: 'Produit non trouvé' };
      }

      if (!stockItem.produits?.prix_achat) {
        return { success: false, error: 'Prix d\'achat non défini pour ce produit' };
      }

      // Calculer le prix de vente avec la marge
      const prixAchat = stockItem.produits.prix_achat;
      const prixVente = prixAchat * (1 + margePercentage / 100);
      
      // Arrondir à 2 décimales
      const prixVenteArrondi = Math.round(prixVente * 100) / 100;

      // Mettre à jour le prix
      const updateResult = await this.updatePrixVente(stockId, prixVenteArrondi);
      
      if (updateResult.success) {
        return {
          success: true,
          message: `Prix calculé automatiquement: ${utils.formatCFA(prixVenteArrondi)} (marge ${margePercentage}%)`,
          prixCalcule: prixVenteArrondi,
          prixAchat: prixAchat,
          marge: margePercentage
        };
      } else {
        return updateResult;
      }
    } catch (error) {
      console.error('Erreur dans definirPrixParDefaut:', error);
      return { success: false, error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Exporter les prix pour backup/import
  async exporterPrix() {
    try {
      const { data, error } = await supabase
        .from('stock_boutique')
        .select('nom_produit, prix_vente, quantite_disponible, quantite_vendue')
        .not('prix_vente', 'is', null)
        .order('nom_produit');
      
      if (error) {
        return { success: false, error: error.message };
      }

      const csvHeaders = ['nom_produit', 'prix_vente', 'quantite_disponible', 'quantite_vendue'];
      const csvLines = [csvHeaders.join(',')];
      
      data.forEach(item => {
        const line = [
          `"${item.nom_produit}"`,
          item.prix_vente || 0,
          item.quantite_disponible || 0,
          item.quantite_vendue || 0
        ];
        csvLines.push(line.join(','));
      });

      const csvContent = csvLines.join('\n');
      
      return { 
        success: true, 
        csvContent,
        filename: `prix_boutique_${new Date().toISOString().split('T')[0]}.csv`,
        count: data.length
      };
    } catch (error) {
      console.error('Erreur dans exporterPrix:', error);
      return { success: false, error: error.message };
    }
  },

  // NOUVELLE MÉTHODE: Calculer les statistiques de marge
  async getStatistiquesMarge() {
    try {
      const { data, error } = await supabase
        .from('stock_boutique')
        .select(`
          nom_produit,
          prix_vente,
          quantite_disponible,
          quantite_vendue,
          produits(prix_achat, quantite)
        `)
        .not('prix_vente', 'is', null)
        .gt('prix_vente', 0);
      
      if (error) {
        return { stats: null, error: error.message };
      }

      const statistiques = {
        produits_avec_prix: data.length,
        marge_moyenne: 0,
        marge_min: Infinity,
        marge_max: -Infinity,
        chiffre_affaires_potentiel: 0,
        valeur_stock_total: 0,
        produits_detailles: []
      };

      let margesValides = [];

      data.forEach(item => {
        const prixVente = item.prix_vente || 0;
        const prixAchat = item.produits?.prix_achat || 0;
        const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0);
        
        if (prixAchat > 0) {
          const marge = ((prixVente - prixAchat) / prixAchat) * 100;
          margesValides.push(marge);
          
          if (marge < statistiques.marge_min) statistiques.marge_min = marge;
          if (marge > statistiques.marge_max) statistiques.marge_max = marge;
        }
        
        const valeurStock = stockReel * prixVente;
        statistiques.chiffre_affaires_potentiel += valeurStock;
        statistiques.valeur_stock_total += valeurStock;
        
        statistiques.produits_detailles.push({
          nom: item.nom_produit,
          prix_vente: prixVente,
          prix_achat: prixAchat,
          stock_reel: stockReel,
          marge_pourcentage: prixAchat > 0 ? ((prixVente - prixAchat) / prixAchat) * 100 : 0,
          valeur_stock: valeurStock
        });
      });

      if (margesValides.length > 0) {
        statistiques.marge_moyenne = margesValides.reduce((sum, marge) => sum + marge, 0) / margesValides.length;
      }

      if (statistiques.marge_min === Infinity) statistiques.marge_min = 0;
      if (statistiques.marge_max === -Infinity) statistiques.marge_max = 0;

      return { stats: statistiques, error: null };
    } catch (error) {
      console.error('Erreur dans getStatistiquesMarge:', error);
      return { stats: null, error: error.message };
    }
  }

}


// ===================== SERVICES CAISSE =====================
export const caisseService = {
  // Vérifier la disponibilité des produits avec prix
  async getProduitsDisponiblesCaisse() {
    try {
      // Essayer d'abord la vue finale
      const { data: stockBoutique, error } = await supabase
        .from('vue_stock_boutique_final')
        .select('*')
        .gt('stock_reel', 0)
        .gt('prix_vente', 0)
      
      if (error) {
        console.warn('Vue finale échouée pour caisse, fallback direct:', error)
        
        // Fallback : requête directe
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('stock_boutique')
          .select(`
            produit_id,
            quantite_disponible,
            quantite_vendue,
            prix_vente,
            produits (
              nom,
              unites (
                label
              )
            )
          `)
          .gt('quantite_disponible', 0)
          .not('prix_vente', 'is', null)
          .gt('prix_vente', 0)
        
        if (fallbackError) {
          return { produits: [], error: fallbackError.message }
        }
        
        const produitsFormates = (fallbackData || []).map(item => {
          const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0)
          return {
            id: item.produit_id,
            nom_produit: item.produits?.nom || 'Produit',
            unite: item.produits?.unites?.label || 'unité',
            stock_reel: stockReel,
            prix_vente: item.prix_vente,
            prix_defini: true
          }
        }).filter(p => p.stock_reel > 0)
        
        return { produits: produitsFormates, error: null }
      }
      
      // Formater les données de la vue finale
      const produitsFormates = (stockBoutique || []).map(item => ({
        id: item.produit_id,
        nom_produit: item.nom_produit,
        unite: item.unite_label,
        stock_reel: item.stock_reel,
        prix_vente: item.prix_vente,
        prix_defini: item.prix_defini
      })).filter(p => p.stock_reel > 0 && p.prix_defini)
      
      return { produits: produitsFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsDisponiblesCaisse:', error)
      return { produits: [], error: error.message }
    }
  },

  // Enregistrer une vente (méthode manuelle corrigée)
  async enregistrerVente(venteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { vente: null, error: 'Utilisateur non connecté' }
      }

      const numeroTicket = 'V-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
      
      // Créer la vente
      const { data: vente, error: venteError } = await supabase
        .from('ventes')
        .insert({
          numero_ticket: numeroTicket,
          total: venteData.total,
          montant_donne: venteData.montant_donne,
          monnaie_rendue: venteData.monnaie_rendue,
          vendeur_id: venteData.vendeur_id,
          statut: 'validee'
        })
        .select()
        .single()
      
      if (venteError) throw venteError

      // Traiter chaque article
      for (const item of venteData.items) {
        // Insérer la ligne de vente
        await supabase
          .from('lignes_vente')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            nom_produit: item.nom,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })
        
        // Insérer dans les sorties boutique
        await supabase
          .from('sorties_boutique')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })
        
        // Mettre à jour le stock boutique
        const { data: stockActuel } = await supabase
          .from('stock_boutique')
          .select('quantite_vendue')
          .eq('produit_id', item.id)
          .single()
        
        if (stockActuel) {
          await supabase
            .from('stock_boutique')
            .update({
              quantite_vendue: (stockActuel.quantite_vendue || 0) + item.quantite,
              updated_at: new Date().toISOString()
            })
            .eq('produit_id', item.id)
        }
      }
      
      return { 
        vente: {
          ...vente,
          items: venteData.items
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur enregistrerVente:', error)
      return { vente: null, error: error.message }
    }
  },async getVentesPeriode(dateDebut, dateFin) {
  try {
    const { data: ventes, error } = await supabase
      .from('ventes')
      .select(`
        id,
        numero_ticket,
        total,
        montant_donne,
        monnaie_rendue,
        created_at,
        vendeur:profiles!ventes_vendeur_id_fkey(nom)
      `)
      .gte('created_at', dateDebut + 'T00:00:00.000Z')
      .lte('created_at', dateFin + 'T23:59:59.999Z')
      .eq('statut', 'validee')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erreur getVentesPeriode:', error)
      return { ventes: [], error: error.message }
    }
    
    // Récupérer les items pour chaque vente
    const ventesAvecItems = await Promise.all(
      (ventes || []).map(async (vente) => {
        try {
          const { data: items } = await supabase
            .from('lignes_vente')
            .select('*')
            .eq('vente_id', vente.id)
          
          return { ...vente, items: items || [] }
        } catch (err) {
          return { ...vente, items: [] }
        }
      })
    )
    
    return { ventes: ventesAvecItems, error: null }
  } catch (error) {
    console.error('Erreur dans getVentesPeriode:', error)
    return { ventes: [], error: error.message }
  }
},

  // Obtenir les ventes du jour
  async getVentesJour(date = null) {
    try {
      const dateRecherche = date || new Date().toISOString().split('T')[0]
      
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          id,
          numero_ticket,
          total,
          montant_donne,
          monnaie_rendue,
          created_at,
          vendeur:profiles!ventes_vendeur_id_fkey(nom)
        `)
        .gte('created_at', dateRecherche + 'T00:00:00.000Z')
        .lt('created_at', dateRecherche + 'T23:59:59.999Z')
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getVentesJour:', error)
        return { ventes: [], error: error.message }
      }
      
      // Récupérer les items pour chaque vente
      const ventesAvecItems = await Promise.all(
        (ventes || []).map(async (vente) => {
          try {
            const { data: items } = await supabase
              .from('lignes_vente')
              .select('*')
              .eq('vente_id', vente.id)
            
            return { ...vente, items: items || [] }
          } catch (err) {
            return { ...vente, items: [] }
          }
        })
      )
      
      return { ventes: ventesAvecItems, error: null }
    } catch (error) {
      console.error('Erreur dans getVentesJour:', error)
      return { ventes: [], error: error.message }
    }
  },
   // Obtenir les produits les plus vendus
  async getProduitsTopVentes(limit = 10, periode = 'mois') {
    try {
      let dateDebut = '';
      const aujourdhui = new Date();
      
      // Calculer la période selon le paramètre
      if (periode === 'semaine') {
        const semaineDerniere = new Date(aujourdhui.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateDebut = semaineDerniere.toISOString().split('T')[0];
      } else if (periode === 'mois') {
        const moisDernier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
        dateDebut = moisDernier.toISOString().split('T')[0];
      } else if (periode === 'annee') {
        const anneeDerniere = new Date(aujourdhui.getFullYear(), 0, 1);
        dateDebut = anneeDerniere.toISOString().split('T')[0];
      } else {
        // Par défaut, derniers 30 jours
        const trenteDerniers = new Date(aujourdhui.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateDebut = trenteDerniers.toISOString().split('T')[0];
      }

      const dateFin = aujourdhui.toISOString().split('T')[0];

      // Récupérer les lignes de vente pour la période
      const { data: lignesVente, error } = await supabase
        .from('lignes_vente')
        .select(`
          nom_produit,
          quantite,
          prix_unitaire,
          total,
          created_at
        `)
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getProduitsTopVentes:', error)
        return { produits: [], error: error.message }
      }

      // Grouper par produit et calculer les totaux
      const produitsGroupes = {}
      
      lignesVente.forEach(ligne => {
        const nom = ligne.nom_produit
        if (!produitsGroupes[nom]) {
          produitsGroupes[nom] = {
            nom_produit: nom,
            quantite_vendue: 0,
            chiffre_affaires: 0,
            nombre_ventes: 0
          }
        }
        
        produitsGroupes[nom].quantite_vendue += ligne.quantite || 0
        produitsGroupes[nom].chiffre_affaires += ligne.total || 0
        produitsGroupes[nom].nombre_ventes += 1
      })

      // Convertir en tableau et trier par chiffre d'affaires
      const produitsArray = Object.values(produitsGroupes)
        .sort((a, b) => b.chiffre_affaires - a.chiffre_affaires)
        .slice(0, limit)

      return { produits: produitsArray, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsTopVentes:', error)
      return { produits: [], error: error.message }
    }
  }
}


// ===================== SERVICES COMPTABILITÉ =====================
// Corrections pour src/lib/supabase.js - Service comptabilité avec vraies valeurs

export const comptabiliteService = {
  // Calculer les vraies dépenses depuis la base de données
  async getDepensesReelles(dateDebut, dateFin) {
    try {
      let depensesStock = 0
      let detailsDepensesStock = []
      
      // 1. Dépenses d'achat de matières premières (achats de produits)
      try {
        const { data: produits, error: produitsError } = await supabase
          .from('produits')
          .select('nom, prix_achat, quantite, date_achat, created_at')
          .gte('date_achat', dateDebut)
          .lte('date_achat', dateFin)
        
        if (!produitsError && produits) {
          depensesStock = produits.reduce((sum, p) => 
            sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0
          )
          detailsDepensesStock = produits.map(p => ({
            date: p.date_achat || p.created_at,
            type: 'achat_matiere_premiere',
            description: `Achat ${p.nom} - ${p.quantite} unités`,
            montant: (p.prix_achat || 0) * (p.quantite || 0)
          }))
        }
      } catch (stockErr) {
        console.warn('Erreur calcul dépenses stock:', stockErr)
      }

      // 2. Coût des ingrédients utilisés en production (consommations réelles)
      let coutIngredients = 0
      let detailsIngredients = []
      
      try {
        // Calculer le coût basé sur les productions ET les prix d'achat des ingrédients
        const { data: productions, error: prodError } = await supabase
          .from('productions')
          .select(`
            id,
            produit,
            quantite,
            date_production,
            cout_ingredients
          `)
          .gte('date_production', dateDebut)
          .lte('date_production', dateFin)
        
        if (!prodError && productions) {
          for (const production of productions) {
            let coutProduction = 0
            
            // Si le coût est déjà calculé, l'utiliser
            if (production.cout_ingredients) {
              coutProduction = production.cout_ingredients
            } else {
              // Sinon, calculer à partir des recettes
              try {
                const { data: recettes } = await supabase
                  .from('recettes')
                  .select(`
                    quantite_necessaire,
                    produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
                      nom, prix_achat, quantite
                    )
                  `)
                  .eq('nom_produit', production.produit)
                
                if (recettes && recettes.length > 0) {
                  coutProduction = recettes.reduce((sum, recette) => {
                    const produit = recette.produit_ingredient
                    if (produit && produit.prix_achat && produit.quantite) {
                      const coutUnitaire = produit.prix_achat / produit.quantite
                      return sum + (coutUnitaire * recette.quantite_necessaire * production.quantite)
                    }
                    return sum
                  }, 0)
                }
              } catch (recetteError) {
                console.warn('Erreur calcul coût recette:', recetteError)
              }
            }
            
            coutIngredients += coutProduction
            
            if (coutProduction > 0) {
              detailsIngredients.push({
                date: production.date_production,
                type: 'cout_production',
                description: `Production ${production.produit} (${production.quantite} unités)`,
                montant: coutProduction
              })
            }
          }
        }
      } catch (err) {
        console.warn('Erreur calcul coût ingrédients:', err)
      }

      // 3. Autres dépenses depuis la table depenses_comptables si elle existe
      let autresDepenses = 0
      let detailsAutres = []
      
      try {
        const { data: depenses, error: depensesError } = await supabase
          .from('depenses_comptables')
          .select('*')
          .gte('date_depense', dateDebut)
          .lte('date_depense', dateFin)
        
        if (!depensesError && depenses) {
          autresDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0)
          detailsAutres = depenses.map(d => ({
            date: d.date_depense,
            type: d.type_depense || 'autre',
            description: d.description || 'Dépense',
            montant: d.montant || 0
          }))
        }
      } catch (depensesErr) {
        // Table peut ne pas exister, ce n'est pas grave
        console.info('Table depenses_comptables non disponible')
      }

      const totalDepenses = depensesStock + coutIngredients + autresDepenses
      
      const details = [
        ...detailsDepensesStock,
        ...detailsIngredients,
        ...detailsAutres
      ].filter(d => d.montant > 0).sort((a, b) => new Date(b.date) - new Date(a.date))
      
      return { 
        depenses: totalDepenses, 
        details, 
        repartition: {
          depenses_achat_matieres: depensesStock,
          cout_ingredients_production: coutIngredients,
          autres_depenses: autresDepenses
        },
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans getDepensesReelles:', error)
      return { 
        depenses: 0, 
        details: [], 
        repartition: { 
          depenses_achat_matieres: 0, 
          cout_ingredients_production: 0, 
          autres_depenses: 0 
        },
        error: error.message 
      }
    }
  },

  // Calculer les vraies recettes (chiffre d'affaires)
  async getRecettesReelles(dateDebut, dateFin) {
    try {
      const ventesResult = await caisseService.getVentesPeriode(dateDebut, dateFin)
      const ventes = ventesResult.ventes || []
      
      const chiffreAffaires = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
      const nombreVentes = ventes.length
      const ticketMoyen = nombreVentes > 0 ? chiffreAffaires / nombreVentes : 0
      
      // Calculer les articles vendus
      const articlesVendus = ventes.reduce((sum, v) => 
        sum + (v.items?.reduce((s, i) => s + (i.quantite || 0), 0) || 0), 0)

      return {
        chiffre_affaires: chiffreAffaires,
        nombre_transactions: nombreVentes,
        ticket_moyen: ticketMoyen,
        articles_vendus: articlesVendus,
        ventes_details: ventes,
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRecettesReelles:', error)
      return {
        chiffre_affaires: 0,
        nombre_transactions: 0,
        ticket_moyen: 0,
        articles_vendus: 0,
        ventes_details: [],
        error: error.message
      }
    }
  },
  async enregistrerDepenseStock(productData, userId) {
  try {
    // Calculer le montant total de la dépense
    const montantTotal = (productData.prix_achat || 0) * (productData.quantite || 0)
    
    if (montantTotal <= 0) {
      return { depense: null, error: 'Montant de dépense invalide' }
    }

    const { data: depense, error } = await supabase
      .from('depenses_comptables')
      .insert({
        type_depense: 'achat_matiere_premiere',
        description: `Achat ${productData.nom} - ${productData.quantite} ${productData.unite?.label || 'unités'}`,
        montant: montantTotal,
        date_depense: productData.date_achat || new Date().toISOString().split('T')[0],
        utilisateur_id: userId,
        details: {
          produit_nom: productData.nom,
          quantite: productData.quantite,
          prix_unitaire: productData.prix_achat / productData.quantite,
          unite: productData.unite?.label
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur enregistrement dépense stock:', error)
      return { depense: null, error: error.message }
    }

    return { depense, error: null }
  } catch (error) {
    console.error('Erreur dans enregistrerDepenseStock:', error)
    return { depense: null, error: error.message }
  }
},


  // Rapport comptable avec calculs corrects
  async getRapportComptable(dateDebut, dateFin) {
    try {
      // 1. Récupérer les vraies recettes
      const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)
      if (recettesResult.error) {
        console.error('Erreur recettes:', recettesResult.error)
      }

      // 2. Récupérer les vraies dépenses
      const depensesResult = await this.getDepensesReelles(dateDebut, dateFin)
      if (depensesResult.error) {
        console.error('Erreur dépenses:', depensesResult.error)
      }

      const chiffreAffaires = recettesResult.chiffre_affaires || 0
      const totalDepenses = depensesResult.depenses || 0

      // 3. Calculer la marge correctement
      const margeBrute = chiffreAffaires - totalDepenses
      const pourcentageMarge = chiffreAffaires > 0 ? (margeBrute / chiffreAffaires) * 100 : 0

      // 4. Vérification des calculs
      console.log('📊 Calculs comptables:', {
        periode: `${dateDebut} → ${dateFin}`,
        chiffreAffaires: chiffreAffaires,
        totalDepenses: totalDepenses,
        margeBrute: margeBrute,
        pourcentageMarge: pourcentageMarge.toFixed(2) + '%'
      })

      return {
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: Math.round(chiffreAffaires * 100) / 100,
          depenses: Math.round(totalDepenses * 100) / 100,
          marge_brute: Math.round(margeBrute * 100) / 100,
          pourcentage_marge: Math.round(pourcentageMarge * 100) / 100
        },
        ventes: {
          nombre_transactions: recettesResult.nombre_transactions || 0,
          ticket_moyen: Math.round((recettesResult.ticket_moyen || 0) * 100) / 100,
          articles_vendus: recettesResult.articles_vendus || 0
        },
        depenses_details: depensesResult.details || [],
        repartition_depenses: depensesResult.repartition || {},
        ventes_details: recettesResult.ventes_details || [],
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRapportComptable:', error)
      return { 
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: 0,
          depenses: 0,
          marge_brute: 0,
          pourcentage_marge: 0
        },
        ventes: {
          nombre_transactions: 0,
          ticket_moyen: 0,
          articles_vendus: 0
        },
        depenses_details: [],
        repartition_depenses: {},
        ventes_details: [],
        error: error.message 
      }
    }
  },

  // Test des données - méthode utilitaire pour debug
  async testDonneesComptables(dateDebut, dateFin) {
    try {
      console.log('🔍 Test des données comptables pour:', dateDebut, '→', dateFin)
      
      // Test ventes
      const { data: ventes } = await supabase
        .from('ventes')
        .select('*')
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
      
      console.log('💰 Ventes trouvées:', ventes?.length || 0)
      if (ventes && ventes.length > 0) {
        const totalVentes = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
        console.log('💰 Total ventes:', totalVentes, 'CFA')
      }

      // Test produits (achats)
      const { data: produits } = await supabase
        .from('produits')
        .select('*')
        .gte('date_achat', dateDebut)
        .lte('date_achat', dateFin)
      
      console.log('📦 Achats de produits:', produits?.length || 0)
      if (produits && produits.length > 0) {
        const totalAchats = produits.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0)
        console.log('📦 Total achats:', totalAchats, 'CFA')
      }

      // Test productions
      const { data: productions } = await supabase
        .from('productions')
        .select('*')
        .gte('date_production', dateDebut)
        .lte('date_production', dateFin)
      
      console.log('🏭 Productions:', productions?.length || 0)

      return {
        ventes: ventes || [],
        produits: produits || [],
        productions: productions || []
      }
    } catch (error) {
      console.error('Erreur test données:', error)
      return null
    }
  },

  // Méthodes existantes...
  async getEvolutionMensuelle(annee) {
    try {
      const evolution = []
      
      for (let mois = 1; mois <= 12; mois++) {
        const dateDebut = `${annee}-${mois.toString().padStart(2, '0')}-01`
        const dateFin = `${annee}-${mois.toString().padStart(2, '0')}-${new Date(annee, mois, 0).getDate()}`
        
        const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)
        
        evolution.push({
          mois: mois,
          chiffre_affaires: recettesResult.chiffre_affaires || 0,
          nb_ventes: recettesResult.nombre_transactions || 0
        })
      }
      
      return { evolution, error: null }
    } catch (error) {
      console.error('Erreur dans getEvolutionMensuelle:', error)
      return { evolution: [], error: error.message }
    }
  },

  // Export corrigé
  async exporterDonneesComptables(dateDebut, dateFin, format = 'csv') {
    try {
      const rapport = await this.getRapportComptable(dateDebut, dateFin)
      
      if (rapport.error) {
        return { success: false, error: rapport.error }
      }

      const donnees = { rapport }

      if (format === 'csv') {
        const csvContent = this.genererCSV(donnees)
        return { 
          success: true, 
          content: csvContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.csv` 
        }
      } else {
        const jsonContent = JSON.stringify(donnees, null, 2)
        return { 
          success: true, 
          content: jsonContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.json` 
        }
      }
    } catch (error) {
      console.error('Erreur dans exporterDonneesComptables:', error)
      return { success: false, error: error.message }
    }
  },

  // CSV amélioré
  genererCSV(donnees) {
    const lignes = []
    const rapport = donnees.rapport
    
    lignes.push('RAPPORT COMPTABLE PATISSERIE SHINE')
    lignes.push(`Période: ${rapport.periode.debut} - ${rapport.periode.fin}`)
    lignes.push(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`)
    lignes.push('')
    lignes.push('RESUME FINANCIER')
    lignes.push('Indicateur,Montant CFA')
    lignes.push(`Chiffre d'affaires,${rapport.finances.chiffre_affaires}`)
    lignes.push(`Dépenses totales,${rapport.finances.depenses}`)
    lignes.push(`Marge brute,${rapport.finances.marge_brute}`)
    lignes.push(`Pourcentage marge,${rapport.finances.pourcentage_marge}%`)
    lignes.push('')
    lignes.push('REPARTITION DES DEPENSES')
    lignes.push('Type,Montant CFA')
    if (rapport.repartition_depenses) {
      Object.entries(rapport.repartition_depenses).forEach(([type, montant]) => {
        lignes.push(`${type},${montant}`)
      })
    }
    lignes.push('')
    lignes.push('ACTIVITE COMMERCIALE')
    lignes.push('Indicateur,Valeur')
    lignes.push(`Nombre de transactions,${rapport.ventes.nombre_transactions}`)
    lignes.push(`Ticket moyen,${rapport.ventes.ticket_moyen}`)
    lignes.push(`Articles vendus,${rapport.ventes.articles_vendus}`)
    
    if (rapport.depenses_details && rapport.depenses_details.length > 0) {
      lignes.push('')
      lignes.push('DETAILS DES DEPENSES')
      lignes.push('Date,Type,Description,Montant CFA')
      rapport.depenses_details.forEach(depense => {
        lignes.push(`${depense.date},${depense.type},${depense.description.replace(/,/g, ';')},${depense.montant}`)
      })
    }
    
    return lignes.join('\n')
  }
}

// ===================== SERVICES STATISTIQUES =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      const [
        { data: produits },
        { data: demandes },
        { data: productions },
        { data: profiles }
      ] = await Promise.all([
        supabase.from('produits').select('id'),
        supabase.from('demandes').select('id').eq('statut', 'en_attente'),
        supabase.from('productions').select('id').eq('date_production', new Date().toISOString().split('T')[0]),
        supabase.from('profiles').select('id')
      ])

      const stats = {
        total_produits: produits?.length || 0,
        demandes_en_attente: demandes?.length || 0,
        productions_jour: productions?.length || 0,
        utilisateurs_actifs: profiles?.length || 0,
        produits_stock_critique: 0,
        stock_atelier_critique: 0,
        efficacite_production: 95
      }

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error)
      return { 
        stats: {
          total_produits: 0,
          demandes_en_attente: 0,
          productions_jour: 0,
          utilisateurs_actifs: 0,
          produits_stock_critique: 0,
          stock_atelier_critique: 0,
          efficacite_production: 0
        }, 
        error: null
      }
    }
  }
}

// ===================== SERVICES UTILISATEURS =====================
export const userService = {
  // Récupérer tous les utilisateurs ACTIFS uniquement
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', true) // ← CORRECTION : Seulement les utilisateurs actifs
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll users:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll users:', error)
      return { users: [], error: error.message }
    }
  },

  // Récupérer TOUS les utilisateurs (y compris inactifs) pour admin
  async getAllIncludingInactive() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('actif', { ascending: false }) // Actifs en premier
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAllIncludingInactive:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAllIncludingInactive:', error)
      return { users: [], error: error.message }
    }
  },

  // Créer un utilisateur via API (robuste)
  async createUser(userData) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return { user: null, error: 'Vous devez être connecté' }
      }

      console.log('🔄 Envoi requête création utilisateur:', userData)

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...userData,
          force_password_change: true // Toujours forcer le changement
        })
      })

      console.log('📡 Statut réponse API:', response.status)

      // Lire le texte de la réponse d'abord
      const responseText = await response.text()
      console.log('📄 Réponse brute:', responseText)

      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ Erreur parsing JSON:', parseError)
        return { 
          user: null, 
          error: `Erreur de format de réponse: ${responseText.substring(0, 100)}...` 
        }
      }

      if (!response.ok) {
        console.error('❌ Erreur API:', result)
        return { user: null, error: result.error || `Erreur ${response.status}` }
      }

      console.log('✅ Utilisateur créé avec succès')
      return { user: result.user, error: null }
    } catch (error) {
      console.error('❌ Erreur dans createUser:', error)
      return { user: null, error: error.message }
    }
  },

  // Mettre à jour un utilisateur
  async updateUser(userId, userData) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return { user: null, error: 'Vous devez être connecté' }
      }

      console.log('🔄 Mise à jour utilisateur:', userId, userData)

      const response = await fetch('/api/admin/update-user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          ...userData
        })
      })

      const responseText = await response.text()
      console.log('📄 Réponse mise à jour:', responseText)

      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        return { user: null, error: `Erreur de format: ${responseText}` }
      }

      if (!response.ok) {
        return { user: null, error: result.error || `Erreur ${response.status}` }
      }

      return { user: result.user, error: null }
    } catch (error) {
      console.error('Erreur dans updateUser:', error)
      return { user: null, error: error.message }
    }
  },

  // Changer le mot de passe d'un utilisateur (admin)
  async changePassword(userId, newPassword) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return { success: false, error: 'Vous devez être connecté' }
      }

      console.log('🔄 Changement mot de passe pour:', userId)

      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: userId,
          newPassword: newPassword
        })
      })

      const responseText = await response.text()
      let result

      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        return { success: false, error: `Erreur de format: ${responseText}` }
      }

      if (!response.ok) {
        return { success: false, error: result.error || `Erreur ${response.status}` }
      }

      return { success: true, message: result.message }
    } catch (error) {
      console.error('Erreur dans changePassword:', error)
      return { success: false, error: error.message }
    }
  },

  // Supprimer un utilisateur (VRAIE suppression ou désactivation)
  async deleteUser(userId, permanent = false) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return { success: false, error: 'Vous devez être connecté' }
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (userId === currentUser?.id) {
        return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }
      }

      // Vérifier si c'est le propriétaire
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()

      if (targetUser && targetUser.username === 'proprietaire') {
        return { success: false, error: 'Le compte propriétaire ne peut pas être supprimé' }
      }

      console.log('🔄 Suppression utilisateur via API:', { userId, permanent })

      // Appeler la nouvelle API
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: userId,
          permanent: permanent
        })
      })

      const responseText = await response.text()
      let result

      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        return { success: false, error: `Erreur de format: ${responseText}` }
      }

      if (!response.ok) {
        return { success: false, error: result.error || `Erreur ${response.status}` }
      }

      return { 
        success: true, 
        message: result.message,
        deletionType: result.deletionType 
      }
    } catch (error) {
      console.error('Erreur dans deleteUser:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir les utilisateurs supprimés/désactivés
  async getDeactivatedUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('actif', false)
        .order('updated_at', { ascending: false })
      
      if (error) {
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getDeactivatedUsers:', error)
      return { users: [], error: error.message }
    }
  },

  // Réactiver un utilisateur désactivé
  async reactivateUser(userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return { success: false, error: 'Vous devez être connecté' }
      }

      console.log('🔄 Réactivation utilisateur:', userId)

      // Réactiver dans profiles
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({
          actif: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // TODO: Réactiver dans auth.users (nécessiterait une API admin)
      // Pour l'instant on réactive seulement dans profiles
      
      return { 
        success: true, 
        message: `Utilisateur ${updatedUser.nom || updatedUser.username} réactivé`,
        user: updatedUser
      }
    } catch (error) {
      console.error('Erreur dans reactivateUser:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir un utilisateur par ID
  async getById(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Erreur getById user:', error)
        return { user: null, error: error.message }
      }

      return { user: data, error: null }
    } catch (error) {
      console.error('Erreur dans getById user:', error)
      return { user: null, error: error.message }
    }
  },

  // Forcer le changement de mot de passe
  async forcePasswordChange(userId) {
    try {
      // Essayer d'abord avec la fonction SQL
      try {
        const { data, error } = await supabase.rpc('admin_force_password_change', {
          target_user_id: userId
        })

        if (error) {
          throw error
        }

        return { success: true, message: 'Changement de mot de passe forcé' }
      } catch (rpcError) {
        console.warn('RPC admin_force_password_change échouée, fallback direct:', rpcError)
        
        // Fallback : mise à jour directe
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            force_password_change: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          return { success: false, error: updateError.message }
        }

        return { success: true, message: 'Changement de mot de passe forcé (méthode directe)' }
      }
    } catch (error) {
      console.error('Erreur dans forcePasswordChange:', error)
      return { success: false, error: error.message }
    }
  },

  // Vérifier si l'utilisateur doit changer son mot de passe
  async checkPasswordChangeRequired(userId) {
    try {
      // Essayer d'abord avec la fonction SQL
      try {
        const { data, error } = await supabase.rpc('check_password_change_required', {
          user_id: userId
        })

        if (error) {
          throw error
        }

        return { required: data || false, error: null }
      } catch (rpcError) {
        console.warn('RPC check_password_change_required échouée, fallback direct:', rpcError)
        
        // Fallback : requête directe
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('force_password_change, last_password_change')
          .eq('id', userId)
          .single()

        if (profileError) {
          return { required: false, error: profileError.message }
        }

        const isRequired = profile.force_password_change === true || 
                          profile.last_password_change === null

        return { required: isRequired, error: null }
      }
    } catch (error) {
      console.error('Erreur dans checkPasswordChangeRequired:', error)
      return { required: false, error: error.message }
    }
  },

  // Test de connexion et permissions
  async testConnection() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        return { 
          success: false, 
          error: 'Utilisateur non connecté',
          details: userError?.message 
        }
      }

      // Test de lecture de la table profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        return { 
          success: false, 
          error: 'Erreur lecture profil',
          details: profileError.message 
        }
      }

      // Test de l'API
      const { data: { session } } = await supabase.auth.getSession()
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          profile: profile
        },
        session: {
          hasToken: !!session?.access_token,
          tokenPreview: session?.access_token?.substring(0, 20) + '...'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Erreur test connexion',
        details: error.message
      }
    }
  },

  // Obtenir les statistiques des utilisateurs
  async getStats() {
    try {
      const [activeResult, inactiveResult] = await Promise.all([
        this.getAll(),
        this.getDeactivatedUsers()
      ])

      const activeUsers = activeResult.users || []
      const inactiveUsers = inactiveResult.users || []

      return {
        total_active: activeUsers.length,
        total_inactive: inactiveUsers.length,
        total_all: activeUsers.length + inactiveUsers.length,
        by_role: {
          admin: activeUsers.filter(u => u.role === 'admin').length,
          employe_production: activeUsers.filter(u => u.role === 'employe_production').length,
          employe_boutique: activeUsers.filter(u => u.role === 'employe_boutique').length
        },
        password_changes_required: activeUsers.filter(u => 
          u.force_password_change === true || u.last_password_change === null
        ).length,
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getStats:', error)
      return {
        total_active: 0,
        total_inactive: 0,
        total_all: 0,
        by_role: { admin: 0, employe_production: 0, employe_boutique: 0 },
        password_changes_required: 0,
        error: error.message
      }
    }
  }
}
// ===================== UTILITAIRES =====================
export const utils = {
  // Formatage de la monnaie CFA
  formatCFA(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount || 0)
  },

  // Formatage de la date
  formatDate(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  // Formatage de la date et heure
  formatDateTime(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  // Calculer le pourcentage de stock restant
  calculateStockPercentage(quantiteRestante, quantiteInitiale) {
    if (quantiteInitiale === 0) return 0
    return Math.round((quantiteRestante / quantiteInitiale) * 100)
  },

  // Déterminer le niveau d'alerte stock
  getStockAlertLevel(quantiteRestante, quantiteInitiale) {
    const percentage = this.calculateStockPercentage(quantiteRestante, quantiteInitiale)
    if (percentage <= 0) return 'rupture'
    if (percentage <= 20) return 'critique'
    if (percentage <= 50) return 'faible'
    return 'normal'
  },

  // Formater un nombre avec séparateurs
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  }
}

export default supabase











































