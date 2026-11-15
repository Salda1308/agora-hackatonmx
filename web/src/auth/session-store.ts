import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { mensajeEntrada } from './cuenta.ts'
import { demoCredentials } from './demo.ts'
import { parseProfile } from './roles.ts'
import type { Profile, Role } from './roles.ts'

export interface SessionState {
  status: 'loading' | 'ready' | 'error'
  session: Session | null
  profile: Profile | null
  role: Role | null
  organizationId: string | null
  error: string | null
}

type SessionClient = Pick<SupabaseClient, 'auth' | 'from'>

const loadingState: SessionState = {
  status: 'loading', session: null, profile: null, role: null, organizationId: null, error: null,
}

export function createSessionStore(client: SessionClient | null, demoEnabled = false) {
  let state = loadingState
  let active = false
  let revision = 0
  let changingAccount = false
  const listeners = new Set<() => void>()

  function publish(next: SessionState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  function fail(session: Session | null) {
    publish({
      ...loadingState, status: 'error', session,
      error: 'No se pudo cargar la sesión. Vuelve a intentar o cierra sesión.',
    })
  }

  async function resolve(session: Session | null, currentRevision: number) {
    if (!active || currentRevision !== revision) return
    publish({ ...loadingState, session })
    try {
      let profile: Profile | null = null
      if (session && client) {
        const { data, error } = await client.from('perfiles')
          .select('id, rol, organizacion_id, nombre_visible').eq('id', session.user.id).maybeSingle()
        if (error) throw error
        profile = parseProfile(data, session.user.id)
      }
      if (!active || currentRevision !== revision) return
      publish({
        status: 'ready', session, profile, role: profile?.rol ?? 'comprador',
        organizationId: profile?.organizacion_id ?? null, error: null,
      })
    } catch {
      if (active && currentRevision === revision) fail(session)
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start() {
      active = true
      const initialRevision = ++revision
      if (!client) {
        void resolve(null, initialRevision)
        return () => { active = false; ++revision }
      }
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        const eventRevision = ++revision
        // Revocar el rol anterior inmediatamente y consultar fuera del callback
        // de Auth (evita bloquear el lock interno de supabase-js).
        publish({ ...loadingState, session })
        setTimeout(() => { void resolve(session, eventRevision) }, 0)
      })
      void client.auth.getSession().then(({ data, error }) => {
        if (!active || initialRevision !== revision) return
        if (error) fail(null)
        else void resolve(data.session, initialRevision)
      }).catch(() => {
        if (active && initialRevision === revision) fail(null)
      })
      return () => {
        active = false
        ++revision
        subscription.unsubscribe()
      }
    },
    async retry() {
      const currentRevision = ++revision
      if (!client) return resolve(null, currentRevision)
      publish({ ...loadingState, session: state.session })
      try {
        const { data, error } = await client.auth.getSession()
        if (!active || currentRevision !== revision) return
        if (error) fail(null)
        else await resolve(data.session, currentRevision)
      } catch {
        if (active && currentRevision === revision) fail(null)
      }
    },
    async signInDemo(role: Role) {
      if (!client) throw new Error('Configura Supabase local para entrar a la demo.')
      const credentials = demoCredentials(role, demoEnabled)
      if (changingAccount) throw new Error('Ya hay un cambio de sesión en curso.')
      changingAccount = true
      const operationRevision = ++revision
      publish({ ...loadingState, session: state.session })
      try {
        const { data, error } = await client.auth.signInWithPassword(credentials)
        if (error) throw new Error('No se pudo entrar a la demo. Comprueba el seed y Supabase local.')
        // Auth puede haber notificado otro evento (incluso SIGNED_OUT desde
        // otra pestaña) mientras terminaba el login. Respetar el más reciente.
        if (revision === operationRevision) await resolve(data.session, ++revision)
        else await resolve(state.session, revision)
      } catch (error) {
        // La cuenta anterior puede seguir autenticada si el login falla.
        // Mantener permisos cerrados hasta reintentar o cerrar sesión.
        if (active) fail(state.session)
        throw error
      } finally {
        changingAccount = false
      }
    },
    /** Inicio de sesión con correo y contraseña reales (T23). Devuelve el perfil resuelto. */
    async signIn(email: string, password: string): Promise<Profile | null> {
      if (!client) throw new Error('El acceso no está disponible por ahora.')
      if (changingAccount) throw new Error('Ya hay un cambio de sesión en curso.')
      changingAccount = true
      const operationRevision = ++revision
      publish({ ...loadingState, session: state.session })
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (error) {
          // Un intento fallido no cambia la cuenta: restaurar la sesión vigente.
          const message = mensajeEntrada(error)
          const current = await client.auth.getSession()
          if (current.error) throw new Error(message)
          if (revision === operationRevision) await resolve(current.data.session, ++revision)
          throw new Error(message, { cause: 'credentials' })
        }
        if (revision === operationRevision) await resolve(data.session, ++revision)
        else await resolve(state.session, revision)
        return state.profile
      } catch (error) {
        if (active && !(error instanceof Error && error.cause === 'credentials')) fail(state.session)
        throw error
      } finally {
        changingAccount = false
      }
    },
    async signOut() {
      if (!client) return resolve(null, ++revision)
      if (changingAccount) throw new Error('Ya hay un cambio de sesión en curso.')
      changingAccount = true
      const operationRevision = ++revision
      publish({ ...loadingState, session: state.session })
      try {
        const { error } = await client.auth.signOut({ scope: 'local' })
        if (error) throw new Error('No se pudo cerrar sesión. Vuelve a intentar.')
        if (revision === operationRevision) await resolve(null, ++revision)
        else await resolve(state.session, revision)
      } catch (error) {
        if (active) fail(state.session)
        throw error
      } finally {
        changingAccount = false
      }
    },
  }
}
