import { Dock } from '../components/ui/Dock'
import { IconBookmark, IconBox, IconHome, IconList, IconPin, IconPlus } from '../components/ui/icons'
import { roleLabels, roleNavigation } from './roles'
import { useSession } from './useSession'
import type { Route } from '../lib/router'

const icons = {
  home: <IconHome />, directory: <IconList />, following: <IconBookmark />,
  solicitudes: <IconList />, publicar: <IconPlus />, organizacion: <IconHome />,
  jornadas: <IconBookmark />, pedidos: <IconBox />, catalogo: <IconList />,
  tareas: <IconPin />, entregas: <IconBox />, reconocimiento: <IconBookmark />,
}

/** Adaptador: mantiene la API y el aspecto de Dock sin cambios compartidos. */
export function RoleDock({ route }: { route: Route }) {
  const { status, role } = useSession()
  const dockRole = status === 'ready' && role ? role : 'comprador'
  const active = route.name === 'role' && route.role === dockRole ? route.page
    : route.name === 'request' ? 'directory' : route.name
  const entries = roleNavigation[dockRole].map((entry) => ({
    key: entry.id, label: entry.label, href: `#${entry.path}`, icon: icons[entry.id],
  }))
  // Solo Publicar crea una acción; el resto son destinos normales, como en D3.
  const action = dockRole === 'fundacion' ? entries.find((entry) => entry.key === 'publicar') : undefined
  const items = entries.filter((entry) => entry !== action)
  return <Dock activeKey={active} start={items.slice(0, 1)} end={items.slice(1)} action={action}
    label={`Navegación de ${roleLabels[dockRole].toLowerCase()}`} />
}
