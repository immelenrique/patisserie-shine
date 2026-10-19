// Parcours de l'écran « À faire » et de la fenêtre de saisie, dans l'application réelle, vérifié en base
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local'],
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local']
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const psql = `psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -v ON_ERROR_STOP=1 -q`
const sql = (q) => execSync(`${psql} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }

// La base de test contient une ancienne demande vide (n°1) : on part d'une liste propre
const nettoyer = () => execSync(`${psql} -c "ALTER TABLE demandes_groupees DISABLE TRIGGER USER; UPDATE demandes_groupees SET statut = 'annulee' WHERE id = 1; ALTER TABLE demandes_groupees ENABLE TRIGGER USER"`)

// Une demande faite par la vendeuse, comme le fait l'écran Demandes (droits de la vendeuse)
const demandeVendeuse = (produit, quantite) => execSync(`${psql} -tA -f -`, { input: `
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', auth.uid(), 1) RETURNING id AS g \\gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (${produit}, ${quantite}, 'Boutique', auth.uid(), :g);
SELECT :g;
` }).toString().trim().split('\n').pop()

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui, largeur = 1400) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.on('dialog', async (d) => { page.dialogues.push(d.type() + ':' + d.message()); await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(1500)
    return page
  }
  const texte = async (page, t) => (await page.getByText(t).count()) > 0
  const fenetre = (page) => page.locator('div.fixed form')

  // 1. La vendeuse arrive sur « À faire » : la caisse en premier, sa demande en attente
  nettoyer()
  const g1 = demandeVendeuse(6, 10)
  const avancement = (page, g) => page.locator('div.p-4.space-y-2', { hasText: `n°${g} ` }).getByRole('list')
  let p = await ouvrir('vendeuse', 390)
  verifier('1. vendeuse : arrive sur « À faire »', await p.getByRole('heading', { name: 'À faire', exact: true }).count() === 1)
  verifier('1. vendeuse : bouton « Ouvrir la caisse »', await p.getByRole('button', { name: /Ouvrir la caisse/ }).count() === 1)
  verifier('1. vendeuse : rôle affiché « Boutique » (plus « employe_boutique »)', await texte(p, 'Boutique') && !(await texte(p, 'employe_boutique')))
  verifier('1. vendeuse : barre simple (6 onglets, pas de groupes)', await p.getByRole('button', { name: 'Réceptions', exact: true }).count() === 1 && await p.getByRole('button', { name: 'Demandes et réceptions', exact: true }).count() === 0)
  verifier('1. vendeuse : sa demande « en attente » avec l\'avancement', (await avancement(p, g1).getAttribute('aria-label')) === 'Avancement : En attente de validation')
  verifier('1. téléphone : pas de défilement horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await p.getByRole('button', { name: /Ouvrir la caisse/ }).click()
  await p.waitForTimeout(1500)
  verifier('1. « Ouvrir la caisse » mène à la caisse', await p.getByRole('button', { name: 'Caisse', exact: true, pressed: undefined }).first().getAttribute('aria-current') === 'page')
  await p.context().close()

  // 2. Le gérant : menu regroupé, demande à valider depuis « À faire », fenêtre récapitulative
  p = await ouvrir('chef')
  verifier('2. gérant : menu regroupé (pas d\'onglet « Stock Principal » en premier niveau)', await p.getByRole('button', { name: 'Stocks', exact: true }).count() === 1 && await p.getByRole('button', { name: 'Stock Principal', exact: true }).count() === 0)
  verifier('2. gérant : rôle affiché « Gérant »', await p.locator('header').getByText('Gérant', { exact: true }).count() === 1)
  verifier('2. gérant : « Demandes à valider (1) »', await texte(p, 'Demandes à valider (1)'))
  const avant = sql('SELECT quantite_restante FROM produits WHERE id = 6')
  await p.getByRole('button', { name: 'Valider tel quel' }).click()
  await fenetre(p).waitFor()
  verifier('2. la fenêtre rappelle les quantités et le stock', (await fenetre(p).innerText()).includes('Pain : 10') && (await fenetre(p).innerText()).includes('en stock : 30'))
  await p.getByRole('button', { name: 'Annuler', exact: true }).click()
  await p.waitForTimeout(500)
  verifier('2. annuler la fenêtre ne valide rien', sql(`SELECT statut FROM demandes_groupees WHERE id = ${g1}`) === 'en_attente')
  await p.getByRole('button', { name: 'Valider tel quel' }).click()
  await fenetre(p).locator('button[type="submit"]').evaluate((b) => { b.click(); b.click() })
  await p.waitForTimeout(2500)
  verifier('2. validée une seule fois : un envoi en route, stock 30 -> 20', sql(`SELECT count(*) || '/' || min(statut) FROM envois WHERE demande_groupee_id = ${g1}`) === '1/en_transit' && sql('SELECT quantite_restante FROM produits WHERE id = 6') === String((parseFloat(avant) - 10).toFixed(2)))
  verifier('2. la demande disparaît de la liste', !(await texte(p, 'Demandes à valider (1)')))
  verifier('2. aucune fenêtre du navigateur', p.dialogues.length === 0, p.dialogues.join(' | '))

  // 3. Refus depuis « Demandes » avec la fenêtre de saisie
  const g2 = demandeVendeuse(3, 4)
  await p.getByRole('button', { name: 'Demandes et réceptions', exact: true }).click()
  await p.waitForTimeout(1500)
  await p.locator(`tr:has-text("#${g2}") button[title="Refuser"]`).click()
  await fenetre(p).waitFor()
  await fenetre(p).locator('input').fill('Sucre réservé à l\'atelier')
  await fenetre(p).locator('button[type="submit"]').click()
  await p.waitForTimeout(2500)
  verifier('3. refus enregistré avec sa raison', sql(`SELECT statut || '/' || (details_validation->'refus'->>'raison') FROM demandes_groupees WHERE id = ${g2}`) === 'refusee/Sucre réservé à l\'atelier')
  await p.context().close()

  // 4. La vendeuse voit l'envoi à compter et sa demande « en route »
  p = await ouvrir('vendeuse')
  verifier('4. vendeuse : « À réceptionner (1) »', await texte(p, 'À réceptionner (1)'))
  verifier('4. vendeuse : demande « validée, en route »', (await avancement(p, g1).getAttribute('aria-label')) === 'Avancement : Validée, en route')
  verifier('4. vendeuse : demande refusée affichée', await texte(p, 'Refusée'))
  await p.getByRole('button', { name: 'Compter ce qui est arrivé' }).click()
  await p.waitForTimeout(1500)
  verifier('4. le bouton mène à l\'écran Réceptions', await p.getByRole('heading', { name: 'Réceptions', exact: true }).count() === 1)
  await p.context().close()

  // 5. Envoi bloqué depuis 30 h : signalé en tête chez le gérant
  sql(`ALTER TABLE envois DISABLE TRIGGER USER; UPDATE envois SET cree_le = now() - interval '30 hours' WHERE demande_groupee_id = ${g1}; ALTER TABLE envois ENABLE TRIGGER USER`)
  p = await ouvrir('chef')
  verifier('5. gérant : « En route depuis plus de 24 h (1) »', await texte(p, 'En route depuis plus de 24 h (1)'))
  await p.context().close()

  // 6. Le propriétaire trouve le récapitulatif dans « Pilotage »
  p = await ouvrir('proprietaire')
  await p.getByRole('button', { name: 'Pilotage', exact: true }).click()
  await p.waitForTimeout(800)
  verifier('6. propriétaire : rôle « Propriétaire » et Récapitulatif dans Pilotage', await p.locator('header').getByText('Propriétaire', { exact: true }).count() === 1 && await p.getByRole('button', { name: 'Récapitulatif', exact: true }).count() === 1)
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/afaire.png' })
  await p.context().close()

  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
