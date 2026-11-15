import { useContext, useSyncExternalStore } from 'react'
import { authEnabled, demoEnabled, SessionContext } from './session-context.ts'
import { roleNavigation } from './roles.ts'

export function useSession() {
  const store = useContext(SessionContext)
  if (!store) throw new Error('useSession requiere SessionProvider.')
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return {
    ...state,
    user: state.session?.user ?? null,
    loading: state.status === 'loading',
    demoEnabled,
    authEnabled,
    navigation: state.status === 'ready' && state.role ? roleNavigation[state.role] : [],
    signInDemo: store.signInDemo,
    signIn: store.signIn,
    signOut: store.signOut,
    retry: store.retry,
  }
}
