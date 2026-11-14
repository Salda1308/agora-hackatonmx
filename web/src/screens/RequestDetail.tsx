import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip, SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar, ProgressRing } from '../components/ui/Progress'
import { IconBack, IconCheck, IconPin } from '../components/ui/icons'
import { findSampleRequest, formatMXN, requestTotals } from '../data/sample'
import { paths } from '../lib/router'

export function RequestDetail({ id }: { id: string }) {
  const request = findSampleRequest(id)

  if (!request) {
    return (
      <main className="screen">
        <div className="screen__body screen__body--top">
          <EmptyState
            title="No encontramos esa solicitud"
            description="Puede que ya se haya completado o que el enlace esté mal."
            action={
              <Button variant="ink" href={paths.directory}>
                Ver solicitudes
              </Button>
            }
          />
        </div>
      </main>
    )
  }

  const totals = requestTotals(request)
  const timeline = [
    { label: 'Publicada', detail: `${totals.total} unidades pedidas`, done: true },
    { label: 'Pagada', detail: `${totals.paid} de ${totals.total} unidades`, done: totals.paid > 0 },
    { label: 'Lista en tienda', detail: `${totals.ready} unidades`, done: totals.ready > 0 },
    { label: 'Entregada', detail: `${totals.delivered} unidades confirmadas`, done: totals.delivered > 0 },
  ]

  return (
    <main className="screen">
      <section className="detail-hero">
        <div className="topbar">
          <a className="ui-icon-button" href={paths.directory} aria-label="Volver a solicitudes">
            <IconBack />
          </a>
          <SampleBadge />
          <ThemeToggle />
        </div>
        <div className="detail-hero__chips">
          <Chip tone="ink">{request.category}</Chip>
          {request.recurring ? <Chip tone="outline">Cada mes</Chip> : null}
        </div>
        <h1 className="detail-hero__title">{request.title}</h1>
        <p className="detail-hero__org">
          {request.org} · {request.orgType}
          <span className="request-card__city">
            <IconPin /> {request.city}
          </span>
        </p>
        <div className="detail-hero__progress">
          <ProgressRing
            value={totals.paid}
            max={totals.total}
            label="Unidades pagadas"
            size={140}
            stroke={14}
            tone="ink"
            caption="pagado"
          />
          <div className="detail-hero__amounts">
            <span className="detail-hero__amount">{formatMXN(totals.amountPaid)}</span>
            <span>de {formatMXN(totals.amountTotal)}</span>
            <span className="detail-hero__updated">Actualizado {request.updated}</span>
          </div>
        </div>
      </section>

      <div className="screen__body">
        <h2 className="section-title">Qué falta</h2>
        <div className="stack">
          {request.items.map((item) => {
            const done = item.paid >= item.total
            return (
              <Card key={item.name} className="item-card">
                <div className="item-card__head">
                  <strong>{item.name}</strong>
                  <span className="item-card__price">{formatMXN(item.unitPrice)} c/u</span>
                </div>
                <ProgressBar
                  label="Unidades pagadas"
                  value={item.paid}
                  max={item.total}
                  tone={done ? 'lime' : 'primary'}
                />
                <div className="item-card__chips">
                  {done ? (
                    <Chip tone="lime" icon={<IconCheck />}>
                      Completo
                    </Chip>
                  ) : (
                    <Chip tone="red">Faltan {item.total - item.paid}</Chip>
                  )}
                  <Chip tone="blue">Listas {item.ready}</Chip>
                  <Chip tone="outline">Entregadas {item.delivered}</Chip>
                </div>
              </Card>
            )
          })}
        </div>

        <h2 className="section-title">Seguimiento</h2>
        <Card>
          <ol className="timeline">
            {timeline.map((step) => (
              <li key={step.label} className={`timeline__step${step.done ? ' timeline__step--done' : ''}`}>
                <span className="timeline__dot" aria-hidden="true">
                  {step.done ? <IconCheck /> : null}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
                <span className="visually-hidden">{step.done ? 'hecho' : 'pendiente'}</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="detail-cta">
          <Button size="lg" block disabled aria-describedby="cta-note">
            Pagar unidades
          </Button>
          <p id="cta-note" className="detail-cta__note">
            Vista de ejemplo: el pago se conecta en otra tarea.
          </p>
        </div>
      </div>
    </main>
  )
}
