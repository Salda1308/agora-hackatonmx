import { lazy, Suspense } from 'react'
import { RoleDock } from './auth/RoleDock'
import { RoleScreen } from './auth/RoleScreen'
import { SessionControls } from './auth/SessionControls'
import { useTrasConfirmar } from './auth/useTrasConfirmar'
import { EmptyState } from './components/ui/EmptyState'
import { CocoLoading } from './components/ui/CocoLoading'
import { Button } from './components/ui/Button'
import { paths, useRoute } from './lib/router'
import { Directory } from './screens/Directory'
import { Following } from './screens/Following'
import { Home } from './screens/Home'
import { RequestDetail } from './screens/RequestDetail'
import { Panel } from './screens/Panel'
import { SystemGallery } from './screens/SystemGallery'

// Área de fundación (T06): carga aparte, con su propia sesión de Supabase.
const FundacionArea = lazy(() => import('./screens/fundacion/FundacionArea'))
// Área de tienda (T08): pedidos y catálogo; "Mi tienda" sigue en RoleScreen.
const TiendaArea = lazy(() => import('./screens/tienda/TiendaArea'))

const OrganizacionPage = lazy(() => import('./screens/organizacion/OrganizacionPage'))
// Jornadas de voluntariado (T18): pública y de la fundación, también aparte.
const JornadasArea = lazy(() => import('./screens/jornadas/JornadasArea'))
const JornadasFundacion = lazy(() => import('./screens/jornadas/JornadasFundacion'))
// Tareas del repartidor (T09); "Mis entregas" y "Reconocimiento" siguen en RoleScreen.
const RepartidorArea = lazy(() => import('./screens/repartidor/RepartidorArea'))
// Entrar, crear cuenta y solicitud de alta por rol (T23).
const RegistroArea = lazy(() => import('./screens/registro/RegistroArea'))

function App() {
  const current = useRoute()
  const route = current.name === 'system' && !import.meta.env.DEV ? { name: 'not-found' as const } : current
  useTrasConfirmar()

  let screen
  switch (route.name) {
    case 'organization':
      screen = <Suspense fallback={<CocoLoading />}><OrganizacionPage slug={route.slug} /></Suspense>
      break
    case 'home':
      screen = <Home />
      break
    case 'directory':
      screen = <Directory />
      break
    case 'request':
      screen = <RequestDetail key={route.id} id={route.id} />
      break
    case 'following':
      screen = <Following />
      break
    case 'panel':
      screen = <Panel />
      break
    case 'fundacion':
    case 'fundacion-publicar':
      screen = (
        <Suspense fallback={<CocoLoading />}>
          <FundacionArea vista={route.name === 'fundacion' ? 'lista' : 'publicar'} />
        </Suspense>
      )
      break
    case 'jornadas':
    case 'jornada':
    case 'folio':
      screen = (
        <Suspense fallback={<CocoLoading />}>
          <JornadasArea
            vista={route.name === 'jornadas' ? { tipo: 'lista' } : { tipo: route.name === 'jornada' ? 'detalle' : 'folio', id: route.id }}
          />
        </Suspense>
      )
      break
    case 'entrar':
    case 'crear-cuenta':
    case 'registro':
    case 'registro-rol':
    case 'auth-callback':
      screen = <Suspense fallback={<CocoLoading />}><RegistroArea route={route} /></Suspense>
      break
    case 'system':
      screen = import.meta.env.DEV ? <SystemGallery /> : null
      break
    case 'role':
      if (route.page === 'organizacion' && (route.role === 'fundacion' || route.role === 'tienda')) {
        screen = <Suspense fallback={<CocoLoading />}><OrganizacionPage own ownerRole={route.role} /></Suspense>
      } else if (route.role === 'tienda' && (route.page === 'pedidos' || route.page === 'catalogo')) {
        screen = (
          <Suspense fallback={<CocoLoading />}>
            <TiendaArea vista={route.page} />
          </Suspense>
        )
      } else if (route.role === 'fundacion' && route.page === 'jornadas') {
        screen = <Suspense fallback={<CocoLoading />}><JornadasFundacion /></Suspense>
      } else if (route.role === 'repartidor' && route.page === 'tareas') {
        screen = <Suspense fallback={<CocoLoading />}><RepartidorArea /></Suspense>
      } else {
        screen = <RoleScreen route={route} />
      }
      break
    default:
      screen = (
        <main className="screen">
          <div className="screen__body screen__body--top">
            <EmptyState
              title="Esta página no existe"
              description="Coco buscó por todos lados y no la encontró."
              action={
                <Button variant="ink" href={paths.home}>
                  Ir al inicio
                </Button>
              }
            />
          </div>
        </main>
      )
  }

  return (
    <div className="app">
      <SessionControls />
      <div key={route.name} className="coco-screen">{screen}</div>
      <RoleDock route={route} />
    </div>
  )
}

export default App
