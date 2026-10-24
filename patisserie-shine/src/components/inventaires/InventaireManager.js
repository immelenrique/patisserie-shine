"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { ClipboardCheck, AlertTriangle, Trash2, Settings, RefreshCw } from 'lucide-react';
import { Card, useSaisie } from '../ui';
import { utils } from '../../utils/formatters';

const LIEUX = { principal: 'Stock principal', atelier: 'Atelier', boutique: 'Boutique' };
// Lieux que chaque rôle compte (même règle que la base, peut_compter)
const LIEUX_DU_ROLE = {
  admin: ['principal', 'atelier', 'boutique'],
  magasinier: ['principal'],
  employe_production: ['atelier'],
  employe_boutique: ['boutique']
};
const FREQUENCES = { aucune: 'Sur demande seulement', quotidienne: 'Chaque soir', hebdomadaire: 'Chaque semaine' };
const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const STATUTS_PERTE = { en_attente: 'En attente du propriétaire', acceptee: 'Acceptée', refusee: 'Refusée' };
const qte = (n) => (n === null || n === undefined ? '-' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n));

// Inventaires à l'aveugle : on compte sans voir la quantité attendue. Les produits qui ne correspondent pas
// sont désignés (sans quantité) pour être recomptés, puis expliqués. Pertes : déclarées ici, décidées par le propriétaire.
export default function InventaireManager({ currentUser }) {
  const lieux = LIEUX_DU_ROLE[currentUser.role] || [];
  const estAdmin = currentUser.role === 'admin';
  const estProprietaire = !!currentUser.is_super_admin;
  const [lieu, setLieu] = useState(lieux[0] || null);
  const [aFaire, setAFaire] = useState([]);
  const [reglages, setReglages] = useState([]);
  const [inventaire, setInventaire] = useState(null);
  const [saisies, setSaisies] = useState({});
  const envoyesRef = useRef({});
  const [aRecompter, setARecompter] = useState([]);
  const [motifRequis, setMotifRequis] = useState([]);
  const [motifs, setMotifs] = useState({});
  const [resultat, setResultat] = useState(null);
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const verrouRef = useRef(false);
  const [produitsPerte, setProduitsPerte] = useState([]);
  const [perte, setPerte] = useState({ produit_id: '', quantite: '', motif: '' });
  const clePerteRef = useRef(null);
  const [mesPertes, setMesPertes] = useState([]);
  const [modeChoisi, setModeChoisi] = useState('');
  const [fenetreSaisie, demander] = useSaisie();

  useEffect(() => {
    if (lieu) charger();
  }, [lieu]);

  const charger = async () => {
    setInventaire(null);
    setResultat(null);
    setMessage('');
    reinitialiserSaisie();
    const [rAFaire, rReglages, rProduits, rPertes] = await Promise.all([
      supabase.rpc('inventaires_a_faire'),
      supabase.from('inventaires_reglages').select('*').order('lieu'),
      supabase.rpc('produits_pour_perte', { p_lieu: lieu }),
      supabase.from('pertes').select('id, lieu, produit_nom, unite, quantite, motif, statut, declare_le, motif_refus')
        .eq('declare_par', currentUser.id).order('declare_le', { ascending: false }).limit(10)
    ]);
    for (const r of [rAFaire, rReglages, rProduits, rPertes]) if (r.error) console.warn('Inventaires :', r.error.message);
    setAFaire(rAFaire.data || []);
    setReglages(rReglages.data || []);
    setProduitsPerte(rProduits.data || []);
    setMesPertes(rPertes.data || []);
  };

  const reinitialiserSaisie = () => {
    setSaisies({});
    envoyesRef.current = {};
    setARecompter([]);
    setMotifRequis([]);
    setMotifs({});
  };

  const etat = aFaire.find(a => a.lieu === lieu);
  const reglage = reglages.find(r => r.lieu === lieu);

  const ouvrir = async () => {
    if (verrouRef.current) return;
    verrouRef.current = true;
    setEnCours(true);
    const { data, error } = await supabase.rpc('inventaire_ouvrir', { p_lieu: lieu, p_mode: estAdmin && modeChoisi ? modeChoisi : null });
    verrouRef.current = false;
    setEnCours(false);
    if (error) return alert('Inventaire impossible : ' + error.message);
    reinitialiserSaisie();
    // Les comptages déjà faits (reprise) sont repris tels quels, sans les quantités attendues
    const deja = {};
    for (const l of data.lignes) if (l.compte !== null) deja[l.produit_id] = String(l.compte);
    setSaisies(deja);
    envoyesRef.current = { ...deja };
    setInventaire(data);
    setResultat(null);
    setMessage('');
  };

  // N'envoie que les comptages nouveaux ou changés : chaque envoi est un comptage gardé par la base
  const enregistrer = async () => {
    const lignes = Object.entries(saisies)
      .filter(([id, v]) => String(v).trim() !== '' && envoyesRef.current[id] !== String(v).trim())
      .map(([id, v]) => ({ produit_id: Number(id), quantite: Number(String(v).replace(',', '.')) }));
    if (lignes.some(l => Number.isNaN(l.quantite) || l.quantite < 0)) {
      alert('Une quantité comptée est invalide.');
      return false;
    }
    if (lignes.length === 0) return true;
    const { error } = await supabase.rpc('inventaire_compter', { p_inventaire_id: inventaire.inventaire_id, p_lignes: lignes });
    if (error) {
      alert('Comptage non enregistré : ' + error.message);
      return false;
    }
    for (const l of lignes) envoyesRef.current[l.produit_id] = String(saisies[l.produit_id]).trim();
    return true;
  };

  const sauvegarder = async () => {
    if (verrouRef.current) return;
    verrouRef.current = true;
    setEnCours(true);
    const ok = await enregistrer();
    verrouRef.current = false;
    setEnCours(false);
    if (ok) setMessage('Comptages enregistrés. Vous pouvez continuer plus tard.');
  };

  const terminer = async () => {
    if (verrouRef.current) return;
    const manquants = inventaire.lignes.filter(l => String(saisies[l.produit_id] ?? '').trim() === '');
    if (manquants.length > 0) {
      alert(`${manquants.length} produit(s) pas encore compté(s) : ${manquants.slice(0, 5).map(l => l.nom).join(', ')}${manquants.length > 5 ? '…' : ''}`);
      return;
    }
    const sansMotif = motifRequis.filter(id => (motifs[id] || '').trim().length < 3);
    if (sansMotif.length > 0) {
      alert('Indiquez la raison de l\'écart pour chaque produit signalé (3 caractères au moins).');
      return;
    }
    verrouRef.current = true;
    setEnCours(true);
    try {
      if (!(await enregistrer())) return;
      const p_motifs = motifRequis.length ? Object.fromEntries(motifRequis.map(id => [String(id), motifs[id].trim()])) : null;
      const { data, error } = await supabase.rpc('inventaire_cloturer', { p_inventaire_id: inventaire.inventaire_id, p_motifs });
      if (error) return alert('Fin de l\'inventaire impossible : ' + error.message);
      if (data.statut === 'a_recompter' || data.statut === 'motif_requis') {
        const recompter = (data.a_recompter || []).map(x => x.produit_id);
        const expliquer = (data.motif_requis || []).map(x => x.produit_id);
        // Les produits à recompter sont vidés : on retape ce qu'on trouve au nouveau comptage
        setSaisies(s => { const n = { ...s }; for (const id of recompter) delete n[id]; return n; });
        for (const id of recompter) delete envoyesRef.current[id];
        setARecompter(recompter);
        setMotifRequis(expliquer);
        setMessage(recompter.length
          ? `${recompter.length} produit(s) ne correspondent pas : recomptez-les (ils sont signalés en orange), puis terminez à nouveau.`
          : `Après recomptage, ${expliquer.length} produit(s) ne correspondent toujours pas : indiquez la raison de chaque écart.`);
        return;
      }
      setResultat(data);
      setInventaire(null);
      reinitialiserSaisie();
      setMessage('');
      charger().then(() => setResultat(data));
    } finally {
      verrouRef.current = false;
      setEnCours(false);
    }
  };

  const annuler = async () => {
    const r = await demander({
      titre: 'Annuler l\'inventaire', message: 'Le stock n\'est pas modifié. Les comptages déjà faits sont gardés dans l\'historique.',
      champs: [{ nom: 'motif', label: 'Motif de l\'annulation', obligatoire: true }], confirmer: 'Annuler l\'inventaire', danger: true
    });
    if (!r) return;
    const { error } = await supabase.rpc('inventaire_annuler', { p_inventaire_id: inventaire.inventaire_id, p_motif: r.motif });
    if (error) return alert('Annulation impossible : ' + error.message);
    charger();
  };

  const declarerPerte = async (e) => {
    e.preventDefault();
    if (verrouRef.current) return;
    const quantite = Number(String(perte.quantite).replace(',', '.'));
    if (!perte.produit_id || !(quantite > 0) || perte.motif.trim().length < 3) {
      alert('Choisissez le produit, la quantité perdue et le motif (3 caractères au moins).');
      return;
    }
    if (!clePerteRef.current) clePerteRef.current = utils.genererCle();
    verrouRef.current = true;
    setEnCours(true);
    const { error } = await supabase.rpc('declarer_perte', {
      p_lieu: lieu, p_produit_id: Number(perte.produit_id), p_quantite: quantite, p_motif: perte.motif.trim(), p_cle: clePerteRef.current
    });
    verrouRef.current = false;
    setEnCours(false);
    if (error) return alert('Perte non enregistrée : ' + error.message);
    clePerteRef.current = null;
    setPerte({ produit_id: '', quantite: '', motif: '' });
    alert('Perte déclarée. Le stock baissera quand le propriétaire l\'aura acceptée.');
    charger();
  };

  const regler = async (r, champ, valeur) => {
    const n = { ...r, [champ]: valeur };
    const { error } = await supabase.rpc('regler_inventaires', {
      p_lieu: n.lieu, p_mode: n.mode, p_nombre: Number(n.nombre), p_frequence: n.frequence, p_jour: Number(n.jour)
    });
    if (error) return alert('Réglage non enregistré : ' + error.message);
    charger();
  };

  if (lieux.length === 0) {
    return <Card className="p-6" hover={false}>Les inventaires concernent le stock principal, l'atelier et la boutique.</Card>;
  }

  const libelleRythme = (r) => r ? `${FREQUENCES[r.frequence]}${r.frequence === 'hebdomadaire' ? ` (le ${JOURS[r.jour]})` : ''} · ${r.mode === 'tirage' ? `${r.nombre} produits tirés au hasard` : 'tous les produits'}` : '';

  return (
    <div className="space-y-6">
      {fenetreSaisie}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center"><ClipboardCheck className="h-7 w-7 mr-2 text-orange-600" />Inventaires</h2>
          <p className="text-gray-600">Comptez ce qui est réellement là : la quantité attendue n'est jamais affichée avant la fin.</p>
        </div>
        <button onClick={charger} className="self-start px-4 min-h-[44px] rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center">
          <RefreshCw className="h-4 w-4 mr-2" />Actualiser
        </button>
      </div>

      {lieux.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lieu">
          {lieux.map(l => (
            <button key={l} role="tab" aria-selected={lieu === l} onClick={() => setLieu(l)}
              className={`px-4 min-h-[44px] rounded-lg font-medium ${lieu === l ? 'bg-orange-700 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}>
              {LIEUX[l]}{aFaire.find(a => a.lieu === l && a.attendu) ? ' •' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Résultat du dernier inventaire terminé */}
      {resultat && (
        <Card className="p-4 border-2 border-green-700" hover={false}>
          <h3 className="font-semibold text-green-800">Inventaire terminé : {resultat.nb_produits} produit(s) compté(s), {resultat.nb_ecarts} écart(s)
            {resultat.nb_ecarts > 0 && ` (${utils.formatCFA(resultat.valeur_ecarts)})`}</h3>
          {resultat.nb_ecarts > 0 && (
            <ul className="mt-2 text-sm space-y-1">
              {resultat.ecarts.map(e => (
                <li key={e.produit_id}>{e.nom} : attendu {qte(e.attendu)}, compté {qte(e.compte)} {e.unite || ''}
                  (<b>{e.ecart > 0 ? '+' : ''}{qte(e.ecart)}</b>, {utils.formatCFA(e.valeur)}) — « {e.motif} »</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-gray-600 mt-2">Le stock a été mis au compté. {resultat.nb_ecarts > 0 ? 'Le propriétaire et les gérants sont prévenus.' : ''}</p>
        </Card>
      )}

      {/* Inventaire : démarrer ou compter */}
      <Card hover={false}>
        <div className="p-4 border-b">
          <h3 className="font-semibold">{LIEUX[lieu]}</h3>
          <p className="text-sm text-gray-600">Rythme : {libelleRythme(reglage)}
            {etat?.attendu && <span className="ml-2 font-semibold text-orange-800">· Inventaire à faire</span>}
            {etat?.dernier && <span className="ml-2">· Dernier : {utils.formatDateTime(etat.dernier)}</span>}</p>
        </div>
        {!inventaire ? (
          <div className="p-4 flex flex-wrap items-center gap-3">
            {estAdmin && !etat?.en_cours_id && (
              <label className="text-sm">Contenu
                <select value={modeChoisi} onChange={(e) => setModeChoisi(e.target.value)} className="ml-2 border border-gray-300 rounded-lg px-2 min-h-[44px]">
                  <option value="">Selon le réglage</option>
                  <option value="tirage">Tirage au hasard</option>
                  <option value="complet">Tous les produits</option>
                </select>
              </label>
            )}
            <button onClick={ouvrir} disabled={enCours} className="bg-orange-700 hover:bg-orange-800 text-white px-5 min-h-[44px] rounded-lg font-medium disabled:opacity-50">
              {etat?.en_cours_id ? `Reprendre l'inventaire n°${etat.en_cours_id}` : 'Commencer l\'inventaire'}
            </button>
          </div>
        ) : (
          <div>
            <div className="p-4 text-sm text-gray-700 flex flex-wrap justify-between gap-2">
              <span>Inventaire n°{inventaire.inventaire_id} · {inventaire.mode === 'tirage' ? 'produits tirés au hasard' : 'tous les produits'} · ouvert par {inventaire.ouvert_par}</span>
              {estAdmin && <button onClick={annuler} className="text-red-700 underline min-h-[32px]">Annuler l'inventaire</button>}
            </div>
            {message && <p role="status" className="mx-4 mb-3 bg-orange-50 border border-orange-200 text-orange-900 rounded-lg px-3 py-2 text-sm">{message}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr><th className="px-4 py-2 text-left">Produit</th><th className="px-4 py-2 text-left">Unité</th><th className="px-4 py-2 text-left">Compté</th></tr>
                </thead>
                <tbody className="divide-y">
                  {inventaire.lignes.map(l => {
                    const recompter = aRecompter.includes(l.produit_id);
                    const expliquer = motifRequis.includes(l.produit_id);
                    return (
                      <tr key={l.produit_id} className={recompter ? 'bg-orange-50' : expliquer ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 font-medium">{l.nom}{recompter && <span className="ml-2 text-xs font-semibold text-orange-800">à recompter</span>}</td>
                        <td className="px-4 py-2">{l.unite || '-'}</td>
                        <td className="px-4 py-2 space-y-2">
                          <input type="number" inputMode="decimal" min="0" step="any" aria-label={`Compté : ${l.nom}`}
                            value={saisies[l.produit_id] ?? ''} onChange={(e) => setSaisies(s => ({ ...s, [l.produit_id]: e.target.value }))}
                            className="w-32 border border-gray-300 rounded-lg px-3 min-h-[44px]" />
                          {expliquer && (
                            <input type="text" aria-label={`Raison de l'écart : ${l.nom}`} placeholder="Raison de l'écart"
                              value={motifs[l.produit_id] || ''} onChange={(e) => setMotifs(m => ({ ...m, [l.produit_id]: e.target.value }))}
                              className="block w-full min-w-[14rem] border border-red-300 rounded-lg px-3 min-h-[44px]" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex flex-wrap gap-3 justify-end">
              <button onClick={sauvegarder} disabled={enCours} className="px-4 min-h-[44px] rounded-lg border border-orange-700 text-orange-800 bg-white hover:bg-orange-50 disabled:opacity-50">Enregistrer</button>
              <button onClick={terminer} disabled={enCours} className="px-5 min-h-[44px] rounded-lg bg-orange-700 hover:bg-orange-800 text-white font-medium disabled:opacity-50">Terminer l'inventaire</button>
            </div>
          </div>
        )}
      </Card>

      {/* Pertes */}
      <Card hover={false}>
        <div className="p-4 border-b"><h3 className="font-semibold flex items-center"><Trash2 className="h-5 w-5 mr-2 text-orange-600" />Déclarer une perte ({LIEUX[lieu]})</h3>
          <p className="text-sm text-gray-600">Casse, périmé, raté… Le stock baisse quand le propriétaire a accepté la perte.</p></div>
        <form onSubmit={declarerPerte} className="p-4 grid gap-3 md:grid-cols-4 md:items-end">
          <label className="text-sm md:col-span-1">Produit
            <select value={perte.produit_id} onChange={(e) => { clePerteRef.current = null; setPerte(p => ({ ...p, produit_id: e.target.value })); }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-2 min-h-[44px]">
              <option value="">Choisir…</option>
              {produitsPerte.map(p => <option key={p.produit_id} value={p.produit_id}>{p.nom}{p.unite ? ` (${p.unite})` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm">Quantité perdue
            <input type="number" inputMode="decimal" min="0" step="any" value={perte.quantite}
              onChange={(e) => { clePerteRef.current = null; setPerte(p => ({ ...p, quantite: e.target.value })); }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 min-h-[44px]" />
          </label>
          <label className="text-sm">Motif
            <input type="text" value={perte.motif} placeholder="ex. : sac tombé et déchiré"
              onChange={(e) => { clePerteRef.current = null; setPerte(p => ({ ...p, motif: e.target.value })); }}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 min-h-[44px]" />
          </label>
          <button type="submit" disabled={enCours} className="bg-orange-700 hover:bg-orange-800 text-white px-4 min-h-[44px] rounded-lg font-medium disabled:opacity-50">Déclarer la perte</button>
        </form>
        {mesPertes.length > 0 && (
          <div className="px-4 pb-4">
            <h4 className="text-sm font-medium mb-2">Mes pertes déclarées</h4>
            <ul className="divide-y text-sm">
              {mesPertes.map(p => (
                <li key={p.id} className="py-2 flex flex-wrap justify-between gap-2">
                  <span>{utils.formatDateTime(p.declare_le)} — {LIEUX[p.lieu]} : {p.produit_nom} {qte(p.quantite)} {p.unite || ''} « {p.motif} »</span>
                  <span className={`font-medium ${p.statut === 'refusee' ? 'text-red-700' : p.statut === 'acceptee' ? 'text-green-700' : 'text-orange-800'}`}>
                    {STATUTS_PERTE[p.statut]}{p.motif_refus ? ` : ${p.motif_refus}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Rythme des inventaires (propriétaire) */}
      {estProprietaire && (
        <Card hover={false}>
          <div className="p-4 border-b"><h3 className="font-semibold flex items-center"><Settings className="h-5 w-5 mr-2 text-orange-600" />Rythme des inventaires</h3>
            <p className="text-sm text-gray-600">Au jour prévu, l'inventaire apparaît dans « À faire » des personnes du lieu ; un inventaire manqué est signalé dans le récapitulatif.</p></div>
          <div className="divide-y">
            {reglages.map(r => (
              <div key={r.lieu} className="p-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium w-32">{LIEUX[r.lieu]}</span>
                <select aria-label={`Fréquence : ${LIEUX[r.lieu]}`} value={r.frequence} onChange={(e) => regler(r, 'frequence', e.target.value)} className="border border-gray-300 rounded-lg px-2 min-h-[44px]">
                  {Object.entries(FREQUENCES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                {r.frequence === 'hebdomadaire' && (
                  <select aria-label={`Jour : ${LIEUX[r.lieu]}`} value={r.jour} onChange={(e) => regler(r, 'jour', e.target.value)} className="border border-gray-300 rounded-lg px-2 min-h-[44px]">
                    {JOURS.slice(1).map((j, i) => <option key={j} value={i + 1}>le {j}</option>)}
                  </select>
                )}
                <select aria-label={`Contenu : ${LIEUX[r.lieu]}`} value={r.mode} onChange={(e) => regler(r, 'mode', e.target.value)} className="border border-gray-300 rounded-lg px-2 min-h-[44px]">
                  <option value="tirage">Tirage au hasard</option>
                  <option value="complet">Tous les produits</option>
                </select>
                {r.mode === 'tirage' && (
                  <label className="flex items-center gap-2">de
                    <input type="number" min="1" max="200" defaultValue={r.nombre} aria-label={`Nombre de produits : ${LIEUX[r.lieu]}`}
                      onBlur={(e) => Number(e.target.value) !== r.nombre && regler(r, 'nombre', e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 min-h-[44px]" />produits
                  </label>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!inventaire && etat?.attendu === false && !resultat && (
        <p className="text-sm text-gray-500 flex items-center"><AlertTriangle className="h-4 w-4 mr-1" />Aucun inventaire attendu aujourd'hui pour ce lieu ; vous pouvez en faire un quand vous voulez.</p>
      )}
    </div>
  );
}
