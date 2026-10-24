// Parcours de la partie 8 (inventaires à l'aveugle, pertes validées par la propriétaire) dans l'application réelle,
// vérifié en base. Atelier de départ : Farine 20 kg.
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  prod: ['f0000000-0000-4000-8000-000000000011', 'prod@shine.local'],
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local'],
  vendeuse: ['c0000000-0000-4000-8000-000000000003', 'vendeuse@shine.local']
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
  const fenetre = (p) => p.getByRole('dialog')
  const nav = (p) => p.getByRole('navigation', { name: 'Navigation principale' })
  const onglet = async (p, nom, groupe) => {
    if (await nav(p).getByRole('button', { name: nom, exact: true }).count() === 0) {
      await nav(p).getByRole('button', { name: groupe, exact: true }).click()
      await p.waitForTimeout(500)
    }
    await nav(p).getByRole('button', { name: nom, exact: true }).click()
    await p.waitForTimeout(2000)
  }
  const carte = (p) => p.locator('div', { has: p.getByRole('button', { name: "Terminer l'inventaire" }) }).last()

  // 1. La production : l'inventaire du soir l'attend ; elle compte sans voir la quantité attendue
  let p = await ouvrir('prod')
  verifier('1. « À faire » : inventaire du soir de l\'atelier', await p.getByText('Atelier : inventaire du soir').count() === 1)
  await p.getByRole('button', { name: "Faire l'inventaire" }).click()
  await p.waitForTimeout(2000)
  verifier('1. un seul lieu proposé à la production (pas de choix)', await p.getByRole('tab').count() === 0)
  await p.getByRole('button', { name: "Commencer l'inventaire" }).click()
  await p.getByRole('button', { name: "Terminer l'inventaire" }).waitFor({ timeout: 10000 })
  const tableau = await p.locator('table').first().innerText()
  verifier('1. la liste montre la farine, sans la quantité attendue (20)', /Farine/.test(tableau) && !/\b20\b/.test(tableau), tableau.replace(/\s+/g, ' '))
  await p.getByLabel('Compté : Farine').fill('18')
  await p.getByRole('button', { name: "Terminer l'inventaire" }).click()
  await p.waitForTimeout(2000)
  verifier('1. écart : la farine est à recompter, sans dire combien', await p.getByText('à recompter').count() === 1 && await p.getByText(/ne correspondent pas : recomptez-les/).count() === 1)
  verifier('1. le champ a été vidé pour le recomptage', await p.getByLabel('Compté : Farine').inputValue() === '')
  await p.getByLabel('Compté : Farine').fill('18')
  await p.getByRole('button', { name: "Terminer l'inventaire" }).click()
  await p.waitForTimeout(2000)
  verifier('1. toujours différent : la raison est demandée', await p.getByLabel("Raison de l'écart : Farine").count() === 1)
  await p.getByRole('button', { name: "Terminer l'inventaire" }).click()
  await p.waitForTimeout(800)
  verifier('1. terminer sans raison : refusé à l\'écran', p.dialogues.some(d => /raison de l'écart/i.test(d)))
  await p.getByLabel("Raison de l'écart : Farine").fill('sac renversé ce matin')
  await p.getByRole('button', { name: "Terminer l'inventaire" }).click()
  await p.waitForTimeout(3000)
  const fin = (await p.locator('body').innerText()).replace(/[  ]/g, ' ')
  verifier('1. résultat affiché : attendu 20, compté 18, -2', /Inventaire terminé : 1 produit\(s\) compté\(s\), 1 écart\(s\)/.test(fin) && /attendu 20, compté 18/.test(fin), fin.slice(0, 300))
  verifier('1. en base : atelier 20 → 18, écart au journal avec la raison, 2 comptages gardés',
    sql("SELECT s.quantite_disponible::int || '/' || j.quantite::int || '/' || jsonb_array_length(l.comptages) FROM stock_atelier s, journal_stock j, inventaire_lignes l WHERE s.produit_id = 1 AND j.nature = 'inventaire' AND j.motif LIKE '%sac renversé ce matin' AND l.produit_id = 1") === '18/-2/2')
  verifier('1. « À faire » n\'attend plus d\'inventaire de l\'atelier', sql("SELECT count(*) FROM jsonb_array_elements((SELECT inventaires_a_faire(true))) x WHERE x->>'lieu' = 'atelier'") === '0')

  // 2. Elle déclare une perte : en attente, le stock ne bouge pas
  await p.getByLabel('Produit').selectOption({ label: 'Farine (Kilogramme)' })
  await p.getByLabel('Quantité perdue').fill('3')
  await p.getByLabel('Motif', { exact: true }).fill('pâte ratée, jetée')
  await p.getByRole('button', { name: 'Déclarer la perte' }).click()
  await p.waitForTimeout(2500)
  verifier('2. perte en attente, stock atelier toujours 18', sql("SELECT p.statut || '/' || s.quantite_disponible::int FROM pertes p, stock_atelier s WHERE s.produit_id = 1") === 'en_attente/18')
  verifier('2. « Mes pertes » : en attente du propriétaire', await p.getByText('En attente du propriétaire').count() === 1)
  verifier('2. production : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 3. La vendeuse ne voit que la boutique, sans réglage du rythme
  p = await ouvrir('vendeuse')
  await onglet(p, 'Inventaires', 'Stocks')
  verifier('3. vendeuse : inventaire de la boutique seulement, pas de réglage', await p.getByRole('heading', { name: 'Boutique', exact: true }).count() === 1
    && await p.getByRole('tab').count() === 0 && await p.getByText('Rythme des inventaires').count() === 0)
  verifier('3. vendeuse : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.context().close()

  // 4. La propriétaire accepte la perte, règle le rythme et lit le récapitulatif
  p = await ouvrir('proprietaire')
  verifier('4. « À faire » : pertes à valider (1)', await p.getByText('Pertes à valider (1)').count() === 1)
  await p.locator('div.p-4', { hasText: 'pâte ratée' }).getByRole('button', { name: 'Accepter', exact: true }).click()
  await fenetre(p).getByRole('button', { name: 'Accepter', exact: true }).click()
  await p.waitForTimeout(2500)
  verifier('4. perte acceptée : atelier 18 → 15, au journal', sql("SELECT p.statut || '/' || s.quantite_disponible::int || '/' || (SELECT count(*) FROM journal_stock WHERE nature = 'perte') FROM pertes p, stock_atelier s WHERE s.produit_id = 1") === 'acceptee/15/1')
  await onglet(p, 'Inventaires', 'Stocks')
  verifier('4. propriétaire : les trois lieux', await p.getByRole('tab').count() === 3)
  await p.getByLabel('Fréquence : Atelier').selectOption('hebdomadaire')
  await p.waitForTimeout(2000)
  await p.getByLabel('Jour : Atelier').selectOption('5')
  await p.waitForTimeout(2000)
  verifier('4. rythme de l\'atelier : chaque semaine, le vendredi', sql("SELECT frequence || '/' || jour FROM inventaires_reglages WHERE lieu = 'atelier'") === 'hebdomadaire/5')
  await onglet(p, 'Récapitulatif', 'Pilotage')
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.waitForTimeout(3000)
  const recap = (await p.locator('body').innerText()).replace(/[  ]/g, ' ')
  verifier('4. récap : écart d\'inventaire de la farine, avec la raison et le premier comptage',
    /Écarts d'inventaire/.test(recap) && /Farine attendu 20, compté 18/.test(recap) && /premier comptage 18/.test(recap) && /sac renversé ce matin/.test(recap))
  verifier('4. récap : perte acceptée, et section Inventaires (1) et pertes (1)', /Pertes acceptées/.test(recap) && /Inventaires \(1\) et pertes \(1\)/.test(recap))
  verifier('4. propriétaire : aucune erreur', p.erreurs.length === 0, p.erreurs.join(' | '))
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/inventaires.png', fullPage: true })
  await p.context().close()

  verifier('5. journal du stock intact', sql("SELECT (verifier_journal_stock())->>'intact'") === 'true')
  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
