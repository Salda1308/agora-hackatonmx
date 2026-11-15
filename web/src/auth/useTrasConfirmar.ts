import { useEffect, useRef } from 'react'
import { esConfirmacionDeAlta, registroPaths } from './registro-routes.ts'
import { roleNavigation } from './roles.ts'
import { useSession } from './useSession.ts'

// Se lee al cargar el módulo, antes de que supabase-js limpie el hash de la URL.
const llegoDeConfirmacion = typeof window !== 'undefined' && esConfirmacionDeAlta(window.location.hash)

/**
 * Tras confirmar el correo, la cuenta entra sola. Quien no tiene perfil va a su
 * solicitud de alta (elegir rol o estado); quien ya tiene rol, a su panel.
 */
export function useTrasConfirmar() {
  const { status, user, role } = useSession()
  const pendiente = useRef(llegoDeConfirmacion)
  useEffect(() => {
    if (!pendiente.current || status !== 'ready' || !user || !role) return
    pendiente.current = false
    window.location.hash = role === 'comprador' ? registroPaths.registro : `#${roleNavigation[role][0].path}`
  }, [status, user, role])
}
