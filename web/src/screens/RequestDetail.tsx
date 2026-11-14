import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip, SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar, ProgressRing } from '../components/ui/Progress'
import { IconBack, IconCheck, IconPin } from '../components/ui/icons'
import { useRequests, formatMXN, requestTotals } from '../features/requests/data'
import { Donation } from '../features/requests/Donation'
import { paths } from '../lib/router'
import { requestVisual } from '../lib/request-visuals'

export function RequestDetail({ id }: { id: string }) {
  const { requests, loading, error, live, retry } = useRequests(id)
  const request = requests[0]
  if (loading || error) return <main className="screen"><div className="screen__body screen__body--top">{loading ? <p role="status">Cargando solicitud…</p> : <div role="alert"><p>{error}</p><Button onClick={retry}>Reintentar</Button></div>}</div></main>

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
    { label: 'Pagada', detail: `${totals.paid} de ${totals.total} unidades`, done: totals.total > 0 && totals.paid >= totals.total },
    { label: 'Lista en tienda', detail: `${totals.ready} unidades`, done: totals.total > 0 && totals.ready >= totals.total },
    { label: 'Entregada', detail: `${totals.delivered} unidades confirmadas`, done: totals.total > 0 && totals.delivered >= totals.total },
  ]

  return (
    <main className="screen request-detail">
      <section className="detail-hero">
        <div className="topbar">
          <a className="ui-icon-button" href={paths.directory} aria-label="Volver a solicitudes">
            <IconBack />
          </a>
          {request.sample && <SampleBadge />}
          <ThemeToggle />
        </div>
        <div className="detail-hero__chips">
          <Chip>{request.category}</Chip>
          {request.recurring ? <Chip>Cada mes</Chip> : null}
        </div>
        <div className="detail-hero__intro">
          <div className="stack">
            <h1 className="detail-hero__title">{request.title}</h1>
            <p className="detail-hero__org">
              <a href={paths.organization(request.orgSlug)}>{request.org}</a>
              <span className="request-card__city"><IconPin /> {request.city}</span>
            </p>
          </div>
          <img src={requestVisual(request.category)} alt="" width="104" height="104" />
        </div>
        <div className="detail-hero__progress">
          <ProgressRing
            value={totals.paid}
            max={totals.total}
            label="Unidades pagadas"
            size={120}
            stroke={12}
            tone="ink"
            caption="pagado"
          />
          <div className="detail-hero__amounts">
            <span className="detail-hero__amount">{formatMXN(totals.amountPaid)}</span>
            <span>de {formatMXN(totals.amountTotal)}</span>
            <span className="detail-hero__updated">Actualizado {live ? 'en vivo' : request.updated}</span>
          </div>
        </div>
        <ProgressBar
          label="Unidades pagadas"
          value={totals.paid}
          max={totals.total}
          tone="ink"
        />
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
                  tone={done ? 'lime' : 'ink'}
                />
                <div className="item-card__chips">
                  {done ? (
                    <Chip tone="lime" icon={<IconCheck />}>
                      Completo
                    </Chip>
                  ) : (
                    <Chip>Faltan {item.total - item.paid}</Chip>
                  )}
                  <Chip>Listas {item.ready}</Chip>
                  <Chip>Entregadas {item.delivered}</Chip>
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

        <Donation request={request} />
      </div>
    </main>
  )
}
