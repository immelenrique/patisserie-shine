// Parcours de la partie 4 (achats et reçus) dans l'application réelle, vérifié en base
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local']
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }
// Une vraie petite image PNG (1 × 1 pixel), comme une photo prise au téléphone
const PHOTO = { name: 'recu.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s) }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(1500)
    return page
  }
  const GROUPE_DE = { 'Stock Principal': 'Stocks', 'Récapitulatif': 'Pilotage' }
  const onglet = async (page, nom) => {
    const bouton = page.getByRole('button', { name: nom, exact: true })
    if (await bouton.count() === 0 && GROUPE_DE[nom]) { await page.getByRole('button', { name: GROUPE_DE[nom], exact: true }).first().click(); await page.waitForTimeout(500) }
    await bouton.first().click(); await page.waitForTimeout(1500)
  }
  const ligne = (page, nom) => page.locator('tr').filter({ has: page.getByText(nom, { exact: true }) }).first()
  const dernier = (page) => page.dialogues[page.dialogues.length - 1] || ''
  const texte = async (page, t) => (await page.getByText(t).count()) > 0

  // 1. Le gérant réapprovisionne la farine avec la photo du reçu
  let p = await ouvrir('chef')
  await onglet(p, 'Stock Principal')
  await ligne(p, 'Farine').locator('button[title="Réapprovisionner"]').click()
  await p.getByPlaceholder('Ex: 20').fill('50')
  await p.getByPlaceholder('Ex: 15000').fill('30000')
  await p.locator('#recu-reappro').setInputFiles(PHOTO)
  verifier('1. la photo choisie est affichée avant l\'envoi', await texte(p, 'recu.png'))
  await p.getByRole('button', { name: /Confirmer le réapprovisionnement/ }).evaluate((b) => { b.click(); b.click() })
  await p.waitForTimeout(3500)
  verifier('1. message : dépense et reçu enregistrés', dernier(p).includes('Reçu joint'), dernier(p).split('\n').slice(-1)[0])
  verifier('1. une seule dépense de 30 000 F malgré le double clic, avec son reçu',
    sql("SELECT count(*) || '/' || max(montant) || '/' || max(jsonb_array_length(pieces_jointes)) FROM depenses_comptables WHERE reference_produit_id = 1 AND achat_journal_id IS NOT NULL") === '1/30000/1')
  verifier('1. le fichier est dans le dossier du gérant',
    sql("SELECT count(*) FROM storage.objects o JOIN depenses_comptables d ON d.pieces_jointes->0->>'chemin' = o.name WHERE d.reference_produit_id = 1 AND o.owner_id = 'a0000000-0000-4000-8000-000000000001' AND o.name LIKE 'a0000000-0000-4000-8000-000000000001/achats/%'") === '1')

  // 2. Création d'un produit sans reçu, puis ajout du reçu depuis « À faire »
  await p.getByRole('button', { name: /Nouveau Produit/ }).click()
  await p.getByPlaceholder('Ex: Farine de Blé').fill('Beurre')
  await p.locator('div.fixed select').first().selectOption({ label: 'Kilogramme (kg)' })
  await p.getByPlaceholder('25').fill('10')
  await p.getByPlaceholder('18500').fill('5000')
  await p.getByRole('button', { name: 'Ajouter le produit' }).click()
  await p.waitForTimeout(3000)
  verifier('2. création : dépense de 5 000 F sans reçu', sql("SELECT montant || '/' || jsonb_array_length(pieces_jointes) || '/' || type_depense FROM depenses_comptables WHERE description LIKE 'Achat Beurre%'") === '5000/0/achat_stock')
  await p.getByRole('button', { name: 'À faire', exact: true }).click()
  await p.waitForTimeout(2000)
  verifier('2. « À faire » : « Achats sans reçu (1) »', await texte(p, 'Achats sans reçu (1)'))
  const [choix] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Ajouter le reçu' }).click()])
  await choix.setFiles(PHOTO)
  await p.waitForTimeout(3000)
  verifier('2. reçu joint après coup', sql("SELECT jsonb_array_length(pieces_jointes) FROM depenses_comptables WHERE description LIKE 'Achat Beurre%'") === '1')
  verifier('2. la section disparaît', !(await texte(p, /Achats sans reçu/)))

  // 3. Écran Dépenses : la dépense d'un achat n'a ni « Modifier » ni « Supprimer »
  await p.getByRole('button', { name: 'Dépenses', exact: true }).click()
  await p.waitForTimeout(2500)
  const rangee = p.locator('tr', { hasText: 'Achat Beurre' }).first()
  verifier('3. dépenses : achat marqué « Achat de stock », sans modifier ni supprimer',
    await rangee.getByText('Achat de stock').count() === 1 && await rangee.locator('button[title="Modifier"]').count() === 0 && await rangee.locator('button[title="Supprimer"]').count() === 0)
  await p.context().close()

  // 4. Un achat sans reçu (sucre), puis le propriétaire lit le récapitulatif du jour
  execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -q -v ON_ERROR_STOP=1 -f -`, { input: `
BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', true);
SELECT reapprovisionner_produit(3, 5, 1500);
COMMIT;` })
  p = await ouvrir('proprietaire')
  await onglet(p, 'Récapitulatif')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.getByText(/Achats de stock :/).waitFor({ timeout: 20000 })
  verifier('4. récap : achats du jour 36 500 F', await texte(p, /Achats de stock : 36\s500/))
  verifier('4. récap : « Achats sans reçu (1) » (le sucre)', await texte(p, 'Achats sans reçu (1)'))
  verifier('4. récap : deux reçus consultables', await p.getByRole('button', { name: 'Voir le reçu' }).count() === 2)
  const [onglet2] = await Promise.all([p.context().waitForEvent('page'), p.getByRole('button', { name: 'Voir le reçu' }).first().click()])
  await onglet2.waitForLoadState().catch(() => {})
  await p.waitForTimeout(1500)
  verifier('4. « Voir le reçu » ouvre un lien temporaire', onglet2.url().includes('/storage/v1/object/sign/depenses-pieces-jointes/'), onglet2.url())
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/achats.png', fullPage: true })
  await p.context().close()

  verifier('5. journal du stock intact', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
