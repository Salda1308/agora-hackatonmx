import { useEffect, useSyncExternalStore } from 'react'
import { parseRolePath } from '../auth/role-routes.ts'
import type { RoleRoute } from '../auth/role-routes.ts'

/*
 * Ruteo mínimo por hash para las pantallas ancla de D1, sin dependencias.
 * Si una tarea posterior adopta un router completo, estas rutas se migran tal cual.
 */

export type Route =
  | RoleRoute
  | { name: 'organization'; slug: string }
  | { name: 'home' }
  | { name: 'directory' }
  | { name: 'request'; id: string }
  | { name: 'system' }
  | { name: 'following' }
  | { name: 'panel' }
  | { name: 'fundacion' }
  | { name: 'fundacion-publicar' }
  | { name: 'jornadas' }
  | { name: 'jornada'; id: string }
  | { name: 'folio'; id: string }
  | { name: 'not-found' }

export const paths = {
  organization: (slug: string) => `#/organizaciones/${encodeURIComponent(slug)}`,
  home: '#/',
  directory: '#/solicitudes',
  request: (id: string) => `#/solicitudes/${encodeURIComponent(id)}`,
  system: '#/sistema',
  following: '#/siguiendo',
  panel: '#/panel',
  fundacion: '#/fundacion',
  fundacionPublicar: '#/fundacion/publicar',
  jornadas: '#/jornadas',
  jornada: (id: string) => `#/jornadas/${encodeURIComponent(id)}`,
  folio: (id: string) => `#/jornadas/folio/${encodeURIComponent(id)}`,
  fundacionJornadas: '#/fundacion/jornadas',
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/solicitudes') return { name: 'directory' }
  if (path === '/sistema') return { name: 'system' }
  if (path === '/siguiendo') return { name: 'following' }
  if (path === '/panel') return { name: 'panel' }
  if (path === '/fundacion') return { name: 'fundacion' }
  if (path === '/fundacion/publicar') return { name: 'fundacion-publicar' }
  const organization = /^\/organizaciones\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)
  if (organization) return { name: 'organization', slug: organization[1] }
  if (path === '/jornadas') return { name: 'jornadas' }
  const folio = /^\/jornadas\/folio\/([^/]+)$/.exec(path)
  if (folio) return { name: 'folio', id: decodeURIComponent(folio[1]) }
  const jornada = /^\/jornadas\/([^/]+)$/.exec(path)
  if (jornada) return { name: 'jornada', id: decodeURIComponent(jornada[1]) }
  const roleRoute = parseRolePath(path)
  if (roleRoute) return roleRoute
  const match = /^\/solicitudes\/([^/]+)$/.exec(path)
  if (match) return { name: 'request', id: decodeURIComponent(match[1]) }
  return { name: 'not-found' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [hash])
  return parseHash(hash)
}
