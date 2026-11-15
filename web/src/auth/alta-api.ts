import type { SupabaseClient } from '@supabase/supabase-js'
import type { SolicitudAltaArgs } from './alta-validacion.ts'
import type { ProfileRole } from './roles.ts'

/*
 * Acceso a la solicitud de alta (contrato de T22): `solicitar_alta` y
 * `mi_solicitud_alta`. Recibe el cliente para poder probarse sin backend.
 */

export type EstadoAlta = 'pendiente' | 'aprobada' | 'rechazada'

export interface MiSolicitudAlta {
  id: string
  rol: ProfileRole
  estado: EstadoAlta
  motivo: string | null
  org_nombre: string | null
  creada_en: string
  resuelta_en: string | null
}

type RpcError = { message?: string; code?: string }
type AltaClient = Pick<SupabaseClient, 'rpc'>

const general = 'No se pudo enviar la solicitud. Vuelve a intentar.'
// Mensajes técnicos de Postgres o PostgREST que no deben llegar a la pantalla.
const tecnico = /permission denied|duplicate key|violates|constraint|function|relation|column|syntax|schema|jwt|null value|fetch/i

/** Los errores que las funciones lanzan a propósito se muestran tal cual; el resto se generaliza. */
export function mensajeServidor(error: RpcError, porDefecto = general): string {
  const mensaje = (error.message ?? '').trim()
  if (error.code === '23505') return mensaje && mensaje.length <= 300 && !tecnico.test(mensaje) ? mensaje : 'Esos datos ya están registrados en otra cuenta o solicitud.'
  if (error.code === '42501' && (!mensaje || tecnico.test(mensaje))) return 'Tu cuenta no puede enviar solicitudes. Confirma tu correo y vuelve a entrar.'
  if (error.code === 'PGRST202') return 'El registro aún no está disponible. Vuelve a intentar más tarde.'
  const propio = ['P0001', '22023', '42501', '23514', '22001', '22P02'].includes(error.code ?? '')
  if (propio && mensaje && mensaje.length <= 300 && !tecnico.test(mensaje)) return mensaje
  return porDefecto
}

export function parseMiSolicitud(data: unknown): MiSolicitudAlta | null {
  const fila = Array.isArray(data) ? data[0] : data
  if (fila == null) return null
  const row = fila as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    !['fundacion', 'tienda', 'repartidor'].includes(String(row.rol)) ||
    !['pendiente', 'aprobada', 'rechazada'].includes(String(row.estado))
  ) throw new Error('Respuesta de solicitud inválida.')
  return {
    id: row.id,
    rol: row.rol as ProfileRole,
    estado: row.estado as EstadoAlta,
    motivo: typeof row.motivo === 'string' && row.motivo.trim() ? row.motivo : null,
    org_nombre: typeof row.org_nombre === 'string' ? row.org_nombre : null,
    creada_en: String(row.creada_en ?? ''),
    resuelta_en: typeof row.resuelta_en === 'string' ? row.resuelta_en : null,
  }
}

export function createAltaApi(client: AltaClient | null) {
  function cliente() {
    if (!client) throw new Error('El registro no está disponible por ahora.')
    return client
  }
  return {
    async solicitarAlta(args: SolicitudAltaArgs): Promise<string> {
      const { data, error } = await cliente().rpc('solicitar_alta', { ...args })
      if (error) throw new Error(mensajeServidor(error))
      return String(data)
    },
    async miSolicitudAlta(): Promise<MiSolicitudAlta | null> {
      const { data, error } = await cliente().rpc('mi_solicitud_alta')
      if (error) throw new Error(mensajeServidor(error, 'No pudimos consultar tu solicitud. Vuelve a intentar.'))
      return parseMiSolicitud(data)
    },
  }
}
