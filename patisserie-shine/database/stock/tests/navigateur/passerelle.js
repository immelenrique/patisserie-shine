// Passerelle locale qui imite Supabase : /rest/v1 -> PostgREST, /auth/v1/user -> utilisateur du jeton
const http = require('http')
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
  if (!url.pathname.startsWith('/rest/v1')) { res.writeHead(404, cors); return res.end() }
  const cible = PGRST + url.pathname.replace('/rest/v1', '') + url.search
  const entetes = { ...req.headers }; delete entetes.host
  const p = http.request(cible, { method: req.method, headers: entetes }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res)
  })
  p.on('error', (e) => { res.writeHead(502, cors); res.end(String(e)) })
  req.pipe(p)
}).listen(54321, '127.0.0.1', () => console.log('passerelle prête'))
