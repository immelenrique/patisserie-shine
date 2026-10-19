// Parcours complet du circuit dans l'application réelle (Chromium), avec vérification en base après chaque étape
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
  const dernierDialogue = (page) => page.dialogues[page.dialogues.length - 1] || ''

  // 1. La vendeuse demande 10 pains pour la boutique
  let p = await ouvrir('vendeuse')
  await onglet(p, 'Demandes')
  await p.getByRole('button', { name: /Nouvelle Demande/ }).click()
  await p.locator('select').first().selectOption('Boutique')
  await p.getByPlaceholder('Rechercher un produit...').fill('Pain')
  await p.getByText('Pain', { exact: true }).first().click()
  await p.getByPlaceholder('Qté').fill('10')
  await p.getByRole('button', { name: 'Créer la demande' }).click()
  await p.waitForTimeout(2000)
  const g1 = sql("SELECT id FROM demandes_groupees WHERE demandeur_id = 'c0000000-0000-4000-8000-000000000003' ORDER BY id DESC LIMIT 1")
  verifier('1. demande créée par la vendeuse, en attente', sql(`SELECT statut FROM demandes_groupees WHERE id = ${g1}`) === 'en_attente', dernierDialogue(p).split('\n')[0])
  await p.context().close()

  // 2. Le gérant valide 8 pains sur 10 (fenêtre de validation)
  p = await ouvrir('chef')
  await onglet(p, 'Demandes')
  await p.locator(`tr:has-text("#${g1}") button[title="Valider"]`).click()
  await p.locator('div.fixed input[type="number"]').first().fill('8')
  await p.getByRole('button', { name: 'Valider et envoyer' }).click()
  await p.waitForTimeout(2500)
  verifier('2. validation : message « en transit »', dernierDialogue(p).includes('en transit'), dernierDialogue(p).split('\n')[0])
  verifier('2. stock principal 30 -> 22, rien encore en boutique', sql('SELECT quantite_restante FROM produits WHERE id = 6') === '22.00' && sql('SELECT count(*) FROM stock_boutique WHERE produit_id = 6') === '0')
  const e1 = sql(`SELECT id FROM envois WHERE demande_groupee_id = ${g1}`)
  verifier('2. envoi en transit', sql(`SELECT statut FROM envois WHERE id = ${e1}`) === 'en_transit')
  await p.getByRole('button', { name: /^Traitées/ }).click()
  await p.waitForTimeout(800)
  verifier('2. colonne Réception : « En transit »', await p.locator(`tr:has-text("#${g1}")`).getByText('En transit').count() > 0)
  await p.context().close()

  // 3. La vendeuse compte 7 pains : écart signalé, motif, confirmation
  p = await ouvrir('vendeuse')
  await onglet(p, 'Réceptions')
  verifier('3. l\'envoi apparaît dans « En transit »', await p.getByText(`Envoi #${e1}`).count() === 1)
  verifier('3. la quantité envoyée n\'est pas affichée avant le comptage', !(await p.locator('main').innerText()).includes(' 8 '))
  await p.locator(`div.p-4:has-text("Envoi #${e1}")`).getByRole('button', { name: 'Réceptionner' }).click()
  await p.getByPlaceholder('Compté').fill('7')
  await p.getByRole('button', { name: 'Valider mon comptage' }).click()
  await p.getByText('Votre comptage ne correspond pas').waitFor({ timeout: 10000 })
  verifier('3. écart affiché après le comptage (envoyé 8, compté 7)', await p.getByText(/Envoyé : 8.*Compté : 7/).count() === 1)
  verifier('3. rien n\'est encore crédité', sql('SELECT count(*) FROM stock_boutique WHERE produit_id = 6') === '0')
  await p.getByRole('button', { name: 'Confirmer avec écart' }).click()
  await p.waitForTimeout(800)
  verifier('3. confirmation sans motif refusée', dernierDialogue(p).includes('motif'))
  await p.getByPlaceholder(/Motif de l'écart/).fill('1 pain tombé pendant le transport')
  await p.getByRole('button', { name: 'Confirmer avec écart' }).click()
  await p.waitForTimeout(2500)
  verifier('3. réception enregistrée avec écart', dernierDialogue(p).includes('avec écart'), dernierDialogue(p))
  verifier('3. boutique créditée de 7, au prix 500', sql('SELECT quantite_disponible || \'/\' || prix_vente FROM stock_boutique WHERE produit_id = 6') === '7/500')
  verifier('3. journal : écart de 1 motivé, signé par la vendeuse', sql(`SELECT count(*) FROM journal_stock WHERE envoi_id = ${e1} AND lieu = 'ecart' AND quantite = 1 AND auteur_id = 'c0000000-0000-4000-8000-000000000003'`) === '1')
  verifier('3. l\'envoi passe dans « Derniers envois traités »', await p.getByText('Reçu avec écart').count() > 0)
  await p.context().close()

  // 4. Le gérant demande et valide lui-même : il ne peut pas réceptionner, un autre caissier le fait
  p = await ouvrir('chef')
  await onglet(p, 'Demandes')
  await p.getByRole('button', { name: /Nouvelle Demande/ }).click()
  await p.locator('select').first().selectOption('Boutique')
  await p.getByPlaceholder('Rechercher un produit...').fill('Pain')
  await p.getByText('Pain', { exact: true }).first().click()
  await p.getByPlaceholder('Qté').fill('5')
  await p.getByRole('button', { name: 'Créer la demande' }).click()
  await p.waitForTimeout(2000)
  const g2 = sql("SELECT id FROM demandes_groupees WHERE demandeur_id = 'a0000000-0000-4000-8000-000000000001' ORDER BY id DESC LIMIT 1")
  await p.locator(`tr:has-text("#${g2}") button[title="Valider"]`).click()
  verifier('4. la fenêtre de validation prévient l\'auteur', await p.getByText('Vous êtes l\'auteur de cette demande').count() === 1)
  await p.getByRole('button', { name: 'Valider et envoyer' }).click()
  await p.waitForTimeout(2500)
  verifier('4. message : réception par une autre personne', dernierDialogue(p).includes('autre personne'))
  const e2 = sql(`SELECT id FROM envois WHERE demande_groupee_id = ${g2}`)
  await onglet(p, 'Réceptions')
  const bloc = p.locator(`div.p-4:has-text("Envoi #${e2}")`)
  verifier('4. le gérant ne voit pas de bouton « Réceptionner » sur sa propre demande', await bloc.getByRole('button', { name: 'Réceptionner' }).count() === 0)
  verifier('4. message explicatif affiché', await bloc.getByText('une autre personne doit la réceptionner').count() === 1)
  await p.context().close()
  p = await ouvrir('caissier2')
  await onglet(p, 'Réceptions')
  await p.locator(`div.p-4:has-text("Envoi #${e2}")`).getByRole('button', { name: 'Réceptionner' }).click()
  await p.getByPlaceholder('Compté').fill('5')
  await p.getByRole('button', { name: 'Valider mon comptage' }).click()
  await p.waitForTimeout(2500)
  verifier('4. un autre caissier réceptionne sans écart', dernierDialogue(p).includes('Réception enregistrée'), dernierDialogue(p))
  verifier('4. boutique à 12 (7 + 5)', sql('SELECT quantite_disponible FROM stock_boutique WHERE produit_id = 6') === '12')
  await p.context().close()

  // 5. La production envoie 3 kg de farine de l'atelier vers la boutique ; la vendeuse réceptionne
  p = await ouvrir('prod')
  await onglet(p, 'Stock Atelier')
  await p.getByRole('button', { name: 'Transférer vers Boutique' }).first().click()
  await p.locator('div.fixed input[type="number"]').first().fill('3')
  await p.getByRole('button', { name: 'Confirmer le transfert' }).click()
  await p.waitForTimeout(2500)
  verifier('5. envoi atelier : message « en transit »', dernierDialogue(p).includes('en transit'), dernierDialogue(p).split('\n')[0])
  verifier('5. atelier 20 -> 17, boutique farine pas encore créditée', sql('SELECT quantite_disponible FROM stock_atelier WHERE produit_id = 1') === '17' && sql('SELECT count(*) FROM stock_boutique WHERE produit_id = 1') === '0')
  await p.context().close()
  p = await ouvrir('vendeuse')
  await onglet(p, 'Réceptions')
  const e3 = sql("SELECT id FROM envois WHERE origine = 'atelier' ORDER BY id DESC LIMIT 1")
  await p.locator(`div.p-4:has-text("Envoi #${e3}")`).getByRole('button', { name: 'Réceptionner' }).click()
  await p.getByPlaceholder('Compté').fill('3')
  await p.getByRole('button', { name: 'Valider mon comptage' }).click()
  await p.waitForTimeout(2500)
  verifier('5. réception atelier -> boutique', sql('SELECT quantite_disponible FROM stock_boutique WHERE produit_id = 1') === '3')
  await p.context().close()

  // 6. Annulation d'un envoi non reçu par le gérant (écran Demandes)
  p = await ouvrir('vendeuse')
  await onglet(p, 'Demandes')
  await p.getByRole('button', { name: /Nouvelle Demande/ }).click()
  await p.locator('select').first().selectOption('Boutique')
  await p.getByPlaceholder('Rechercher un produit...').fill('Sucre')
  await p.getByText('Sucre', { exact: true }).first().click()
  await p.getByPlaceholder('Qté').fill('4')
  await p.getByRole('button', { name: 'Créer la demande' }).click()
  await p.waitForTimeout(2000)
  await p.context().close()
  const g3 = sql("SELECT id FROM demandes_groupees WHERE demandeur_id = 'c0000000-0000-4000-8000-000000000003' ORDER BY id DESC LIMIT 1")
  p = await ouvrir('chef')
  await onglet(p, 'Demandes')
  await p.locator(`tr:has-text("#${g3}") button[title="Valider"]`).click()
  await p.getByRole('button', { name: 'Valider et envoyer' }).click()
  await p.waitForTimeout(2500)
  verifier('6. sucre envoyé (40 -> 36)', sql('SELECT quantite_restante FROM produits WHERE id = 3') === '36.00')
  await p.getByRole('button', { name: /^Traitées/ }).click()
  await p.waitForTimeout(800)
  await p.locator(`tr:has-text("#${g3}") button[title^="Annuler l'envoi"]`).click()
  await saisir(p, 'Erreur : la boutique n\'a pas besoin de sucre')
  await p.waitForTimeout(2500)
  verifier('6. annulation : sucre rendu (36 -> 40)', sql('SELECT quantite_restante FROM produits WHERE id = 3') === '40.00', dernierDialogue(p))
  verifier('6. demande et lignes annulées', sql(`SELECT g.statut || '/' || string_agg(d.statut, ',') FROM demandes_groupees g JOIN demandes d ON d.demande_groupee_id = g.id WHERE g.id = ${g3} GROUP BY g.statut`) === 'annulee/annulee')
  await p.context().close()

  // 7. Intégrité du journal et équilibre
  verifier('7. journal intact (chaînage vérifié)', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  verifier('7. chaque envoi s\'équilibre', sql('SELECT count(*) FROM (SELECT envoi_id FROM journal_stock GROUP BY envoi_id HAVING sum(quantite) <> 0) x') === '0')

  await browser.close()
  const ko = resultats.filter(r => !r.ok).length
  console.log(`\n${resultats.length - ko}/${resultats.length} vérifications conformes`)
  process.exit(ko ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
