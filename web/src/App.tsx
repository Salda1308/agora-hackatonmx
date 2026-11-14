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
    case 'system':
      screen = import.meta.env.DEV ? <SystemGallery /> : null
      break
    case 'role':
      screen = <RoleScreen route={route} />
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
