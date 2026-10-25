"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { utils } from '../../utils/formatters';
import { Plus, ChefHat, AlertTriangle, Info, Truck } from 'lucide-react';
import { Card, Modal } from '../ui';

const qte = (n) => (n === null || n === undefined ? '-' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n));
const FORMULAIRE_VIDE = { recette: '', fournees: '1', quantite: '', envoyer: true };

// Production de l'atelier par recette : les matières de la recette (fournées × quantités) sortent du stock atelier,
// le produit fini y entre, puis part à la boutique par un envoi compté à l'arrivée. Une quantité obtenue hors de la
// marge de la recette est signalée au propriétaire. Tout est calculé et enregistré par la base (declarer_production).
export default function ProductionManager({ currentUser }) {
  const peutProduire = ['admin', 'employe_production'].includes(currentUser.role);
  const [fiches, setFiches] = useState([]);
  const [sansFiche, setSansFiche] = useState([]);
  const [lignes, setLignes] = useState({});
  const [stockAtelier, setStockAtelier] = useState({});
  const [productions, setProductions] = useState([]);
  const [noms, setNoms] = useState({});
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [enCours, setEnCours] = useState(false);
  const verrouRef = useRef(false);
  const cleRef = useRef(null);

  useEffect(() => { charger(); }, []);
  // Toute modification du formulaire est une nouvelle production (nouvelle clé anti-doublon)
  useEffect(() => { cleRef.current = null; }, [form]);

  const charger = async () => {
    setLoading(true);
    const [rFiches, rRecettes, rStock, rProd] = await Promise.all([
      supabase.from('recettes_fiches').select('*').order('nom_produit'),
      supabase.from('recettes').select('nom_produit, produit_ingredient_id, quantite_necessaire, produit:produits!recettes_produit_ingredient_id_fkey(nom, unite:unites(label))'),
      supabase.from('stock_atelier').select('produit_id, quantite_disponible'),
      supabase.from('productions').select('*').order('created_at', { ascending: false }).limit(30)
    ]);
    const err = [rFiches, rRecettes, rStock, rProd].find(r => r.error);
    if (err) setErreur('Chargement impossible : ' + err.error.message);
    const parRecette = {};
    for (const r of rRecettes.data || []) (parRecette[r.nom_produit] = parRecette[r.nom_produit] || []).push(r);
    const avecFiche = (rFiches.data || []).filter(f => parRecette[f.nom_produit]);
    setFiches(avecFiche);
    setSansFiche(Object.keys(parRecette).filter(n => !avecFiche.some(f => f.nom_produit === n)).sort());
    setLignes(parRecette);
    setStockAtelier(Object.fromEntries((rStock.data || []).map(s => [s.produit_id, Number(s.quantite_disponible)])));
    setProductions(rProd.data || []);
    // Les productions n'ont pas de lien direct vers les profils : les noms sont lus à part
    const ids = [...new Set((rProd.data || []).map(p => p.producteur_id).filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase.from('profiles').select('id, nom, username').in('id', ids);
      setNoms(Object.fromEntries((data || []).map(p => [p.id, p.nom || p.username])));
    }
    setLoading(false);
  };

  const fiche = fiches.find(f => f.nom_produit === form.recette);
  const fournees = parseFloat(String(form.fournees).replace(',', '.')) || 0;
  const besoins = (lignes[form.recette] || []).map(l => {
    const besoin = Number(l.quantite_necessaire) * fournees;
    const stock = stockAtelier[l.produit_ingredient_id] ?? 0;
    return { nom: l.produit?.nom || '?', unite: l.produit?.unite?.label || '', besoin, stock, manque: Math.max(0, besoin - Math.max(stock, 0)) };
  });
  const attendu = fiche ? { mini: fournees * (fiche.rendement - fiche.marge_moins), maxi: fournees * (Number(fiche.rendement) + Number(fiche.marge_plus)), centre: fournees * fiche.rendement } : null;

  const enregistrer = async (e) => {
    e.preventDefault();
    if (verrouRef.current) return;
    const quantite = parseFloat(String(form.quantite).replace(',', '.'));
    if (!fiche || !(fournees > 0) || !(quantite > 0)) {
      alert('Choisissez la recette, le nombre de fournées et la quantité réellement obtenue.');
      return;
    }
    if (!cleRef.current) cleRef.current = utils.genererCle();
    verrouRef.current = true;
    setEnCours(true);
    const { data, error } = await supabase.rpc('declarer_production', {
      p_recette: form.recette, p_fournees: fournees, p_quantite: quantite, p_envoyer: form.envoyer, p_cle: cleRef.current
    });
    verrouRef.current = false;
    setEnCours(false);
    if (error) return alert('Production non enregistrée : ' + error.message);
    if (data.deja_enregistre) {
      alert('Cette production était déjà enregistrée.');
    } else {
      const manques = (data.matieres || []).filter(m => Number(m.manque) > 0);
      alert(`Production n°${data.production_id} enregistrée : ${qte(data.quantite)} « ${data.produit} ».`
        + `\n\nMatières retirées du stock atelier :\n` + (data.matieres || []).map(m => `• ${m.produit} : ${qte(m.retire)} ${m.unite || ''}`).join('\n')
        + (manques.length ? `\n\nPas assez au stock enregistré (noté, sans blocage) :\n` + manques.map(m => `• ${m.produit} : ${qte(m.manque)} ${m.unite || ''}`).join('\n') : '')
        + (data.hors_marge ? `\n\nQuantité hors de la marge de la recette (${qte(data.min)} à ${qte(data.max)}) : le propriétaire est prévenu.` : '')
        + (data.envoi_id ? `\n\nEnvoi n°${data.envoi_id} vers la boutique : elle comptera à l'arrivée.` : `\n\nLe produit est au stock atelier ; envoyez-le depuis « Stock Atelier ».`));
    }
    setOuvert(false);
    setForm(FORMULAIRE_VIDE);
    charger();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center"><ChefHat className="w-8 h-8 text-orange-600 mr-3" />Production de l'atelier</h1>
          <p className="text-gray-600">Les matières de la recette sortent du stock atelier ; le produit fini part à la boutique, qui le compte à l'arrivée.</p>
        </div>
        {peutProduire && (
          <button onClick={() => { setForm(FORMULAIRE_VIDE); setOuvert(true); }} disabled={fiches.length === 0}
            className="self-start bg-orange-700 hover:bg-orange-800 text-white px-5 min-h-[44px] rounded-lg font-medium flex items-center disabled:opacity-50">
            <Plus className="w-4 h-4 mr-2" />Nouvelle production
          </button>
        )}
      </div>

      {erreur && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{erreur}</div>}

      {sansFiche.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 shrink-0" />
          <span>Recette(s) sans rendement, donc pas encore utilisables : {sansFiche.join(', ')}.
            Le propriétaire ou un gérant indique dans « Recettes » combien chacune donne par fournée et la marge acceptée.</span>
        </div>
      )}

      <Card hover={false}>
        <div className="p-4 border-b"><h3 className="font-semibold">Dernières productions</h3></div>
        {productions.length === 0 ? <p className="p-4 text-gray-500">Aucune production enregistrée.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Date', 'Recette', 'Fournées', 'Obtenu', 'Attendu', 'Coût des matières', 'Envoi', 'Par'].map(t => <th key={t} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{t}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {productions.map(p => (
                  <tr key={p.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{utils.formatDateTime(p.created_at)}</td>
                    <td className="px-3 py-2">{p.recette || p.produit}{p.recette && p.produit !== p.recette ? ` → ${p.produit}` : ''}</td>
                    <td className="px-3 py-2">{p.fournees ?? '-'}</td>
                    <td className="px-3 py-2 font-medium">{qte(p.quantite)}</td>
                    <td className="px-3 py-2">{p.quantite_attendue === null || p.quantite_attendue === undefined ? '-' : (
                      <span className={p.hors_marge ? 'text-red-700 font-semibold' : ''}>{qte(p.quantite_min)} à {qte(p.quantite_max)}{p.hors_marge ? ' (hors marge)' : ''}</span>)}</td>
                    <td className="px-3 py-2">{utils.formatCFA(p.cout_ingredients || 0)}</td>
                    <td className="px-3 py-2">{p.envoi_id ? `n°${p.envoi_id}` : '-'}</td>
                    <td className="px-3 py-2">{noms[p.producteur_id] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={ouvert} onClose={() => setOuvert(false)} title="Nouvelle production" size="lg">
        <form onSubmit={enregistrer} className="space-y-4">
          <label className="block text-sm font-medium">Recette
            <select value={form.recette} onChange={(e) => setForm(f => ({ ...f, recette: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 min-h-[44px]">
              <option value="">Choisir…</option>
              {fiches.map(f => <option key={f.nom_produit} value={f.nom_produit}>{f.nom_produit} → {f.produit_fini}</option>)}
            </select>
          </label>
          {fiche && (
            <p className="text-sm text-gray-700 flex items-start"><Info className="w-4 h-4 mr-1 mt-0.5 shrink-0" />
              Une fournée donne environ {qte(fiche.rendement)} « {fiche.produit_fini} » (de {qte(fiche.rendement - fiche.marge_moins)} à {qte(Number(fiche.rendement) + Number(fiche.marge_plus))}).</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Nombre de fournées
              <input type="number" min="0" step="any" inputMode="decimal" value={form.fournees} onChange={(e) => setForm(f => ({ ...f, fournees: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 min-h-[44px]" />
            </label>
            <label className="text-sm font-medium">Quantité obtenue
              <input type="number" min="0" step="any" inputMode="decimal" value={form.quantite} onChange={(e) => setForm(f => ({ ...f, quantite: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 min-h-[44px]" placeholder={attendu ? `environ ${qte(attendu.centre)}` : ''} />
            </label>
          </div>
          {fiche && besoins.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Matière</th><th className="px-3 py-2 text-left">Retirée de l'atelier</th><th className="px-3 py-2 text-left">Stock atelier enregistré</th></tr></thead>
                <tbody className="divide-y">
                  {besoins.map(b => (
                    <tr key={b.nom} className={b.manque > 0 ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2">{b.nom}</td>
                      <td className="px-3 py-2">{qte(b.besoin)} {b.unite}</td>
                      <td className="px-3 py-2">{qte(b.stock)} {b.unite}{b.manque > 0 && <span className="ml-2 text-amber-900 text-xs font-semibold">manque {qte(b.manque)} (noté, sans blocage)</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {attendu && Number(form.quantite) > 0 && (Number(form.quantite) < attendu.mini || Number(form.quantite) > attendu.maxi) && (
            <p role="status" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Hors de la marge de la recette ({qte(attendu.mini)} à {qte(attendu.maxi)}) : la production sera enregistrée et le propriétaire prévenu.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input type="checkbox" checked={form.envoyer} onChange={(e) => setForm(f => ({ ...f, envoyer: e.target.checked }))} className="w-5 h-5" />
            <Truck className="w-4 h-4" />Envoyer tout à la boutique maintenant (elle comptera à l'arrivée)
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setOuvert(false)} className="px-4 min-h-[44px] rounded-lg border border-gray-300 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={enCours || !fiche} className="px-5 min-h-[44px] rounded-lg bg-orange-700 hover:bg-orange-800 text-white font-medium disabled:opacity-50">
              {enCours ? 'Enregistrement…' : 'Enregistrer la production'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
