// src/components/caisse/useCaisse.js
// Caisse au nom de la personne connectée, commune à la boutique et à la cuisine : ouverture avec le fond
// de caisse, clôture à l'aveugle (le montant attendu est calculé par la base : fond + ventes boutique et cuisine).
"use client";

import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { utils } from '../../utils/formatters';
import { useSaisie } from '../ui';

export function useCaisse(currentUser) {
  // Caisse ouverte au nom de la personne connectée (null = fermée, undefined = pas encore lue)
  const [caisse, setCaisse] = useState(undefined);
  const [clotureEnCours, setClotureEnCours] = useState(false);
  const [fenetreSaisie, demander] = useSaisie();

  const chargerCaisse = async () => {
    const { data, error } = await supabase
      .from('caisses_actives')
      .select('id, date_ouverture, fond_caisse_initial')
      .eq('caissier_id', currentUser.id)
      .eq('statut', 'ouverte')
      .maybeSingle();
    if (error) {
      console.error('Lecture de la caisse :', error);
      return;
    }
    setCaisse(data || null);
  };

  // Le fond de caisse est déclaré à l'ouverture : il entre dans le montant attendu à la clôture
  const ouvrirCaisse = async () => {
    const r = await demander({
      titre: 'Ouvrir la caisse',
      message: 'Comptez l\'argent présent dans la caisse avant la première vente (la monnaie de départ).',
      champs: [{ nom: 'fond', label: 'Fond de caisse (FCFA)', type: 'number', zero: true, placeholder: '0' }],
      confirmer: 'Ouvrir la caisse'
    });
    if (!r) return false;
    const { data, error } = await supabase.rpc('ouvrir_caisse', { p_fond: r.fond });
    if (error) {
      alert('Ouverture impossible : ' + error.message);
      return false;
    }
    setCaisse({ id: data.caisse_id, date_ouverture: data.ouverte_le, fond_caisse_initial: data.fond });
    return true;
  };

  // Clôture à l'aveugle : la personne compte l'argent sans connaître le montant attendu,
  // calculé par la base (fond + ventes de sa caisse). En cas d'écart elle recompte, ou confirme avec un motif.
  const effectuerCloture = async () => {
    if (clotureEnCours) return;
    setClotureEnCours(true);
    try {
      const premier = await demander({
        titre: 'Clôturer la caisse',
        message: 'Comptez tout l\'argent de la caisse, fond compris, puis indiquez le total.',
        champs: [{ nom: 'montant', label: 'Montant compté (FCFA)', type: 'number', zero: true }],
        confirmer: 'Valider le comptage'
      });
      if (!premier) return;
      let { data, error } = await supabase.rpc('cloturer_caisse', { p_montant: premier.montant });
      if (error) throw error;

      // Tant que le comptage ne correspond pas : on recompte (chaque comptage est gardé par la base),
      // ou l'on clôture avec un motif, et le propriétaire est informé
      while (data.statut === 'ecart') {
        const suite = await demander({
          titre: 'Le comptage ne correspond pas',
          message: `Le montant compté ne correspond pas aux ventes enregistrées (comptage n° ${data.comptages}).\n\n`
            + 'Recomptez l\'argent. Si l\'écart demeure, expliquez-le : la caisse sera clôturée avec cet écart '
            + 'et le propriétaire en sera informé.',
          champs: [
            { nom: 'montant', label: 'Nouveau comptage (FCFA)', type: 'number', zero: true },
            { nom: 'motif', label: 'Motif de l\'écart', placeholder: 'ex. : monnaie rendue en trop',
              aide: 'Laissez vide pour simplement recompter.' }
          ],
          confirmer: 'Valider',
          danger: true
        });
        if (!suite) {
          alert('La caisse reste ouverte. Les comptages sont notés ; vous pourrez recompter plus tard.');
          return;
        }
        const motif = suite.motif && suite.motif.length >= 3 ? suite.motif : null;
        ({ data, error } = await supabase.rpc('cloturer_caisse', motif
          ? { p_montant: suite.montant, p_confirmer: true, p_motif: motif }
          : { p_montant: suite.montant }));
        if (error) throw error;
      }

      const ecart = Number(data.ecart);
      setCaisse(null);
      alert(`Caisse clôturée.\n\n`
        + `Fond : ${utils.formatCFA(data.fond)}\n`
        + `Ventes : ${utils.formatCFA(data.total_ventes)} (${data.nombre_ventes} vente${data.nombre_ventes > 1 ? 's' : ''})\n`
        + `Attendu : ${utils.formatCFA(data.attendu)}\n`
        + `Compté : ${utils.formatCFA(data.compte)}\n`
        + (ecart === 0 ? 'Aucun écart ✓' : `Écart : ${ecart > 0 ? '+' : ''}${utils.formatCFA(ecart)} (${ecart > 0 ? 'excédent' : 'manque'}) — le propriétaire est informé.`));
    } catch (error) {
      console.error('Erreur clôture:', error);
      alert('Erreur lors de la clôture : ' + (error.message || error));
      chargerCaisse();
    } finally {
      setClotureEnCours(false);
    }
  };

  return { caisse, chargerCaisse, ouvrirCaisse, effectuerCloture, clotureEnCours, fenetreSaisie, demander };
}

export function BoutonsCaisse({ caisse, ouvrir, cloturer, clotureEnCours }) {
  return (
    <>
      {caisse ? (
        <button
          onClick={cloturer}
          disabled={clotureEnCours}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center disabled:opacity-60"
        >
          <Lock className="w-4 h-4 mr-2" />
          Clôturer
        </button>
      ) : caisse === null && (
        <button
          onClick={ouvrir}
          className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 flex items-center"
        >
          <LockOpen className="w-4 h-4 mr-2" />
          Ouvrir la caisse
        </button>
      )}
    </>
  );
}

export function BandeauCaisse({ caisse }) {
  if (caisse === undefined) return null;
  return (
    caisse ? (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-900 text-sm">
        Caisse ouverte depuis {new Date(caisse.date_ouverture).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        {new Date(caisse.date_ouverture).toDateString() !== new Date().toDateString() && ` le ${new Date(caisse.date_ouverture).toLocaleDateString('fr-FR')}`}
        {' · '}fond {utils.formatCFA(caisse.fond_caisse_initial)}
      </div>
    ) : (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-900 text-sm">
        Caisse fermée : elle s'ouvrira à la première vente, ou avec le bouton « Ouvrir la caisse ».
      </div>
    )
  );
}
