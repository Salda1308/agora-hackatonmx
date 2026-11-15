import { useRef, useState } from 'react'
import { Coco } from '../components/ui/Coco'
import { Button } from '../components/ui/Button'
import { SampleBadge } from '../components/ui/Chip'
import { demoAccounts } from './demo'
import { registroPaths } from './registro-routes'
import { roleLabels, roleNavigation } from './roles'
import type { Role } from './roles'
import { useSession } from './useSession'
import './session.css'

export function SessionControls() {
  const { user, role, loading, status, error, demoEnabled, authEnabled, signInDemo, signOut, retry } = useSession()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)
  if (!demoEnabled && !authEnabled && !user && status !== 'error') return null

  function cerrar() {
    if (details.current) details.current.open = false
  }

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
          <span>{demoEnabled ? 'Acceso de demostración' : user ? 'Tu sesión' : 'Tu cuenta'}</span>
          <strong>{loading ? 'Cargando…' : user && role ? roleLabels[role] : demoEnabled ? 'Visitante' : 'Entrar'}</strong>
        </summary>
        <div className="session-controls__panel" aria-busy={busy || loading}>
          {demoEnabled ? <>
            <Coco size={72} pose="saludando" animation="greet" />
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
          {authEnabled && !user ? (
            <div className="session-controls__account" role="group" aria-label="Tu cuenta">
              <p className="session-muted">¿Fundación, tienda o repartidor? Entra con tu cuenta o solicita tu alta.</p>
              <div className="session-controls__roles">
                <Button variant="outline" href={registroPaths.entrar} onClick={cerrar}>Entrar</Button>
                <Button variant="outline" href={registroPaths.crearCuenta} onClick={cerrar}>Crear cuenta</Button>
              </div>
            </div>
          ) : null}
          {user && status === 'ready' && role === 'comprador' && !demoAccounts.some((a) => a.email === user.email) ? (
            <Button variant="outline" href={registroPaths.registro} onClick={cerrar}>Mi solicitud de alta</Button>
          ) : null}
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
