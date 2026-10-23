// Parcours de la partie 6 (magasinier, achats confirmés sur facture) dans l'application réelle, vérifié en base
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  magasin: ['f0000000-0000-4000-8000-000000000014', 'magasin@shine.local'],
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local']
}
const MAG = COMPTES.magasin[0]
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (id, email) => {
  const t = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 })
  return t + '.' + crypto.createHmac('sha256', SECRET).update(t).digest('base64url')
}
const sql = (q) => execSync(`psql -h ${process.env.PGHOST || '/var/lib/postgresql/rlstest'} -p ${process.env.PGPORT || 55432} -U postgres -d shine_e2e -tA -v ON_ERROR_STOP=1`, { input: q }).toString().trim()
const resultats = []
const verifier = (nom, ok, detail = '') => { resultats.push({ ok, nom, detail }); console.log((ok ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail ? ' -> ' + detail : '')) }
const PHOTO = { name: 'facture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }

;(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    page.dialogues = []
    page.erreurs = []
    page.on('pageerror', (e) => page.erreurs.push(e.message))
    page.on('response', (r) => { if (r.status() >= 400 && !/realtime|achats_a_confirmer/.test(r.url())) page.erreurs.push(`${r.status()} ${r.url().replace('http://127.0.0.1:54321', '').slice(0, 120)}`) })
    page.on('dialog', async (d) => { page.dialogues.push(d.message()); await d.accept() })
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s); window.open = () => null }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('heading', { name: 'À faire', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForTimeout(2000)
    return page
  }
  const fenetre = (p) => p.getByRole('dialog')
  const nav = (p) => p.getByRole('navigation', { name: 'Navigation principale' })
  const texte = async (p, t) => (await p.getByText(t).count()) > 0

  // Une demande de la vendeuse en attente (créée comme depuis l'écran Demandes)
  const g = sql(`BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"${COMPTES.vendeuse[0]}"}', true) IS NULL;
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', '${COMPTES.vendeuse[0]}', 1) RETURNING id;
COMMIT;`).split('\n').filter(l => /^\d+$/.test(l))[0]
  sql(`BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"${COMPTES.vendeuse[0]}"}', true);
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 6, 'Boutique', '${COMPTES.vendeuse[0]}', ${g});
COMMIT;`)

  // 1. Le magasinier : seulement ses écrans
  let p = await ouvrir('magasin')
  const onglets = (await nav(p).getByRole('button').allInnerTexts()).map(t => t.trim())
  verifier('1. onglets du magasinier : À faire, Stock Principal, Demandes', ['À faire', 'Stock Principal', 'Demandes'].every(o => onglets.includes(o)), onglets.join(', '))
  verifier('1. ni caisse, ni réceptions, ni récapitulatif, ni équipe', !onglets.some(o => /Caisse|Réceptions|Récapitulatif|Équipe|Utilisateurs|Comptabilité/.test(o)), onglets.join(', '))
  verifier('1. rôle affiché : Magasinier', await texte(p, 'Magasinier'))
  verifier('1. il est prévenu de la nouvelle demande', Number(sql(`SELECT count(*) FROM notifications WHERE destinataire_id = '${MAG}' AND type = 'demande_nouvelle'`)) === 1)

  // 2. Il valide la demande depuis « À faire »
  const aValider = p.locator('div.p-4', { hasText: `Demande n°${g} ` }).filter({ has: p.getByRole('button', { name: 'Valider tel quel' }) })
  verifier('2. « À faire » : la demande de la vendeuse est à valider', await texte(p, /Demandes à valider \(\d+\)/) && await aValider.count() === 1)
  await aValider.getByRole('button', { name: 'Valider tel quel' }).click()
  await fenetre(p).getByRole('button', { name: 'Valider et envoyer' }).click()
  await p.waitForTimeout(2500)
  verifier('2. envoi parti, signé par le magasinier, stock principal 30 → 24',
    sql(`SELECT e.valideur_id || '/' || e.statut || '/' || p.quantite_restante::int FROM envois e, produits p WHERE e.demande_groupee_id = ${g} AND p.id = 6`) === `${MAG}/en_transit/24`)
  verifier('2. il n\'a rien à réceptionner', !(await texte(p, /À réceptionner/)))

  // 3. Il entre un achat avec la photo de la facture, puis un second sans
  await nav(p).getByRole('button', { name: 'Stock Principal', exact: true }).click()
  await p.waitForTimeout(2000)
  const ligne = (nom) => p.locator('tr').filter({ has: p.getByText(nom, { exact: true }) }).first()
  verifier('3. Stock Principal : réapprovisionner oui, corriger non',
    await ligne('Pain').locator('button[title="Réapprovisionner"]').count() === 1 && await ligne('Pain').locator('button[title*="orriger"]').count() === 0)
  await ligne('Pain').locator('button[title="Réapprovisionner"]').click()
  await p.getByPlaceholder('Ex: 20').fill('20')
  await p.getByPlaceholder('Ex: 15000').fill('10000')
  await p.locator('#recu-reappro').setInputFiles(PHOTO)
  await p.getByRole('button', { name: /Confirmer le réapprovisionnement/ }).click()
  await p.waitForTimeout(3500)
  await ligne('Farine').locator('button[title="Réapprovisionner"]').click()
  await p.getByPlaceholder('Ex: 20').fill('10')
  await p.getByPlaceholder('Ex: 15000').fill('7000')
  await p.getByRole('button', { name: /Confirmer le réapprovisionnement/ }).click()
  await p.waitForTimeout(3500)
  verifier('3. deux achats du magasinier, le premier avec sa facture',
    sql(`SELECT string_agg(montant::int || ':' || jsonb_array_length(pieces_jointes), ',' ORDER BY id) FROM depenses_comptables WHERE utilisateur_id = '${MAG}' AND achat_journal_id IS NOT NULL`) === '10000:1,7000:0')
  verifier('3. magasinier : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 4. La propriétaire compare à la facture : le pain est conforme, la farine non
  p = await ouvrir('proprietaire')
  verifier('4. « À faire » : achats à confirmer (2)', await texte(p, 'Achats à confirmer avec la facture (2)'))
  const achat = (t) => p.locator('div.p-4', { hasText: t }).filter({ has: p.getByRole('button', { name: 'Conforme', exact: true }) }).first()
  verifier('4. pain : 20 pièces, 10 000 F, 500 F l\'unité, saisi par le magasinier, facture consultable',
    /Pain : 20/.test(await achat('Pain :').innerText()) && /500 F l'unité/.test((await achat('Pain :').innerText()).replace(/[  ]/g, ' '))
    && /Moussa \(magasin\)/.test(await achat('Pain :').innerText()) && await achat('Pain :').getByRole('button', { name: 'Voir le reçu' }).count() === 1)
  verifier('4. farine : signalée sans reçu', /aucun reçu/.test(await achat('Farine :').innerText()))
  await achat('Pain :').getByRole('button', { name: 'Conforme', exact: true }).click()
  await fenetre(p).getByRole('button', { name: 'Oui, conforme' }).click()
  await p.waitForTimeout(2500)
  await achat('Farine :').getByRole('button', { name: 'Non conforme', exact: true }).click()
  await fenetre(p).getByRole('button', { name: 'Signaler' }).click()
  verifier('4. non conforme sans explication : la fenêtre la demande', await texte(p, /Ce qui ne correspond pas : obligatoire/))
  await fenetre(p).getByLabel(/Ce qui ne correspond pas/).fill('Facture : 8 kg pour 7 000 F')
  await fenetre(p).getByRole('button', { name: 'Signaler' }).click()
  await p.waitForTimeout(2500)
  verifier('4. en base : pain conforme, farine non conforme avec le constat',
    sql(`SELECT string_agg(c.conforme || ':' || coalesce(c.commentaire, '-'), ',' ORDER BY d.id) FROM confirmations_achats c JOIN depenses_comptables d ON d.id = c.depense_id`) === 'true:-,false:Facture : 8 kg pour 7 000 F')
  verifier('4. le magasinier est prévenu du constat', Number(sql(`SELECT count(*) FROM notifications WHERE destinataire_id = '${MAG}' AND message LIKE 'Achat non conforme%'`)) === 1)
  verifier('4. la section disparaît', !(await texte(p, /Achats à confirmer avec la facture/)))

  // 5. Le récapitulatif garde la trace
  await nav(p).getByRole('button', { name: 'Pilotage', exact: true }).click()
  await p.waitForTimeout(500)
  await nav(p).getByRole('button', { name: 'Récapitulatif', exact: true }).click()
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(3000)
  const recap = (await p.locator('body').innerText()).replace(/[  ]/g, ' ')
  verifier('5. récap : achat non conforme, saisi par le magasinier, avec le constat',
    /Achats non conformes à la facture/.test(recap) && /saisi par Moussa \(magasin\)/.test(recap) && /Facture : 8 kg pour 7 000 F/.test(recap))
  verifier('5. récap : la sortie validée par le magasinier', /Moussa \(magasin\)/.test(recap) && /Validations et refus \(1\)/.test(recap))
  // 6. L'écran Équipe propose le rôle
  await nav(p).getByRole('button', { name: 'Équipe', exact: true }).click()
  await p.waitForTimeout(500)
  await nav(p).locator('div.border-t').getByRole('button', { name: 'Utilisateurs', exact: true }).click()
  await p.getByRole('button', { name: /Nouvel Utilisateur/ }).first().click()
  await p.waitForTimeout(800)
  verifier('6. Équipe : le rôle Magasinier se choisit à la création', await p.locator('option[value="magasinier"]').count() > 0)
  verifier('6. propriétaire : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/magasinier.png', fullPage: true })
  await p.context().close()

  verifier('7. journal du stock intact', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
