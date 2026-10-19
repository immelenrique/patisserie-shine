"use client";

import { useRef } from 'react';
import { Camera, FileText, X } from 'lucide-react';

// Photo (ou PDF) du reçu d'achat. Sur téléphone, le bouton ouvre directement l'appareil photo.
export default function ChampRecu({ fichier, onChange, id = 'recu-achat' }) {
  const inputRef = useRef(null);
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">Reçu d'achat (photo ou PDF)</label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={(e) => { onChange(e.target.files?.[0] || null); e.target.value = ''; }}
      />
      {fichier ? (
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-gray-800 min-w-0">
            {fichier.type === 'application/pdf' ? <FileText className="h-4 w-4 shrink-0" /> : <Camera className="h-4 w-4 shrink-0" />}
            <span className="truncate">{fichier.name}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} aria-label="Retirer le reçu"
            className="p-2 rounded-lg hover:bg-gray-200 min-h-[40px] min-w-[40px] flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full min-h-[44px] rounded-lg border border-orange-700 text-orange-800 bg-white hover:bg-orange-50 flex items-center justify-center gap-2 font-medium">
          <Camera className="h-5 w-5" />Prendre le reçu en photo
        </button>
      )}
      <p className="text-xs text-gray-600 mt-2">Facultatif, mais un achat sans reçu est signalé au propriétaire.</p>
    </div>
  );
}
