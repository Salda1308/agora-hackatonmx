import { useState } from 'react'
import { RequireRole } from '../../auth/RequireRole'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from '../fundacion/Marco'
import { Catalogo } from './Catalogo'
import { Pedidos } from './Pedidos'
import './tienda.css'

export type VistaTienda = 'pedidos' | 'catalogo'

/**
 * Área de la tienda (T08). Se carga aparte (lazy). Usa la sesión de R1 montada en
 * main.tsx; RequireRole es solo la guarda de interfaz, RLS autoriza los datos.
 */
export default function TiendaArea({ vista }: { vista: VistaTienda }) {
  const { organizationId } = useSession()
  return (
    <RequireRole allowed={['tienda']}
      pending={<Marco><CocoLoading title="Cargando sesión…" size={88} /></Marco>}
      fallback={<SinAcceso />}>
      {organizationId ? (
        vista === 'catalogo' ? <Catalogo tiendaId={organizationId} /> : <Pedidos tiendaId={organizationId} />
      ) : <SinAcceso />}
    </RequireRole>
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
      await signInDemo('tienda')
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally {
      setEntrando(false)
    }
  }
  return (
    <Marco>
      <EmptyState title="Solo para tiendas" description="Entra con la cuenta de tu tienda para ver tus pedidos."
        action={demoEnabled ? (
          <div className="stack">
            <Button onClick={() => void entrar()} disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar como tienda'}</Button>
            <span className="tda-muted tda-center">Acceso de demostración · datos de ejemplo</span>
          </div>
        ) : <Button variant="ink" href={paths.home}>Ir al inicio</Button>} />
      {fallo ? <p className="tda-error" role="alert">{fallo}</p> : null}
    </Marco>
  )
}
