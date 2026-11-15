import { paths } from '../lib/router'
import { requestVisual } from '../lib/request-visuals'
import { requestTotals, type PublicRequest } from '../features/requests/data'
import { SampleBadge } from './ui/Chip'
import { FloatingChip } from './ui/FloatingChip'
import { OrganizationAvatar } from './ui/OrganizationAvatar'
import { ProgressBar } from './ui/Progress'
import { Button } from './ui/Button'

export function RequestCard({ request }: { request: PublicRequest }) {
  const totals = requestTotals(request)
  const complete = totals.total > 0 && totals.paid >= totals.total
  return <article className="request-card cause-card">
    <a className="cause-card__visual" href={paths.request(request.id)} aria-label={`Ver causa: ${request.title}`}>
      <img src={requestVisual(request.category)} alt="" loading="lazy" decoding="async" />
      <FloatingChip>{request.category}{request.recurring ? ' · Cada mes' : ''}</FloatingChip>
      <span className="feed-illustration-note">Ilustración de insumos</span>
    </a>
    <div className="cause-card__body">
      {request.sample && <SampleBadge />}
      <a className="feed-organization" href={paths.organization(request.orgSlug)}>
        <OrganizationAvatar name={request.org} src={request.orgLogo} /><span><strong>{request.org}</strong><span className="feed-muted">{request.city}</span></span>
      </a>
      <h2 className="request-card__title"><a href={paths.request(request.id)}>{request.title}</a></h2>
      <ProgressBar label="Unidades pagadas" value={totals.paid} max={totals.total} tone="ink" size="sm" />
      {request.store && <p className="feed-muted">Tienda · {request.store}</p>}
      <Button variant={complete ? 'outline' : 'primary'} href={paths.request(request.id)} block>{complete ? 'Ver seguimiento' : 'Quiero ayudar'} <span aria-hidden="true">↗</span></Button>
    </div>
  </article>
}
