import { RequestCard } from '../components/RequestCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SampleBadge } from '../components/ui/Chip'
import { Coco } from '../components/ui/Coco'
import { SAMPLE_REQUESTS, requestTotals } from '../data/sample'
import { paths } from '../lib/router'

const STEPS = [
  { title: 'Piden', text: 'Una organización verificada elige lo que necesita del catálogo de una tienda.' },
  { title: 'Pagas', text: 'Eliges cuántas unidades pagar. El pago va directo a la tienda.' },
  { title: 'Llega', text: 'La tienda prepara, alguien entrega y la organización confirma.' },
]

export function Home() {
  const totals = SAMPLE_REQUESTS.map(requestTotals).reduce(
    (a, t) => ({ paid: a.paid + t.paid, total: a.total + t.total, delivered: a.delivered + t.delivered }),
    { paid: 0, total: 0, delivered: 0 },
  )
  const featured = SAMPLE_REQUESTS.slice(0, 2)

  return (
    <main className="screen">
      <section className="hero">
        <div className="topbar">
          <span className="brand">Ágora</span>
          <ThemeToggle />
        </div>
        <h1 className="hero__title">
          Ayuda que <span className="highlight">se ve</span>, unidad por unidad.
        </h1>
        <p className="hero__lead">
          Organizaciones verificadas piden lo que necesitan en unidades con precio fijo. Tú eliges cuántas pagar y ves la
          barra avanzar.
        </p>
        <div className="hero__coco">
          <Coco size={168} />
          <p className="hero__bubble">¡Hola! Soy Coco. Te acompaño en cada paso.</p>
        </div>
        <Button variant="accent" size="lg" block href={paths.directory}>
          Ver solicitudes
        </Button>
      </section>

      <div className="screen__body">
        <div className="section-head">
          <h2 className="section-title">Hoy en Ágora</h2>
          <SampleBadge />
        </div>
        <div className="stats">
          <Card tone="yellow" className="stat">
            <span className="stat__value">{totals.paid}</span>
            <span className="stat__label">unidades pagadas</span>
          </Card>
          <Card tone="lime" className="stat">
            <span className="stat__value">{SAMPLE_REQUESTS.length}</span>
            <span className="stat__label">solicitudes abiertas</span>
          </Card>
          <Card tone="ink" className="stat stat--wide">
            <span className="stat__value">{Math.round((totals.delivered / totals.total) * 100)}%</span>
            <span className="stat__label">de lo pedido ya se entregó</span>
          </Card>
        </div>

        <div className="section-head">
          <h2 className="section-title">Necesitan ahora</h2>
          <a className="section-link" href={paths.directory}>
            Ver todas
          </a>
        </div>
        <div className="stack">
          {featured.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>

        <Card tone="ink" padding="lg" className="how">
          <h2 className="how__title">
            Cómo <span className="highlight highlight--lime">funciona</span>
          </h2>
          <ol className="how__list">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="how__num">{i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </main>
  )
}
