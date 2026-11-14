import { roleNavigation } from './roles.ts'
import type { ProfileRole } from './roles.ts'

export type RoleRoute = { name: 'role'; role: ProfileRole; page: string }

export function parseRolePath(path: string): RoleRoute | null {
  for (const role of ['fundacion', 'tienda', 'repartidor'] as const) {
    const destination = roleNavigation[role].find((entry) => entry.path === path)
    if (destination) return { name: 'role', role, page: destination.id }
  }
  return null
}
