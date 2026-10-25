"use client";

import { useEffect, useState } from 'react';
import { Store, Settings } from 'lucide-react';
import { boulangerieService } from '../../services/boulangerieService';
import { useSaisie } from '../ui';

// En-tête : la boulangerie de la personne connectée ; pour la propriétaire, le choix de la boulangerie affichée
// (« Toutes » pour lire l'ensemble) et la modification des coordonnées imprimées sur le ticket.
export default function ChoixBoulangerie() {
  const [info, setInfo] = useState(null);
  const [fenetreSaisie, demander] = useSaisie();

  useEffect(() => {
    boulangerieService.charger().then(setInfo);
  }, []);

  if (!info) return null;

  const changer = async (valeur) => {
    const { error } = await boulangerieService.choisir(valeur === '' ? null : Number(valeur));
    if (error) {
      alert('Changement impossible : ' + error);
      return;
    }
    // Tous les écrans relisent leurs données pour la boulangerie choisie
    window.location.reload();
  };

  const coordonnees = async () => {
    const b = info.courante;
    const r = await demander({
      titre: `Coordonnées de ${b.nom}`,
      message: 'Elles sont imprimées en haut du ticket de caisse.',
      champs: [
        { nom: 'adresse', label: 'Adresse', valeur: b.adresse || '', placeholder: 'ex. Cocody, Abidjan' },
        { nom: 'telephones', label: 'Téléphones', valeur: b.telephones || '', placeholder: 'ex. 07 00 00 00 00' }
      ],
      confirmer: 'Enregistrer'
    });
    if (!r) return;
    const { error } = await boulangerieService.modifierCoordonnees(b.id, r.adresse, r.telephones);
    if (error) {
      alert('Enregistrement impossible : ' + error);
      return;
    }
    setInfo(await boulangerieService.charger());
  };

  if (!info.peut_choisir) {
    return info.courante ? (
      <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-900 rounded-full text-xs" title="Votre boulangerie">
        <Store className="w-3 h-3" />{info.courante.nom}
      </span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-1">
      <Store className="w-4 h-4 text-amber-700 hidden sm:block" />
      <select
        aria-label="Boulangerie affichée"
        value={info.toutes ? '' : String(info.courante?.id ?? '')}
        onChange={(e) => changer(e.target.value)}
        className={`text-sm border rounded-lg px-2 py-1 ${info.toutes ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
      >
        {(info.liste || []).map(b => <option key={b.id} value={String(b.id)}>{b.nom}</option>)}
        <option value="">Toutes (lecture seule)</option>
      </select>
      {!info.toutes && info.courante && (
        <button onClick={coordonnees} className="p-1 text-gray-500 hover:text-amber-700" title="Coordonnées du ticket" aria-label="Coordonnées du ticket">
          <Settings className="w-4 h-4" />
        </button>
      )}
      {fenetreSaisie}
    </div>
  );
}
