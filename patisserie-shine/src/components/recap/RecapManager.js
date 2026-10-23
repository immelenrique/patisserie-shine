"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  AlertTriangle, Clock, UserCheck, FileText, Truck, Package, CreditCard, Receipt,
  Users, Archive, Printer, RefreshCw, ShieldCheck, ShieldAlert, ShoppingBag, Lock
} from 'lucide-react';
import { Card } from '../ui';
import { recuService } from '../../services';
import { utils } from '../../utils/formatters';

const FUSEAU = 'Africa/Ouagadougou';
const LIEUX = { principal: 'Stock principal', atelier: 'Atelier', boutique: 'Boutique', transit: 'Transit', ecart: 'Écart' };
const NATURES = { achat: 'Achat', ajustement: 'Correction', utilisation: 'Utilisation', production: 'Production' };
const STATUTS_ENVOI = { en_transit: 'En transit', recu: 'Reçu', annule: 'Annulé' };
const STATUTS_DEMANDE = { en_attente: 'En attente', validee: 'Validée', refusee: 'Refusée', partiellement_validee: 'Partielle', annulee: 'Annulée' };

// Date du jour (AAAA-MM-JJ) à Ouagadougou, décalée de n jours
const jour = (decalage = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toLocaleDateString('en-CA', { timeZone: FUSEAU });
};
const libelleJour = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const qte = (n) => (n === null || n === undefined ? '-' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n));
const heure = (d) => (d ? utils.formatDateTime(d) : '-');

