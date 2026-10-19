"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Truck, PackageCheck, AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import { Card, Modal } from '../ui';

const LIEUX = { principal: 'Stock principal', atelier: 'Atelier', boutique: 'Boutique' };

// Réception des envois : la personne compte ce qui est arrivé sans voir la quantité annoncée.
// S'il y a un écart, la base le signale ; on recompte ou on indique un motif, puis on confirme.
// Le stock de destination n'est crédité qu'à ce moment, de la quantité réellement comptée.
export default function ReceptionsManager({ currentUser }) {
  const [enTransit, setEnTransit] = useState([]);
  const [recents, setRecents] = useState([]);
  const [noms, setNoms] = useState({});
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [envoiOuvert, setEnvoiOuvert] = useState(null);
  const [comptes, setComptes] = useState({});
  const [ecarts, setEcarts] = useState(null);
  const [motifs, setMotifs] = useState({});
  const [enregistrement, setEnregistrement] = useState(false);
  const enregistrementRef = useRef(false);

  const estAdmin = currentUser.role === 'admin';

  useEffect(() => {
    charger();
  }, [currentUser]);

  const charger = async () => {
    setLoading(true);
    try {
      // La base ne renvoie que les envois qui concernent le rôle de l'utilisateur
      const { data, error } = await supabase
        .from('envois')
        .select('*, lignes:envoi_lignes(*)')
        .order('cree_le', { ascending: false })
        .limit(100);
      if (error) throw error;

      // Produits toujours dans le même ordre (alphabétique) à l'écran
      const envois = (data || []).map(e => ({ ...e, lignes: [...(e.lignes || [])].sort((a, b) => (a.produit_nom || '').localeCompare(b.produit_nom || '')) }));
      setEnTransit(envois.filter(e => e.statut === 'en_transit'));
      setRecents(envois.filter(e => e.statut !== 'en_transit').slice(0, 30));

      const ids = [...new Set(envois.flatMap(e => [e.demandeur_id, e.valideur_id, e.receptionnaire_id, e.annule_par]).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profils } = await supabase.from('profiles').select('id, nom, username').in('id', ids);
        setNoms(Object.fromEntries((profils || []).map(p => [p.id, p.nom || p.username])));
      }
      setErreur('');
    } catch (err) {
      console.error('Erreur chargement réceptions:', err);
      setErreur('Erreur lors du chargement des envois : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const nom = (id) => (id ? noms[id] || '…' : '-');
  const date = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '-');

  // Règle de contrôle croisé : la personne qui a validé sa propre demande (ou envoyé depuis l'atelier)
  // ne peut pas réceptionner
  const peutReceptionner = (envoi) => !(envoi.auto_validation && envoi.valideur_id === currentUser.id);

  const ouvrir = (envoi) => {
    setComptes({});
    setMotifs({});
    setEcarts(null);
    setEnvoiOuvert(envoi);
  };

  const fermer = () => {
    setEnvoiOuvert(null);
    setEcarts(null);
  };

  const receptionner = async (confirmer) => {
    if (!envoiOuvert || enregistrementRef.current) return;

    const lignes = [];
    for (const ligne of envoiOuvert.lignes) {
      const valeur = parseFloat(comptes[ligne.produit_id]);
      if (isNaN(valeur) || valeur < 0) {
        alert(`Indiquez la quantité comptée pour ${ligne.produit_nom}`);
        return;
      }
      lignes.push({ produit_id: ligne.produit_id, quantite_recue: valeur, motif: motifs[ligne.produit_id] || null });
    }
    if (confirmer && ecarts?.some(e => (motifs[e.produit_id] || '').trim().length < 3)) {
      alert('Indiquez un motif pour chaque écart.');
      return;
    }

    enregistrementRef.current = true;
    setEnregistrement(true);
    try {
      const { data, error } = await supabase.rpc('receptionner_envoi', {
        p_envoi_id: envoiOuvert.id,
        p_lignes: lignes,
        p_confirmer: confirmer
      });
      if (error) throw error;

      if (data.statut === 'ecarts') {
        setEcarts(data.ecarts);
        return;
      }
      alert(data.avec_ecart
        ? 'Réception enregistrée avec écart. Le propriétaire et les gérants sont prévenus.'
        : '✅ Réception enregistrée : le stock est à jour.');
      fermer();
      await charger();
    } catch (err) {
      console.error('Erreur réception:', err);
      alert('❌ Réception impossible : ' + err.message);
      await charger();
    } finally {
      enregistrementRef.current = false;
      setEnregistrement(false);
    }
  };

  const annuler = async (envoi) => {
    const motif = prompt('Motif de l\'annulation (obligatoire) :');
    if (motif === null) return;
    if (motif.trim().length < 3) {
      alert('Le motif est obligatoire.');
      return;
    }
    const { error } = await supabase.rpc('annuler_envoi', { p_envoi_id: envoi.id, p_motif: motif.trim() });
    alert(error ? '❌ Annulation impossible : ' + error.message : `Envoi annulé : la marchandise revient au ${LIEUX[envoi.origine].toLowerCase()}.`);
    await charger();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Réceptions</h2>
        <p className="text-sm text-gray-600">
          Comptez ce qui est réellement arrivé : le stock n'est mis à jour qu'à la réception.
        </p>
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">{erreur}</div>
      )}

      <Card>
        <div className="p-4 border-b flex items-center">
          <Truck className="h-5 w-5 text-orange-600 mr-2" />
          <h3 className="font-semibold">En transit ({enTransit.length})</h3>
        </div>
        {enTransit.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Aucun envoi à réceptionner</p>
        ) : (
          <div className="divide-y">
            {enTransit.map(envoi => (
              <div key={envoi.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-medium">
                    Envoi #{envoi.id} : {LIEUX[envoi.origine]} → {LIEUX[envoi.destination]}
                  </div>
                  <div className="text-sm text-gray-600">
                    {envoi.lignes.length} produit(s) · {envoi.origine === 'atelier' ? 'Envoyé' : 'Validé'} par {nom(envoi.valideur_id)} le {date(envoi.cree_le)}
                    {envoi.demandeur_id && envoi.origine === 'principal' && <> · Demandé par {nom(envoi.demandeur_id)}</>}
                  </div>
                  <div className="text-xs text-gray-500">{envoi.lignes.map(l => l.produit_nom).join(', ')}</div>
                  {envoi.auto_validation && (
                    <div className="text-xs text-orange-700 mt-1">
                      {peutReceptionner(envoi)
                        ? 'À réceptionner par une autre personne que celle qui a validé ou envoyé'
                        : 'Vous avez validé ou envoyé cette marchandise : une autre personne doit la réceptionner'}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {peutReceptionner(envoi) && (
                    <button
                      onClick={() => ouvrir(envoi)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
                    >
                      <PackageCheck className="h-4 w-4 mr-2" />
                      Réceptionner
                    </button>
                  )}
                  {estAdmin && (
                    <button
                      onClick={() => annuler(envoi)}
                      className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center"
                      title="Annuler l'envoi"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b flex items-center">
          <Clock className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="font-semibold">Derniers envois traités</h3>
        </div>
        {recents.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Aucun envoi traité</p>
        ) : (
          <div className="divide-y">
            {recents.map(envoi => (
              <div key={envoi.id} className="p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">
                    #{envoi.id} : {LIEUX[envoi.origine]} → {LIEUX[envoi.destination]}
                  </span>
                  {envoi.statut === 'annule' ? (
                    <span className="text-gray-600">Annulé par {nom(envoi.annule_par)}</span>
                  ) : envoi.avec_ecart ? (
                    <span className="text-red-700 flex items-center"><AlertTriangle className="h-4 w-4 mr-1" />Reçu avec écart</span>
                  ) : (
                    <span className="text-green-700">Reçu</span>
                  )}
                </div>
                <div className="text-gray-600">
                  {envoi.statut === 'annule'
                    ? `${date(envoi.annule_le)} · ${envoi.motif_annulation}`
                    : `Reçu par ${nom(envoi.receptionnaire_id)} le ${date(envoi.recu_le)}`}
                </div>
                {envoi.lignes.filter(l => l.quantite_recue !== null && Number(l.quantite_recue) !== Number(l.quantite_envoyee)).map(l => (
                  <div key={l.id} className="text-red-700 text-xs">
                    {l.produit_nom} : envoyé {l.quantite_envoyee}, reçu {l.quantite_recue} {l.unite || ''} ({l.motif_ecart})
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={!!envoiOuvert} onClose={fermer} title={envoiOuvert ? `Réception de l'envoi #${envoiOuvert.id}` : ''} size="lg">
        {envoiOuvert && (
          <div className="space-y-4">
            {!ecarts ? (
              <>
                <p className="text-sm text-gray-600">
                  Comptez chaque produit et saisissez la quantité réellement reçue.
                </p>
                <div className="space-y-2">
                  {envoiOuvert.lignes.map(ligne => (
                    <div key={ligne.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium text-sm">{ligne.produit_nom}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={comptes[ligne.produit_id] ?? ''}
                          onChange={(e) => setComptes(prev => ({ ...prev, [ligne.produit_id]: e.target.value }))}
                          className="w-24 px-2 py-1 border rounded"
                          placeholder="Compté"
                        />
                        <span className="text-xs text-gray-500">{ligne.unite}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => receptionner(false)}
                  disabled={enregistrement}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {enregistrement ? 'Vérification…' : 'Valider mon comptage'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                  Votre comptage ne correspond pas à ce qui a été envoyé. Recomptez, ou indiquez un motif pour chaque écart.
                </div>
                <div className="space-y-3">
                  {ecarts.map(e => (
                    <div key={e.produit_id} className="p-2 bg-gray-50 rounded">
                      <div className="text-sm font-medium">{e.produit_nom}</div>
                      <div className="text-xs text-gray-600">
                        Envoyé : {e.quantite_envoyee} · Compté : {e.quantite_comptee} {e.unite || ''}
                      </div>
                      <input
                        type="text"
                        value={motifs[e.produit_id] || ''}
                        onChange={(ev) => setMotifs(prev => ({ ...prev, [e.produit_id]: ev.target.value }))}
                        className="mt-1 w-full px-2 py-1 border rounded text-sm"
                        placeholder="Motif de l'écart (ex. : 2 croissants écrasés)"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEcarts(null)}
                    disabled={enregistrement}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Recompter
                  </button>
                  <button
                    onClick={() => receptionner(true)}
                    disabled={enregistrement}
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {enregistrement ? 'Enregistrement…' : 'Confirmer avec écart'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
