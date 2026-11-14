import { supabase } from '../../lib/supabase'

// Recepción de entregas (T10). La base de datos valida que la entrega sea de tu
// fundación, cuenta los intentos y cierra todo en una sola transacción.

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

export interface EntregaRecibida {
  tarea_id: string
  tienda_nombre: string
  solicitud_titulo: string
  total_centavos: number
  articulos: { nombre: string; unidades: number }[]
  foto_path: string | null
  entregada_en: string
  confirmada_en: string | null
  intentos_restantes: number
  bloqueada: boolean
}

export type ResultadoConfirmacion = 'confirmada' | 'incorrecto' | 'bloqueada'

export async function cargarEntregas(): Promise<EntregaRecibida[]> {
  const { data, error } = await cliente().rpc('entregas_de_mi_fundacion')
  if (error) throw error
  return (data ?? []) as EntregaRecibida[]
}

/** Enlace temporal (5 min) a la foto del bucket privado. */
export async function urlFoto(ruta: string): Promise<string | null> {
  const { data, error } = await cliente().storage.from('entregas').createSignedUrl(ruta, 300)
  return error ? null : data.signedUrl
}

export async function confirmarEntrega(tarea: string, codigo: string) {
  const { data, error } = await cliente().rpc('confirmar_entrega', { p_tarea: tarea, p_codigo: codigo })
  if (error) {
    throw new Error(error.message.includes('No hay una entrega por confirmar')
      ? 'Esta entrega ya no está pendiente.'
      : 'No se pudo confirmar. Vuelve a intentar.')
  }
  const fila = ((data ?? []) as { resultado: ResultadoConfirmacion; intentos_restantes: number }[])[0]
  if (!fila) throw new Error('No se pudo confirmar. Vuelve a intentar.')
  return fila
}
