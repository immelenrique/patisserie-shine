// Parcours de la partie 5 (caisse ouverte, comptage à l'aveugle) dans l'application réelle, vérifié en base
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local']
}
const VENDEUSE = COMPTES.vendeuse[0]
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tA`, { input: q }).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }
// 6 000 écrit de n'importe quelle façon (espace, espace insécable, point)
const SIX_MILLE = /6[\s  .,]?000/

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.erreurs = []
    page.on('pageerror', (e) => page.erreurs.push(e.message))
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(1500)
    return page
  }
  const fenetre = (p) => p.getByRole('dialog')
  const vendre = async (p) => {
    const tuile = p.locator('div.cursor-pointer', { hasText: 'Croissant' }).first()
    await tuile.click()
    await tuile.click()
    await p.getByPlaceholder('0').first().fill('1000')
    await p.getByRole('button', { name: /Finaliser la Vente/ }).click()
  }
  const fermerRecu = async (p) => {
    await p.waitForTimeout(2500)
    const f = fenetre(p)
    if (await f.count()) await f.getByRole('button', { name: 'Fermer' }).first().click()
    await p.waitForTimeout(500)
  }

  // 1. La vendeuse ouvre la caisse avec un fond de 5 000 F
  let p = await ouvrir('vendeuse')
  await p.getByRole('button', { name: 'Caisse', exact: true }).first().click()
  await p.waitForTimeout(2000)
  verifier('1. caisse fermée signalée', await p.getByText(/Caisse fermée/).count() > 0)
  await p.getByRole('button', { name: 'Ouvrir la caisse', exact: true }).click()
  await fenetre(p).getByLabel(/Fond de caisse/).fill('5000')
  await fenetre(p).getByRole('button', { name: 'Ouvrir la caisse', exact: true }).click()
  await p.waitForTimeout(1500)
  verifier('1. caisse ouverte en base avec un fond de 5 000 F',
    sql(`SELECT fond_caisse_initial FROM caisses_actives WHERE caissier_id = '${VENDEUSE}' AND statut = 'ouverte'`) === '5000.00'
    || sql(`SELECT fond_caisse_initial::int FROM caisses_actives WHERE caissier_id = '${VENDEUSE}' AND statut = 'ouverte'`) === '5000')
  verifier('1. bandeau « Caisse ouverte » affiché', await p.getByText(/Caisse ouverte depuis/).count() > 0)

  // 2. Une vente de 1 000 F
  const ventesAvant = Number(sql('SELECT count(*) FROM ventes'))
  await vendre(p)
  await fermerRecu(p)
  verifier('2. vente enregistrée', Number(sql('SELECT count(*) FROM ventes')) === ventesAvant + 1)

  // 3. Clôture : 6 200 compté pour 6 000 attendus, sans que l'attendu soit montré
  await p.getByRole('button', { name: 'Clôturer', exact: true }).click()
  const premier = await fenetre(p).innerText()
  verifier('3. premier comptage : le montant attendu n\'est pas montré', !SIX_MILLE.test(premier), premier.replace(/\n/g, ' '))
  await fenetre(p).getByLabel(/Montant compté/).fill('6200')
  await fenetre(p).getByRole('button', { name: 'Valider le comptage' }).click()
  await p.getByRole('heading', { name: 'Le comptage ne correspond pas' }).waitFor({ timeout: 10000 })
  const second = await fenetre(p).innerText()
  verifier('3. écart signalé sans révéler l\'attendu', !SIX_MILLE.test(second) && /comptage n° 1/.test(second), second.replace(/\n/g, ' '))
  // Recomptage sans motif : toujours faux, la caisse reste ouverte et le comptage est noté
  await fenetre(p).getByLabel(/Nouveau comptage/).fill('6100')
  await fenetre(p).getByRole('button', { name: 'Valider', exact: true }).click()
  await p.waitForTimeout(1500)
  verifier('3. recomptage faux sans motif : on redemande (comptage n° 2)', /comptage n° 2/.test(await fenetre(p).innerText()))
  verifier('3. caisse toujours ouverte, 2 comptages gardés',
    sql(`SELECT jsonb_array_length(details->'comptages') FROM caisses_actives WHERE caissier_id = '${VENDEUSE}' AND statut = 'ouverte'`) === '2')
  // Troisième comptage, avec un motif : clôture avec l'écart
  await fenetre(p).getByLabel(/Nouveau comptage/).fill('6200')
  await fenetre(p).getByLabel(/Motif/).fill('pièce de 200 F trouvée dans le tiroir')
  await fenetre(p).getByRole('button', { name: 'Valider', exact: true }).click()
  await p.waitForTimeout(2000)
  const fin = p.dialogues.find(d => /Caisse clôturée/.test(d)) || ''
  verifier('3. clôture annoncée avec l\'écart de +200 F', /Écart : \+200/.test(fin.replace(/[  ]/g, ' ')), fin.replace(/\n/g, ' | '))
  verifier('3. relevé en base : attendu 6 000, compté 6 200, 3 comptages, motif',
    sql(`SELECT montant_theorique::int || '/' || montant_reel::int || '/' || jsonb_array_length(details_ventes->'comptages') || '/' || observations FROM releves_caisse WHERE caissier_id = '${VENDEUSE}' ORDER BY id DESC LIMIT 1`)
      === '6000/6200/3/pièce de 200 F trouvée dans le tiroir')
  verifier('3. propriétaire et gérants prévenus', Number(sql("SELECT count(*) FROM notifications WHERE type = 'alerte_generale' AND message LIKE 'Écart de caisse%'")) > 0)
  verifier('3. bandeau revenu à « Caisse fermée »', await p.getByText(/Caisse fermée/).count() > 0)

  // 4. Vente avec la caisse fermée : on demande d'abord de l'ouvrir ; annuler = pas de vente
  const avant4 = Number(sql('SELECT count(*) FROM ventes'))
  await vendre(p)
  await p.getByRole('heading', { name: 'Ouvrir la caisse' }).waitFor({ timeout: 10000 })
  await fenetre(p).getByRole('button', { name: 'Annuler' }).click()
  await p.waitForTimeout(1500)
  verifier('4. caisse fermée : ouverture demandée, annulée = aucune vente', Number(sql('SELECT count(*) FROM ventes')) === avant4)
  // Ouverture avec un fond nul, puis la vente passe
  await p.getByRole('button', { name: /Finaliser la Vente/ }).click()
  await fenetre(p).getByLabel(/Fond de caisse/).fill('0')
  await fenetre(p).getByRole('button', { name: 'Ouvrir la caisse', exact: true }).click()
  await fermerRecu(p)
  verifier('4. fond nul accepté, vente enregistrée dans la nouvelle caisse',
    Number(sql('SELECT count(*) FROM ventes')) === avant4 + 1
    && sql(`SELECT fond_caisse_initial::int FROM caisses_actives WHERE caissier_id = '${VENDEUSE}' AND statut = 'ouverte'`) === '0')
  verifier('4. aucune erreur de la page', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 5. Le propriétaire voit les caisses et l'écart dans le récapitulatif du jour
  p = await ouvrir('proprietaire')
  await p.getByRole('button', { name: 'Pilotage', exact: true }).first().click()
  await p.waitForTimeout(500)
  await p.getByRole('button', { name: 'Récapitulatif', exact: true }).click()
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(2500)
  const texte = (await p.locator('body').innerText()).replace(/[  ]/g, ' ')
  verifier('5. récap : section Caisses (2)', /Caisses \(2\)/.test(texte))
  verifier('5. récap : écart de caisse de la vendeuse, 3 comptages, premier à 6 200, motif',
    /Écarts de caisse/.test(texte) && /\+200/.test(texte) && /3 comptage\(s\), le premier à 6 200/.test(texte) && /pièce de 200 F trouvée/.test(texte))
  verifier('5. aucune erreur de la page', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/caisse.png', fullPage: true })
  await p.context().close()

  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
