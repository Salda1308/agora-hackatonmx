import { supabase } from '../../lib/supabase'
import { videoEmbed } from '../../screens/organizacion/media'

export type FeedType = 'publicacion' | 'solicitud' | 'jornada'
export type FeedMedia = { ruta: string; tipo: string; src?: string }
export type FeedItem = {
  tipo: FeedType
  id: string
  creado_en: string
  organizacion_id: string
  organizacion_nombre: string
  organizacion_slug: string
  organizacion_logo: string | null
  titulo: string | null
  texto: string | null
  medios: FeedMedia[]
  extra: Record<string, unknown>
  me_gusta: number
  comentarios: number
  yo_di_me_gusta: boolean
}
export type FeedComment = { id: string; autor: string; es_organizacion: boolean; texto: string; creado_en: string; es_mio: boolean }
export type FeedPage = { items: FeedItem[]; next: string | null; social: boolean }
export const PAGE_SIZE = 20
export const SOON = 'Los me gusta y comentarios estarán disponibles pronto.'

function client() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}
export function missingFunction(error: { code?: string }) {
  return error.code === 'PGRST202' || error.code === '42883'
}

// Contrato T24: estos códigos traen un mensaje en español listo para mostrar; el resto se oculta.
const CONTRACT_CODES = new Set(['42501', '22023', '54000', 'P0002'])
function socialError(error: { code?: string; message?: string }) {
  if (missingFunction(error)) return new Error(SOON)
  if (error.code && CONTRACT_CODES.has(error.code) && error.message) return new Error(error.message)
  return new Error('No pudimos completar la acción. Intenta de nuevo.')
}

async function resolveMedia(items: FeedItem[]): Promise<FeedItem[]> {
  return Promise.all(items.map(async item => ({ ...item, medios: await Promise.all((item.medios ?? []).map(async media => {
    if (media.tipo === 'video') return { ...media, src: videoEmbed(media.ruta) ?? undefined }
    if (media.tipo !== 'imagen') return media
    const { data } = await client().storage.from('publicaciones').createSignedUrl(media.ruta, 300)
    return { ...media, src: data?.signedUrl }
  })) })))
}

type Org = { id: string; nombre: string; slug: string; logo_url: string | null; es_ejemplo: boolean; categoria: string | null }
type BaseRow = { id: string; organizacion_id: string; creada_en: string; es_ejemplo: boolean; organizacion: Org | Org[] }
type PostRow = BaseRow & { texto: string | null; publicacion_medios: { tipo: string; url: string; orden: number }[] }
type RequestRow = BaseRow & { titulo: string; descripcion: string | null; publicada_en: string; tienda: { nombre: string } | { nombre: string }[] | null; solicitud_articulos: { nombre: string; cantidad: number; unidades_pagadas: number }[] }
type DayRow = BaseRow & { titulo: string; descripcion: string | null; inicia_en: string; termina_en: string; ubicacion: string | null; cupos: number }
const orgFields = 'id,nombre,slug,logo_url,es_ejemplo,categoria'

