import { useState } from 'react'
import { SessionProvider } from '../../auth/SessionProvider'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from './Marco'
import { MisSolicitudes } from './MisSolicitudes'
import { NuevaSolicitud } from './NuevaSolicitud'
import './fundacion.css'

export type VistaFundacion = 'lista' | 'publicar'

/**
 * Área de la fundación. Se carga aparte (lazy) para que la web pública no dependa de
 * Supabase. Monta su propia sesión de R1; el rol sale solo de perfiles y RLS autoriza.
 */
export default function FundacionArea({ vista }: { vista: VistaFundacion }) {
  return (
    <SessionProvider>
      <Puerta vista={vista} />
    </SessionProvider>
  )
}

function Puerta({ vista }: { vista: VistaFundacion }) {
  const { status, role, organizationId, demoEnabled, signInDemo, signOut, retry, error } = useSession()
  const [fallo, setFallo] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  if (status === 'loading') {
    return (
      <Marco>
        <p className="fund-muted" role="status">Cargando…</p>
      </Marco>
    )
  }

  if (status === 'error') {
    return (
      <Marco>
        <EmptyState
          title="No pudimos cargar tu sesión"
          description={error ?? undefined}
          action={
            <div className="wrap-row">
              <Button variant="ink" onClick={() => void retry()}>Reintentar</Button>
              <Button variant="ghost" onClick={() => void signOut().catch(() => {})}>Salir</Button>
            </div>
          }
        />
      </Marco>
    )
  }

  if (role !== 'fundacion' || !organizationId) {
    const entrar = async () => {
      setFallo(null)
      setEntrando(true)
      try {
        await signInDemo('fundacion')
      } catch (e) {
        setFallo(e instanceof Error ? e.message : 'No se pudo entrar.')
      } finally {
        setEntrando(false)
      }
    }
    return (
      <Marco>
        <EmptyState
          title="Solo para fundaciones"
          description="Entra con la cuenta de tu fundación para pedir y publicar."
          action={
            demoEnabled ? (
              <div className="stack">
                <Button onClick={() => void entrar()} disabled={entrando}>
                  {entrando ? 'Entrando…' : 'Entrar como fundación'}
                </Button>
                <span className="fund-muted fund-center">Acceso de demostración · datos de ejemplo</span>
              </div>
            ) : (
              <Button variant="ink" href={paths.home}>Ir al inicio</Button>
            )
          }
        />
        {fallo ? <p className="fund-error" role="alert">{fallo}</p> : null}
      </Marco>
    )
  }

  return vista === 'publicar' ? (
    <NuevaSolicitud organizacionId={organizationId} />
  ) : (
    <MisSolicitudes organizacionId={organizationId} />
  )
}
