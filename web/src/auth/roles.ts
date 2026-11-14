export type ProfileRole = 'fundacion' | 'tienda' | 'repartidor'
export type Role = ProfileRole | 'comprador'

export interface Profile {
  id: string
  rol: ProfileRole
  organizacion_id: string | null
  nombre_visible: string | null
}

// Fallar cerrado ante datos inesperados; nunca inferir privilegios de metadata.
export function parseProfile(value: unknown, userId: string): Profile | null {
  if (value === null) return null
  if (typeof value !== 'object') throw new Error('Perfil de sesión inválido.')
  const row = value as Record<string, unknown>
  if (
    row.id !== userId ||
    !['fundacion', 'tienda', 'repartidor'].includes(String(row.rol)) ||
    !(row.organizacion_id === null || typeof row.organizacion_id === 'string') ||
    (row.rol !== 'repartidor' && !row.organizacion_id) ||
    !(row.nombre_visible === null || typeof row.nombre_visible === 'string')
  ) throw new Error('Perfil de sesión inválido.')
  return row as unknown as Profile
}

export function hasRole(role: Role | null, allowed: readonly Role[]): boolean {
  return role !== null && allowed.includes(role)
}

export const roleLabels: Record<Role, string> = {
  comprador: 'Comprador', fundacion: 'Fundación', tienda: 'Tienda', repartidor: 'Repartidor',
}

// Destinos hash del diseño vigente; no impone estilos ni lógica de negocio.
export const roleNavigation = {
  comprador: [
    { id: 'home', label: 'Inicio', path: '/' },
    { id: 'directory', label: 'Solicitudes', path: '/solicitudes' },
    { id: 'following', label: 'Siguiendo', path: '/siguiendo' },
  ],
  fundacion: [
    { id: 'solicitudes', label: 'Solicitudes', path: '/fundacion' },
    { id: 'publicar', label: 'Publicar', path: '/fundacion/publicar', primary: true },
    { id: 'organizacion', label: 'Mi página', path: '/fundacion/organizacion' },
    { id: 'jornadas', label: 'Jornadas', path: '/fundacion/jornadas' },
  ],
  tienda: [
    { id: 'pedidos', label: 'Pedidos', path: '/tienda' },
    { id: 'catalogo', label: 'Catálogo', path: '/tienda/catalogo' },
    { id: 'organizacion', label: 'Mi tienda', path: '/tienda/organizacion' },
  ],
  repartidor: [
    { id: 'tareas', label: 'Tareas', path: '/repartidor' },
    { id: 'entregas', label: 'Mis entregas', path: '/repartidor/entregas' },
    { id: 'reconocimiento', label: 'Reconocimiento', path: '/repartidor/reconocimiento' },
  ],
} as const
