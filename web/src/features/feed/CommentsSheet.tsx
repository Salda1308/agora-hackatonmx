import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { OrganizationAvatar } from '../../components/ui/OrganizationAvatar'
import { comment, deleteComment, loadComments, PAGE_SIZE, reportComment, type FeedComment, type FeedItem } from './api'
import { formatDate } from './presentation'
import { SessionInvitation } from './SessionInvitation'

export function CommentsSheet({ item, onClose, onCountChange }: { item: FeedItem; onClose: () => void; onCountChange: (delta: number) => void }) {
  const { user, status, organizationId } = useSession()
  const [comments, setComments] = useState<FeedComment[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [revision, setRevision] = useState(0)
  const [action, setAction] = useState<{ id: string; type: 'delete' | 'report' } | null>(null)
  const [reason, setReason] = useState('')
  const confirmed = Boolean(user?.email_confirmed_at)

  useEffect(() => {
    let active = true
    loadComments(item).then(rows => {
      if (!active) return
      setComments(rows); setNext(rows.length === PAGE_SIZE ? rows.at(-1)!.creado_en : null)
    }).catch(cause => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [item, user?.id, revision]) // The target and account define the comment permissions.

  async function more() {
    if (!next || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const rows = await loadComments(item, next)
      setComments(current => [...current, ...rows.filter(row => !current.some(c => c.id === row.id))])
      setNext(rows.length === PAGE_SIZE ? rows.at(-1)!.creado_en : null)
    } catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !text.trim() || !confirmed) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await comment(item, text)
      setText(''); setLoading(true); onCountChange(1); setNotice('Tu comentario se publicó.'); setRevision(n => n + 1)
    } catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function moderate(event: FormEvent) {
    event.preventDefault()
    if (!action || lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (action.type === 'delete') {
        await deleteComment(action.id)
        setComments(current => current.filter(c => c.id !== action.id)); onCountChange(-1)
        setNotice('Comentario eliminado.')
      } else {
        await reportComment(action.id, reason)
        setNotice('Gracias. El equipo revisará tu reporte.')
      }
      setAction(null); setReason('')
    } catch (cause) { setError((cause as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <Modal open title="Comentarios" description={item.organizacion_nombre} onClose={onClose}>
    {loading ? <p role="status">Cargando comentarios…</p> : <>
      {!comments.length && !error && <p className="feed-muted">Empieza la conversación con un mensaje de apoyo.</p>}
      <ol className="feed-comments">
        {comments.map(c => <li key={c.id} className="feed-comment">
          <OrganizationAvatar name={c.autor} />
          <div className="feed-comment__content">
            <strong>{c.autor}</strong>{c.es_organizacion && <span className="feed-comment__badge">Organización</span>}
            <time dateTime={c.creado_en}>{formatDate(c.creado_en, true)}</time>
            <p>{c.texto}</p>
            {user && status === 'ready' && <div className="feed-comment__actions">
              {(c.es_mio || organizationId === item.organizacion_id) && <button type="button" disabled={busy} onClick={() => setAction({ id: c.id, type: 'delete' })}>Eliminar</button>}
              {!c.es_mio && <button type="button" disabled={busy} onClick={() => setAction({ id: c.id, type: 'report' })}>Reportar</button>}
            </div>}
            {action?.id === c.id && <form className="feed-form" onSubmit={moderate}>
              {action.type === 'report' ? <label>Motivo del reporte<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label> : <p>¿Eliminar este comentario?</p>}
              <div className="wrap-row"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button>
                <Button type="submit" disabled={busy || (action.type === 'report' && !reason.trim())}>{action.type === 'report' ? 'Enviar reporte' : 'Eliminar comentario'}</Button></div>
            </form>}
          </div>
        </li>)}
      </ol>
      {next && <Button variant="outline" disabled={busy} onClick={() => void more()}>Ver más comentarios</Button>}
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="ghost" disabled={busy} onClick={() => { setError(''); setLoading(true); setRevision(n => n + 1) }}>Recargar comentarios</Button></div>}
    {!user ? <SessionInvitation onClose={onClose} /> : !confirmed ? <p className="feed-invitation">Confirma tu correo para comentar y dar me gusta.</p> : <form className="feed-form feed-comment-form" onSubmit={submit}>
      <label htmlFor="feed-comment-text">Escribe un comentario</label>
      <textarea id="feed-comment-text" value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={3} required aria-describedby="feed-comment-hint" />
      <p id="feed-comment-hint" className="feed-muted">{text.length}/500 · Sin enlaces, correos ni teléfonos.</p>
      <Button type="submit" disabled={busy || !text.trim() || status !== 'ready'}>{busy ? 'Enviando…' : 'Comentar'}</Button>
    </form>}
  </Modal>
}
