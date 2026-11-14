import type { Role } from './roles.ts'

export const demoAccounts: ReadonlyArray<{ role: Role; label: string; email: string }> = [
  { role: 'comprador', label: 'Comprador', email: 'comprador@demo.agora.test' },
  { role: 'fundacion', label: 'Fundación', email: 'fundacion@demo.agora.test' },
  { role: 'tienda', label: 'Tienda', email: 'tienda@demo.agora.test' },
  { role: 'repartidor', label: 'Repartidor', email: 'repartidor@demo.agora.test' },
]

// demoHost: host exacto del Supabase de la demo publicada (VITE_DEMO_AUTH_HOST), solo HTTPS.
export function isDemoEnabled(flag: unknown, supabaseUrl: string, demoHost?: unknown): boolean {
  if (flag !== 'true') return false
  try {
    const url = new URL(supabaseUrl)
    const loopback = ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    const hosted = url.protocol === 'https:' && typeof demoHost === 'string' &&
      demoHost !== '' && url.hostname === demoHost
    return (loopback || hosted) && !url.username && !url.password
  } catch {
    return false
  }
}

export function demoCredentials(role: Role, enabled: boolean) {
  if (!enabled) throw new Error('El acceso de demostración está desactivado.')
  const account = demoAccounts.find((entry) => entry.role === role)
  if (!account) throw new Error('Rol de demostración inválido.')
  // Pública por diseño: coincide con supabase/seed.sql. Solo para el stack local.
  return { email: account.email, password: 'Agora-demo-2026!' }
}
