"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Truck, ClipboardCheck, AlertTriangle, CreditCard, FileText, RefreshCw, ChevronRight, Camera, FileCheck } from 'lucide-react';
import { recuService } from '../../services';
import { Card, useSaisie } from '../ui';

const LIEUX = { principal: 'Stock principal', atelier: 'Atelier', boutique: 'Boutique' };
const HEURES_BLOCAGE = 24;

const depuis = (date) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `il y a ${heures} h`;
  return `il y a ${Math.floor(heures / 24)} jours`;
};
const nomDe = (p) => (p ? p.nom || p.username : '-');
const qte = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

// Écran d'accueil : ce qui attend la personne connectée, du plus urgent au moins urgent.
// Les données viennent des mêmes tables et fonctions que les écrans Demandes et Réceptions ;
// la base ne renvoie que ce que le rôle a le droit de voir.
export default function AFaireManager({ currentUser, hasPermission, onNaviguer }) {
  const [envois, setEnvois] = useState([]);
  const [aValider, setAValider] = useState([]);
  const [mesDemandes, setMesDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(null);
  const [achatsSansRecu, setAchatsSansRecu] = useState([]);
  const [envoiRecu, setEnvoiRecu] = useState(null);
  // Achats à confirmer avec la facture (propriétaire)
  const [aConfirmer, setAConfirmer] = useState({ nombre: 0, a_confirmer: [] });
  const recuInputRef = useRef(null);
  const recuCibleRef = useRef(null);
  const enCoursRef = useRef(false);
  const [fenetreSaisie, demander] = useSaisie();

  const estAdmin = currentUser.role === 'admin';
  const estMagasinier = currentUser.role === 'magasinier';
  // Le magasinier valide les demandes comme le propriétaire et les gérants
  const peutValider = estAdmin || estMagasinier;
  const estProprietaire = !!currentUser.is_super_admin;

  useEffect(() => {
    charger();
  }, [currentUser]);

  const charger = async () => {
    setLoading(true);
    try {
      const depuis7j = new Date(Date.now() - 7 * 86400000).toISOString();
      const requetes = [
        // Envois en route et réceptions des dernières 48 h (écarts)
        supabase.from('envois')
          .select('*, lignes:envoi_lignes(produit_nom, unite, quantite_envoyee, quantite_recue, motif_ecart)')
          .or(`statut.eq.en_transit,recu_le.gte.${new Date(Date.now() - 48 * 3600000).toISOString()}`)
          .order('cree_le', { ascending: true })
          .limit(100),
        supabase.from('demandes_groupees')
          .select('id, destination, statut, created_at, lignes:demandes!demandes_demande_groupee_id_fkey(quantite, produit:produits(nom, unite:unites(label))), envois(id, statut, avec_ecart)')
          .eq('demandeur_id', currentUser.id)
          .gte('created_at', depuis7j)
          .order('created_at', { ascending: false })
          .limit(10)
      ];
      if (peutValider) {
        requetes.push(supabase.from('demandes_groupees')
          .select('id, destination, created_at, demandeur_id, demandeur:profiles!demandes_groupees_demandeur_id_fkey(nom, username), lignes:demandes!demandes_demande_groupee_id_fkey(quantite, produit:produits(nom, quantite_restante, unite:unites(label)))')
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: true })
          .limit(50));
      }
      const [rEnvois, rMes, rValider] = await Promise.all(requetes);
      for (const r of [rEnvois, rMes, rValider]) if (r?.error) throw r.error;
      // Les envois n'ont pas de lien direct vers les profils : les noms sont lus à part
      const ids = [...new Set((rEnvois.data || []).flatMap(e => [e.valideur_id, e.receptionnaire_id]).filter(Boolean))];
      let noms = {};
      if (ids.length > 0) {
        const { data: profils } = await supabase.from('profiles').select('id, nom, username').in('id', ids);
        noms = Object.fromEntries((profils || []).map(p => [p.id, p]));
      }
      setEnvois((rEnvois.data || []).map(e => ({ ...e, valideur: noms[e.valideur_id], receptionnaire: noms[e.receptionnaire_id] })));
      setMesDemandes(rMes.data || []);
      setAValider(rValider?.data || []);
      // Achats des 7 derniers jours sans reçu (les siens ; tous pour le propriétaire et les gérants).
      // Sans la partie 4 en base, la colonne n'existe pas encore : la section reste simplement vide.
      const rAchats = await supabase.from('depenses_comptables')
        .select('id, description, montant, date_depense, created_at, utilisateur_id')
        .not('achat_journal_id', 'is', null)
        .eq('pieces_jointes', '[]')
        .gte('created_at', depuis7j)
        .order('created_at', { ascending: false })
        .limit(30);
      if (rAchats.error) console.warn('Achats sans reçu indisponibles:', rAchats.error.message);
      setAchatsSansRecu(rAchats.error ? [] : (rAchats.data || []));
      if (estProprietaire) {
        // Sans la partie 6 en base, la fonction n'existe pas encore : la section reste vide
        const rConf = await supabase.rpc('achats_a_confirmer');
        if (rConf.error) console.warn('Achats à confirmer indisponibles:', rConf.error.message);
        setAConfirmer(rConf.error || !rConf.data ? { nombre: 0, a_confirmer: [] } : rConf.data);
      }
      setErreur('');
    } catch (err) {
      console.error('Erreur chargement À faire:', err);
      setErreur('Impossible de charger les tâches : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Même règle que la base : qui a validé sa propre demande (ou envoyé depuis l'atelier) ne réceptionne pas
  const peutReceptionner = (e) => !(e.auto_validation && e.valideur_id === currentUser.id);
  const enTransit = envois.filter(e => e.statut === 'en_transit');
  const bloques = enTransit.filter(e => Date.now() - new Date(e.cree_le).getTime() > HEURES_BLOCAGE * 3600000);
  // Le magasinier fait partir la marchandise : c'est la personne qui la reçoit qui la compte
  const aReceptionner = estMagasinier ? [] : enTransit.filter(e => !bloques.includes(e) && peutReceptionner(e) && (!estAdmin || e.demandeur_id === currentUser.id));
  const ecarts = estAdmin ? envois.filter(e => e.statut === 'recu' && e.avec_ecart) : [];

  const libelleLignes = (lignes, champ = 'quantite_envoyee') =>
    (lignes || []).map(l => `${l.produit_nom || l.produit?.nom} ${qte(l[champ])}${l.unite ? ' ' + l.unite : l.produit?.unite?.label ? ' ' + l.produit.unite.label : ''}`).join(' · ');

  const validerTelQuel = async (d) => {
    if (enCoursRef.current) return;
    const manques = (d.lignes || []).filter(l => Number(l.quantite) > Number(l.produit?.quantite_restante ?? 0));
    if (manques.length > 0) {
      alert('Stock insuffisant pour : ' + manques.map(l => l.produit?.nom).join(', ') + '. Ajustez les quantités dans « Demandes ».');
      return;
    }
    const ok = await demander({
      titre: `Valider la demande n°${d.id}`,
      message: `Ces quantités sortent du stock principal vers ${d.destination === 'Boutique' ? 'la boutique' : 'l\'atelier'}, puis attendent d'être comptées à l'arrivée.`,
      details: (d.lignes || []).map(l => `${l.produit?.nom} : ${qte(l.quantite)} ${l.produit?.unite?.label || ''} (en stock : ${qte(l.produit?.quantite_restante ?? 0)})`),
      confirmer: 'Valider et envoyer'
    });
    if (!ok) return;
    enCoursRef.current = true;
    setEnCours(d.id);
    const { error } = await supabase.rpc('valider_demande_groupee', { p_groupe_id: d.id });
    enCoursRef.current = false;
    setEnCours(null);
    if (error) alert('Validation impossible : ' + error.message);
    await charger();
  };

  const etatDemande = (d) => {
    // Une demande a au plus un envoi : la base renvoie un objet (ou une liste selon la version)
    const envoi = Array.isArray(d.envois) ? d.envois[0] : d.envois;
    if (d.statut === 'refusee') return { etape: -1, libelle: 'Refusée' };
    if (!envoi) return { etape: d.statut === 'en_attente' ? 1 : 2, libelle: d.statut === 'en_attente' ? 'En attente de validation' : 'Traitée' };
    if (envoi.statut === 'annule') return { etape: -1, libelle: 'Envoi annulé' };
    if (envoi.statut === 'recu') return { etape: 4, libelle: envoi.avec_ecart ? 'Reçue avec écart' : 'Reçue' };
    return { etape: 3, libelle: 'Validée, en route' };
  };

  const choisirRecu = (depense) => {
    recuCibleRef.current = depense;
    recuInputRef.current?.click();
  };
  const envoyerRecu = async (fichier) => {
    const depense = recuCibleRef.current;
    if (!fichier || !depense) return;
    setEnvoiRecu(depense.id);
    const { error } = await recuService.ajouter(depense.id, fichier, currentUser.id);
    setEnvoiRecu(null);
    if (error) alert('Le reçu n\'a pas pu être joint : ' + error);
    await charger();
  };

  // La propriétaire compare l'achat saisi (quantité, montant) à la facture
  const confirmerAchat = async (a, conforme) => {
    if (enCoursRef.current) return;
    const detail = [`${a.produit} : ${qte(a.quantite)} ${a.unite || ''}`, `Montant : ${new Intl.NumberFormat('fr-FR').format(a.montant)} F`
      + (a.prix_unitaire !== null ? ` (${new Intl.NumberFormat('fr-FR').format(a.prix_unitaire)} F l'unité)` : ''), `Saisi par ${a.par || '-'}`];
    const r = conforme
      ? await demander({ titre: 'Achat conforme à la facture', message: 'La facture indique bien cette quantité et ce montant ?', details: detail, confirmer: 'Oui, conforme' })
      : await demander({
          titre: 'Achat non conforme', message: 'Indiquez ce que dit la facture. Les gérants et la personne qui a saisi l\'achat seront prévenus.', details: detail,
          champs: [{ nom: 'commentaire', label: 'Ce qui ne correspond pas', obligatoire: true, placeholder: 'ex. : facture de 3 kg pour 9 000 F' }],
          confirmer: 'Signaler', danger: true
        });
    if (!r) return;
    enCoursRef.current = true;
    setEnCours('achat-' + a.depense_id);
    const { error } = await supabase.rpc('confirmer_achat', { p_depense_id: a.depense_id, p_conforme: conforme, p_commentaire: r.commentaire || null });
    enCoursRef.current = false;
    setEnCours(null);
    if (error) alert('Confirmation impossible : ' + error.message);
    else if (!conforme) alert('Achat signalé. Si la quantité en stock est fausse, corrigez-la dans « Stock Principal » (correction motivée).');
    await charger();
  };
  const voirRecu = async (chemin) => {
    // L'onglet est ouvert tout de suite (sinon le navigateur le bloque), puis dirigé vers le reçu
    const onglet = window.open('', '_blank');
    const { url, error } = await recuService.lien(chemin);
    if (error || !url) {
      onglet?.close();
      alert('Reçu indisponible : ' + (error || 'lien introuvable'));
      return;
    }
    if (onglet) onglet.location.href = url; else window.location.href = url;
  };

  const nbTaches = bloques.length + aReceptionner.length + aValider.length + ecarts.length + achatsSansRecu.length + (aConfirmer.nombre || 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fenetreSaisie}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">À faire</h2>
          <p className="text-gray-600">
            {nbTaches === 0 ? 'Rien ne vous attend pour le moment.' : `${nbTaches} élément(s) attendent une action, du plus urgent au moins urgent.`}
          </p>
        </div>
        <button onClick={charger} className="self-start sm:self-auto px-4 min-h-[44px] rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center">
          <RefreshCw className="h-4 w-4 mr-2" />Actualiser
        </button>
      </div>

      {erreur && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{erreur}</div>}

      {hasPermission('view_caisse') && (
        <button onClick={() => onNaviguer('caisse')}
          className="w-full sm:w-auto bg-orange-700 hover:bg-orange-800 text-white rounded-xl px-6 min-h-[64px] flex items-center justify-between gap-6 text-lg font-semibold">
          <span className="flex items-center"><CreditCard className="h-6 w-6 mr-3" />Ouvrir la caisse</span>
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* 1. Marchandise bloquée en route */}
      {bloques.length > 0 && (
        <Section icone={AlertTriangle} titre={`En route depuis plus de ${HEURES_BLOCAGE} h (${bloques.length})`} alerte>
          {bloques.map(e => (
            <Ligne key={e.id}
              titre={`Envoi n°${e.id} : ${LIEUX[e.origine]} → ${LIEUX[e.destination]}`}
              texte={libelleLignes(e.lignes)}
              note={`Parti ${depuis(e.cree_le)} · validé par ${nomDe(e.valideur)} · personne n'a encore compté`}
              action={peutReceptionner(e) ? { libelle: 'Réceptionner', onClick: () => onNaviguer('receptions') } : { libelle: 'Voir', secondaire: true, onClick: () => onNaviguer('receptions') }} />
          ))}
        </Section>
      )}

      {/* 2. À compter à l'arrivée */}
      {aReceptionner.length > 0 && (
        <Section icone={Truck} titre={`À réceptionner (${aReceptionner.length})`}>
          {aReceptionner.map(e => (
            <Ligne key={e.id}
              titre={`Envoi n°${e.id} : ${LIEUX[e.origine]} → ${LIEUX[e.destination]}`}
              texte={`${(e.lignes || []).length} produit(s) : ${(e.lignes || []).map(l => l.produit_nom).join(', ')}`}
              note={`Validé par ${nomDe(e.valideur)} ${depuis(e.cree_le)}`}
              action={{ libelle: 'Compter ce qui est arrivé', onClick: () => onNaviguer('receptions') }} />
          ))}
        </Section>
      )}

      {/* 3. Demandes à valider (magasinier, propriétaire et gérants) */}
      {peutValider && aValider.length > 0 && (
        <Section icone={ClipboardCheck} titre={`Demandes à valider (${aValider.length})`}
          lien={{ libelle: 'Ajuster ou refuser dans Demandes', onClick: () => onNaviguer('demandes') }}>
          {aValider.map(d => (
            <Ligne key={d.id}
              titre={`${d.demandeur_id === currentUser.id ? 'Vous' : nomDe(d.demandeur)} → ${d.destination}`}
              texte={libelleLignes(d.lignes, 'quantite')}
              note={`Demande n°${d.id} · ${depuis(d.created_at)}`}
              badge={d.demandeur_id === currentUser.id ? 'Votre demande : un autre devra réceptionner' : null}
              action={{ libelle: enCours === d.id ? 'Validation…' : 'Valider tel quel', disabled: enCours !== null, onClick: () => validerTelQuel(d) }} />
          ))}
        </Section>
      )}

      {/* 3 bis. Achats à confirmer avec la facture (propriétaire) */}
      {estProprietaire && aConfirmer.nombre > 0 && (
        <Section icone={FileCheck} titre={`Achats à confirmer avec la facture (${aConfirmer.nombre})`}>
          {(aConfirmer.a_confirmer || []).map(a => {
            const recu = (a.recus || []).find(x => x.present);
            const occupe = enCours !== null;
            return (
              <Ligne key={a.depense_id}
                titre={`${a.produit} : ${qte(a.quantite)} ${a.unite || ''}`}
                texte={`${new Intl.NumberFormat('fr-FR').format(a.montant)} F${a.prix_unitaire !== null ? ` · ${new Intl.NumberFormat('fr-FR').format(a.prix_unitaire)} F l'unité` : ''} · ${a.nature}`}
                note={`Saisi par ${a.par || '-'} ${depuis(a.le)} · ${recu ? 'reçu joint' : (a.recus || []).length ? 'reçu disparu du stockage' : 'aucun reçu'}`}
                actions={[
                  ...(recu ? [{ libelle: 'Voir le reçu', secondaire: true, onClick: () => voirRecu(recu.chemin) }] : []),
                  { libelle: enCours === 'achat-' + a.depense_id ? 'Envoi…' : 'Conforme', disabled: occupe, onClick: () => confirmerAchat(a, true) },
                  { libelle: 'Non conforme', secondaire: true, disabled: occupe, onClick: () => confirmerAchat(a, false) }
                ]} />
            );
          })}
        </Section>
      )}

      {/* 4. Achats sans reçu (7 jours) */}
      <input ref={recuInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="sr-only"
        aria-label="Photo du reçu" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; envoyerRecu(f); }} />
      {achatsSansRecu.length > 0 && (
        <Section icone={Camera} titre={`Achats sans reçu (${achatsSansRecu.length})`}>
          {achatsSansRecu.map(d => (
            <Ligne key={d.id}
              titre={d.description}
              texte={`${new Intl.NumberFormat('fr-FR').format(d.montant)} F · acheté le ${new Date(d.date_depense + 'T12:00:00').toLocaleDateString('fr-FR')}`}
              note={`Enregistré ${depuis(d.created_at)}${d.utilisateur_id === currentUser.id ? ' par vous' : ''} · signalé au propriétaire tant qu'il n'a pas de reçu`}
              action={{ libelle: envoiRecu === d.id ? 'Envoi…' : 'Ajouter le reçu', disabled: envoiRecu !== null, onClick: () => choisirRecu(d) }} />
          ))}
        </Section>
      )}

      {/* 5. Écarts constatés (48 h) */}
      {ecarts.length > 0 && (
        <Section icone={AlertTriangle} titre={`Écarts à la réception, 48 dernières heures (${ecarts.length})`}>
          {ecarts.map(e => (
            <Ligne key={e.id}
              titre={`Envoi n°${e.id} : ${LIEUX[e.origine]} → ${LIEUX[e.destination]}`}
              texte={(e.lignes || []).filter(l => Number(l.quantite_recue) !== Number(l.quantite_envoyee))
                .map(l => `${l.produit_nom} : envoyé ${qte(l.quantite_envoyee)}, compté ${qte(l.quantite_recue)}${l.motif_ecart ? ` · « ${l.motif_ecart} »` : ''}`).join(' — ')}
              note={`Validé par ${nomDe(e.valideur)} · compté par ${nomDe(e.receptionnaire)}`}
              action={{ libelle: 'Voir', secondaire: true, onClick: () => onNaviguer('receptions') }} />
          ))}
        </Section>
      )}

      {/* 6. Mes demandes : où en est chacune */}
      <Section icone={FileText} titre="Mes demandes (7 derniers jours)"
        lien={hasPermission('view_demandes') ? { libelle: 'Nouvelle demande', onClick: () => onNaviguer('demandes') } : null}>
        {mesDemandes.length === 0 ? (
          <p className="p-4 text-gray-500">Aucune demande ces 7 derniers jours.</p>
        ) : mesDemandes.map(d => {
          const etat = etatDemande(d);
          return (
            <div key={d.id} className="p-4 space-y-2">
              <div className="flex justify-between gap-3">
                <span className="font-medium">n°{d.id} → {d.destination} : {libelleLignes(d.lignes, 'quantite')}</span>
                <span className="text-sm text-gray-600 whitespace-nowrap">{depuis(d.created_at)}</span>
              </div>
              {etat.etape < 0 ? (
                <p className="text-sm font-medium text-gray-700">{etat.libelle}</p>
              ) : (
                <ol className="grid grid-cols-4 gap-2" aria-label={`Avancement : ${etat.libelle}`}>
                  {['Envoyée', 'Validée', 'En route', 'Reçue'].map((libelle, i) => (
                    <li key={libelle} className="space-y-1">
                      <div className={`h-1.5 rounded-full ${i < etat.etape ? 'bg-blue-700' : 'bg-gray-200'}`}></div>
                      <span className={`text-xs ${i < etat.etape ? 'text-blue-900 font-semibold' : 'text-gray-600'}`}>{libelle}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ icone: Icone, titre, alerte = false, lien = null, children }) {
  return (
    <Card hover={false} className={alerte ? 'border-2 border-orange-700' : ''}>
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
        <h3 className={`font-semibold flex items-center ${alerte ? 'text-orange-800' : ''}`}>
          <Icone className={`h-5 w-5 mr-2 ${alerte ? 'text-orange-700' : 'text-orange-600'}`} />{titre}
        </h3>
        {lien && <button onClick={lien.onClick} className="text-sm font-medium text-orange-800 hover:underline min-h-[44px]">{lien.libelle}</button>}
      </div>
      <div className="divide-y">{children}</div>
    </Card>
  );
}

function Ligne({ titre, texte, note, badge, action, actions }) {
  const boutons = actions || (action ? [action] : []);
  return (
    <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium">{titre}</div>
        <div className="text-sm text-gray-700">{texte}</div>
        <div className="text-xs text-gray-600">{note}</div>
      </div>
      {badge && <span className="self-start md:self-auto text-xs font-semibold text-blue-900 bg-blue-100 rounded-full px-3 py-1">{badge}</span>}
      {boutons.length > 0 && (
        <div className="self-start md:self-auto flex flex-wrap gap-2">
          {boutons.map(b => (
            <button key={b.libelle} onClick={b.onClick} disabled={b.disabled}
              className={`px-4 min-h-[44px] rounded-lg font-medium disabled:opacity-50 ${b.secondaire
                ? 'border border-orange-700 text-orange-800 bg-white hover:bg-orange-50'
                : 'bg-orange-700 hover:bg-orange-800 text-white'}`}>
              {b.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
