import { useEffect, useRef, useState } from 'react'
import { useSession } from '../auth/useSession'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { Coco } from '../components/ui/Coco'
import { CocoLoading } from '../components/ui/CocoLoading'
import { EmptyState } from '../components/ui/EmptyState'
import { Portada } from '../features/feed/Portada'
import { portadaCauses } from '../features/feed/portada-data'
import { useRequests } from '../features/requests/data'
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
  const { requests } = useRequests()
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
  const updateItem = (updated: FeedItem) => setItems(current => current.map(row => row.id === updated.id && row.tipo === updated.tipo ? updated : row))
  return <main className="screen social-home">
    <header className="social-home__header">
      <a className="brand" href={paths.home} aria-label="Ágora, inicio"><Coco size={40} variant="portrait" />ágora<span className="brand-dot">.</span></a>
      <span className="social-home__tagline">Aquí, cada gesto cuenta.</span>
      <ThemeToggle />
      <a className="social-home__cta" href={paths.directory}>Donar</a>
    </header>
    <Portada causes={portadaCauses(requests, items)} feed={items} social={social} loading={loading} onFeedChange={updateItem} />
    <div className="social-home__layout">
      <section className="feed-timeline" aria-labelledby="feed-title">
        <div className="feed-timeline__heading"><div><span className="portada-pill">En comunidad</span><h2 id="feed-title">Lo más reciente</h2></div><a className="feed-text-button" href={paths.panel}>Ver el impacto <span aria-hidden="true">↗</span></a></div>
        <div className="chip-row feed-filters" role="group" aria-label="Filtrar publicaciones">
          {filters.map(f => <Chip key={f.label} selected={filter === f.type} onClick={() => setFilter(f.type)}>{f.label}</Chip>)}
        </div>
        {loading && !items.length && <CocoLoading title="Buscando novedades…" size={96} />}
        <div className="feed-list" aria-busy={loading || moreLoading}>
          {visible.map(item => <FeedCard key={`${item.tipo}-${item.id}`} item={item} social={social} onComments={() => setComments(item)}
            onChange={updateItem} />)}
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
