import { paths } from '../lib/router'
import { requestVisual } from '../lib/request-visuals'
import { requestTotals, type SampleRequest } from '../data/sample'
import { Card } from './ui/Card'
import { ProgressBar } from './ui/Progress'
import { IconPin } from './ui/icons'

/** Solicitud visual: insumos, contexto y un solo avance; el desglose vive en el detalle. */
export function RequestCard({ request }: { request: SampleRequest }) {
  const totals = requestTotals(request)
  return (
    <Card href={paths.request(request.id)} className="request-card" aria-label={`${request.title}, ${request.org}`}>
      <div className="request-card__summary">
        <img className="request-card__image" src={requestVisual(request.category)} alt="" width="112" height="112" loading="lazy" decoding="async" />
        <div className="request-card__copy">
          <p className="request-card__eyebrow">{request.category}{request.recurring ? ' · Cada mes' : ''}</p>
          <h3 className="request-card__title">{request.title}</h3>
          <p className="request-card__org">{request.org}</p>
          <span className="request-card__city"><IconPin /> {request.city}</span>
        </div>
      </div>
      <ProgressBar
        label="Unidades pagadas"
        value={totals.paid}
        max={totals.total}
        tone="ink"
        size="sm"
      />
    </Card>
  )
}
