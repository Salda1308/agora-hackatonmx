// Solo fixtures locales de D7. Nunca conecta a un Supabase ni envía pagos.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../public/', import.meta.url))
const port = Number(process.env.D7_FIXTURE_PORT || 56471)
const org = { id: 'f7000000-0000-0000-0000-000000000001', nombre: 'Casa Abierta · ejemplo', slug: 'casa-abierta-ejemplo', logo_url: null, categoria: 'albergue', direccion_publica: 'Ciudad de México', latitud: null, longitud: null, es_ejemplo: true }
const store = { id: 'f7000000-0000-0000-0000-000000000002', nombre: 'La Despensa · ejemplo', slug: 'despensa-ejemplo' }
const request = { id: 'f7000000-0000-0000-0000-000000000003', organizacion_id: org.id, titulo: 'Agua para compartir, todos los días', descripcion: 'Cada garrafón ayuda a que más personas tengan agua limpia en su mesa. Juntamos 50 unidades para este mes.', estado: 'publicada', recurrente: false, publicada_en: '2026-11-15T06:00:00Z', creada_en: '2026-11-15T06:00:00Z', es_ejemplo: true, organizaciones: org, organizacion: org, tienda: store, solicitud_articulos: [{ id: 'f7000000-0000-0000-0000-000000000004', nombre: 'Garrafón de 20 litros', precio_centavos: 4500, cantidad: 50, unidades_pagadas: 32, unidades_listas: 10, unidades_entregadas: 8 }] }
const day = { id: 'f7000000-0000-0000-0000-000000000005', organizacion_id: org.id, titulo: 'Un sábado para hacer comunidad', descripcion: 'Nos encontramos para preparar despensas. Trae tus ganas de ayudar, aquí ponemos lo demás.', creada_en: '2026-11-15T05:00:00Z', inicia_en: '2026-11-21T16:00:00Z', termina_en: '2026-11-21T20:00:00Z', ubicacion: 'Casa Abierta, Ciudad de México', cupos: 20, es_ejemplo: true, organizacion: org }
const base = { organizacion_id: org.id, organizacion_nombre: org.nombre, organizacion_slug: org.slug, organizacion_logo: null, me_gusta: 12, comentarios: 2, yo_di_me_gusta: false, medios: [], extra: { ejemplo: true } }
const feed = [
  { ...base, tipo: 'publicacion', id: 'f7000000-0000-0000-0000-000000000006', creado_en: '2026-11-15T07:00:00Z', titulo: null, texto: 'Así se ve una comunidad que se cuida. 💛\nHoy preparamos las primeras despensas del mes. Gracias a cada persona que puso un poquito de su parte.', medios: [{ tipo: 'imagen', ruta: `${org.id}/ejemplo.svg` }] },
  { ...base, tipo: 'solicitud', id: request.id, creado_en: request.publicada_en, titulo: request.titulo, texto: request.descripcion, extra: { ejemplo: true, unidades_pagadas: 32, unidades_totales: 50, categoria: 'albergue', tienda: store } },
  { ...base, tipo: 'jornada', id: day.id, creado_en: day.creada_en, titulo: day.titulo, texto: day.descripcion, extra: { ejemplo: true, inicia_en: day.inicia_en, termina_en: day.termina_en, ubicacion: day.ubicacion, cupos: 20, cupos_ocupados: 4 } },
]
for (let i = 3; i < 21; i++) feed.push({ ...base, tipo: 'publicacion', id: `f7000000-0000-0000-0000-${String(10 + i).padStart(12, '0')}`, creado_en: new Date(Date.parse('2026-11-15T04:00:00Z') - i * 60000).toISOString(), titulo: null, texto: `Historia de ejemplo ${i + 1}. Gracias por acompañarnos y hacer que la ayuda llegue.` })
const initialComments = [
  { id: 'comment-1', autor: 'Vecino A1B2', es_organizacion: false, texto: '¡Gracias por compartir lo que están haciendo!', creado_en: '2026-11-15T08:00:00Z', es_mio: false },
  { id: 'comment-2', autor: org.nombre, es_organizacion: true, texto: 'Cada gesto cuenta. Gracias por estar aquí.', creado_en: '2026-11-15T07:30:00Z', es_mio: false },
]
let comments = structuredClone(initialComments), mode = 'rpc', liked = false, log = [], signedInRole = 'comprador'
const uid = 'f7000000-0000-0000-0000-000000000099'
function user() { return { id: uid, aud: 'authenticated', role: 'authenticated', email: `${signedInRole}@demo.agora.test`, email_confirmed_at: '2026-11-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z', app_metadata: {}, user_metadata: {} } }
function jwt() { return ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now()/1000)+3600, role:'authenticated' })).toString('base64url'), 'local-fixture'].join('.') }
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'authorization,apikey,content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  let body = ''; for await (const chunk of req) body += chunk
  let input = {}; try { input = JSON.parse(body || '{}') } catch { /* empty */ }
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
  if (url.pathname === '/__control') { mode = input.mode || 'rpc'; liked = false; comments = structuredClone(initialComments); log = []; return json({ mode }) }
  if (url.pathname === '/__log') return json(log)
  log.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), input })
  if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/publicaciones/fixture.svg?token=example' })
  if (url.pathname.includes('fixture.svg') || url.pathname === '/image.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(await readFile(`${root}illustrations/alimentos.svg`))
  }
  if (url.pathname.endsWith('/auth/v1/token')) { signedInRole = String(input.email).split('@')[0]; return json({ access_token: jwt(), refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: user() }) }
  if (url.pathname.endsWith('/auth/v1/user')) return json(user())
  if (url.pathname.endsWith('/auth/v1/logout')) return json({})
  const rpc = url.pathname.split('/rpc/')[1]
  if (rpc) {
    if (mode === 'error') return json({ code: '42501', message: 'Permiso denegado' }, 403)
    if (mode === 'fallback' || (mode === 'missing-social' && rpc !== 'feed_publico')) return json({ code: 'PGRST202', message: 'Function not found' }, 404)
    if (rpc === 'feed_publico') return json(feed.filter(row => !input.p_antes || row.creado_en < input.p_antes).slice(0, input.p_limite).map(row => ({ ...row, me_gusta: liked ? 13 : 12, yo_di_me_gusta: liked })))
    if (rpc === 'comentarios_de') return json(comments.map(row => ({ ...row, es_mio: row.id.startsWith('own-') })))
    if (rpc === 'alternar_me_gusta') { liked = !liked; return json(liked) }
    if (rpc === 'comentar') {
      if (/https?:|@|\d{10}/.test(input.p_texto)) return json({ code: '22023', message: 'Los comentarios no pueden llevar enlaces' }, 400)
      const id = `own-${Date.now()}`
      comments.unshift({ id, autor: 'Vecino D7AA', es_organizacion: false, texto: input.p_texto, creado_en: new Date().toISOString(), es_mio: true }); return json(id)
    }
    if (rpc === 'borrar_comentario') { comments = comments.filter(c => c.id !== input.p_id); return json(null) }
    if (rpc === 'reportar_comentario') return json(null)
    if (rpc === 'cupos_ocupados_jornadas') return json([{ jornada_id: day.id, ocupados: 4 }])
    return json([])
  }
  if (url.pathname.endsWith('/perfiles')) return json(signedInRole === 'comprador' ? [] : [{ id: uid, rol: signedInRole, organizacion_id: signedInRole === 'repartidor' ? null : org.id, nombre_visible: 'Cuenta de ejemplo' }])
  if (url.pathname.endsWith('/solicitudes')) return json([request, { ...request, id: 'f7000000-0000-0000-0000-000000000007', titulo: 'Despensas que acercan', solicitud_articulos: [{ ...request.solicitud_articulos[0], nombre: 'Arroz', cantidad: 80, unidades_pagadas: 16 }] }, { ...request, id: 'f7000000-0000-0000-0000-000000000008', titulo: 'Cuadernos para un nuevo comienzo', solicitud_articulos: [{ ...request.solicitud_articulos[0], nombre: 'Cuaderno escolar', cantidad: 40, unidades_pagadas: 40 }] }].filter(r => !url.searchParams.has('id') || url.searchParams.get('id') === `eq.${r.id}`))
  if (url.pathname.endsWith('/publicaciones')) return json([{ id: feed[0].id, organizacion_id: org.id, creada_en: feed[0].creado_en, texto: feed[0].texto, es_ejemplo: true, organizacion: org, publicacion_medios: [{ tipo: 'imagen', url: `${org.id}/ejemplo.svg`, orden: 0 }] }])
  if (url.pathname.endsWith('/jornadas')) return json([day])
  if (url.pathname.endsWith('/organizaciones')) return json([org])
  return json([])
})
server.listen(port, '127.0.0.1', () => console.log(`Fixtures D7 en http://127.0.0.1:${port}; ningún backend real.`))
