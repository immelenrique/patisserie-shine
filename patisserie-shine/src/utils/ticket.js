// src/utils/ticket.js
// Ticket de caisse imprimé (modèle choisi par la propriétaire), commun à la boutique et à la cuisine.
// recu : { numero, date ('jj/mm/aaaa hh:mm:ss'), items: [{ nom, prix, quantite }], total, montant_donne,
//          monnaie_rendue, vendeur, lieu ('Cuisine' pour la caisse cuisine, sinon rien) }
import { utils } from './formatters'

const ENTREPRISE = {
  activites: 'PÂTISSERIE · BOULANGERIE · GLACIER',
  adresse: ['Balkuis, non loin de la station Shell', 'Ouagadougou'],
  telephones: '74 48 67 98 / 05 07 39 00',
  merci: 'Merci pour votre confiance !',
  slogan: ['Le goût qui illumine', 'vos moments']
}

const montant = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0))

export function contenuTicket(recu) {
  const e = utils.escapeHtml
  const [jour, heure = ''] = String(recu.date || new Date().toLocaleString('fr-FR')).split(' ')
  const items = recu.items || []
  const sousTotal = items.reduce((s, i) => s + (Number(i.prix) || 0) * (Number(i.quantite) || 0), 0)
  const remise = Math.max(0, Math.round(sousTotal - (Number(recu.total) || 0)))
  const ligne = (gauche, droite, gras = false) =>
    `<div class="l${gras ? ' g' : ''}"><span>${gauche}</span><span>${droite}</span></div>`

  return `
  <div class="ticket">
    <div class="c">
      <img src="${window.location.origin}/logo-shine.png" alt="Pâtisserie Shine" class="logo">
      <div class="act">${ENTREPRISE.activites}</div>
      <div class="adr">${ENTREPRISE.adresse.map(e).join('<br>')}</div>
      <div class="tel">${e(ENTREPRISE.telephones)}</div>
    </div>
    <div class="sep"></div>
    <div class="titre">TICKET DE CAISSE${recu.lieu ? ` — ${e(recu.lieu).toUpperCase()}` : ''}</div>
    <div>N° : ${e(recu.numero)}</div>
    <div>Date : ${e(jour)}</div>
    <div>Heure : ${e(heure.slice(0, 5))}</div>
    <div>Caissier(ère) : ${e(recu.vendeur || '-')}</div>
    <div class="sep"></div>
    <table>
      <thead><tr><th class="q">Qté</th><th class="d">Désignation</th><th class="n">P.U</th><th class="n">Total</th></tr></thead>
      <tbody>
        ${items.map(i => `<tr><td class="q">${e(i.quantite)}</td><td class="d">${e(i.nom)}</td><td class="n">${montant(i.prix)}</td><td class="n">${montant((Number(i.prix) || 0) * (Number(i.quantite) || 0))}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="sep"></div>
    <div class="tot">
      ${ligne('Sous-total :', montant(sousTotal))}
      ${ligne('Remise :', montant(remise), true)}
      ${ligne('Total :', montant(recu.total), true)}
    </div>
    <div class="sep"></div>
    <div>Mode de paiement : Espèces</div>
    ${ligne('Montant reçu :', montant(recu.montant_donne))}
    ${ligne('Monnaie :', montant(recu.monnaie_rendue))}
    <div class="sep"></div>
    <div class="c merci">${e(ENTREPRISE.merci)}</div>
    <div class="c">${ENTREPRISE.slogan.map(e).join('<br>')}</div>
  </div>`
}

const STYLE = `
  @page { size: auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .ticket { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; width: 100%; box-sizing: border-box; padding: 4px 3mm 8px; line-height: 1.35; }
  .c { text-align: center; }
  .logo { width: 38mm; max-width: 80%; display: block; margin: 0 auto 2px; }
  .act { font-size: 9px; letter-spacing: 1px; font-weight: bold; margin-top: 2px; }
  .adr { margin-top: 4px; }
  .tel { font-weight: bold; margin-top: 2px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .titre { text-align: center; font-weight: bold; font-size: 15px; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; border-bottom: 1px solid #000; padding: 1px 0; }
  td { padding: 1px 0; vertical-align: top; }
  .q { width: 9%; text-align: left; }
  .d { padding-right: 3px; }
  .n { text-align: right; white-space: nowrap; padding-left: 4px; }
  .l { display: flex; justify-content: space-between; }
  .tot { padding-left: 25%; }
  .tot .l span:last-child { font-weight: bold; }
  .g { font-weight: bold; font-size: 13px; }
  .merci { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-style: italic; font-size: 17px; margin: 4px 0 3px; }
`

// Imprime le ticket : fenêtre d'impression, ou cadre caché si les fenêtres sont bloquées.
// L'impression attend que le logo soit chargé (sinon il manquerait sur le papier).
export function imprimerTicket(recu) {
  if (!recu) return
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${utils.escapeHtml(recu.numero)}</title>
    <style>${STYLE}</style></head><body>${contenuTicket(recu)}</body></html>`

  const imprimer = (fenetre, fin) => {
    const go = () => setTimeout(() => { fenetre.focus(); fenetre.print(); fin() }, 150)
    const logo = fenetre.document.querySelector('.logo')
    if (!logo || logo.complete) go()
    else { logo.onload = go; logo.onerror = go }
  }

  const fenetre = window.open('', '_blank', 'width=400,height=700')
  if (fenetre) {
    fenetre.document.open()
    fenetre.document.write(html)
    fenetre.document.close()
    imprimer(fenetre, () => {
      fenetre.onafterprint = () => fenetre.close()
      setTimeout(() => { if (!fenetre.closed) fenetre.close() }, 60000)
    })
    return
  }

  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, { position: 'absolute', width: '0', height: '0', border: 'none' })
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  imprimer(iframe.contentWindow, () => setTimeout(() => iframe.remove(), 1000))
}
