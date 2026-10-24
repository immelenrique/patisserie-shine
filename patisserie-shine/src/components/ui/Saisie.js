"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Modal } from './Modal';

// Fenêtre de saisie de l'application, à la place de prompt()/confirm() du navigateur :
// même aspect partout, le contexte reste visible, les champs obligatoires sont vérifiés avant de fermer.
//
//   const [fenetreSaisie, demander] = useSaisie();
//   const r = await demander({ titre, message, champs: [{ nom: 'motif', label: 'Motif', obligatoire: true }] });
//   if (!r) return;          // annulé
//   r.motif                  // texte saisi, sans espaces autour
//
// Sans champs, la fenêtre sert de confirmation : elle renvoie {} ou null.
export function useSaisie() {
  const [demande, setDemande] = useState(null);
  const resolveRef = useRef(null);

  const demander = useCallback((options) => new Promise((resolve) => {
    resolveRef.current?.(null);
    resolveRef.current = resolve;
    setDemande(options);
  }), []);

  const fermer = (valeur) => {
    resolveRef.current?.(valeur);
    resolveRef.current = null;
    setDemande(null);
  };

  const fenetre = demande ? <FenetreSaisie {...demande} onValider={fermer} onAnnuler={() => fermer(null)} /> : null;
  return [fenetre, demander];
}

function FenetreSaisie({ titre, message, details, champs = [], confirmer = 'Confirmer', danger = false, onValider, onAnnuler }) {
  const [valeurs, setValeurs] = useState(() => Object.fromEntries(champs.map(c => [c.nom, c.valeur ?? ''])));
  const [erreur, setErreur] = useState('');
  const premierRef = useRef(null);

  useEffect(() => {
    premierRef.current?.focus();
  }, []);

  const valider = (e) => {
    e.preventDefault();
    const resultat = {};
    for (const c of champs) {
      const v = String(valeurs[c.nom] ?? '').trim();
      if (c.type === 'number') {
        const n = parseFloat(v.replace(',', '.'));
        if (Number.isNaN(n) || v === '') return setErreur(`${c.label} : indiquez un nombre.`);
        // zero: true accepte 0 (fond de caisse vide, caisse vide)
        if (c.zero ? n < 0 : n <= 0) return setErreur(`${c.label} : indiquez un nombre ${c.zero ? 'positif ou nul' : 'supérieur à 0'}.`);
        if (c.max !== undefined && n > c.max) return setErreur(`${c.label} : ${c.max} au maximum.`);
        resultat[c.nom] = n;
      } else {
        if (c.obligatoire && v.length < 3) return setErreur(`${c.label} : obligatoire (3 caractères au moins).`);
        resultat[c.nom] = v;
      }
    }
    onValider(resultat);
  };

  return (
    <Modal isOpen onClose={onAnnuler} title={titre} size="sm">
      <form onSubmit={valider} className="space-y-4">
        {message && <p className="text-gray-700 whitespace-pre-line">{message}</p>}
        {details && details.length > 0 && (
          <ul className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-1">
            {details.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        )}
        {champs.map((c, i) => (
          <div key={c.nom}>
            <label htmlFor={`saisie-${c.nom}`} className="block text-sm font-medium text-gray-700 mb-1">
              {c.label}{c.obligatoire || c.type === 'number' ? ' *' : ' (facultatif)'}
            </label>
            <input
              id={`saisie-${c.nom}`}
              ref={i === 0 ? premierRef : undefined}
              type={c.type === 'number' ? 'number' : 'text'}
              inputMode={c.type === 'number' ? 'decimal' : undefined}
              step={c.type === 'number' ? 'any' : undefined}
              min={c.type === 'number' ? '0' : undefined}
              max={c.max}
              placeholder={c.placeholder || ''}
              value={valeurs[c.nom]}
              onChange={(e) => { setErreur(''); setValeurs(v => ({ ...v, [c.nom]: e.target.value })); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {c.aide && <p className="text-xs text-gray-500 mt-1">{c.aide}</p>}
          </div>
        ))}
        {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onAnnuler} className="px-4 min-h-[44px] rounded-lg border border-gray-300 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" ref={champs.length === 0 ? premierRef : undefined}
            className={`px-4 min-h-[44px] rounded-lg text-white font-medium ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-orange-700 hover:bg-orange-800'}`}>
            {confirmer}
          </button>
        </div>
      </form>
    </Modal>
  );
}
