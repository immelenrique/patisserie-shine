// Parcours de la partie 12 (deux boulangeries) dans l'application réelle, vérifié en base.
// Abidjan : Koffi (gérant), Aya (boutique), « Attiéké » 20 en boutique à 700 F. Ouaga : l'existant.
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local'],
  vend_abj: ['a2000000-0000-4000-8000-000000000002', 'vend_abj@shine.local'],
  admin_abj: ['a2000000-0000-4000-8000-000000000001', 'admin_abj@shine.local'],
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local']
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tA -v ON_ERROR_STOP=1`, { input: q }).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.erreurs = []
    page.on('pageerror', (e) => page.erreurs.push(e.message))
    page.on('response', (r) => { if (r.status() >= 400 && !/realtime/.test(r.url())) page.erreurs.push(`${r.status()} ${r.url().replace('http://127.0.0.1:54321', '').slice(0, 120)}`) })
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null; window.__tickets = []; setInterval(() => { document.querySelectorAll('iframe').forEach(f => { try { const t = f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText; if (t && /TICKET DE CAISSE/.test(t) && !window.__tickets.includes(t)) window.__tickets.push(t) } catch (e) {} }) }, 50) }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(2000)
    return page
  }
  const nav = (p) => p.getByRole('navigation', { name: 'Navigation principale' })
  const onglet = async (p, nom, groupe) => {
    if (await nav(p).getByRole('button', { name: nom, exact: true }).count() === 0) {
      await nav(p).getByRole('button', { name: groupe, exact: true }).click()
      await p.waitForTimeout(500)
    }
    await nav(p).getByRole('button', { name: nom, exact: true }).click()
    await p.waitForTimeout(2500)
  }
  const dernier = (p) => p.dialogues[p.dialogues.length - 1] || ''
  const texte = async (p) => (await p.locator('body').innerText()).replace(/[  ]/g, ' ')

  // 1. La vendeuse d'Abidjan : sa boulangerie, ses articles seulement ; vente et ticket aux coordonnées d'Abidjan
  let p = await ouvrir('vend_abj')
  verifier('1. en-tête : « Abidjan »', await p.locator('header').getByText('Abidjan', { exact: true }).count() === 1)
  await p.getByRole('button', { name: 'Caisse', exact: true }).first().click()
  await p.waitForTimeout(2500)
  verifier('1. caisse : « Attiéké » proposé, pas le Croissant d\'Ouaga',
    await p.locator('div.cursor-pointer', { hasText: 'Attiéké' }).count() === 1 && await p.locator('div.cursor-pointer', { hasText: 'Croissant' }).count() === 0)
  await p.locator('div.cursor-pointer', { hasText: 'Attiéké' }).first().click()
  await p.getByPlaceholder('0').first().fill('1000')
  await p.getByRole('button', { name: /Finaliser la Vente/ }).click()
  await p.waitForTimeout(800)
  await p.getByRole('dialog').getByLabel(/Fond de caisse/).fill('0')
  await p.getByRole('dialog').getByRole('button', { name: 'Ouvrir la caisse', exact: true }).click()
  await p.waitForTimeout(3000)
  verifier('1. vente inscrite à Abidjan (700 F)', sql("SELECT boulangerie_id || '/' || total::int FROM ventes ORDER BY id DESC LIMIT 1") === '2/700')
  const tickets = await p.evaluate(() => window.__tickets)
  const ticket = (tickets[tickets.length - 1] || '').replace(/[  ]/g, ' ')
  verifier('1. ticket : adresse et téléphone d\'Abidjan, pas ceux d\'Ouaga', /Cocody Angré/.test(ticket) && /07 07 07 07 07/.test(ticket) && !/Balkuis/.test(ticket), ticket.split('\n').slice(0, 6).join(' | '))
  verifier('1. vendeuse d\'Abidjan : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 2. La vendeuse d'Ouaga ne voit rien d'Abidjan
  p = await ouvrir('vendeuse')
  verifier('2. en-tête : « Ouagadougou »', await p.locator('header').getByText('Ouagadougou', { exact: true }).count() === 1)
  await p.getByRole('button', { name: 'Caisse', exact: true }).first().click()
  await p.waitForTimeout(2500)
  verifier('2. caisse d\'Ouaga : Croissant, pas d\'Attiéké',
    await p.locator('div.cursor-pointer', { hasText: 'Croissant' }).count() === 1 && await p.locator('div.cursor-pointer', { hasText: 'Attiéké' }).count() === 0)
  await p.context().close()

  // 3. Le gérant d'Abidjan : ses comptes seulement, pas de choix de boulangerie
  p = await ouvrir('admin_abj')
  verifier('3. gérant d\'Abidjan : pas de sélecteur de boulangerie', await p.getByLabel('Boulangerie affichée').count() === 0)
  await onglet(p, 'Utilisateurs', 'Équipe')
  const equipe = await texte(p)
  verifier('3. utilisateurs : Aya visible, l\'équipe d\'Ouaga non', /@vend_abj/.test(equipe) && !/@vendeuse/.test(equipe) && !/@chef/.test(equipe))
  verifier('3. gérant d\'Abidjan : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 4. La propriétaire passe d'une boulangerie à l'autre
  p = await ouvrir('proprietaire')
  verifier('4. sélecteur sur Ouagadougou', await p.getByLabel('Boulangerie affichée').inputValue() === '1')
  await onglet(p, 'Récapitulatif', 'Pilotage')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(2500)
  verifier('4. récap d\'Ouaga : la vente d\'Aya n\'y est pas', !/Aya \(vend_abj\)/.test(await texte(p)))
  await p.getByLabel('Boulangerie affichée').selectOption('2')
  await p.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
  await p.waitForTimeout(2000)
  verifier('4. choix enregistré : Abidjan', sql("SELECT boulangerie_active FROM profiles WHERE username = 'proprietaire'") === '2')
  await onglet(p, 'Récapitulatif', 'Pilotage')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(2500)
  verifier('4. récap d\'Abidjan : la vente d\'Aya', /Aya \(vend_abj\)/.test(await texte(p)))
  await onglet(p, 'Utilisateurs', 'Équipe')
  await p.getByRole('button', { name: /Nouvel Utilisateur/ }).first().click()
  await p.waitForTimeout(800)
  verifier('4. création de compte : choix de la boulangerie proposé', await p.getByLabel('Boulangerie *').count() === 1)
  await p.keyboard.press('Escape').catch(() => {})
  await p.getByLabel('Boulangerie affichée').selectOption('')
  await p.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
  await p.waitForTimeout(2000)
  verifier('4. mode « toutes » enregistré', sql("SELECT coalesce(boulangerie_active::text, 'toutes') FROM profiles WHERE username = 'proprietaire'") === 'toutes')
  verifier('4. propriétaire : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/boulangeries.png', fullPage: false })
  await p.context().close()

  verifier('5. journal du stock intact (deux chaînes)', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
