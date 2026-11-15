import { Dock } from './ui/Dock'
import { IconBookmark, IconHeart, IconHome, IconList, IconSearch, IconUser } from './ui/icons'
import { paths, type Route } from '../lib/router'

/** Destinos actuales; D8 puede cambiar la cuenta sin tocar la navegación pública. */
export function SiteDock({ route }: { route: Route }) {
  // D8: Cuenta lleva a #/cuenta para todos; ahí cada rol ve lo suyo.
  const account = paths.cuenta
  const active = route.name === 'request' ? 'directory' : ['jornada', 'folio'].includes(route.name) ? 'jornadas'
    : ['role', 'fundacion', 'fundacion-publicar', 'cuenta'].includes(route.name) ? 'account' : route.name
  const entries = [
    { key: 'home', label: 'Inicio', href: paths.home, icon: <IconHome /> },
    { key: 'directory', label: 'Solicitudes', href: paths.directory, icon: <IconList /> },
    { key: 'jornadas', label: 'Voluntariado', href: paths.jornadas, icon: <IconHeart /> },
    { key: 'following', label: 'Siguiendo', href: paths.following, icon: <IconBookmark /> },
    { key: 'account', label: 'Cuenta', href: account, icon: <IconUser /> },
  ]
  // D10: en escritorio la barra lleva búsqueda (el directorio tiene el buscador) y el CTA oscuro.
  const actions = <>
    <a className="ui-icon-button" href={paths.directory} aria-label="Buscar causas"><IconSearch /></a>
    <a className="ui-dock__cta" href={paths.directory}>Donar <span className="ui-dock__cta-arrow" aria-hidden="true">→</span></a>
  </>
  return <Dock activeKey={active} start={entries.slice(0, 2)} end={entries.slice(2)} actions={actions} />
}
