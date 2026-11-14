import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { createSessionStore } from './session-store.ts'
import { demoEnabled, SessionContext } from './session-context.ts'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSessionStore(supabase, demoEnabled))
  useEffect(() => store.start(), [store])
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>
}
