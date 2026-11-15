import './panel/panel.css'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip, SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { IconCheck } from '../components/ui/icons'
import { ProgressBar } from '../components/ui/Progress'
import { formatMXN } from '../features/requests/data'
import { paths } from '../lib/router'
import { type PanelCounters, type PanelDelivery, type PanelUsage, usePanelPublico } from './panel/api'

const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function fecha(value: string | null) {
  if (!value) return 'Pendiente'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : DATE_FORMAT.format(date)
}

function CounterGroup({ counters, compact = false }: { counters: PanelCounters; compact?: boolean }) {
  return (
    <div className={`panel-counters${compact ? ' panel-counters--compact' : ''}`}>
      <div className="panel-counter panel-counter--received">
        <span className="panel-counter__label">Recibido</span>
        <strong>{counters.recibido}</strong>
        <span>unidades financiadas</span>
      </div>
      <div className="panel-counter panel-counter--bought">
        <span className="panel-counter__label">Comprado</span>
        <strong>{counters.comprado}</strong>
        <span>unidades listas</span>
      </div>
      <div className="panel-counter panel-counter--delivered">
        <span className="panel-counter__label">Entregado</span>
        <strong>{counters.entregado}</strong>
        <span>unidades confirmadas</span>
      </div>
    </div>
  )
}

function DeliveryNote({ delivery }: { delivery: PanelDelivery }) {
  const confirmed = delivery.estado === 'confirmada'
  const evidenceReceived = delivery.estado === 'evidencia_recibida'
  return (
    <div className={`panel-delivery panel-delivery--${delivery.estado}`}>
      <div className="panel-delivery__heading">
        <span className="panel-delivery__icon" aria-hidden="true">
          {confirmed ? <IconCheck /> : <span />}
        </span>
        <div>
          <strong>Entrega vinculada</strong>
          <p>
            {confirmed
              ? `${delivery.constancia}. ${fecha(delivery.confirmada_en)}`
              : evidenceReceived
                ? `${delivery.constancia}. ${fecha(delivery.entregada_en)}`
                : delivery.constancia}
          </p>
        </div>
      </div>
      {delivery.id && !delivery.foto_publica ? (
        <p className="panel-delivery__privacy">
          La foto de entrega es privada y no se muestra aquí. Si la organización da consentimiento explícito para una foto pública, este registro podría añadirla. Por ahora mostramos solo la constancia.
        </p>
      ) : null}
    </div>
  )
}

function UsageCard({ usage }: { usage: PanelUsage }) {
  return (
    <Card className="panel-usage">
      <div className="panel-usage__head">
        <div>
          <span className="panel-usage__eyebrow">Ticket</span>
          <strong className="panel-usage__ticket">{usage.ticket}</strong>
          {usage.ejemplo ? <SampleBadge /> : null}
        </div>
        <strong className="panel-usage__amount">{formatMXN(usage.monto_centavos / 100)}</strong>
      </div>
      <div className="panel-usage__meta">
        <strong>{usage.solicitud}</strong>
        <span>{usage.organizacion} · {usage.zona}</span>
        <span>Recibido {fecha(usage.pagado_en)}</span>
      </div>
      <DeliveryNote delivery={usage.entrega} />
    </Card>
  )
}

