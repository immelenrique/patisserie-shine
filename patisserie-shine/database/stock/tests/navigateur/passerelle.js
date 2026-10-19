// Passerelle locale qui imite Supabase : /rest/v1 -> PostgREST, /auth/v1/user -> utilisateur du jeton,
// /storage/v1 -> stockage de fichiers minimal (dépôt dans son propre dossier, lien signé, suppression),
// avec les mêmes règles que l'espace « depenses-pieces-jointes » de la production
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const DOSSIER = process.env.STOCKAGE || path.join(os.tmpdir(), 'shine-stockage')
const PG = ['-h', process.env.PGHOST || '/var/run/postgresql', '-p', process.env.PGPORT || '55432', '-U', 'postgres', '-d', 'shine_e2e', '-tA', '-v', 'ON_ERROR_STOP=1']
const sql = (requete, vars = {}) => execFileSync('psql', [...PG, ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`])], { input: requete }).toString().trim()
const lire = (req) => new Promise((ok) => { const morceaux = []; req.on('data', (m) => morceaux.push(m)); req.on('end', () => ok(Buffer.concat(morceaux))) })
const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(corps)) }
const estAdmin = (uid) => sql("SELECT count(*) FROM profiles WHERE id = :'uid' AND role = 'admin' AND actif", { uid }) === '1'

async function stockage(req, res, url) {
  const route = decodeURIComponent(url.pathname.replace('/storage/v1/object/', ''))
  // Lien signé : lecture du fichier
  if (req.method === 'GET' && route.startsWith('sign/')) {
    const fichier = path.join(DOSSIER, route.slice(5))
    if (!url.searchParams.get('token') || !fs.existsSync(fichier)) return json(res, 400, { error: 'not_found' })
    // Comme Supabase : servi avec son type (une image s'affiche au lieu d'être téléchargée)
    const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' }
    res.writeHead(200, { 'content-type': types[fichier.split('.').pop().toLowerCase()] || 'application/octet-stream', ...cors }); return res.end(fs.readFileSync(fichier))
  }
  let c = null; try { c = decode((req.headers.authorization || '').replace('Bearer ', '')) } catch {}
  if (!c || !c.sub) return json(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'jeton absent' })
  const corps = await lire(req)
  if (req.method === 'POST' && route.startsWith('sign/')) {
    const [espace, ...reste] = route.slice(5).split('/')
    const nom = reste.join('/')
    if (reste[0] !== c.sub && !estAdmin(c.sub)) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    if (sql("SELECT count(*) FROM storage.objects WHERE bucket_id = :'b' AND name = :'n'", { b: espace, n: nom }) !== '1') return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    return json(res, 200, { signedURL: `/object/sign/${espace}/${nom}?token=${crypto.randomUUID()}` })
  }
  if (req.method === 'DELETE') {
    const espace = route
    const { prefixes = [] } = JSON.parse(corps.toString() || '{}')
    const admin = estAdmin(c.sub)
    const supprimes = []
    for (const nom of prefixes) {
      if (nom.split('/')[0] !== c.sub && !admin) continue
      sql("DELETE FROM storage.objects WHERE bucket_id = :'b' AND name = :'n'", { b: espace, n: nom })
      fs.rmSync(path.join(DOSSIER, espace, nom), { force: true }); supprimes.push({ name: nom })
    }
    return json(res, 200, supprimes)
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const [espace, ...reste] = route.split('/')
    const nom = reste.join('/')
    // Règle de la production : on ne dépose que dans son propre dossier
    if (espace !== 'depenses-pieces-jointes' || reste[0] !== c.sub) return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
    if (sql("SELECT count(*) FROM storage.objects WHERE bucket_id = :'b' AND name = :'n'", { b: espace, n: nom }) === '1') return json(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
    const fichier = path.join(DOSSIER, espace, nom)
    fs.mkdirSync(path.dirname(fichier), { recursive: true }); fs.writeFileSync(fichier, corps)
    const id = sql("INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata) VALUES (:'b', :'n', :'u', :'u', jsonb_build_object('size', :t::bigint)) RETURNING id", { b: espace, n: nom, u: c.sub, t: corps.length })
    return json(res, 200, { Key: `${espace}/${nom}`, Id: id })
  }
  return json(res, 404, { error: 'route inconnue' })
}

const PGRST = 'http://127.0.0.1:3001'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (url.pathname.startsWith('/auth/v1/')) {
    const jeton = (req.headers.authorization || '').replace('Bearer ', '')
    let c = null; try { c = decode(jeton) } catch {}
    res.writeHead(c ? 200 : 401, { 'content-type': 'application/json', ...cors })
    return res.end(JSON.stringify(c ? { id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email } : { msg: 'no' }))
  }
  if (url.pathname.startsWith('/storage/v1/object/')) return stockage(req, res, url).catch((e) => json(res, 500, { error: String(e) }))
  if (!url.pathname.startsWith('/rest/v1')) { res.writeHead(404, cors); return res.end() }
  const cible = PGRST + url.pathname.replace('/rest/v1', '') + url.search
  const entetes = { ...req.headers }; delete entetes.host
  const p = http.request(cible, { method: req.method, headers: entetes }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res)
  })
  p.on('error', (e) => { res.writeHead(502, cors); res.end(String(e)) })
  req.pipe(p)
}).listen(54321, '127.0.0.1', () => console.log('passerelle prête'))
