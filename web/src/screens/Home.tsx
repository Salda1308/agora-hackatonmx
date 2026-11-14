import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SampleBadge } from '../components/ui/Chip'
import { Coco } from '../components/ui/Coco'
import { ProgressBar } from '../components/ui/Progress'
import { SAMPLE_REQUESTS, requestTotals } from '../data/sample'
import { paths } from '../lib/router'
import { requestVisual } from '../lib/request-visuals'

export function Home() {
  const featured = SAMPLE_REQUESTS.slice(0, 2)
  const organization = SAMPLE_REQUESTS[0]

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
          <SampleBadge />
          <div className="stack">
            {featured.map((request) => {
              const totals = requestTotals(request)
              return (
                <Card key={request.id} href={paths.request(request.id)} className="landing__need">
                  <div className="landing__need-summary">
                    <img src={requestVisual(request.category)} alt="" width="88" height="88" loading="lazy" decoding="async" />
                    <div>
                      <h3>{request.title}</h3>
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

        <section className="landing__updates" aria-labelledby="home-updates">
          <h2 id="home-updates" className="section-title">Desde las organizaciones</h2>
          <Card className="landing__post">
            <div className="landing__post-head">
              <span className="landing__avatar" aria-hidden="true">CH</span>
              <div>
                <strong>{organization.org}</strong>
                <p>Publicación de ejemplo</p>
              </div>
            </div>
            <p>Ya recibimos {organization.items[0].delivered} garrafones. Gracias por sumar.</p>
          </Card>
        </section>
      </div>
    </main>
  )
}