export function Panel() {
  const { panel, loading, error, live, retry } = usePanelPublico()

  if (loading) {
    return (
      <main className="screen panel">
        <div className="screen__body screen__body--top">
          <div className="topbar"><span className="brand">Panel público</span></div>
          <EmptyState pose="volando-garrafon" title="Coco está reuniendo las cifras" description="Un momento, estamos leyendo los avances públicos." />
        </div>
      </main>
    )
  }

  if (error || !panel) {
    return (
      <main className="screen panel">
        <div className="screen__body screen__body--top">
          <div className="topbar"><span className="brand">Panel público</span></div>
          <EmptyState
            title="El panel no está disponible"
            description={error || 'No encontramos datos públicos todavía.'}
            action={<Button variant="ink" onClick={retry}>Reintentar</Button>}
          />
        </div>
      </main>
    )
  }

  const empty = panel.solicitudes.length === 0 && panel.usos.length === 0
  return (
    <main className="screen panel">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <a className="ui-icon-button" href={paths.home} aria-label="Volver al inicio">←</a>
          <span className="brand">Panel público</span>
        </div>

        <header className="panel-heading">
          <div className="panel-heading__status">
            <span className={`panel-live${live ? ' panel-live--on' : ''}`} aria-hidden="true" />
            <span>{live ? 'Actualizado en vivo' : 'Actualización periódica'}</span>
          </div>
          <h1 className="page-title">Lo que entra, se compra y <span className="highlight">llega</span>.</h1>
          <p className="page-lead">Transparencia por unidad, sin nombres de donantes, voluntarios ni personas receptoras.</p>
        </header>

        {empty ? (
          <EmptyState
            pose="volando-garrafon"
            title="Aún no hay movimientos públicos"
            description="Cuando una solicitud se publique, Coco traerá sus contadores y su registro de uso."
            action={<Button variant="ink" href={paths.directory}>Ver solicitudes</Button>}
          />
        ) : (
          <>
            <section className="panel-section panel-overview" aria-labelledby="panel-overview-title">
              <div className="panel-section__head">
                <div>
                  <span className="panel-kicker">{panel.evento.nombre}</span>
                  <h2 id="panel-overview-title" className="section-title">Resumen del evento</h2>
                </div>
                <Chip tone="lime">Solo datos públicos</Chip>
              </div>
              <CounterGroup counters={panel.resumen} />
            </section>

            {panel.zonas.length > 0 ? (
              <section className="panel-section" aria-labelledby="panel-zones-title">
                <div className="panel-section__head">
                  <div>
                    <span className="panel-kicker">Dónde sucede</span>
                    <h2 id="panel-zones-title" className="section-title">Por zona</h2>
                  </div>
                </div>
                <div className="panel-zones">
                  {panel.zonas.map((zone) => (
                    <Card key={zone.nombre} className="panel-zone">
                      <h3>{zone.nombre}</h3>
                      <CounterGroup counters={zone} compact />
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="panel-section" aria-labelledby="panel-requests-title">
              <div className="panel-section__head">
                <div>
                  <span className="panel-kicker">Seguimiento abierto</span>
                  <h2 id="panel-requests-title" className="section-title">Por solicitud</h2>
                </div>
                <a className="section-link" href={paths.directory}>Ver solicitudes</a>
              </div>
              <div className="panel-requests">
                {panel.solicitudes.map((request) => (
                  <Card key={request.id} href={paths.request(request.id)} className="panel-request">
                    <div className="panel-request__head">
                      <div>
                        <h3>{request.titulo}</h3>
                        {request.ejemplo ? <SampleBadge /> : null}
                        <p>{request.organizacion} · {request.zona}</p>
                      </div>
                      <span className="panel-request__arrow" aria-hidden="true">↗</span>
                    </div>
                    <CounterGroup counters={request} compact />
                    <ProgressBar label="Entregadas" value={request.entregado} max={request.recibido || 1} tone="lime" />
                  </Card>
                ))}
              </div>
            </section>

            <section className="panel-section" aria-labelledby="panel-usage-title">
              <div className="panel-section__head">
                <div>
                  <span className="panel-kicker">Trazabilidad</span>
                  <h2 id="panel-usage-title" className="section-title">Registro de uso</h2>
                </div>
              </div>
              <p className="panel-section__lead">Cada gasto conserva su ticket y la entrega que le corresponde. Los montos no incluyen datos de quien donó.</p>
              {panel.usos.length > 0 ? (
                <div className="panel-usage-list">
                  {panel.usos.map((usage) => <UsageCard key={usage.id} usage={usage} />)}
                </div>
              ) : (
                <Card className="panel-notice">Todavía no hay gastos confirmados para mostrar.</Card>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
