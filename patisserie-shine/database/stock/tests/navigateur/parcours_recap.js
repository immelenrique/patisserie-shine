// Parcours de la partie 3 (récapitulatif) dans l'application réelle : une journée est jouée en base avec les
// fonctions de l'application, puis le propriétaire ouvre l'écran ; le gérant ne doit pas le voir.
const { chromium } = require('playwright')
const crypto = require('crypto')
const { execSync } = require('child_process')
const SECRET = 'secret-de-test-local-uniquement-0123456789'
const APP = 'http://127.0.0.1:3100'
const COMPTES = {
  proprietaire: ['b0000000-0000-4000-8000-000000000002', 'proprietaire@shine.local'],
  chef: ['a0000000-0000-4000-8000-000000000001', 'chef@shine.local']
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

// La journée : écart à la réception, réception par le valideur, refus motivé, correction motivée
const JOURNEE = `
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', auth.uid(), 1) RETURNING id AS g1 \\gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 10, 'Boutique', auth.uid(), :g1);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', auth.uid(), 1) RETURNING id AS g2 \\gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (6, 4, 'Boutique', auth.uid(), :g2);
INSERT INTO demandes_groupees (destination, demandeur_id, nombre_produits) VALUES ('Boutique', auth.uid(), 1) RETURNING id AS g3 \\gset
INSERT INTO demandes (produit_id, quantite, destination, demandeur_id, demande_groupee_id) VALUES (3, 2, 'Boutique', auth.uid(), :g3);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000001"}', false);
SELECT (valider_demande_groupee(:g1) ->> 'envoi_id') AS e1 \\gset
SELECT (valider_demande_groupee(:g2) ->> 'envoi_id') AS e2 \\gset
SELECT refuser_demande(:g3, 'Sucre réservé à l''atelier') IS NOT NULL AS ok \\gset
SELECT receptionner_envoi(:e2, '[{"produit_id":6,"quantite_recue":4}]') IS NOT NULL AS ok \\gset
SELECT ajuster_stock_principal(1, 95, 'Sac de farine percé') IS NOT NULL AS ok \\gset
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"c0000000-0000-4000-8000-000000000003"}', false);
SELECT receptionner_envoi(:e1, '[{"produit_id":6,"quantite_recue":8,"motif":"2 pains manquants dans le carton"}]', true) IS NOT NULL AS ok \\gset
`

;(async () => {
  execSync(`${psql} -f -`, { input: JOURNEE })
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ouvrir = async (qui) => {
    const [id, email] = COMPTES[qui]
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await ctx.newPage()
    const session = { access_token: jeton(id, email), refresh_token: 'r', token_type: 'bearer', expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id, email, aud: 'authenticated', role: 'authenticated' } }
    await page.addInitScript((s) => { localStorage.setItem('sb-127-auth-token', s) }, JSON.stringify(session))
    await page.goto(APP)
    await page.getByRole('button', { name: 'Tableau de bord', exact: true }).first().waitFor({ timeout: 90000 })
    return page
  }
  const texte = async (page, t) => (await page.getByText(t).count()) > 0

  // 1. Le gérant n'a pas l'onglet
  let p = await ouvrir('chef')
  await p.waitForTimeout(1500)
  verifier('1. gérant : pas d\'onglet Récapitulatif', (await p.getByRole('button', { name: 'Récapitulatif', exact: true }).count()) === 0)
  await p.context().close()

  // 2. Le propriétaire ouvre l'écran : la veille s'affiche par défaut, sans activité
  p = await ouvrir('proprietaire')
  await p.getByRole('button', { name: 'Récapitulatif', exact: true }).first().click()
  await p.getByText(/Récapitulatif .* généré le/).waitFor({ timeout: 20000 })
  verifier('2. propriétaire : la veille par défaut, rien d\'anormal', await texte(p, 'Rien d\'anormal sur la période.'))

  // 3. Aujourd'hui : les alertes de la journée
  await p.getByRole('button', { name: "Aujourd'hui", exact: true }).click()
  await p.getByText('Validé et réceptionné par la même personne (1)').waitFor({ timeout: 20000 }).catch(() => {})
  verifier('3. alerte : validé et réceptionné par la même personne', await texte(p, 'Validé et réceptionné par la même personne (1)'))
  verifier('3. alerte : écart de -2 avec le motif de la vendeuse', await texte(p, 'Écarts à la réception (1)') && await texte(p, '« 2 pains manquants dans le carton »'))
  verifier('3. alerte : correction de la farine avec son motif', await texte(p, 'Corrections de stock (1)') && await texte(p, '« Sac de farine percé »'))
  verifier('3. journal : intégrité affichée', await texte(p, /Journal du stock intact \(\d+ mouvements vérifiés\)/))
  verifier('3. validations : refus visible avec sa raison', await texte(p, '« Sucre réservé à l\'atelier »'))
  const chiffres = (await p.locator('div.grid', { hasText: 'Réceptions' }).first().innerText()).replace(/\s+/g, ' ')
  const nbDemandes = sql("SELECT count(*) FROM demandes_groupees WHERE created_at >= current_date")
  verifier('3. chiffres : demandes du jour, 2 validées, 1 refusée, 2 réceptions, 1 écart',
    chiffres.includes(`Demandes ${nbDemandes}`) && chiffres.includes('Validées 2') && chiffres.includes('Refusées 1') && chiffres.includes('Réceptions 2') && chiffres.includes('Écarts 1'), chiffres)
  await p.screenshot({ path: process.env.CAPTURE || '/tmp/recap.png', fullPage: true })

  // 4. Période personnalisée inversée : refusée par l'écran
  await p.locator('input[name="du"]').fill(sql("SELECT current_date"))
  await p.locator('input[name="au"]').fill(sql("SELECT current_date - 1"))
  await p.getByRole('button', { name: 'Générer la période' }).click()
  await p.waitForTimeout(800)
  verifier('4. période inversée : message d\'erreur', await texte(p, 'Période invalide'))

  // 5. Période personnalisée de 4 jours
  await p.locator('input[name="du"]').fill(sql("SELECT current_date - 3"))
  await p.locator('input[name="au"]').fill(sql("SELECT current_date"))
  await p.getByRole('button', { name: 'Générer la période' }).click()
  await p.waitForTimeout(2000)
  verifier('5. période de 4 jours : les mêmes alertes', await texte(p, 'Validé et réceptionné par la même personne (1)'))
  verifier('5. la base n\'a rien modifié en lisant (stock farine toujours 95)', sql('SELECT quantite_restante FROM produits WHERE id = 1') === '95.00')

  await browser.close()
  const ko = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - ko.length}/${resultats.length} vérifications conformes`)
  process.exit(ko.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