// Récapitulatif pour le propriétaire : tout ce qui s'est passé sur une période, calculé par la base à partir
// des données d'origine (rien n'est stocké). Par défaut : la veille. Les 14 derniers jours sont proposés,
// et n'importe quelle période (3 mois au plus) peut être générée.
export default function RecapManager({ currentUser }) {
  const [du, setDu] = useState(jour(-1));
  const [au, setAu] = useState(jour(-1));
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const demandeRef = useRef(0);

  useEffect(() => {
    generer(jour(-1), jour(-1));
  }, [currentUser]);

  const generer = async (debut, fin) => {
    if (!debut || !fin || fin < debut) {
      setErreur('Période invalide : la date de fin doit suivre la date de début.');
      return;
    }
    setDu(debut);
    setAu(fin);
    const numero = ++demandeRef.current;
    setLoading(true);
    setErreur('');
    try {
      const { data, error } = await supabase.rpc('recap_periode', { p_du: debut, p_au: fin });
      if (error) throw error;
      // Seule la dernière demande s'affiche (clics rapides sur plusieurs jours)
      if (numero === demandeRef.current) setRecap(data);
    } catch (err) {
      console.error('Erreur récapitulatif:', err);
      if (numero === demandeRef.current) {
        setRecap(null);
        setErreur('Impossible de générer le récapitulatif : ' + err.message);
      }
    } finally {
      if (numero === demandeRef.current) setLoading(false);
    }
  };

  const quatorzeJours = Array.from({ length: 14 }, (_, i) => jour(-1 - i));
  const titrePeriode = du === au ? libelleJour(du) : `du ${libelleJour(du)} au ${libelleJour(au)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Récapitulatif</h2>
          <p className="text-sm text-gray-600">
            Demandes, validations, réceptions, achats, corrections, ventes et dépenses. Réservé au propriétaire.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => generer(du, au)} className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />Actualiser
          </button>
          <button onClick={() => window.print()} disabled={!recap} className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center disabled:opacity-50">
            <Printer className="h-4 w-4 mr-2" />Imprimer
          </button>
        </div>
      </div>

      {/* Choix de la période */}
      <Card className="p-4 space-y-3 print:hidden" hover={false}>
        <div className="flex flex-wrap gap-2">
          {[['Hier', -1, -1], ["Aujourd'hui", 0, 0], ['7 derniers jours', -7, -1], ['14 derniers jours', -14, -1]].map(([libelle, a, b]) => (
            <button key={libelle} onClick={() => generer(jour(a), jour(b))}
              className={`px-3 py-1.5 rounded-lg text-sm ${du === jour(a) && au === jour(b) ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {libelle}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {quatorzeJours.map(j => (
            <button key={j} onClick={() => generer(j, j)}
              className={`px-2 py-1 rounded text-xs ${du === j && au === j ? 'bg-orange-100 text-orange-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
              {libelleJour(j)}
            </button>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); generer(e.target.du.value, e.target.au.value); }}>
          <label className="text-sm">Du<input name="du" type="date" defaultValue={du} key={'du' + du} max={jour(0)} className="block border rounded px-2 py-1" /></label>
          <label className="text-sm">Au<input name="au" type="date" defaultValue={au} key={'au' + au} max={jour(0)} className="block border rounded px-2 py-1" /></label>
          <button type="submit" className="bg-orange-600 text-white px-4 py-1.5 rounded-lg hover:bg-orange-700">Générer la période</button>
        </form>
      </Card>

      {erreur && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">{erreur}</div>}

      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
        </div>
      )}

      {recap && !loading && <Contenu recap={recap} titre={titrePeriode} />}
    </div>
  );
}

function Contenu({ recap, titre }) {
  const c = recap.chiffres || {};
  const alertes = recap.alertes || {};
  const ventes = recap.ventes || {};
  const depenses = recap.depenses || {};
  const journal = recap.journal || {};
  const corrections = (recap.mouvements || []).filter(m => m.nature === 'ajustement');
  const comptesParAutre = (recap.comptes || []).filter(x => x.par_autre);
  const autoValidations = (recap.decisions || []).filter(d => d.auto_validation);
  const nbPoints = (alertes.transit_24h || []).length + (alertes.meme_personne || []).length + (alertes.ecarts || []).length
    + corrections.length + (ventes.annulations || []).length + comptesParAutre.length + (journal.intact === false ? 1 : 0)
    + (alertes.achats_sans_recu || []).length + (alertes.recus_disparus || []).length + (alertes.depenses_modifiees || []).length
    + (alertes.ecarts_caisse || []).length + (alertes.caisses_ouvertes || []).length + (alertes.ventes_hors_caisse || []).length;

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500">Récapitulatif {titre} — généré le {heure(recap.genere_le)}</div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Chiffre titre="Demandes" valeur={c.demandes} />
        <Chiffre titre="Validées" valeur={c.validations} />
        <Chiffre titre="Refusées" valeur={c.refus} />
        <Chiffre titre="Réceptions" valeur={c.receptions} />
        <Chiffre titre="Écarts" valeur={c.ecarts} alerte={c.ecarts > 0} />
        <Chiffre titre="Ventes" valeur={utils.formatCFA(c.chiffre_affaires)} />
        <Chiffre titre="Dépenses" valeur={utils.formatCFA(c.depenses)} />
      </div>

      {/* Points à vérifier */}
      <Section icone={AlertTriangle} titre={`Points à vérifier (${nbPoints})`} couleur={nbPoints > 0 ? 'text-red-600' : 'text-green-600'}>
        <div className="p-4 space-y-4">
          <div className={`flex items-center text-sm ${journal.intact === false ? 'text-red-700 font-semibold' : 'text-green-700'}`}>
            {journal.intact === false ? <ShieldAlert className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {journal.intact === false
              ? `Journal du stock altéré à partir de la ligne ${journal.premiere_ligne_alteree} : à signaler immédiatement au technicien.`
              : `Journal du stock intact (${qte(journal.lignes_verifiees)} mouvements vérifiés).`}
          </div>
          {nbPoints === 0 && <p className="text-sm text-gray-500">Rien d'anormal sur la période.</p>}

          <Liste titre="Marchandise en transit depuis plus de 24 h (état actuel)" lignes={alertes.transit_24h}
            rendu={(e) => <>Envoi n°{e.id} {LIEUX[e.origine]} → {LIEUX[e.destination]}, parti le {heure(e.parti_le)} ({e.heures} h), validé par <b>{e.valideur}</b>
              {e.demandeur && <> pour {e.demandeur}</>} : {e.lignes.map(l => `${l.produit} ${qte(l.envoyee)}`).join(', ')}</>} />

          <Liste titre="Validé et réceptionné par la même personne" lignes={alertes.meme_personne}
            rendu={(e) => <>Envoi n°{e.id} {LIEUX[e.origine]} → {LIEUX[e.destination]} : validé et reçu par <b>{e.personne}</b> le {heure(e.recu_le)}
              {e.demandeur && <> (demandé par {e.demandeur})</>}{e.avec_ecart && ' — avec écart'}</>} />

          <Liste titre="Écarts à la réception" lignes={alertes.ecarts}
            rendu={(x) => <>Envoi n°{x.envoi_id} {x.produit} : envoyé {qte(x.envoyee)}, reçu {qte(x.recue)} (<b>{x.ecart > 0 ? '+' : ''}{qte(x.ecart)}</b> {x.unite || ''}).
              Validé par {x.valideur}, compté par {x.receptionnaire}. Motif : « {x.motif || '-'} »</>} />

          <Liste titre="Corrections de stock" lignes={corrections}
            rendu={(m) => <>{heure(m.le)} — {LIEUX[m.lieu]} : {m.produit} <b>{m.quantite > 0 ? '+' : ''}{qte(m.quantite)}</b> {m.unite || ''} par {m.auteur || '-'}. Motif : « {m.motif || '-'} »</>} />

          <Liste titre="Ventes annulées" lignes={ventes.annulations}
            rendu={(a) => <>{heure(a.le)} — ticket {a.ticket} ({utils.formatCFA(a.montant)}) vendu par {a.vendeur || '-'}, annulé par <b>{a.annule_par || '-'}</b>. Motif : « {a.motif} »</>} />

          <Liste titre="Comptes modifiés par une autre personne" lignes={comptesParAutre}
            rendu={(x) => <>{heure(x.le)} — compte <b>{x.compte || '-'}</b> : {x.action} (par {x.par})</>} />

          <Liste titre="Achats sans reçu" lignes={alertes.achats_sans_recu}
            rendu={(a) => <>{heure(a.le)} — {a.description} : <b>{utils.formatCFA(a.montant)}</b>, par {a.par || '-'}</>} />

          <Liste titre="Reçus disparus du stockage (état actuel)" lignes={alertes.recus_disparus}
            rendu={(x) => <>Dépense n°{x.depense_id} ({x.description}, {utils.formatCFA(x.montant)}) : le fichier « {x.fichier} » ajouté le {heure(x.ajoute_le)} n'existe plus</>} />

          <Liste titre="Dépenses modifiées ou supprimées" lignes={alertes.depenses_modifiees}
            rendu={(x) => <>{heure(x.le)} — dépense n°{x.depense_id} « {x.description} » <b>{x.action === 'suppression' ? 'supprimée' : 'modifiée'}</b> par {x.par || '-'}
              {x.action === 'suppression' ? ` (montant : ${utils.formatCFA(x.montant_avant)})` : ` : ${(x.champs || []).join(', ')}`}
              {x.action === 'modification' && x.montant_avant !== x.montant_apres && x.montant_apres !== null && ` (montant ${utils.formatCFA(x.montant_avant)} → ${utils.formatCFA(x.montant_apres)})`}</>} />

          <Liste titre="Écarts de caisse" lignes={alertes.ecarts_caisse}
            rendu={(x) => <>{heure(x.fermeture)} — caisse de <b>{x.caissier || '-'}</b> : attendu {utils.formatCFA(x.attendu)}, compté {utils.formatCFA(x.compte)}
              {' '}(<b>{x.ecart > 0 ? '+' : ''}{utils.formatCFA(x.ecart)}</b>) en {x.comptages} comptage(s){x.comptages > 1 && `, le premier à ${utils.formatCFA(x.premier_comptage)}`}. Motif : « {x.motif || '-'} »</>} />

          <Liste titre="Caisses ouvertes depuis plus de 16 h (état actuel)" lignes={alertes.caisses_ouvertes}
            rendu={(x) => <>Caisse de <b>{x.caissier || '-'}</b> ouverte le {heure(x.ouverture)} ({x.heures} h) : la clôture a été oubliée, l'argent n'a pas été compté</>} />

          <Liste titre="Ventes faites sans caisse ouverte" lignes={alertes.ventes_hors_caisse}
            rendu={(x) => <><b>{x.vendeur || '-'}</b> : {x.nombre} vente(s) pour {utils.formatCFA(x.total)}, comptées dans aucune caisse</>} />

          {autoValidations.length > 0 && (
            <p className="text-sm text-gray-600">
              {autoValidations.length} demande(s) validée(s) par la personne qui les avait faites : la réception a obligatoirement été faite par quelqu'un d'autre.
            </p>
          )}
          {recap.en_attente?.nombre > 0 && (
            <p className="text-sm text-gray-600 flex items-center">
              <Clock className="h-4 w-4 mr-1" />{recap.en_attente.nombre} demande(s) en attente de validation actuellement, la plus ancienne du {heure(recap.en_attente.plus_ancienne)}.
            </p>
          )}
        </div>
      </Section>

      {/* Validations et refus */}
      <Section icone={UserCheck} titre={`Validations et refus (${(recap.decisions || []).length})`}>
        <Tableau entetes={['Heure', 'Demande', 'Demandé par', 'Décision', 'Produits (demandé → validé)']} lignes={recap.decisions}
          rendu={(d) => [
            heure(d.le),
            <>n°{d.id} → {d.destination}</>,
            d.demandeur || '-',
            <><span className={d.statut === 'refusee' ? 'text-red-600' : 'text-green-700'}>{STATUTS_DEMANDE[d.statut] || d.statut}</span> par {d.valideur || '-'}
              {d.auto_validation && <span className="ml-1 text-xs bg-amber-100 text-amber-800 px-1 rounded">sa propre demande</span>}
              {d.raison_refus && <div className="text-xs text-gray-500">« {d.raison_refus} »</div>}</>,
            <Lignes lignes={d.lignes} rendu={(l) => <>{l.produit} : {qte(l.demandee)} → <b className={l.validee !== null && Number(l.validee) !== Number(l.demandee) ? 'text-orange-700' : ''}>{l.validee === null ? '-' : qte(l.validee)}</b> {l.unite || ''}</>} />
          ]} />
      </Section>

      {/* Envois et réceptions */}
      <Section icone={Truck} titre={`Envois et réceptions (${(recap.envois || []).length})`}>
        <Tableau entetes={['Envoi', 'Parti', 'Réception', 'Produits (envoyé / reçu)']} lignes={recap.envois}
          rendu={(e) => [
            <>n°{e.id} {LIEUX[e.origine]} → {LIEUX[e.destination]}<div className="text-xs text-gray-500">{STATUTS_ENVOI[e.statut]}{e.demande_id ? ` — demande n°${e.demande_id}` : ''}</div></>,
            <>{heure(e.parti_le)}<div className="text-xs text-gray-500">{e.origine === 'atelier' ? 'envoyé' : 'validé'} par {e.valideur}</div></>,
            e.statut === 'annule'
              ? <span className="text-gray-600">Annulé le {heure(e.annule_le)} par {e.annule_par} : « {e.motif_annulation} »</span>
              : e.statut === 'recu'
                ? <>{heure(e.recu_le)}<div className={`text-xs ${e.meme_personne ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>par {e.receptionnaire}{e.meme_personne ? ' (même personne que la validation)' : ''}</div></>
                : <span className="text-orange-700">En attente de réception</span>,
            <Lignes lignes={e.lignes} rendu={(l) => <>{l.produit} : {qte(l.envoyee)}{l.recue !== null && <> / <b className={Number(l.ecart) !== 0 ? 'text-red-600' : ''}>{qte(l.recue)}</b></>} {l.unite || ''}
              {l.motif_ecart && <span className="text-xs text-gray-500"> « {l.motif_ecart} »</span>}</>} />
          ]} />
      </Section>

      {/* Demandes faites */}
      <Section icone={FileText} titre={`Demandes faites (${(recap.demandes || []).length})`}>
        <Tableau entetes={['Heure', 'Demande', 'Par', 'Statut actuel', 'Produits']} lignes={recap.demandes}
          rendu={(d) => [heure(d.le), <>n°{d.id} → {d.destination}</>, d.demandeur || '-', STATUTS_DEMANDE[d.statut] || d.statut,
            <Lignes lignes={d.lignes} rendu={(l) => <>{l.produit} : {qte(l.quantite)} {l.unite || ''}</>} />]} />
      </Section>

      {/* Mouvements du stock */}
      <Section icone={Package} titre={`Achats, corrections, utilisations, production (${(recap.mouvements || []).length})`}>
        <Tableau entetes={['Heure', 'Type', 'Lieu', 'Produit', 'Quantité', 'Par', 'Détail']} lignes={recap.mouvements}
          rendu={(m) => [heure(m.le), NATURES[m.nature] || m.nature, LIEUX[m.lieu] || m.lieu, m.produit,
            <b className={m.quantite < 0 ? 'text-red-600' : 'text-green-700'}>{m.quantite > 0 ? '+' : ''}{qte(m.quantite)} {m.unite || ''}</b>,
            m.auteur || '-', m.motif || '']} />
      </Section>

      {/* Ventes */}
      <Section icone={CreditCard} titre={`Ventes : ${ventes.nombre || 0} tickets, ${utils.formatCFA(ventes.total)}`}>
        <div className="grid md:grid-cols-2 gap-4 p-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Par vendeur</h4>
            <Tableau entetes={['Vendeur', 'Tickets', 'Total']} lignes={ventes.par_vendeur} interne
              rendu={(v) => [v.vendeur || '-', v.nombre, utils.formatCFA(v.total)]} />
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Articles vendus</h4>
            <Tableau entetes={['Article', 'Quantité', 'Total']} lignes={ventes.articles} interne
              rendu={(a) => [a.produit, qte(a.quantite), utils.formatCFA(a.total)]} />
          </div>
        </div>
      </Section>

      {/* Caisses : ouverture, comptage, écart */}
      {recap.caisses && (
        <Section icone={Lock} titre={`Caisses (${recap.caisses.length})`}>
          <Tableau entetes={['Caissier', 'Ouverture', 'Clôture', 'Fond', 'Ventes', 'Attendu', 'Compté', 'Écart', 'Comptages']} lignes={recap.caisses}
            rendu={(x) => [x.caissier || '-', heure(x.ouverture), x.fermeture ? heure(x.fermeture) : <span className="text-orange-800 font-medium">ouverte</span>,
              utils.formatCFA(x.fond), x.ventes === null ? '-' : `${utils.formatCFA(x.ventes)} (${x.nombre_ventes})`,
              x.attendu === null ? '-' : utils.formatCFA(x.attendu), x.compte === null ? '-' : utils.formatCFA(x.compte),
              x.ecart === null ? '-' : <span className={x.ecart !== 0 ? 'text-red-700 font-semibold' : 'text-green-700'}>{x.ecart > 0 ? '+' : ''}{utils.formatCFA(x.ecart)}</span>,
              x.comptages]} />
        </Section>
      )}

      {/* Achats de stock, avec leurs reçus */}
      {recap.achats && (
        <Section icone={ShoppingBag} titre={`Achats de stock : ${utils.formatCFA(c.achats)}`}>
          <Tableau entetes={['Heure', 'Achat', 'Montant', 'Par', 'Reçu']} lignes={recap.achats}
            rendu={(a) => [heure(a.le), a.description, utils.formatCFA(a.montant), a.par || '-',
              a.recus.length === 0
                ? <span className="text-orange-800 font-medium">aucun</span>
                : <div className="flex flex-wrap gap-2">{a.recus.map((r, i) => r.present
                    ? <BoutonRecu key={i} chemin={r.chemin} />
                    : <span key={i} className="text-red-700 font-medium">fichier disparu</span>)}</div>]} />
        </Section>
      )}

      {/* Dépenses */}
      <Section icone={Receipt} titre={`Dépenses : ${utils.formatCFA(depenses.total)}`}>
        <Tableau entetes={['Date', 'Type', 'Description', 'Montant', 'Justificatifs', 'Par']} lignes={depenses.lignes}
          rendu={(d) => [utils.formatDate(d.date), d.categorie || d.type, <>{d.description}{d.facture && <div className="text-xs text-gray-500">Facture {d.facture}</div>}</>,
            utils.formatCFA(d.montant), d.pieces > 0 ? `${d.pieces} pièce(s)` : <span className="text-orange-700">aucun</span>, d.par || '-']} />
      </Section>

      {/* Comptes et produits archivés */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section icone={Users} titre={`Comptes (${(recap.comptes || []).length})`}>
          <Tableau entetes={['Heure', 'Compte', 'Action', 'Par']} lignes={recap.comptes} interne
            rendu={(x) => [heure(x.le), x.compte || '-', x.action, <span className={x.par_autre ? 'text-red-600 font-medium' : ''}>{x.par || '-'}</span>]} />
        </Section>
        <Section icone={Archive} titre={`Produits archivés (${(recap.archives || []).length})`}>
          <Tableau entetes={['Heure', 'Produit', 'Motif', 'Par']} lignes={recap.archives} interne
            rendu={(a) => [heure(a.le), a.produit, a.motif, a.par || '-']} />
        </Section>
      </div>
    </div>
  );
}

// Ouvre le reçu dans un nouvel onglet, par un lien temporaire (l'espace des reçus est privé)
function BoutonRecu({ chemin }) {
  const [chargement, setChargement] = useState(false);
  const ouvrir = async () => {
    // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis dirigé vers le reçu
    const onglet = window.open('', '_blank');
    setChargement(true);
    const { url, error } = await recuService.lien(chemin);
    setChargement(false);
    if (error || !url) {
      onglet?.close();
      alert('Reçu indisponible : ' + (error || 'lien introuvable'));
      return;
    }
    if (onglet) onglet.location.href = url; else window.location.href = url;
  };
  return (
    <button type="button" onClick={ouvrir} disabled={chargement}
      className="text-sm font-medium text-orange-800 underline min-h-[32px] disabled:opacity-50">
      {chargement ? 'Ouverture…' : 'Voir le reçu'}
    </button>
  );
}

function Chiffre({ titre, valeur, alerte = false }) {
  return (
    <Card className="p-3" hover={false}>
      <div className="text-xs text-gray-500">{titre}</div>
      <div className={`text-lg font-bold ${alerte ? 'text-red-600' : 'text-gray-900'}`}>{valeur ?? 0}</div>
    </Card>
  );
}

function Section({ icone: Icone, titre, couleur = 'text-orange-600', children }) {
  return (
    <Card hover={false} className="break-inside-avoid">
      <div className="p-4 border-b flex items-center">
        <Icone className={`h-5 w-5 mr-2 ${couleur}`} />
        <h3 className="font-semibold">{titre}</h3>
      </div>
      {children}
    </Card>
  );
}

function Liste({ titre, lignes, rendu }) {
  if (!lignes || lignes.length === 0) return null;
  return (
    <div>
      <h4 className="font-medium text-sm text-red-700 mb-1">{titre} ({lignes.length})</h4>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
        {lignes.map((l, i) => <li key={i}>{rendu(l)}</li>)}
      </ul>
    </div>
  );
}

function Lignes({ lignes, rendu }) {
  if (!lignes || lignes.length === 0) return <span className="text-gray-400">-</span>;
  return <div className="space-y-0.5">{lignes.map((l, i) => <div key={i}>{rendu(l)}</div>)}</div>;
}

function Tableau({ entetes, lignes, rendu, interne = false }) {
  if (!lignes || lignes.length === 0) {
    return <p className={`${interne ? 'py-2' : 'p-4'} text-sm text-gray-500`}>Aucun élément sur la période.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>{entetes.map(e => <th key={e} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{e}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {lignes.map((l, i) => (
            <tr key={i} className="align-top">
              {rendu(l).map((cellule, j) => <td key={j} className="px-3 py-2">{cellule}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
