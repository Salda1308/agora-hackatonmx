import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SampleBadge } from '../components/ui/Chip'
import { Coco } from '../components/ui/Coco'
import { ProgressBar } from '../components/ui/Progress'
import { useRequests, requestTotals } from '../features/requests/data'
import { paths } from '../lib/router'
import { requestVisual } from '../lib/request-visuals'

export function Home() {
  const { requests, loading, error, retry } = useRequests()
  const featured = requests.slice(0, 2)

  return (
    <main className="screen landing">
      <div className="landing__cover">
        <header className="landing__header">
          <span className="brand">Ágora</span>
          <ThemeToggle />
        </header>
        <div className="landing__portrait" aria-hidden="true">
          <Coco size={640} variant="portrait" />
        </div>
      </div>

      <section className="landing__story">
        <h1 className="landing__title">Tu ayuda llega.</h1>
        <Button variant="outline" size="lg" block className="landing__cta" href={paths.directory}>
          Quiero ayudar
        </Button>
      </section>

      <div className="landing__discover">
        <section className="landing__needs" aria-labelledby="home-needs">
          <div className="section-head">
            <h2 id="home-needs" className="section-title">Necesitan <span className="highlight">apoyo</span></h2>
            <a className="section-link" href={paths.directory}>Ver todas</a>
          </div>
          {loading && <p role="status">Cargando solicitudes…</p>}
          {error && <div role="alert"><p>{error}</p><Button onClick={retry}>Reintentar</Button></div>}
          {!loading && !error && !featured.length && <p>Pronto habrá solicitudes publicadas.</p>}
          <div className="stack">
            {featured.map((request) => {
              const totals = requestTotals(request)
              return (
                <Card key={request.id} href={paths.request(request.id)} className="landing__need">
                  <div className="landing__need-summary">
                    <img src={requestVisual(request.category)} alt="" width="88" height="88" loading="lazy" decoding="async" />
                    <div>
                      {request.sample && <SampleBadge />}<h3>{request.title}</h3>
                      <p>{request.org}</p>
                    </div>
                  </div>
                  <ProgressBar
                    label="Unidades pagadas"
                    value={totals.paid}
                    max={totals.total}
                    tone="ink"
                  />
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
