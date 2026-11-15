import { supabase } from '../../lib/supabase'

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

export interface ArticuloTarea {
  nombre: string
  unidades: number
}

export interface TareaDisponible {
  id: string
  creada_en: string
  tienda_nombre: string
  tienda_direccion: string | null
  destino_nombre: string
  total_centavos: number
  articulos: ArticuloTarea[]
}

export interface MiTarea {
  id: string
  estado: 'asignada' | 'recogida'
  tienda_nombre: string
  tienda_direccion: string | null
  tienda_latitud: number | null
  tienda_longitud: number | null
  codigo_recogida: string | null
  destino_nombre: string
  total_centavos: number
  articulos: ArticuloTarea[]
}

export interface Nivel {
  entregas: number
  limite_centavos: number | null
}

// Mensajes que la base de datos devuelve a propósito; lo demás se generaliza.
function mensaje(error: { message: string }, conocidos: string[], general: string) {
  return new Error(conocidos.find((m) => error.message.includes(m)) ?? general)
}

export async function cargarDisponibles(): Promise<TareaDisponible[]> {
  const { data, error } = await cliente().rpc('tareas_disponibles')
  if (error) throw error
  return ((data ?? []) as TareaDisponible[]).map((t) => ({ ...t, total_centavos: Number(t.total_centavos) }))
}

export async function cargarMiTarea(): Promise<MiTarea | null> {
  const { data, error } = await cliente().rpc('mi_tarea')
  if (error) throw error
  const fila = ((data ?? []) as MiTarea[])[0]
  return fila ? { ...fila, total_centavos: Number(fila.total_centavos) } : null
}

export async function cargarNivel(): Promise<Nivel> {
  const { data, error } = await cliente().rpc('mi_nivel_repartidor')
  if (error) throw error
  const fila = ((data ?? []) as Nivel[])[0]
  return {
    entregas: fila?.entregas ?? 0,
    limite_centavos: fila?.limite_centavos == null ? null : Number(fila.limite_centavos),
  }
}

export async function tomarTarea(id: string) {
  const { error } = await cliente().rpc('tomar_tarea', { p_tarea: id })
  if (error) {
    throw mensaje(error, ['La tarea ya no está disponible', 'Ya tienes una tarea activa',
      'Como voluntario nuevo solo tomas pedidos de bajo valor'], 'No se pudo tomar. Vuelve a intentar.')
  }
}

export async function liberarTarea(id: string) {
  const { error } = await cliente().rpc('liberar_tarea', { p_tarea: id })
  if (error) throw mensaje(error, ['No tienes esa tarea o ya la recogiste'], 'No se pudo liberar. Vuelve a intentar.')
}
