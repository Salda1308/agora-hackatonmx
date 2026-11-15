import { useEffect, useState } from 'react'
import { createAltaApi } from '../../auth/alta-api'
import type { MiSolicitudAlta } from '../../auth/alta-api'
import { createCuentaApi } from '../../auth/cuenta'
import { supabase } from '../../lib/supabase'

export const alta = createAltaApi(supabase)
export const cuenta = createCuentaApi(supabase)

export const REVISION_MS = 10_000

type Lectura =
  | { carga: 'cargando'; solicitud: null; error: null }
  | { carga: 'listo'; solicitud: MiSolicitudAlta | null; error: null }
  | { carga: 'error'; solicitud: null; error: string }

const cargando: Lectura = { carga: 'cargando', solicitud: null, error: null }

/**
 * Última solicitud de alta del usuario. Se consulta al entrar y cada 10 s
 * mientras sigue pendiente (sin consultar con la pestaña oculta).
 */
export function useMiSolicitud(userId: string | null) {
  const [lectura, setLectura] = useState<{ clave: string; valor: Lectura } | null>(null)
  const [intento, setIntento] = useState(0)
  const clave = `${userId}:${intento}`

  useEffect(() => {
    if (!userId) return
    let vivo = true
    alta.miSolicitudAlta()
      .then((solicitud) => { if (vivo) setLectura({ clave, valor: { carga: 'listo', solicitud, error: null } }) })
      .catch((e: unknown) => {
        if (vivo) setLectura({ clave, valor: { carga: 'error', solicitud: null, error: e instanceof Error ? e.message : 'No pudimos consultar tu solicitud.' } })
      })
    return () => { vivo = false }
  }, [userId, clave])

  const actual = lectura?.clave === clave ? lectura.valor : cargando
  const pendiente = actual.solicitud?.estado === 'pendiente'

  useEffect(() => {
    if (!userId || !pendiente) return
    let vivo = true
    const id = window.setInterval(() => {
      if (document.hidden) return
      // Un fallo pasajero no borra el estado ya mostrado; se reintenta en la siguiente vuelta.
      alta.miSolicitudAlta()
        .then((solicitud) => { if (vivo) setLectura({ clave, valor: { carga: 'listo', solicitud, error: null } }) })
        .catch(() => {})
    }, REVISION_MS)
    return () => { vivo = false; window.clearInterval(id) }
  }, [userId, pendiente, clave])

  return { ...actual, recargar: () => setIntento((n) => n + 1) }
}
