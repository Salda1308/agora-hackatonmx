import { supabase } from '../../lib/supabase'

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

export type EstadoSolicitud = 'borrador' | 'publicada' | 'cerrada' | 'cancelada'

export interface MiOrganizacion {
  id: string
  nombre: string
  verificada: boolean
  suspendida: boolean
}

export interface MiSolicitud {
  id: string
  titulo: string
  estado: EstadoSolicitud
  publicada_en: string | null
  creada_en: string
  es_ejemplo: boolean
  tienda: { nombre: string } | null
  solicitud_articulos: { nombre: string; cantidad: number; unidades_pagadas: number; precio_centavos: number }[]
}

export interface Tienda {
  id: string
  nombre: string
}

export interface ArticuloCatalogo {
  id: string
  nombre: string
  descripcion: string | null
  unidad: string
  precio_centavos: number
  vigente_desde: string
  vigente_hasta: string | null
}

const peso = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatoPesos = (centavos: number) => peso.format(centavos / 100)

export async function cargarMiOrganizacion(id: string): Promise<MiOrganizacion> {
  const { data, error } = await cliente()
    .from('organizaciones')
    .select('id, nombre, verificada, suspendida')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as MiOrganizacion
}

export async function cargarMisSolicitudes(organizacionId: string): Promise<MiSolicitud[]> {
  const { data, error } = await cliente()
    .from('solicitudes')
    .select(
      'id, titulo, estado, publicada_en, creada_en, es_ejemplo, tienda:organizaciones!tienda_id(nombre), solicitud_articulos(nombre, cantidad, unidades_pagadas, precio_centavos)',
    )
    .eq('organizacion_id', organizacionId)
    .order('creada_en', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as MiSolicitud[]
}

export async function cargarTiendas(): Promise<Tienda[]> {
  const { data, error } = await cliente()
    .from('organizaciones')
    .select('id, nombre')
    .eq('tipo', 'tienda')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Tienda[]
}

export async function cargarCatalogo(tiendaId: string): Promise<ArticuloCatalogo[]> {
  const { data, error } = await cliente()
    .from('catalogo_articulos')
    .select('id, nombre, descripcion, unidad, precio_centavos, vigente_desde, vigente_hasta')
    .eq('tienda_id', tiendaId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  const hoy = new Date().toLocaleDateString('en-CA')
  return ((data ?? []) as ArticuloCatalogo[]).filter(
    (a) => a.vigente_desde <= hoy && (!a.vigente_hasta || a.vigente_hasta >= hoy),
  )
}

export async function publicarSolicitud(input: {
  tiendaId: string
  titulo: string
  descripcion: string
  articulos: { articulo_id: string; cantidad: number }[]
}): Promise<string> {
  const { data, error } = await cliente().rpc('publicar_solicitud', {
    p_tienda_id: input.tiendaId,
    p_titulo: input.titulo,
    p_articulos: input.articulos,
    p_descripcion: input.descripcion,
  })
  if (error) throw new Error(mensajeError(error.message))
  return data as string
}

// Mensajes de la base que ya están en español; el resto se resume.
function mensajeError(message: string) {
  const conocidos = [
    'Tu fundación aún no está verificada',
    'Agrega al menos un artículo',
    'La tienda no está verificada',
    'El artículo no está activo en el catálogo de la tienda de la solicitud',
    'Hay artículos que ya no están en el catálogo de la tienda',
  ]
  return conocidos.find((m) => message.includes(m)) ?? 'No se pudo publicar. Vuelve a intentar.'
}
