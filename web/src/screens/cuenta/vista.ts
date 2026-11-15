import type { Role } from '../../auth/roles.ts'

/* Decisión pura de qué muestra `#/cuenta` (D8). Sin React para probarla con node:test. */

export type VistaCuenta =
  | 'cargando'
  | 'error'
  /** Sin sesión: comprobantes del dispositivo, invitación a crear cuenta y acceso demo. */
  | 'invitado'
  /** Con sesión y sin perfil de rol: comprador demo o alta pendiente o rechazada (T23). */
  | 'sin-perfil'
  | 'fundacion'
  | 'tienda'
  | 'repartidor'

export interface EntradaVista {
  status: 'loading' | 'ready' | 'error'
  hasUser: boolean
  role: Role | null
  organizationId: string | null
}

export function vistaCuenta({ status, hasUser, role, organizationId }: EntradaVista): VistaCuenta {
  if (status === 'loading') return 'cargando'
  if (status === 'error') return 'error'
  if (!hasUser) return 'invitado'
  // Fundación y tienda sin organización no son válidas (parseProfile ya lo impide): se tratan sin perfil.
  if ((role === 'fundacion' || role === 'tienda') && organizationId) return role
  if (role === 'repartidor') return 'repartidor'
  return 'sin-perfil'
}

export interface Atajo {
  etiqueta: string
  href: string
}

/** Atajos de cada rol; solo destinos que ya existen. */
export function atajosCuenta(vista: VistaCuenta): Atajo[] {
  switch (vista) {
    case 'fundacion':
      return [
        { etiqueta: 'Mis solicitudes', href: '#/fundacion' },
        { etiqueta: 'Nueva solicitud', href: '#/fundacion/publicar' },
        { etiqueta: 'Jornadas', href: '#/fundacion/jornadas' },
        { etiqueta: 'Mi página', href: '#/fundacion/organizacion' },
      ]
    case 'tienda':
      return [
        { etiqueta: 'Pedidos', href: '#/tienda' },
        { etiqueta: 'Catálogo', href: '#/tienda/catalogo' },
        { etiqueta: 'Mi tienda', href: '#/tienda/organizacion' },
      ]
    case 'repartidor':
      return [
        { etiqueta: 'Tareas', href: '#/repartidor' },
        { etiqueta: 'Mis entregas', href: '#/repartidor/entregas' },
        { etiqueta: 'Reconocimiento', href: '#/repartidor/reconocimiento' },
      ]
    case 'invitado':
    case 'sin-perfil':
      return [
        // Los comprobantes ya tienen su tarjeta en la cuenta: aquí, a dónde ayudar.
        { etiqueta: 'Solicitudes', href: '#/solicitudes' },
        { etiqueta: 'Voluntariado', href: '#/jornadas' },
      ]
    default:
      return []
  }
}

/** Entregas para quitar el límite de voluntario nuevo (regla de T09). */
export const ENTREGAS_PARA_NIVEL = 3

/** Texto y avance del nivel del repartidor a partir de `mi_nivel_repartidor`. */
export function nivelRepartidor(entregas: number, limiteCentavos: number | null) {
  const hechas = Math.max(0, entregas)
  if (limiteCentavos === null) {
    return { nuevo: false, hechas, faltan: 0, titulo: 'Voluntario confiable' }
  }
  const faltan = Math.max(0, ENTREGAS_PARA_NIVEL - hechas)
  return { nuevo: true, hechas: Math.min(hechas, ENTREGAS_PARA_NIVEL), faltan, titulo: 'Voluntario nuevo' }
}
