import { createContext } from 'react'
import { isDemoEnabled } from './demo.ts'
import type { createSessionStore } from './session-store.ts'

export const demoEnabled = Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) && isDemoEnabled(
  import.meta.env.VITE_DEMO_AUTH_ENABLED, import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_DEMO_AUTH_HOST,
)

// Hay backend configurado: se ofrecen Entrar y Crear cuenta (T23).
export const authEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export const SessionContext = createContext<ReturnType<typeof createSessionStore> | null>(null)
