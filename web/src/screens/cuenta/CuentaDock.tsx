import { RoleDock } from '../../auth/RoleDock'
import { useSession } from '../../auth/useSession'
import { SiteDock } from '../../components/SiteDock'
import type { Route } from '../../lib/router'

/** En `#/cuenta` cada rol conserva su dock; comprador e invitado usan el dock público. */
export function CuentaDock({ route }: { route: Route }) {
  const { status, role } = useSession()
  return status === 'ready' && role && role !== 'comprador' ? <RoleDock route={route} /> : <SiteDock route={route} />
}
