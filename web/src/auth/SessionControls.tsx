import { useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { SampleBadge } from '../components/ui/Chip'
import { demoAccounts } from './demo'
import { roleLabels, roleNavigation } from './roles'
import type { Role } from './roles'
import { useSession } from './useSession'
import './session.css'

export function SessionControls() {
  const { user, role, loading, status, error, demoEnabled, signInDemo, signOut, retry } = useSession()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)
  if (!demoEnabled && !user && status !== 'error') return null

  async function changeAccount(nextRole?: Role) {
    setBusy(true)
    setActionError(null)
    try {
      if (nextRole) await signInDemo(nextRole)
      else await signOut()
      window.location.hash = nextRole ? `#${roleNavigation[nextRole][0].path}` : '#/'
      if (details.current) details.current.open = false
      summary.current?.focus()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo cambiar la sesión.')
    } finally { setBusy(false) }
  }

  return (
    <aside className="session-controls" aria-label="Sesión">
      <details ref={details}>
        <summary ref={summary} className="session-controls__summary">
          <span>{demoEnabled ? 'Acceso de demostración' : 'Tu sesión'}</span>
          <strong>{loading ? 'Cargando…' : user && role ? roleLabels[role] : 'Visitante'}</strong>
        </summary>
        <div className="session-controls__panel" aria-busy={busy || loading}>
          {demoEnabled ? <>
            <SampleBadge />
            <p className="session-muted">Elige un rol para probar Ágora con una cuenta de ejemplo.</p>
            <div className="session-controls__roles" role="group" aria-label="Entrar con un rol demo">
              {demoAccounts.map((account) => (
                <Button key={account.role} variant={user?.email === account.email ? 'ink' : 'outline'}
                  aria-pressed={user?.email === account.email} disabled={loading || busy}
                  onClick={() => { void changeAccount(account.role) }}>{account.label}</Button>
              ))}
            </div>
          </> : null}
          {user ? <Button variant="ghost" disabled={busy || loading}
            onClick={() => { void changeAccount() }}>Cerrar sesión</Button> : null}
        </div>
      </details>
      {error || actionError ? <div className="session-controls__error" role="alert">
        <p>{actionError ?? error}</p>
        {status === 'error' ? <Button variant="outline" disabled={busy || loading}
          onClick={() => { setActionError(null); void retry() }}>Reintentar sesión</Button> : null}
      </div> : null}
    </aside>
  )
}
