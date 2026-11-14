import { useEffect, useSyncExternalStore } from 'react'
import { parseRolePath } from '../auth/role-routes.ts'
import type { RoleRoute } from '../auth/role-routes.ts'

/*
 * Ruteo mínimo por hash para las pantallas ancla de D1, sin dependencias.
 * Si una tarea posterior adopta un router completo, estas rutas se migran tal cual.
 */

export type Route =
  | RoleRoute
  | { name: 'home' }
  | { name: 'directory' }
  | { name: 'request'; id: string }
  | { name: 'system' }
  | { name: 'following' }
  | { name: 'not-found' }

export const paths = {
  home: '#/',
  directory: '#/solicitudes',
  request: (id: string) => `#/solicitudes/${encodeURIComponent(id)}`,
  system: '#/sistema',
  following: '#/siguiendo',
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/solicitudes') return { name: 'directory' }
  if (path === '/sistema') return { name: 'system' }
  if (path === '/siguiendo') return { name: 'following' }
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
