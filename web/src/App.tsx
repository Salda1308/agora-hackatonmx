import { Dock } from './components/ui/Dock'
import { EmptyState } from './components/ui/EmptyState'
import { Button } from './components/ui/Button'
import { IconBookmark, IconHome, IconList } from './components/ui/icons'
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
  let active = ''
  switch (route.name) {
    case 'home':
      screen = <Home />
      active = 'home'
      break
    case 'directory':
      screen = <Directory />
      active = 'directory'
      break
    case 'request':
      screen = <RequestDetail key={route.id} id={route.id} />
      active = 'directory'
      break
    case 'following':
      screen = <Following />
      active = 'following'
      break
    case 'system':
      screen = import.meta.env.DEV ? <SystemGallery /> : null
      active = 'system'
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
      {screen}
      <Dock
        activeKey={active}
        start={[
          { key: 'home', label: 'Inicio', href: paths.home, icon: <IconHome /> },
          { key: 'directory', label: 'Solicitudes', href: paths.directory, icon: <IconList /> },
        ]}
        end={[
          { key: 'following', label: 'Siguiendo', href: paths.following, icon: <IconBookmark /> },
        ]}
      />
    </div>
  )
}

export default App
