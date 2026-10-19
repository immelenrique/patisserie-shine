// Parcours de la partie 2 (stock principal, atelier, boutique) dans l'application réelle, vérifié en base
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local'],
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local'],
  caissier2: ['f0000000-0000-4000-8000-000000000012', 'caissier2@shine.local'],
  prod: ['f0000000-0000-4000-8000-000000000011', 'prod@shine.local']
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }


;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); if (d.type() === 'prompt') await d.accept(page.reponsePrompt || 'test'); else await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('button', { name: 'À faire', exact: true }).first().waitFor({ timeout: 90000 })
    return page
  }
  // Navigation regroupée (plus de 7 onglets) : ouvrir le groupe si l'onglet n'est pas visible
  const GROUPE_DE = { 'Demandes': 'Demandes et réceptions', 'Réceptions': 'Demandes et réceptions', 'Stock Principal': 'Stocks', 'Stock Atelier': 'Stocks', 'Stock Boutique': 'Stocks', 'Récapitulatif': 'Pilotage', 'Tableau de bord': 'Pilotage' }
  const onglet = async (page, nom) => {
    const bouton = page.getByRole('button', { name: nom, exact: true })
    if (await bouton.count() === 0 && GROUPE_DE[nom]) { await page.getByRole('button', { name: GROUPE_DE[nom], exact: true }).first().click(); await page.waitForTimeout(500) }
    await bouton.first().click(); await page.waitForTimeout(1500)
  }
  // Fenêtre de saisie de l'application (remplace prompt) : remplit les champs dans l'ordre et confirme
  const saisir = async (page, ...valeurs) => {
    const fenetre = page.locator('div.fixed form')
    await fenetre.waitFor({ timeout: 10000 })
    const champs = fenetre.locator('input')
    for (let i = 0; i < valeurs.length; i++) await champs.nth(i).fill(valeurs[i])
    await fenetre.locator('button[type="submit"]').click()
  }
  const dernier = (page) => page.dialogues[page.dialogues.length - 1] || ''
  const ligne = (page, nom) => page.locator('tr').filter({ has: page.getByText(nom, { exact: true }) }).first()

  // 1. Le gérant crée « Beurre » (10 kg pour 5 000 F) avec un double clic
  let p = await ouvrir('chef')
  await onglet(p, 'Stock Principal')
  await p.getByRole('button', { name: /Nouveau Produit/ }).click()
  await p.getByPlaceholder('Ex: Farine de Blé').fill('Beurre')
  await p.locator('div.fixed select').first().selectOption({ label: 'Kilogramme (kg)' })
  await p.getByPlaceholder('25').fill('10')
  await p.getByPlaceholder('18500').fill('5000')
  await p.getByRole('button', { name: 'Ajouter le produit' }).evaluate((b) => { b.click(); b.click() })
  await p.waitForTimeout(3000)
  verifier('1. création : un seul produit malgré le double clic', sql("SELECT count(*) FROM produits WHERE nom = 'Beurre'") === '1')
  verifier('1. création : 10 kg à 500 F, inscrite au journal par le gérant',
    sql("SELECT p.quantite_restante || '/' || round(p.prix_achat) || '/' || (SELECT count(*) FROM journal_stock j WHERE j.produit_id = p.id AND j.nature = 'achat' AND j.auteur_id = 'a0000000-0000-4000-8000-000000000001') FROM produits p WHERE nom = 'Beurre'") === '10.00/500/1')

  // 2. Réapprovisionnement de la farine (+50 pour 30 000 F)
  await ligne(p, 'Farine').locator('button[title="Réapprovisionner"]').click()
  await p.getByPlaceholder('Ex: 20').fill('50')
  await p.getByPlaceholder('Ex: 15000').fill('30000')
  await p.getByRole('button', { name: /Confirmer le réapprovisionnement/ }).click()
  await p.waitForTimeout(2500)
  verifier('2. réappro : message de succès', dernier(p).includes('Réapprovisionnement réussi'), dernier(p).split('\n').slice(-1)[0])
  verifier('2. réappro : 100 -> 150, journal +50', sql("SELECT quantite_restante || '/' || (SELECT sum(quantite) FROM journal_stock WHERE produit_id = 1 AND nature = 'achat') FROM produits WHERE id = 1") === '150.00/50')

  // 3. Correction du sucre 40 -> 35 : motif exigé
  await ligne(p, 'Sucre').locator('button[title="Modifier"]').click()
  await p.getByPlaceholder('20', { exact: true }).fill('35')
  await p.getByRole('button', { name: 'Modifier le produit' }).click()
  await p.waitForTimeout(800)
  verifier('3. correction sans motif refusée par l\'écran', await p.getByText('Indiquez le motif de la correction').count() > 0)
  await p.getByPlaceholder(/Motif de la correction/).fill('Sac déchiré')
  await p.getByRole('button', { name: 'Modifier le produit' }).click()
  await p.waitForTimeout(2500)
  verifier('3. correction : sucre 35, journal -5 avec le motif', sql("SELECT quantite_restante || '/' || (SELECT quantite || ':' || motif FROM journal_stock WHERE produit_id = 3 AND nature = 'ajustement' ORDER BY id DESC LIMIT 1) FROM produits WHERE id = 3") === '35.00/-5.00:Sac déchiré')

  // 4. Archivage : refusé pour le pain (en stock), accepté pour le sucre une fois à zéro
  await ligne(p, 'Pain').locator('button[title^="Archiver"]').click()
  await saisir(p, 'Plus vendu')
  await p.waitForTimeout(2000)
  verifier('4. archivage du pain refusé (il reste du stock)', dernier(p).includes('Il reste'), dernier(p))
  await ligne(p, 'Sucre').locator('button[title="Modifier"]').click()
  await p.getByPlaceholder('20', { exact: true }).fill('0')
  await p.getByPlaceholder(/Motif de la correction/).fill('Fin du produit')
  await p.getByRole('button', { name: 'Modifier le produit' }).click()
  await p.waitForTimeout(2500)
  await ligne(p, 'Sucre').locator('button[title^="Archiver"]').click()
  await saisir(p, 'Plus vendu')
  await p.waitForTimeout(2500)
  verifier('4. sucre archivé, historique conservé', sql("SELECT actif || '/' || (SELECT count(*) FROM mouvements_stock WHERE produit_id = 3) FROM produits WHERE id = 3").startsWith('false/') && sql('SELECT count(*) FROM mouvements_stock WHERE produit_id = 3') !== '0')
  verifier('4. sucre retiré de la liste', await p.locator('tr').filter({ has: p.getByText('Sucre', { exact: true }) }).count() === 0)

  // 5. Vidage du stock atelier avec motif
  await onglet(p, 'Stock Atelier')
  await p.getByRole('button', { name: /Vider Tout le Stock/ }).click()
  await saisir(p, 'Consommé en production de la semaine')
  await p.waitForTimeout(2500)
  verifier('5. atelier vidé, inscrit au journal avec le motif', sql("SELECT coalesce(sum(quantite_disponible), 0) || '/' || (SELECT count(*) FROM journal_stock WHERE lieu = 'atelier' AND motif = 'Consommé en production de la semaine') FROM stock_atelier") === '0/1')
  await p.context().close()

  // 6. La vendeuse marque 3 sachets comme utilisés : comptés une seule fois ; pas d'édition du type
  p = await ouvrir('vendeuse')
  await onglet(p, 'Stock Boutique')
  await p.getByRole('button', { name: /Fournitures & Emballages/ }).click()
  await p.waitForTimeout(800)
  verifier('6. la vendeuse ne voit pas « Modifier le type »', await p.locator('button[title="Modifier le type"]').count() === 0)
  await p.locator('tr', { hasText: 'Sachets' }).first().locator('button[title="Marquer comme utilisé"]').click()
  await saisir(p, '3', 'Emballage des commandes')
  await p.waitForTimeout(2500)
  verifier('6. utilisation comptée une seule fois (3)', sql("SELECT quantite_utilisee FROM stock_boutique WHERE produit_id = 7") === '3', dernier(p))
  verifier('6. la raison saisie est inscrite au journal', sql("SELECT motif FROM journal_stock WHERE nature = 'utilisation' ORDER BY id DESC LIMIT 1") === 'Emballage des commandes')
  await p.context().close()

  // 7. Intégrité
  verifier('7. journal intact', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')

  await browser.close()
  const ko = resultats.filter(r => !r.ok).length
  console.log(`\n${resultats.length - ko}/${resultats.length} vérifications conformes`)
  process.exit(ko ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
