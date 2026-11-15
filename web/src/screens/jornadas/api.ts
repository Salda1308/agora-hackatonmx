import { supabase } from '../../lib/supabase'

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

export type EstadoInscripcion = 'pendiente' | 'confirmada' | 'rechazada' | 'asistio' | 'no_asistio'

export interface Jornada {
  id: string
  organizacion_id: string
  titulo: string
  descripcion: string | null
  requisitos: string | null
  ubicacion: string | null
  inicia_en: string
  termina_en: string
  cupos: number
  es_ejemplo: boolean
  organizacion: { nombre: string } | null
  ocupados: number
}

export interface Inscripcion {
  id: string
  nombre_contacto: string
  contacto: string
  asistentes: number
  estado: EstadoInscripcion
  creada_en: string
}

export interface JornadaConInscripciones extends Jornada {
  inscripciones_jornada: Inscripcion[]
}

export interface ConsultaInscripcion {
  id: string
  estado: EstadoInscripcion
  asistentes: number
  jornada: { id: string; titulo: string; inicia_en: string; termina_en: string; organizacion: string }
  constancia: { folio: string; nombre: string; asistentes: number; horas: number } | null
}

const CAMPOS =
  'id, organizacion_id, titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos, es_ejemplo, organizacion:organizaciones(nombre)'

async function conOcupados<T extends { id: string }>(filas: T[]): Promise<(T & { ocupados: number })[]> {
  if (filas.length === 0) return []
  const { data, error } = await cliente().rpc('cupos_ocupados_jornadas', { p_ids: filas.map((f) => f.id) })
  if (error) throw error
  const mapa = new Map((data as { jornada_id: string; ocupados: number }[]).map((d) => [d.jornada_id, d.ocupados]))
  return filas.map((f) => ({ ...f, ocupados: mapa.get(f.id) ?? 0 }))
}

export async function cargarJornadasPublicas(): Promise<Jornada[]> {
  const { data, error } = await cliente()
    .from('jornadas')
    .select(CAMPOS)
    .gt('inicia_en', new Date().toISOString())
    .order('inicia_en')
  if (error) throw error
  return conOcupados((data ?? []) as unknown as Omit<Jornada, 'ocupados'>[])
}

export async function cargarJornada(id: string): Promise<Jornada | null> {
  const { data, error } = await cliente().from('jornadas').select(CAMPOS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [jornada] = await conOcupados([data as unknown as Omit<Jornada, 'ocupados'>])
  return jornada
}

const MENSAJES: Record<string, string> = {
  'La jornada no tiene cupo suficiente': 'Ya no hay cupo para tantas personas.',
  'La jornada ya empezó': 'Esta jornada ya empezó.',
  'La jornada no está disponible': 'Esta jornada ya no está disponible.',
  'Máximo 4 asistentes por inscripción': 'Puedes inscribir hasta 4 personas por registro.',
  'Este contacto ya inscribió el máximo de asistentes': 'Ese correo o teléfono ya inscribió a 4 personas en esta jornada.',
  'Cambio de estado no permitido': 'Ese cambio no está permitido.',
}

function mensaje(error: { message: string }) {
  return new Error(MENSAJES[error.message] ?? 'Algo salió mal. Intenta de nuevo.')
}

export async function inscribirse(input: {
  jornadaId: string
  nombre: string
  contacto: string
  asistentes: number
}): Promise<string> {
  const { data, error } = await cliente().rpc('inscribirse_jornada', {
    p_jornada: input.jornadaId,
    p_nombre_contacto: input.nombre,
    p_contacto: input.contacto,
    p_asistentes: input.asistentes,
  })
  if (error) throw mensaje(error)
  return data as string
}

export async function consultarInscripcion(folio: string): Promise<ConsultaInscripcion | null> {
  const { data, error } = await cliente().rpc('consultar_inscripcion', { p_inscripcion: folio })
  if (error) throw error
  return (data ?? null) as ConsultaInscripcion | null
}

// Fundación -----------------------------------------------------------------

export async function cargarMisJornadas(organizacionId: string): Promise<JornadaConInscripciones[]> {
  const { data, error } = await cliente()
    .from('jornadas')
    .select(`${CAMPOS}, inscripciones_jornada(id, nombre_contacto, contacto, asistentes, estado, creada_en)`)
    .eq('organizacion_id', organizacionId)
    .order('inicia_en', { ascending: false })
  if (error) throw error
  return conOcupados((data ?? []) as unknown as Omit<JornadaConInscripciones, 'ocupados'>[])
}

export async function cargarDireccion(organizacionId: string): Promise<string | null> {
  const { data, error } = await cliente()
    .from('organizaciones')
    .select('direccion_publica')
    .eq('id', organizacionId)
    .single()
  if (error) throw error
  return (data as { direccion_publica: string | null }).direccion_publica
}

export async function crearJornada(input: {
  organizacionId: string
  titulo: string
  descripcion: string
  requisitos: string
  ubicacion: string
  iniciaEn: string
  terminaEn: string
  cupos: number
}): Promise<void> {
  const { error } = await cliente().from('jornadas').insert({
    organizacion_id: input.organizacionId,
    titulo: input.titulo,
    descripcion: input.descripcion,
    requisitos: input.requisitos,
    ubicacion: input.ubicacion,
    inicia_en: input.iniciaEn,
    termina_en: input.terminaEn,
    cupos: input.cupos,
  })
  if (error) throw new Error(error.code === '42501' ? 'Tu organización no puede abrir jornadas.' : 'No se pudo guardar.')
}

export async function cambiarEstado(inscripcionId: string, estado: EstadoInscripcion): Promise<void> {
  const { error } = await cliente().from('inscripciones_jornada').update({ estado }).eq('id', inscripcionId)
  if (error) throw mensaje(error)
}

// Formato -------------------------------------------------------------------

const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' })

export function formatoHorario(inicia: string, termina: string) {
  const i = new Date(inicia)
  return `${fecha.format(i)} · ${hora.format(i)} a ${hora.format(new Date(termina))}`
}

// Folios guardados en este dispositivo (solo conveniencia; el folio es el acceso).
const CLAVE = 'agora.jornadas.folios'

export function leerFolios(): string[] {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    return Array.isArray(valor) ? valor.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function guardarFolio(folio: string) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([folio, ...leerFolios().filter((f) => f !== folio)].slice(0, 20)))
  } catch {
    // Sin almacenamiento: la persona conserva el enlace de su folio.
  }
}
