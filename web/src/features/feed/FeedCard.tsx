import { useRef, useState } from 'react'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { SampleBadge } from '../../components/ui/Chip'
import { FloatingChip } from '../../components/ui/FloatingChip'
import { OrganizationAvatar } from '../../components/ui/OrganizationAvatar'
import { ProgressBar } from '../../components/ui/Progress'
import { IconComment, IconHeart } from '../../components/ui/icons'
import { paths } from '../../lib/router'
import { requestVisual } from '../../lib/request-visuals'
import { SOON, toggleLike, type FeedItem } from './api'
import { categoryFrom, extraNumber, extraText, formatDate, storeName } from './presentation'

export function FeedCard({ item, social, onComments, onChange }: {
  item: FeedItem; social: boolean; onComments: () => void; onChange: (item: FeedItem) => void
}) {
  const { user, status } = useSession()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const typeLabel = item.tipo === 'publicacion' ? 'Historia' : item.tipo === 'solicitud' ? 'Causa en curso' : 'Voluntariado'
  const media = item.medios.filter(m => m.src)
  const isSample = item.extra.ejemplo === true
  const text = item.texto ?? ''
  const displayedText = !expanded && text.length > 320 ? `${text.slice(0, 320).trim()}…` : text
  async function like() {
    if (lock.current) return
    if (!user) { onComments(); return }
    if (!user.email_confirmed_at) { setError('Confirma tu correo para dar me gusta.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      const liked = await toggleLike(item)
      onChange({ ...item, yo_di_me_gusta: liked, me_gusta: Math.max(0, item.me_gusta + (liked === item.yo_di_me_gusta ? 0 : liked ? 1 : -1)) })
    } catch (cause) {
      const message = (cause as Error).message
      setError(message); if (message === SOON) setUnavailable(true)
    } finally { lock.current = false; setBusy(false) }
  }
  return <article className={`feed-card feed-card--${item.tipo}`} aria-label={`${typeLabel} de ${item.organizacion_nombre}`}>
    <header className="feed-card__header">
      <a className="feed-organization" href={paths.organization(item.organizacion_slug)}>
        <OrganizationAvatar name={item.organizacion_nombre} src={item.organizacion_logo} />
        <span><strong>{item.organizacion_nombre}</strong><span className="feed-muted">{typeLabel} · <time dateTime={item.creado_en}>{formatDate(item.creado_en)}</time></span></span>
      </a>
      <span className="feed-verified" aria-label="Organización verificada" title="Organización verificada">✓</span>
    </header>
    {isSample && <div className="feed-card__sample"><SampleBadge /></div>}
    {item.tipo === 'publicacion' ? <>
      <div className="feed-card__copy">
        {item.titulo && <h2>{item.titulo}</h2>}
        <p>{displayedText}</p>
        {text.length > 320 && <button className="feed-text-button" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Leer menos' : 'Leer historia completa'}</button>}
      </div>
      {media.length > 0 && <div className="feed-media" aria-label="Imágenes y videos de la publicación">
        {media.map((m, index) => <figure key={`${m.ruta}-${index}`}>
          {m.tipo === 'imagen' ? <img src={m.src} alt={`Publicación de ${item.organizacion_nombre}, imagen ${index + 1}`} loading="lazy" /> : <iframe src={m.src} title={`Video de ${item.organizacion_nombre}`} loading="lazy" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" />}
          {media.length > 1 && <figcaption>{index + 1} / {media.length}</figcaption>}
        </figure>)}
      </div>}
    </> : item.tipo === 'solicitud' ? <>
      <a className="feed-cause-visual" href={paths.request(item.id)} aria-label={`Ver causa: ${item.titulo}`}>
        <img src={media.find(m => m.tipo === 'imagen')?.src ?? requestVisual(categoryFrom(`${item.titulo ?? ''} ${item.texto ?? ''} ${item.extra.categoria ?? ''}`))} alt="" loading="lazy" />
        <FloatingChip>{categoryFrom(`${item.titulo ?? ''} ${item.texto ?? ''} ${item.extra.categoria ?? ''}`)}</FloatingChip>
        {!media.length && <span className="feed-illustration-note">Ilustración de insumos</span>}
      </a>
      <div className="feed-card__copy">
        <h2><a href={paths.request(item.id)}>{item.titulo}</a></h2>
        <p>{displayedText}</p>
        <ProgressBar label="Unidades pagadas" value={extraNumber(item, 'unidades_pagadas')} max={extraNumber(item, 'unidades_totales')} tone="ink" />
        {storeName(item) && <p className="feed-muted">Tienda · {storeName(item)}</p>}
        <Button href={paths.request(item.id)}>Sumarme a esta causa <span aria-hidden="true">↗</span></Button>
      </div>
    </> : <div className="feed-card__copy feed-jornada">
      <div className="feed-jornada__date"><span>Reserva el día</span><strong>{formatDate(extraText(item, 'inicia_en'))}</strong></div>
      <h2><a href={paths.jornada(item.id)}>{item.titulo}</a></h2>
      <p>{displayedText}</p>
      <p className="feed-muted">{extraText(item, 'ubicacion') || 'Consulta el punto de encuentro'} · {'cupos_ocupados' in item.extra ? `${Math.max(0, extraNumber(item, 'cupos') - extraNumber(item, 'cupos_ocupados'))} de ${extraNumber(item, 'cupos')} lugares libres` : `${extraNumber(item, 'cupos')} lugares en total`}</p>
      <Button variant="ink" href={paths.jornada(item.id)}>Quiero participar <span aria-hidden="true">↗</span></Button>
    </div>}
    <footer className="feed-card__footer">
      {social && !unavailable ? <>
        <button type="button" className="feed-social-button" aria-pressed={item.yo_di_me_gusta} disabled={busy || status === 'loading'} onClick={() => void like()}>
          <IconHeart /><span>Me gusta</span><strong>{item.me_gusta}</strong>
        </button>
        <button type="button" className="feed-social-button" onClick={onComments}><IconComment /><span>Comentarios</span> <strong>{item.comentarios}</strong></button>
      </> : <span className="feed-muted">Me gusta y comentarios, pronto</span>}
    </footer>
    {error && <p className="feed-card__error" role="alert">{error}</p>}
  </article>
}
