import { useState } from 'react'
import { registroPaths } from '../../auth/registro-routes'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from '../fundacion/Marco'
import { Tareas } from './Tareas'
import './repartidor.css'

/**
 * Área del repartidor (T09). Se carga aparte (lazy). La guarda es de interfaz; las
 * funciones de la base de datos validan rol, regla de valor y asignación.
 */
export default function RepartidorArea() {
  const { status, role, user } = useSession()
  if (status === 'loading') return <Marco><CocoLoading title="Cargando sesión…" size={88} /></Marco>
  if (status === 'ready' && role === 'repartidor') return <Tareas />
  // Cuenta iniciada sin perfil de rol: camino a la solicitud de alta.
  if (status === 'ready' && role === 'comprador' && user) return <Alta />
  return <SinAcceso />
}

// El alta es por solicitud revisada por el equipo (T22/T23), ya no al instante.
function Alta() {
  return (
    <Marco>
      <EmptyState pose="volando-garrafon" title="Hazte repartidor"
        description="Envía tu solicitud. El equipo la revisa y, al aprobarla, verás aquí las tareas cerca de ti."
        action={<Button variant="ink" href={registroPaths.registroRol('repartidor')}>Solicitar acceso</Button>} />
    </Marco>
  )
}

function SinAcceso() {
  const { status, demoEnabled, signInDemo, signOut, retry, error } = useSession()
  const [fallo, setFallo] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  if (status === 'error') {
    return (
      <Marco>
        <EmptyState title="No pudimos cargar tu sesión" description={error ?? undefined}
          action={<div className="wrap-row">
            <Button variant="ink" onClick={() => void retry()}>Reintentar</Button>
            <Button variant="ghost" onClick={() => void signOut().catch(() => {})}>Salir</Button>
          </div>} />
      </Marco>
    )
  }

  const entrar = async () => {
    setFallo(null)
    setEntrando(true)
    try {
      await signInDemo('repartidor')
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally {
      setEntrando(false)
    }
  }
  return (
    <Marco>
      <EmptyState title="Solo para voluntarios" description="Entra con tu cuenta para ver tareas cerca de ti."
        action={demoEnabled ? (
          <div className="stack">
            <Button onClick={() => void entrar()} disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar como repartidor'}</Button>
            <span className="rep-muted rep-center">Acceso de demostración · datos de ejemplo</span>
          </div>
        ) : <Button variant="ink" href={paths.home}>Ir al inicio</Button>} />
      {fallo ? <p className="rep-error" role="alert">{fallo}</p> : null}
    </Marco>
  )
}
