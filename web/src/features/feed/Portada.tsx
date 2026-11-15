import { useRef, useState } from 'react'
import { useSession } from '../../auth/useSession'
import { registroPaths } from '../../auth/registro-routes'
import { SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { ProgressBar } from '../../components/ui/Progress'
import { IconHeart } from '../../components/ui/icons'
import { paths } from '../../lib/router'
import { requestVisual } from '../../lib/request-visuals'
import type { Category } from '../requests/data'
import { toggleLike, type FeedItem } from './api'
import { categoryCounts, communityStats, missing, pickFeatured, urgentCauses, type Cause, type UrgentSort } from './portada-data'

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`
const Arrow = () => <span className="portada-arrow" aria-hidden="true">→</span>

/**
 * D10: portada del Inicio, arriba del feed. Un solo bloque cálido (hero) con Coco
 * en el círculo y la causa real más necesitada flotando; después categorías y "Más urgentes".
 */
export function Portada({ causes, feed, social, loading, onFeedChange }: {
  causes: Cause[]; feed: FeedItem[]; social: boolean; loading: boolean; onFeedChange: (item: FeedItem) => void
}) {
  const [category, setCategory] = useState<Category | null>(null)
  const [sort, setSort] = useState<UrgentSort>('faltan')
  const featured = pickFeatured(causes)
  const stats = communityStats(causes, feed)
  const urgent = urgentCauses(causes, sort, category)
  return <>
    <section className="portada-hero" aria-labelledby="portada-title">
      <div className="portada-hero__copy">
        {stats.unitsPaid > 0 && <p className="portada-proof">
          <span className="portada-proof__dots" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>{units(stats.unitsPaid)}</strong> pagadas en {stats.openCauses === 1 ? '1 causa abierta' : `${stats.openCauses} causas abiertas`}</span>
        </p>}
        <h1 id="portada-title" className="portada-hero__title">Lo bueno se <em>comparte</em>.</h1>
        <p className="portada-hero__lead">Elige una causa, dona las unidades que le faltan y sigue cómo llegan a la organización.</p>
        <div className="portada-hero__actions">
          <a className="portada-button portada-button--ink" href={featured && missing(featured) > 0 ? paths.request(featured.id) : paths.directory}>Donar a una causa <Arrow /></a>
          <a className="portada-button portada-button--outline" href={paths.jornadas}>Ser voluntario</a>
        </div>
        {stats.organizations > 0 && <p className="portada-orgs">
          <span className="portada-orgs__faces" aria-hidden="true">{feed.filter((item, i, all) => all.findIndex(o => o.organizacion_id === item.organizacion_id) === i).slice(0, 3).map(item => <i key={item.organizacion_id}>{item.organizacion_nombre.slice(0, 2).toUpperCase()}</i>)}</span>
          <span><strong>{stats.organizations === 1 ? '1 organización verificada' : `${stats.organizations} organizaciones verificadas`}</strong><span className="feed-muted">comparten aquí lo que necesitan</span></span>
        </p>}
        {stats.sample && <SampleBadge />}
      </div>
      <div className="portada-hero__visual">
        <div className="portada-stage" aria-hidden="true">
          <div className="portada-orbit" />
          <div className="portada-circle"><Coco size={320} pose="saludando" animation="greet" /></div>
          <span className="portada-badge portada-badge--verified">Orgs<br />verificadas</span>
          <span className="portada-badge portada-badge--store">Directo<br />a la tienda</span>
          <span className="portada-mini"><Coco size={96} pose="caja-suministros" /></span>
        </div>
        {featured ? <a className="portada-feature" href={paths.request(featured.id)}>
          <img src={requestVisual(featured.category)} alt="" width="56" height="56" />
          <span className="portada-feature__text">
            <strong>{featured.title}</strong>
            <span className="feed-muted">{missing(featured) > 0 ? `Faltan ${units(missing(featured))}` : 'Causa completa'} · {featured.org}</span>
            {featured.total > 0 && <ProgressBar label="Unidades pagadas" value={featured.paid} max={featured.total} tone="ink" size="sm" />}
          </span>
          <span className="portada-feature__go"><Arrow /><span className="visually-hidden">Ver causa</span></span>
        </a> : <p className="portada-feature portada-feature--empty">{loading ? 'Coco busca una causa para ti…' : 'Pronto verás aquí una causa abierta.'}</p>}
      </div>
    </section>

    <section className="portada-categories" aria-labelledby="portada-categories-title">
      <h2 id="portada-categories-title" className="visually-hidden">Causas por categoría</h2>
      <div className="portada-categories__row" role="group" aria-label="Filtrar causas urgentes por categoría" data-scroll-x>
        <button type="button" className="portada-category" aria-pressed={category === null} onClick={() => setCategory(null)}>
          <span className="portada-category__circle"><Coco size={64} pose="pulgar-arriba" /></span>
          <strong>Todas</strong><span className="feed-muted">{causes.filter(c => missing(c) > 0).length} abiertas</span>
        </button>
        {categoryCounts(causes).map(({ category: name, count }) => <button key={name} type="button" className="portada-category" aria-pressed={category === name} onClick={() => setCategory(name)}>
          <span className="portada-category__circle"><img src={requestVisual(name)} alt="" width="64" height="64" /></span>
          <strong>{name}</strong><span className="feed-muted">{count === 1 ? '1 causa' : `${count} causas`}</span>
        </button>)}
      </div>
    </section>

    <section className="portada-urgent" aria-labelledby="portada-urgent-title">
      <div className="portada-urgent__heading">
        <div>
          <span className="portada-pill">Más urgentes</span>
          <h2 id="portada-urgent-title">Causas que te <em>necesitan</em> hoy</h2>
        </div>
        <div className="portada-sort" role="group" aria-label="Ordenar causas urgentes">
          <button type="button" aria-pressed={sort === 'faltan'} onClick={() => setSort('faltan')}>Faltan más</button>
          <button type="button" aria-pressed={sort === 'casi'} onClick={() => setSort('casi')}>Casi listas</button>
        </div>
      </div>
      {urgent.length ? <ul className="portada-grid" data-scroll-x>
        {urgent.map(cause => <li key={cause.id}><UrgentCard cause={cause} item={social ? feed.find(i => i.tipo === 'solicitud' && i.id === cause.id) : undefined} onFeedChange={onFeedChange} /></li>)}
      </ul> : <p className="portada-empty">{loading ? 'Buscando causas abiertas…' : category ? `No hay causas abiertas de ${category.toLowerCase()} por ahora.` : 'No hay causas abiertas por ahora.'} <a href={paths.directory}>Ver todas las causas</a></p>}
    </section>
  </>
}

function UrgentCard({ cause, item, onFeedChange }: { cause: Cause; item?: FeedItem; onFeedChange: (item: FeedItem) => void }) {
  const percent = cause.total ? Math.round((cause.paid / cause.total) * 100) : 0
  return <article className="portada-card">
    <div className="portada-card__visual">
      <img src={requestVisual(cause.category)} alt="" loading="lazy" />
      <span className="portada-card__chip">{cause.category}</span>
      {item && <CauseLike item={item} onChange={onFeedChange} />}
      <span className="portada-card__label">{percent >= 75 ? 'Casi lista' : `Faltan ${missing(cause)}`}</span>
    </div>
    <div className="portada-card__body">
      {cause.sample && <SampleBadge />}
      <h3><a href={paths.request(cause.id)}>{cause.title}</a></h3>
      <p className="feed-muted">{cause.org}{cause.store ? ` · ${cause.store}` : ''}</p>
      <ProgressBar label="Unidades pagadas" value={cause.paid} max={cause.total} tone="ink" size="sm" />
    </div>
  </article>
}

/** Me gusta de la causa en el feed (contrato T24). Sin sesión lleva a Entrar. */
function CauseLike({ item, onChange }: { item: FeedItem; onChange: (item: FeedItem) => void }) {
  const { user, status } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const label = `${item.yo_di_me_gusta ? 'Quitar me gusta' : 'Me gusta'}: ${item.titulo ?? 'causa'} (${item.me_gusta})`
  if (!user) return <a className="portada-card__heart" href={registroPaths.entrar} aria-label={`Entra para dar me gusta a ${item.titulo ?? 'esta causa'}`}><IconHeart /></a>
  async function like() {
    if (lock.current) return
    if (!user?.email_confirmed_at) { setError('Confirma tu correo para dar me gusta.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const liked = await toggleLike(item)
      onChange({ ...item, yo_di_me_gusta: liked, me_gusta: Math.max(0, item.me_gusta + (liked === item.yo_di_me_gusta ? 0 : liked ? 1 : -1)) })
    } catch (cause) { setError((cause as Error).message) } finally { lock.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="portada-card__heart" aria-pressed={item.yo_di_me_gusta} aria-label={label} disabled={busy || status === 'loading'} onClick={() => void like()}><IconHeart /></button>
    {error && <span className="portada-card__error" role="alert">{error}</span>}
  </>
}
