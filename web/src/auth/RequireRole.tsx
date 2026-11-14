import type { ReactNode } from 'react'
import { hasRole } from './roles.ts'
import type { Role } from './roles.ts'
import { useSession } from './useSession.ts'

// Guarda de interfaz. La autorización de datos sigue estando en RLS.
export function RequireRole({ allowed, children, fallback = null, pending = null }: {
  allowed: readonly Role[]
  children: ReactNode
  fallback?: ReactNode
  pending?: ReactNode
}) {
  const { status, role } = useSession()
  if (status === 'loading') return pending
  if (status !== 'ready' || !hasRole(role, allowed)) return fallback
  return children
}
