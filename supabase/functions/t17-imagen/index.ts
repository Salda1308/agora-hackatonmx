import { stripJpegMetadata } from './jpeg.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async (request: Request) => {
  const reply = (status: number, value: object) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido' })
  const authorization = request.headers.get('authorization')
  if (!authorization) return reply(401, { error: 'Sesión requerida' })
  const base = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_ANON_KEY')!
  const headers = { Authorization: authorization, apikey: key }
  try {
    const auth = await fetch(`${base}/auth/v1/user`, { headers })
    if (!auth.ok) return reply(401, { error: 'Sesión inválida' })
    const user = await auth.json()
    const profileResponse = await fetch(`${base}/rest/v1/perfiles?id=eq.${encodeURIComponent(user.id)}&select=organizacion_id,rol`, { headers })
    if (!profileResponse.ok) return reply(403, { error: 'Acceso denegado' })
    const [profile] = await profileResponse.json()
    if (!profile?.organizacion_id || !['fundacion', 'tienda'].includes(profile.rol)) return reply(403, { error: 'Organización requerida' })
    const orgResponse = await fetch(`${base}/rest/v1/organizaciones?id=eq.${encodeURIComponent(profile.organizacion_id)}&verificada=eq.true&suspendida=eq.false&or=(categoria.is.null,categoria.neq.colectivo_busqueda)&select=id`, { headers })
    if (!orgResponse.ok || !(await orgResponse.json()).length) return reply(403, { error: 'Organización no disponible' })
    const limit = 5 * 1024 * 1024
    if (request.headers.get('content-type')?.split(';')[0] !== 'image/jpeg') return reply(415, { error: 'Solo JPEG procesado' })
    const reader = request.body?.getReader()
    if (!reader) return reply(400, { error: 'Imagen requerida' })
    const parts: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) { await reader.cancel(); return reply(413, { error: 'Máximo 5 MB' }) }
      parts.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.length }
    let clean: Uint8Array
    try { clean = stripJpegMetadata(bytes) } catch { return reply(400, { error: 'JPEG inválido' }) }
    const path = `${profile.organizacion_id}/${crypto.randomUUID()}.jpg`
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const upload = await fetch(`${base}/storage/v1/object/publicaciones/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, apikey: secret, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }, body: clean })
    if (!upload.ok) return reply(502, { error: 'No se pudo guardar la imagen' })
    return reply(200, { path })
  } catch { return reply(500, { error: 'No se pudo procesar la imagen' }) }
})
