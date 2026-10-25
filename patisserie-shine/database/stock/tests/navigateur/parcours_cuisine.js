// Parcours de la partie 10 (cuisine sécurisée) dans l'application réelle, vérifié en base.
// Cuisine de départ : Riz sauce 10 (1 500 F), Jus 20 (600 F, prix du stock), Poulet braisé 5 (3 000 F).
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  cuisine: ['f0000000-0000-4000-8000-000000000015', 'cuisine@shine.local'],
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
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
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

  const carteProduit = (p, nom) => p.locator('div.cursor-pointer', { hasText: nom }).first()
  const saisie = async (p, valeurs, bouton) => {
    const d = p.getByRole('dialog')
    for (const [label, v] of Object.entries(valeurs)) await d.getByLabel(label).fill(String(v))
    await d.getByRole('button', { name: bouton, exact: true }).click()
    await p.waitForTimeout(2500)
  }

  // 1. La caissière cuisine : la caisse s'ouvre à la première vente, prix et total viennent de la base
  let p = await ouvrir('cuisine')
  await onglet(p, 'Caisse Cuisine', 'Ventes')
  verifier('1. caisse fermée annoncée', await p.getByText(/Caisse fermée : elle s'ouvrira à la première vente/).count() === 1)
  await carteProduit(p, 'Riz sauce').click()
  await carteProduit(p, 'Riz sauce').click()
  await carteProduit(p, 'Jus').click()
  await p.getByPlaceholder('0', { exact: true }).last().fill('5000')
  await p.getByRole('button', { name: 'Finaliser la Vente' }).click()
  await p.waitForTimeout(1000)
  await saisie(p, { 'Fond de caisse (FCFA)': 1000 }, 'Ouvrir la caisse')
  verifier('1. reçu : 3 600 F (Jus au prix du stock), monnaie 1 400 F',
    /3\s600/.test(await p.getByRole('dialog').innerText()) && /1\s400/.test(await p.getByRole('dialog').innerText()))
  verifier('1. en base : une vente de 3 600 F, Riz 10 → 8, Jus 20 → 19, mouvements tracés',
    sql("SELECT count(*) || '/' || sum(total)::int || '/' || (SELECT quantite_disponible::int FROM stock_cuisine WHERE produit_cuisine_id = 1) || '/' || (SELECT quantite_disponible::int FROM stock_cuisine WHERE produit_cuisine_id = 2) || '/' || (SELECT count(*) FROM mouvements_stock_cuisine WHERE type_mouvement = 'vente') FROM ventes_cuisine") === '1/3600/8/19/2')
  await p.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
  await p.waitForTimeout(800)
  verifier('1. caisse ouverte affichée avec son fond', await p.getByText(/Caisse ouverte depuis .* fond 1\s000/).count() === 1)
  // Seconde vente : 1 Jus
  await carteProduit(p, 'Jus').click()
  await p.getByPlaceholder('0', { exact: true }).last().fill('600')
  await p.getByRole('button', { name: 'Finaliser la Vente' }).click()
  await p.waitForTimeout(2500)
  await p.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
  await p.waitForTimeout(800)
  // Clôture à l'aveugle : 1 000 + 3 600 + 600 = 5 200 ; un premier comptage faux
  await p.getByRole('button', { name: 'Clôturer', exact: true }).click()
  await p.waitForTimeout(800)
  await saisie(p, { 'Montant compté (FCFA)': 5000 }, 'Valider le comptage')
  verifier('1. comptage faux : écart annoncé sans le montant attendu', await p.getByText('Le comptage ne correspond pas').count() === 1 && !/5\s200/.test(await p.getByRole('dialog').innerText()))
  await saisie(p, { 'Nouveau comptage (FCFA)': 5200 }, 'Valider')
  verifier('1. clôture : attendu 5 200 F (fond + ventes cuisine), aucun écart', /Attendu : 5\s200/.test(dernier(p)) && /Aucun écart/.test(dernier(p)), dernier(p).replace(/\n/g, ' | '))
  await onglet(p, 'Stock Cuisine', 'Stocks')
  verifier('1. cuisine : ni « Ajouter Stock » ni « Corriger »', await p.getByRole('button', { name: /Ajouter Stock/ }).count() === 0 && await p.getByRole('button', { name: 'Corriger' }).count() === 0)
  verifier('1. cuisine : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 2. Le gérant : entrée de stock, correction motivée, annulation d'une vente
  p = await ouvrir('chef')
  await onglet(p, 'Stock Cuisine', 'Stocks')
  await p.getByRole('button', { name: /Ajouter Stock/ }).click()
  await p.getByRole('dialog').locator('select').selectOption('1')
  await p.getByRole('dialog').locator('input[type=number]').first().fill('5')
  await p.getByRole('button', { name: 'Ajouter le stock' }).dblclick()
  await p.waitForTimeout(2500)
  verifier('2. entrée de 5 Riz sauce comptée une seule fois (double clic)', sql("SELECT (SELECT quantite_disponible::int FROM stock_cuisine WHERE produit_cuisine_id = 1) || '/' || count(*) FROM mouvements_stock_cuisine WHERE type_mouvement = 'entree'") === '13/1')
  await p.locator('div.p-4', { hasText: 'Poulet braisé' }).getByRole('button', { name: 'Corriger' }).click()
  await p.waitForTimeout(800)
  await saisie(p, { 'Quantité réellement présente': 4, 'Motif de la correction': 'un plat tombé' }, 'Corriger')
  verifier('2. correction Poulet 5 → 4 tracée avec le motif', sql("SELECT quantite_avant::int || '/' || quantite_apres::int || '/' || raison FROM mouvements_stock_cuisine WHERE type_mouvement = 'ajustement'") === '5/4/un plat tombé')
  await p.getByRole('button', { name: /Historique/ }).first().click()
  await p.waitForTimeout(1000)
  verifier('2. historique : le motif affiché', await p.getByText('Motif : un plat tombé').count() === 1)
  await p.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first().click()
  await onglet(p, 'Caisse Cuisine', 'Ventes')
  await p.getByRole('button', { name: /Ventes du Jour/ }).click()
  await p.waitForTimeout(2000)
  const ticket = sql("SELECT numero_ticket FROM ventes_cuisine WHERE total = 600")
  await p.getByRole('button', { name: `Annuler la vente ${ticket}` }).click()
  await p.waitForTimeout(800)
  await saisie(p, { "Motif de l'annulation": 'erreur' }, 'Annuler la vente')
  verifier('2. motif trop court refusé par la fenêtre', await p.getByText(/10 caractères au moins/).count() === 1)
  await saisie(p, { "Motif de l'annulation": 'le client a rendu la boisson' }, 'Annuler la vente')
  verifier('2. vente annulée, Jus remis en stock (18 → 19)', sql(`SELECT statut || '/' || (SELECT quantite_disponible::int FROM stock_cuisine WHERE produit_cuisine_id = 2) FROM ventes_cuisine WHERE numero_ticket = '${ticket}'`) === 'annulee/19')
  verifier('2. gérant : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 3. La propriétaire lit le récapitulatif du jour
  p = await ouvrir('proprietaire')
  await onglet(p, 'Récapitulatif', 'Pilotage')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(3000)
  const recap = (await p.locator('body').innerText()).replace(/[\u00a0\u202f]/g, ' ')
  verifier('3. récap : section Cuisine, 1 ticket pour 3 600 F', /Cuisine : 1 tickets, 3 600/.test(recap))
  verifier('3. récap : l\'annulation avec son motif', /Cuisine : ventes annulées/.test(recap) && /annulé par Chef Admin \(chef\)\. Motif : « le client a rendu la boisson »/.test(recap))
  verifier('3. récap : la correction du Poulet avec son motif', /Poulet braisé : 5 → 4 par Chef Admin \(chef\)\. Motif : « un plat tombé »/.test(recap))
  verifier('3. récap : caisse cuisine clôturée sans écart', /Fatou \(cuisine\)/.test(recap))
  verifier('3. propriétaire : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/cuisine.png', fullPage: true })
  await p.context().close()

  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
