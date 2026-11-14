// Opt-in, isolated T17 only. JPEG fixture path supplied by the caller.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
const url = process.env.T17_SUPABASE_URL
const key = process.env.T17_SUPABASE_KEY
if (!url || !key || new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== '57421') throw new Error('Solo stack aislado T17 (127.0.0.1:57421)')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(url, key, { auth: { persistSession: false } })
const { data: login, error } = await client.auth.signInWithPassword({ email: 'fundacion@demo.agora.test', password: 'Agora-demo-2026!' })
assert.equal(error, null)
const { data: profile } = await client.from('perfiles').select('organizacion_id').eq('id', login.user.id).single()
const org = profile.organizacion_id
const original = new Uint8Array(await readFile(process.env.T17_JPEG))
const metadata = new TextEncoder().encode('Exif\0\0GPS-location-T17')
const source = new Uint8Array(original.length + metadata.length + 4)
source.set(original.subarray(0,2)); source.set([255,225,0,metadata.length+2],2); source.set(metadata,6); source.set(original.subarray(2),6+metadata.length)
let postId, path
try {
  const post = await client.from('publicaciones').insert({ organizacion_id: org, texto: 'Prueba de imagen T17', consentimiento: true }).select('id').single()
  assert.equal(post.error, null); postId = post.data.id
  const direct = await client.storage.from('publicaciones').upload(`${org}/raw.jpg`, source, { contentType: 'image/jpeg' })
  assert.ok(direct.error, 'la subida directa debe estar bloqueada')
  const upload = await client.functions.invoke('t17-imagen', { body: new Blob([source], { type: 'image/jpeg' }), headers: { 'Content-Type': 'image/jpeg' } })
  if (upload.error) { const body = await upload.error.context?.text?.(); throw new Error(`Función: ${upload.error.message} ${body ?? ''}`) }
  path = upload.data.path
  assert.ok(path.startsWith(`${org}/`))
  const media = await client.from('publicacion_medios').insert({ publicacion_id: postId, tipo: 'imagen', url: path })
  assert.equal(media.error, null)
  const signed = await anon.storage.from('publicaciones').createSignedUrl(path, 60)
  assert.equal(signed.error, null)
  const response = await fetch(signed.data.signedUrl)
  assert.equal(response.status, 200)
  const clean = new Uint8Array(await response.arrayBuffer())
  assert.ok(!new TextDecoder().decode(clean).includes('GPS-location-T17'))
  const scanOffset = bytes => bytes.findIndex((value, i) => value === 255 && bytes[i+1] === 218)
  assert.deepEqual(clean.subarray(scanOffset(clean)), original.subarray(scanOffset(original)), 'se conserva el scan comprimido original')
  const report = await anon.from('reportes').insert({ publicacion_id: postId, motivo: 'Prueba automática T17' })
  assert.equal(report.error, null)
  console.log('PASS: login, publicación, bloqueo directo, función, imagen sin EXIF/GPS, lectura pública firmada y reporte')
} finally {
  if (postId) await client.from('publicaciones').delete().eq('id', postId)
  if (path) await client.storage.from('publicaciones').remove([path])
  await client.auth.signOut()
}