/** Compatibilidad con T17/T18/T06: solo se activa si el RPC aún no existe. */
async function fallbackFeed(before?: string): Promise<FeedPage> {
  const db = client()
  let posts = db.from('publicaciones').select(`id,organizacion_id,creada_en,texto,es_ejemplo,organizacion:organizaciones!inner(${orgFields}),publicacion_medios(tipo,url,orden)`)
    .eq('retirada', false).eq('organizacion.verificada', true).eq('organizacion.suspendida', false).order('creada_en', { ascending: false }).limit(PAGE_SIZE)
  let requests = db.from('solicitudes').select(`id,organizacion_id,creada_en,publicada_en,titulo,descripcion,es_ejemplo,organizacion:organizaciones!solicitudes_organizacion_id_fkey!inner(${orgFields}),tienda:organizaciones!solicitudes_tienda_id_fkey(nombre),solicitud_articulos(nombre,cantidad,unidades_pagadas)`)
    .eq('estado', 'publicada').eq('organizacion.verificada', true).eq('organizacion.suspendida', false).order('publicada_en', { ascending: false }).limit(PAGE_SIZE)
  let days = db.from('jornadas').select(`id,organizacion_id,creada_en,titulo,descripcion,inicia_en,termina_en,ubicacion,cupos,es_ejemplo,organizacion:organizaciones!inner(${orgFields})`)
    .gt('inicia_en', new Date().toISOString()).eq('organizacion.verificada', true).eq('organizacion.suspendida', false).order('creada_en', { ascending: false }).limit(PAGE_SIZE)
  // Filtrar antes de limitar para no perder páginas si hay organizaciones excluidas.
  posts = posts.or('categoria.is.null,categoria.neq.colectivo_busqueda', { referencedTable: 'organizacion' })
  requests = requests.or('categoria.is.null,categoria.neq.colectivo_busqueda', { referencedTable: 'organizacion' })
  days = days.or('categoria.is.null,categoria.neq.colectivo_busqueda', { referencedTable: 'organizacion' })
  if (before) { posts = posts.lt('creada_en', before); requests = requests.lt('publicada_en', before); days = days.lt('creada_en', before) }
  const [p, r, j] = await Promise.all([posts, requests, days])
  if (p.error || r.error || j.error) throw new Error('No pudimos cargar las novedades. Intenta de nuevo.')
  function base(row: BaseRow, tipo: FeedType): FeedItem[] {
    const org = Array.isArray(row.organizacion) ? row.organizacion[0] : row.organizacion
    if (!org || org.categoria === 'colectivo_busqueda') return []
    return [{ tipo, id: row.id, creado_en: row.creada_en, organizacion_id: row.organizacion_id,
      organizacion_nombre: org.nombre, organizacion_slug: org.slug, organizacion_logo: org.logo_url,
      titulo: null, texto: null, medios: [], extra: { ejemplo: row.es_ejemplo || org.es_ejemplo }, me_gusta: 0, comentarios: 0, yo_di_me_gusta: false }]
  }
  const items = [
    ...(p.data as unknown as PostRow[]).flatMap(row => base(row, 'publicacion').map(item => ({ ...item, texto: row.texto,
      medios: row.publicacion_medios.sort((a, b) => a.orden - b.orden).map(m => ({ ruta: m.url, tipo: m.tipo })) }))),
    ...(r.data as unknown as RequestRow[]).flatMap(row => base(row, 'solicitud').map(item => ({ ...item, creado_en: row.publicada_en,
      titulo: row.titulo, texto: row.descripcion, extra: { ...item.extra,
        categoria: row.solicitud_articulos.map(a => a.nombre).join(' '),
        unidades_totales: row.solicitud_articulos.reduce((n, a) => n + a.cantidad, 0),
        unidades_pagadas: row.solicitud_articulos.reduce((n, a) => n + a.unidades_pagadas, 0),
        tienda: (Array.isArray(row.tienda) ? row.tienda[0] : row.tienda) ?? null } }))),
    ...(j.data as unknown as DayRow[]).flatMap(row => base(row, 'jornada').map(item => ({ ...item, titulo: row.titulo, texto: row.descripcion,
      extra: { ...item.extra, inicia_en: row.inicia_en, termina_en: row.termina_en, ubicacion: row.ubicacion, cupos: row.cupos } }))),
  ].sort((a, b) => b.creado_en.localeCompare(a.creado_en) || b.id.localeCompare(a.id)).slice(0, PAGE_SIZE)
  return { items: await resolveMedia(items), next: items.length === PAGE_SIZE ? items.at(-1)!.creado_en : null, social: false }
}

export async function loadFeed(before?: string): Promise<FeedPage> {
  const { data, error } = await client().rpc('feed_publico', { p_limite: PAGE_SIZE, p_antes: before ?? null })
  if (error) {
    if (missingFunction(error)) return fallbackFeed(before)
    throw new Error('No pudimos cargar las novedades. Intenta de nuevo.')
  }
  const items = (data ?? []) as FeedItem[]
  return { items: await resolveMedia(items), next: items.length === PAGE_SIZE ? items.at(-1)!.creado_en : null, social: true }
}
export async function toggleLike(item: Pick<FeedItem, 'tipo' | 'id'>): Promise<boolean> {
  const { data, error } = await client().rpc('alternar_me_gusta', { p_tipo: item.tipo, p_id: item.id })
  if (error) throw socialError(error)
  return data as boolean
}
export async function loadComments(item: Pick<FeedItem, 'tipo' | 'id'>, before?: string): Promise<FeedComment[]> {
  const { data, error } = await client().rpc('comentarios_de', { p_tipo: item.tipo, p_id: item.id, p_limite: PAGE_SIZE, p_antes: before ?? null })
  if (error) throw socialError(error)
  return (data ?? []) as FeedComment[]
}
export async function comment(item: Pick<FeedItem, 'tipo' | 'id'>, text: string): Promise<string> {
  const { data, error } = await client().rpc('comentar', { p_tipo: item.tipo, p_id: item.id, p_texto: text.trim() })
  if (error) throw socialError(error)
  return data as string
}
export async function deleteComment(id: string): Promise<void> {
  const { error } = await client().rpc('borrar_comentario', { p_id: id })
  if (error) throw socialError(error)
}
export async function reportComment(id: string, reason: string): Promise<void> {
  const { error } = await client().rpc('reportar_comentario', { p_id: id, p_motivo: reason.trim() })
  if (error) throw socialError(error)
}
