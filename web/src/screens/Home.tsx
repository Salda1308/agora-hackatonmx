import { useEffect, useRef, useState } from 'react'
import { useSession } from '../auth/useSession'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { Coco } from '../components/ui/Coco'
import { CocoLoading } from '../components/ui/CocoLoading'
import { EmptyState } from '../components/ui/EmptyState'
import { WaveSection } from '../components/ui/WaveSection'
import { FeedCard } from '../features/feed/FeedCard'
import { CommentsSheet } from '../features/feed/CommentsSheet'
import { loadFeed, type FeedItem, type FeedType } from '../features/feed/api'
import { paths } from '../lib/router'

export function Home() {
  const { user } = useSession()
  return <FeedTimeline key={user?.id ?? 'visitor'} />
}
const filters: { label: string; type: FeedType | null }[] = [
  { label: 'Todo', type: null }, { label: 'Historias', type: 'publicacion' },
  { label: 'Causas', type: 'solicitud' }, { label: 'Voluntariado', type: 'jornada' },
]
function FeedTimeline() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [social, setSocial] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FeedType | null>(null)
  const [comments, setComments] = useState<FeedItem | null>(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    const current = ++generation.current
    loadFeed().then(page => {
      if (!active || current !== generation.current) return
      setItems(page.items); setNext(page.next); setSocial(page.social)
    }).catch(cause => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  // Las publicaciones retiradas y URLs firmadas se revalidan al regresar a la pestaña.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && !lock.current && !comments) setRevision(n => n + 1) }
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer) }
  }, [comments])
  async function more() {
    if (!next || lock.current) return
    lock.current = true; setMoreLoading(true); setError('')
    const current = generation.current
    try {
      const page = await loadFeed(next)
      if (current !== generation.current) return
      setItems(previous => [...previous, ...page.items.filter(row => !previous.some(p => p.id === row.id && p.tipo === row.tipo))])
      setNext(page.next); setSocial(page.social)
    } catch (cause) { if (current === generation.current) setError((cause as Error).message) }
    finally { lock.current = false; setMoreLoading(false) }
  }
  const visible = items.filter(item => !filter || item.tipo === filter)
  return <main className="screen social-home">
    <header className="social-home__header"><a className="brand" href={paths.home}>ágora<span className="brand-dot">.</span></a><span className="social-home__tagline">Aquí, cada gesto cuenta.</span><ThemeToggle /></header>
    <div className="social-home__layout">
      <aside className="social-home__intro">
        <WaveSection className="feed-welcome" aria-labelledby="feed-welcome-title">
          <div><span className="feed-eyebrow">Una comunidad que suma</span><h1 id="feed-welcome-title">Lo bueno<br />se comparte<span className="brand-dot">.</span></h1><p>Historias, causas y personas haciendo comunidad.</p></div>
          <Coco size={160} pose="caja-suministros" />
          <a className="feed-welcome__link" href={paths.directory}>Encuentra dónde ayudar <span aria-hidden="true">↗</span></a>
        </WaveSection>
        <div className="feed-community-note"><span className="feed-eyebrow">De cerca</span><h2>Pequeñas acciones.<br />Cambios compartidos.</h2><p>Conoce a las organizaciones, apoya una causa o regala un poco de tu tiempo.</p><a className="feed-text-button" href={paths.jornadas}>Explorar voluntariado ↗</a><a className="feed-text-button" href={paths.panel}>Ver el impacto de la comunidad ↗</a></div>
      </aside>
      <section className="feed-timeline" aria-label="Novedades de la comunidad">
        <div className="feed-timeline__heading"><h2>En comunidad</h2><span className="feed-muted">Lo más reciente</span></div>
        <div className="chip-row feed-filters" role="group" aria-label="Filtrar publicaciones">
          {filters.map(f => <Chip key={f.label} selected={filter === f.type} onClick={() => setFilter(f.type)}>{f.label}</Chip>)}
        </div>
        {loading && !items.length && <CocoLoading title="Buscando novedades…" size={96} />}
        <div className="feed-list" aria-busy={loading || moreLoading}>
          {visible.map(item => <FeedCard key={`${item.tipo}-${item.id}`} item={item} social={social} onComments={() => setComments(item)}
            onChange={updated => setItems(current => current.map(row => row.id === updated.id && row.tipo === updated.tipo ? updated : row))} />)}
        </div>
        {error && <div className="feed-error" role="alert"><p>{error}</p><Button variant="outline" onClick={() => { if (items.length && next) void more(); else setRevision(n => n + 1) }}>Reintentar</Button></div>}
        {!loading && !error && !visible.length && <EmptyState title={filter ? 'Todavía no hay novedades de este tipo' : 'La comunidad está por encontrarse'} description={next ? 'Hay más publicaciones por explorar. Carga la siguiente página.' : 'Cuando las organizaciones compartan una historia, causa o jornada, la verás aquí.'} />}
        {next && <Button variant="outline" block disabled={loading || moreLoading} onClick={() => void more()}>{moreLoading ? 'Cargando…' : 'Ver más'}</Button>}
        {!loading && visible.length > 0 && !next && <p className="feed-end">Estás al día. Gracias por estar aquí.</p>}
      </section>
    </div>
    {comments && <CommentsSheet key={`${comments.tipo}-${comments.id}`} item={comments} onClose={() => setComments(null)}
      onCountChange={delta => setItems(current => current.map(row => row.tipo === comments.tipo && row.id === comments.id ? { ...row, comentarios: Math.max(0, row.comentarios + delta) } : row))} />}
  </main>
}
