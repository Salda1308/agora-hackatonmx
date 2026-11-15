import { Button } from '../../components/ui/Button'
import { SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { ProgressBar } from '../../components/ui/Progress'
import { paths } from '../../lib/router'
import type { FeedItem } from './api'
import { extraNumber } from './presentation'

/** La causa del feed a la que le faltan más unidades; si ninguna trae avance, la primera. */
function pickSpotlight(items: FeedItem[]): FeedItem | null {
  const causes = items.filter(item => item.tipo === 'solicitud')
  const open = causes.filter(item => extraNumber(item, 'unidades_totales') > extraNumber(item, 'unidades_pagadas'))
  const missing = (item: FeedItem) => extraNumber(item, 'unidades_totales') - extraNumber(item, 'unidades_pagadas')
  return open.sort((a, b) => missing(b) - missing(a))[0] ?? causes[0] ?? null
}

/** Cabecera del Inicio: Coco saluda y presenta una causa concreta con su avance y un CTA. */
export function CocoSpotlight({ items, loading }: { items: FeedItem[]; loading: boolean }) {
  const cause = pickSpotlight(items)
  const total = cause ? extraNumber(cause, 'unidades_totales') : 0
  const paid = cause ? extraNumber(cause, 'unidades_pagadas') : 0
  const left = Math.max(0, total - paid)
  return <section className="coco-spotlight" aria-labelledby="coco-spotlight-title">
    <div className="coco-spotlight__greeting">
      <Coco size={96} pose="saludando" animation="greet" />
      <div>
        <span className="feed-eyebrow">Una comunidad que suma</span>
        <h1 id="coco-spotlight-title">Lo bueno se comparte<span className="brand-dot">.</span></h1>
        <p>{cause ? (left > 0 ? `Soy Coco. A esta causa le faltan ${left} ${left === 1 ? 'unidad' : 'unidades'}:` : 'Soy Coco. Mira cómo avanza esta causa:')
          : loading ? 'Soy Coco. Estoy buscando una causa para ti…' : 'Soy Coco. Te ayudo a encontrar dónde sumar.'}</p>
      </div>
    </div>
    {cause ? <a className="coco-spotlight__cause" href={paths.request(cause.id)}>
      {cause.extra.ejemplo === true && <SampleBadge />}
      <strong>{cause.titulo}</strong>
      <span className="feed-muted">{cause.organizacion_nombre}</span>
      {total > 0 && <ProgressBar label="Unidades pagadas" value={paid} max={total} tone="ink" size="sm" />}
      <span className="coco-spotlight__cta">Donar unidades <span aria-hidden="true">↗</span></span>
    </a> : !loading && <Button href={paths.directory} block>Ver causas en curso</Button>}
    <nav className="coco-spotlight__links" aria-label="Atajos">
      <a href={paths.directory}>Todas las causas</a>
      <a href={paths.jornadas}>Voluntariado</a>
    </nav>
  </section>
}
