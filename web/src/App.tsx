import { lazy, Suspense } from 'react'
import { RoleDock } from './auth/RoleDock'
import { RoleScreen } from './auth/RoleScreen'
import { SessionControls } from './auth/SessionControls'
import { EmptyState } from './components/ui/EmptyState'
import { Button } from './components/ui/Button'
import { paths, useRoute } from './lib/router'
import { Directory } from './screens/Directory'
import { Following } from './screens/Following'
import { Home } from './screens/Home'
import { RequestDetail } from './screens/RequestDetail'
import { SystemGallery } from './screens/SystemGallery'

// Área de fundación (T06): carga aparte, con su propia sesión de Supabase.
const FundacionArea = lazy(() => import('./screens/fundacion/FundacionArea'))
// Jornadas de voluntariado (T18): pública y de la fundación, también aparte.
const JornadasArea = lazy(() => import('./screens/jornadas/JornadasArea'))
const JornadasFundacion = lazy(() => import('./screens/jornadas/JornadasFundacion'))

function App() {
  const current = useRoute()
  const route = current.name === 'system' && !import.meta.env.DEV ? { name: 'not-found' as const } : current

  let screen
  switch (route.name) {
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
    case 'fundacion':
    case 'fundacion-publicar':
      screen = (
        <Suspense fallback={null}>
          <FundacionArea vista={route.name === 'fundacion' ? 'lista' : 'publicar'} />
        </Suspense>
      )
      break
    case 'jornadas':
    case 'jornada':
    case 'folio':
      screen = (
        <Suspense fallback={null}>
          <JornadasArea
            vista={route.name === 'jornadas' ? { tipo: 'lista' } : { tipo: route.name === 'jornada' ? 'detalle' : 'folio', id: route.id }}
          />
        </Suspense>
      )
      break
    case 'system':
      screen = import.meta.env.DEV ? <SystemGallery /> : null
      break
    case 'role':
      screen = route.role === 'fundacion' && route.page === 'jornadas'
        ? <Suspense fallback={null}><JornadasFundacion /></Suspense>
        : <RoleScreen route={route} />
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
      {screen}
      <RoleDock route={route} />
    </div>
  )
}

export default App
