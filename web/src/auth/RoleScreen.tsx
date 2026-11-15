import { Button } from '../components/ui/Button'
import { SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { paths } from '../lib/router'
import { RequireRole } from './RequireRole'
import { registroPaths } from './registro-routes'
import type { RoleRoute } from './role-routes'
import { roleLabels, roleNavigation } from './roles'
import { useSession } from './useSession'

/** Punto de sustitución para T06/T08/T09/T17/T18; no simula acciones de negocio. */
export function RoleScreen({ route }: { route: RoleRoute }) {
  const { role, profile, status, user } = useSession()
  const destination = roleNavigation[route.role].find((entry) => entry.id === route.page)
  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar"><span className="brand">Ágora</span></div>
        <RequireRole allowed={[route.role]}
          pending={<EmptyState title="Cargando tu sesión" description="Estamos comprobando tu acceso." />}
          fallback={<EmptyState title={`Acceso para ${roleLabels[route.role].toLowerCase()}`}
            description={status === 'error' ? 'Reintenta o cierra sesión desde el panel de acceso.'
              : 'Esta cuenta no tiene acceso a esa área.'}
            action={user && role === 'comprador'
              ? <Button variant="ink" href={registroPaths.registro}>Solicitar acceso</Button>
              : <Button variant="ink" href={paths.home}>Ir al inicio</Button>} />}>
          <SampleBadge />
          <div><p className="session-muted">{roleLabels[route.role]} · {profile?.nombre_visible}</p>
            <h1 className="page-title">{destination?.label}</h1></div>
          <EmptyState pose={route.role === 'repartidor' ? 'volando-garrafon' : 'saludando'} title="Tu espacio está listo"
            description="Las herramientas de esta sección estarán disponibles pronto."
            action={<Button variant="outline" href={paths.directory}>Ver solicitudes públicas</Button>} />
        </RequireRole>
        {role && role !== 'comprador' ? <a href={`#${roleNavigation[role][0].path}`}>Volver a mi área</a> : null}
      </div>
    </main>
  )
}
