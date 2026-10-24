// Tour de tous les écrans (propriétaire et caissière) : aucune erreur JavaScript ni erreur React,
// puis une vente complète en caisse vérifiée en base. Sert de contrôle après une mise à jour de
// Next.js ou de React.
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local']
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }
// Le banc n'a pas de service temps réel (notifications en direct) : ces erreurs-là sont attendues
const ATTENDU = /realtime\/v1|WebSocket/

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.erreurs = []
    page.dialogues = []
    page.on('pageerror', (e) => page.erreurs.push('exception : ' + e.message))
    // « Failed to load resource » ne dit pas quelle ressource : les requêtes en échec sont relevées plus bas, avec leur adresse
    page.on('console', (m) => { if (m.type() === 'error' && !ATTENDU.test(m.text()) && !/^Failed to load resource/.test(m.text())) page.erreurs.push('console : ' + m.text().slice(0, 160)) })
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); await d.accept() })
    // Requêtes en échec, avec leur adresse (la console ne la donne pas)
    page.on('response', (r) => { if (r.status() >= 400 && (process.env.TOUT || !ATTENDU.test(r.url()))) page.erreurs.push(`requête ${r.status()} : ${r.request().method()} ${decodeURIComponent(r.url().replace(APP, '').replace('http://127.0.0.1:54321', '')).slice(0, 180)}`) })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(1500)
    return page
  }

  // 1. Le propriétaire ouvre chaque groupe du menu, puis chaque onglet du groupe
  let p = await ouvrir('proprietaire')
  const nav = p.getByRole('navigation', { name: 'Navigation principale' })
  const groupes = await nav.locator('div').first().getByRole('button').allInnerTexts()
  let ecrans = 0
  for (const groupe of groupes) {
    await nav.locator('div').first().getByRole('button', { name: groupe.trim(), exact: true }).click()
    await p.waitForTimeout(1500)
    ecrans++
    const sousOnglets = nav.locator('div.border-t').getByRole('button')
    const noms = (await sousOnglets.count()) ? await sousOnglets.allInnerTexts() : []
    for (const nom of noms.slice(1)) {
      await nav.locator('div.border-t').getByRole('button', { name: nom.trim(), exact: true }).click()
      await p.waitForTimeout(1500)
      ecrans++
    }
  }
  verifier(`1. propriétaire : ${ecrans} écrans ouverts sans erreur`, p.erreurs.length === 0, [...new Set(p.erreurs)].join('\n      '))
  verifier('1. aucune fenêtre d\'erreur affichée', !p.dialogues.some(d => /erreur/i.test(d)), p.dialogues.join(' | '))
  await p.context().close()

  // 2. La caissière : écrans, puis une vente de 2 croissants malgré un double clic
  p = await ouvrir('vendeuse')
  for (const nom of ['Tableau de bord', 'Stock Boutique', 'Demandes', 'Réceptions', 'Caisse']) {
    await p.getByRole('button', { name: nom, exact: true }).first().click()
    await p.waitForTimeout(1500)
  }
  const ventesAvant = sql('SELECT count(*) FROM ventes')
  const stockAvant = sql('SELECT quantite_disponible - quantite_vendue FROM stock_boutique WHERE produit_id = 2')
  const tuile = p.locator('div.cursor-pointer', { hasText: 'Croissant' }).first()
  await tuile.click()
  await tuile.click()
  await p.getByPlaceholder('0').fill('1000')
  await p.getByRole('button', { name: /Finaliser la Vente/ }).evaluate((b) => { b.click(); b.click() })
  // Caisse fermée : la vente demande d'abord le fond de caisse (partie 5)
  const ouverture = p.getByRole('dialog').getByLabel(/Fond de caisse/)
  if (await ouverture.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
    await ouverture.fill('0')
    await p.getByRole('dialog').getByRole('button', { name: 'Ouvrir la caisse', exact: true }).click()
  }
  await p.waitForTimeout(3500)
  verifier('2. caisse : une seule vente enregistrée malgré le double clic', sql('SELECT count(*) FROM ventes') === String(Number(ventesAvant) + 1))
  verifier('2. caisse : 2 croissants pour 1 000 F, stock décompté de 2',
    sql("SELECT total || '/' || (SELECT sum(quantite) FROM lignes_vente l WHERE l.vente_id = v.id) FROM ventes v ORDER BY id DESC LIMIT 1") === '1000/2'
    && sql('SELECT quantite_disponible - quantite_vendue FROM stock_boutique WHERE produit_id = 2') === String(Number(stockAvant) - 2))
  verifier('2. caissière : écrans et vente sans erreur', p.erreurs.length === 0, [...new Set(p.erreurs)].join('\n      '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/ecrans.png' })
  await p.context().close()

  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
