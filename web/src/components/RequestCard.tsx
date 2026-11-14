import { paths } from '../lib/router'
import { requestTotals, type SampleRequest } from '../data/sample'
import { Card } from './ui/Card'
import { Chip } from './ui/Chip'
import { ProgressBar, ProgressRing } from './ui/Progress'
import { IconPin } from './ui/icons'

/** Tarjeta de solicitud para el directorio: aro general y barra por artículo. */
export function RequestCard({ request }: { request: SampleRequest }) {
  const totals = requestTotals(request)
  return (
    <Card href={paths.request(request.id)} className="request-card" aria-label={`${request.title}, ${request.org}`}>
      <div className="request-card__top">
        <div className="request-card__chips">
          <Chip>{request.category}</Chip>
          {request.recurring ? <Chip>Cada mes</Chip> : null}
        </div>
        <ProgressRing value={totals.paid} max={totals.total} label="Avance de la solicitud" size={64} stroke={6} tone="ink" />
      </div>
      <h3 className="request-card__title">{request.title}</h3>
      <p className="request-card__org">
        {request.org}
        <span className="request-card__city">
          <IconPin /> {request.city}
        </span>
      </p>
      <div className="request-card__items">
        {request.items.map((item) => (
          <ProgressBar
            key={item.name}
            size="sm"
            label={item.name}
            value={item.paid}
            max={item.total}
            detail={`${item.paid}/${item.total}`}
            tone={item.paid >= item.total ? 'lime' : 'ink'}
          />
        ))}
      </div>
    </Card>
  )
}
