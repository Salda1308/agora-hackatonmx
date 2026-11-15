import { useSession } from '../auth/useSession'
import { Dock } from './ui/Dock'
import { IconBookmark, IconHeart, IconHome, IconList, IconUser } from './ui/icons'
import { paths, type Route } from '../lib/router'

/** Destinos actuales; D8 puede cambiar la cuenta sin tocar la navegación pública. */
export function SiteDock({ route }: { route: Route }) {
  const { role, status } = useSession()
  const account = status === 'ready' && role === 'fundacion' ? '#/fundacion'
    : status === 'ready' && role === 'tienda' ? '#/tienda'
    : status === 'ready' && role === 'repartidor' ? '#/repartidor' : paths.following
  const active = route.name === 'request' ? 'directory' : ['jornada', 'folio'].includes(route.name) ? 'jornadas'
    : ['role', 'fundacion', 'fundacion-publicar'].includes(route.name) ? 'account' : route.name
  const entries = [
    { key: 'home', label: 'Inicio', href: paths.home, icon: <IconHome /> },
    { key: 'directory', label: 'Solicitudes', href: paths.directory, icon: <IconList /> },
    { key: 'jornadas', label: 'Voluntariado', href: paths.jornadas, icon: <IconHeart /> },
    { key: 'following', label: 'Siguiendo', href: paths.following, icon: <IconBookmark /> },
    { key: 'account', label: 'Cuenta', href: account, icon: <IconUser /> },
  ]
  return <Dock activeKey={active} start={entries.slice(0, 2)} end={entries.slice(2)} />
}
