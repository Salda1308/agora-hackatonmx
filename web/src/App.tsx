import { Dock } from './components/ui/Dock'
import { EmptyState } from './components/ui/EmptyState'
import { Button } from './components/ui/Button'
import { IconBookmark, IconHeart, IconHome, IconList, IconSwatch } from './components/ui/icons'
import { SAMPLE_REQUESTS } from './data/sample'
import { paths, useRoute } from './lib/router'
import { Directory } from './screens/Directory'
import { Following } from './screens/Following'
import { Home } from './screens/Home'
import { RequestDetail } from './screens/RequestDetail'
import { SystemGallery } from './screens/SystemGallery'

function App() {
  const route = useRoute()

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
      screen = <SystemGallery />
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
        action={{ key: 'give', label: 'Ayudar', href: paths.request(SAMPLE_REQUESTS[0].id), icon: <IconHeart /> }}
        end={[
          { key: 'following', label: 'Siguiendo', href: paths.following, icon: <IconBookmark /> },
          { key: 'system', label: 'Sistema', href: paths.system, icon: <IconSwatch /> },
        ]}
      />
    </div>
  )
}

export default App
