// Parcours de la partie 9 (production par recette, recettes protégées) dans l'application réelle, vérifié en base.
// Atelier de départ : Farine 20 kg.
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  prod: ['f0000000-0000-4000-8000-000000000011', 'prod@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local'],
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
  // Une recette déjà enregistrée par un gérant, et une ancienne recette sans rendement
  sql(`BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"${COMPTES.chef[0]}"}', true) IS NULL;
SELECT recette_enregistrer('Pain test', '[{"produit_id":1,"quantite":2}]', 50, 3, 2, 'Pain maison') IS NULL;
COMMIT;
INSERT INTO recettes (nom_produit, produit_ingredient_id, quantite_necessaire) VALUES ('Vieux gâteau', 1, 1);
INSERT INTO prix_vente_recettes (nom_produit, prix_vente, actif) VALUES ('Pain test', 150, true);`)

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

  // 1. Le gérant : la recette sans rendement lui est signalée ; il règle le rendement d'une recette
  let p = await ouvrir('chef')
  verifier('1. « À faire » : recettes à compléter (Vieux gâteau)', await p.getByText('Recettes à compléter (1)').count() === 1 && await p.getByText('Vieux gâteau').count() >= 1)
  await onglet(p, 'Recettes', 'Production')
  verifier('1. la recette sans rendement est signalée', await p.getByText(/Rendement à indiquer/).count() === 1)
  const carte = p.locator('div.overflow-hidden', { hasText: 'Pain test' }).first()
  verifier('1. fiche affichée : environ 50 « Pain maison » par fournée', /Donne environ 50 « Pain maison » par fournée/.test(await carte.innerText()))
  await carte.getByRole('button', { name: 'Modifier', exact: true }).click()
  await p.getByPlaceholder('ex. 120').fill('40')
  await p.getByRole('button', { name: /^Enregistrer \(1 ingrédient\)/ }).click()
  await p.waitForTimeout(2500)
  verifier('1. rendement modifié : 40 par fournée, l\'ancienne version gardée', sql("SELECT f.rendement::int || '/' || (SELECT count(*) FROM journal_recettes WHERE nom_produit = 'Pain test') FROM recettes_fiches f WHERE nom_produit = 'Pain test'") === '40/2')
  verifier('1. gérant : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 2. La production : pas de modification des recettes ; elle déclare deux productions
  p = await ouvrir('prod')
  await onglet(p, 'Recettes', 'Production')
  verifier('2. production : ni « Nouvelle Recette » ni « Modifier »', await p.getByRole('button', { name: /Nouvelle Recette/ }).count() === 0 && await p.getByRole('button', { name: 'Modifier', exact: true }).count() === 0)
  await onglet(p, 'Production', 'Production')
  verifier('2. la recette sans rendement est signalée à la production', await p.getByText(/Recette\(s\) sans rendement/).count() === 1)
  await p.getByRole('button', { name: 'Nouvelle production' }).click()
  await p.getByLabel('Recette').selectOption('Pain test')
  await p.getByLabel('Nombre de fournées').fill('2')
  verifier('2. les matières à retirer sont affichées (4 kg de farine)', /Farine\s+4 Kilogramme/.test((await p.getByRole('dialog').innerText()).replace(/[  ]/g, ' ')))
  await p.getByLabel('Quantité obtenue').fill('75')
  await p.getByRole('button', { name: 'Enregistrer la production' }).click()
  await p.waitForTimeout(3000)
  verifier('2. production enregistrée et envoyée', /Production n°\d+ enregistrée : 75 « Pain maison »/.test(dernier(p)) && /Envoi n°\d+ vers la boutique/.test(dernier(p)), dernier(p).split('\n')[0])
  verifier('2. en base : farine 20 → 16, pain envoyé (atelier 0), envoi de 75 en transit',
    sql("SELECT (SELECT quantite_disponible::int FROM stock_atelier WHERE produit_id = 1) || '/' || (SELECT s.quantite_disponible::int FROM stock_atelier s JOIN produits p ON p.id = s.produit_id WHERE p.nom = 'Pain maison') || '/' || (SELECT l.quantite_envoyee::int || e.statut FROM envois e JOIN envoi_lignes l ON l.envoi_id = e.id WHERE e.origine = 'atelier' ORDER BY e.id DESC LIMIT 1)") === '16/0/75en_transit')
  await p.getByRole('button', { name: 'Nouvelle production' }).click()
  await p.getByLabel('Recette').selectOption('Pain test')
  await p.getByLabel('Nombre de fournées').fill('1')
  await p.getByLabel('Quantité obtenue').fill('20')
  verifier('2. hors marge annoncé avant d\'enregistrer', await p.getByText(/Hors de la marge de la recette \(37 à 42\)/).count() === 1)
  await p.getByRole('button', { name: 'Enregistrer la production' }).click()
  await p.waitForTimeout(3000)
  verifier('2. propriétaire et gérants prévenus du rendement hors marge', sql("SELECT count(DISTINCT destinataire_id) > 0 FROM notifications WHERE message LIKE 'Rendement hors marge : Pain maison 20 obtenus%'") === 't')
  verifier('2. la liste affiche les deux productions, la seconde hors marge', await p.getByText('(hors marge)').count() === 1 && await p.locator('tbody tr').count() >= 2)
  verifier('2. production : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 3. La vendeuse compte le pain à l'arrivée
  p = await ouvrir('vendeuse')
  await onglet(p, 'Réceptions', 'Demandes et réceptions')
  const envoi = sql("SELECT id FROM envois WHERE origine = 'atelier' ORDER BY id DESC LIMIT 1")
  await p.locator(`div.p-4:has-text("Envoi #${envoi}")`).getByRole('button', { name: 'Réceptionner' }).click()
  await p.getByPlaceholder('Compté').fill('75')
  await p.getByRole('button', { name: 'Valider mon comptage' }).click()
  await p.waitForTimeout(2500)
  verifier('3. boutique : 75 « Pain maison » au prix de la recette (150 F)', sql("SELECT s.quantite_disponible::int || '/' || s.prix_vente::int FROM stock_boutique s JOIN produits p ON p.id = s.produit_id WHERE p.nom = 'Pain maison'") === '75/150')
  await p.context().close()

  // 4. La propriétaire lit le récapitulatif du jour
  p = await ouvrir('proprietaire')
  await onglet(p, 'Récapitulatif', 'Pilotage')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(3000)
  const recap = (await p.locator('body').innerText()).replace(/[  ]/g, ' ')
  verifier('4. récap : section Productions (2), la production hors marge signalée',
    /Productions \(2\)/.test(recap) && /Productions hors de la marge de la recette/.test(recap) && /20 Pain maison obtenus pour 37 à 42 attendus/.test(recap))
  verifier('4. récap : recette modifiée par le gérant, avec l\'ancienne version',
    /Recettes modifiées ou supprimées/.test(recap) && /« Pain test » modifiée par Chef/.test(recap) && /40 par fournée/.test(recap))
  verifier('4. récap : la recette sans rendement est rappelée', /Recette\(s\) sans rendement, donc inutilisables pour produire : Vieux gâteau/.test(recap))
  verifier('4. propriétaire : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/production.png', fullPage: true })
  await p.context().close()

  verifier('5. journal du stock intact', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
