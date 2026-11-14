import { createContext } from 'react'
import { isDemoEnabled } from './demo.ts'
import type { createSessionStore } from './session-store.ts'

export const demoEnabled = Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) && isDemoEnabled(
  import.meta.env.VITE_DEMO_AUTH_ENABLED, import.meta.env.VITE_SUPABASE_URL,
)

export const SessionContext = createContext<ReturnType<typeof createSessionStore> | null>(null)
