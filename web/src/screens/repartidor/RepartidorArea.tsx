import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from '../fundacion/Marco'
import { altaRepartidor } from './api'
import { Tareas } from './Tareas'
import './repartidor.css'

/**
 * Área del repartidor (T09). Se carga aparte (lazy). La guarda es de interfaz; las
 * funciones de la base de datos validan rol, regla de valor y asignación.
 */
export default function RepartidorArea() {
  const { status, role, user } = useSession()
  if (status === 'loading') return <Marco><p className="rep-muted" role="status">Cargando…</p></Marco>
  if (status === 'ready' && role === 'repartidor') return <Tareas />
  // Cuenta iniciada sin perfil de rol: puede darse de alta como voluntario.
  if (status === 'ready' && role === 'comprador' && user) return <Alta />
  return <SinAcceso />
}

function Alta() {
  const { retry } = useSession()
  const [nombre, setNombre] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setFallo(null)
    setEnviando(true)
    try {
      await altaRepartidor(nombre)
      await retry()
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo completar el alta.')
      setEnviando(false)
    }
  }

  return (
    <Marco>
      <div>
        <h1 className="page-title">Hazte voluntario</h1>
        <p className="page-lead">Recoge pedidos en la tienda y llévalos a quien los necesita.</p>
      </div>
      <Card className="rep-stack">
        <form className="rep-stack" onSubmit={(e) => void enviar(e)}>
          <label className="rep-field">
            Tu nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name"
              minLength={2} maxLength={120} required />
          </label>
          <label className="rep-check">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} required />
            <span>Entregaré completo y mostraré el código solo en la tienda.</span>
          </label>
          <p className="rep-muted">Al empezar solo verás pedidos de hasta $500. Tu correo debe estar confirmado.</p>
          <Button type="submit" size="lg" block disabled={enviando || !acepto || nombre.trim().length < 2}>
            {enviando ? 'Enviando…' : 'Darme de alta'}
          </Button>
          {fallo ? <p className="rep-error" role="alert">{fallo}</p> : null}
        </form>
      </Card>
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
