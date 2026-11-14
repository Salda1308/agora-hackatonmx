import { supabase } from '../../lib/supabase'

// Entrega con foto y código (T10). Las funciones de la base de datos validan rol,
// asignación y estado; aquí solo se llaman.

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

function mensaje(error: { message: string }, conocidos: string[], general: string) {
  return new Error(conocidos.find((m) => error.message.includes(m)) ?? general)
}

export interface MiEntrega {
  tarea_id: string
  foto_path: string | null
  entregada_en: string
  codigo_entrega: string
  intentos_restantes: number
  bloqueada: boolean
}

export async function cargarMiEntrega(): Promise<MiEntrega | null> {
  const { data, error } = await cliente().rpc('mi_entrega')
  if (error) throw error
  return ((data ?? []) as MiEntrega[])[0] ?? null
}

export async function marcarRecogida(tarea: string) {
  const { error } = await cliente().rpc('marcar_recogida', { p_tarea: tarea })
  if (error) {
    throw mensaje(error, ['No tienes esa tarea por recoger', 'El pedido no está listo'],
      'No se pudo marcar. Vuelve a intentar.')
  }
}

const LADO_MAXIMO = 1280
const PESO_MAXIMO = 3 * 1024 * 1024

/**
 * Recodifica la foto en el navegador: JPEG nuevo de hasta 1280 px, sin EXIF ni
 * ubicación (el lienzo no copia metadatos).
 */
export async function prepararFoto(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.')
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo leer la foto.')
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  imagen.close()
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.8))
  if (!blob) throw new Error('No se pudo leer la foto.')
  if (blob.size > PESO_MAXIMO) throw new Error('La foto pesa demasiado.')
  return blob
}

/** Sube la foto al bucket privado y marca entregado. Devuelve el código de entrega. */
export async function registrarEntrega(tarea: string, foto: Blob): Promise<string> {
  const ruta = `${tarea}/${crypto.randomUUID()}.jpg`
  const subida = await cliente().storage.from('entregas').upload(ruta, foto, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (subida.error) throw new Error('No se pudo subir la foto. Vuelve a intentar.')
  const { data, error } = await cliente().rpc('registrar_entrega', { p_tarea: tarea, p_foto_path: ruta })
  if (error) {
    throw mensaje(error, ['No tienes esa tarea en camino', 'Sube la foto de la entrega', 'La entrega ya está confirmada'],
      'No se pudo marcar entregado. Vuelve a intentar.')
  }
  return data as string
}
