import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { paths } from '../lib/router'

/** Causas seguidas. Sin backend todavía, muestra el estado vacío con Coco. */
export function Following() {
  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span className="brand brand--ink">Ágora</span>
          <ThemeToggle />
        </div>
        <h1 className="page-title">
          Lo que <span className="highlight highlight--lime">sigues</span>
        </h1>
        <EmptyState
          title="Aún no sigues ninguna causa"
          description="Cuando sigas una, aquí verás su avance y cada entrega confirmada."
          action={
            <Button href={paths.directory}>
              Explorar solicitudes
            </Button>
          }
        />
      </div>
    </main>
  )
}
