import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSession } from '../../auth/useSession'
import { RequireRole } from '../../auth/RequireRole'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip, SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, FormModal } from '../../components/ui/FormModal'
import { describe } from '../../components/ui/describe'
import { supabase } from '../../lib/supabase'
import { paths } from '../../lib/router'
import { cleanImage, videoEmbed } from './media'
import './organizacion.css'

type Org = { id: string; nombre: string; slug: string; descripcion: string | null; direccion_publica: string | null; es_ejemplo: boolean }
type Media = { tipo: string; url: string; src?: string }
type Post = { id: string; texto: string | null; creada_en: string; es_ejemplo: boolean; publicacion_medios: Media[] }
type Need = { id: string; titulo: string; es_ejemplo: boolean }

export default function OrganizacionPage({ slug, own = false, ownerRole }: { slug?: string; own?: boolean; ownerRole?: 'fundacion' | 'tienda' }) {
  const { organizationId, status } = useSession()
  return own ? <RequireRole allowed={ownerRole ? [ownerRole] : ['fundacion', 'tienda']} pending={<Shell><p>Cargando sesión…</p></Shell>}
    fallback={<Shell><EmptyState title="Ingresa con tu organización" description="Solo tu organización puede editar su página." /></Shell>}>
    <Page key={`${organizationId}-${status}`} organizationId={organizationId ?? undefined} own />
  </RequireRole> : <Page key={slug} slug={slug} />
}
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="screen"><div className="screen__body screen__body--top org-page">
    <div className="topbar"><a className="ui-icon-button" href={paths.directory} aria-label="Volver a solicitudes">←</a><span className="brand">Ágora</span><ThemeToggle /></div>{children}
  </div></main>
}
function Page({ slug, organizationId, own = false }: { slug?: string; organizationId?: string; own?: boolean }) {
  const [org, setOrg] = useState<Org | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [needs, setNeeds] = useState<Need[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, refresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  useEffect(() => {
    let active = true
    const client = supabase
    async function load() {
      setError('')
      if (!client) { setError('El servicio no está configurado.'); setLoading(false); return }
      if (!slug && !organizationId) { setOrg(null); setLoading(false); return }
      try {
        let query = client.from('organizaciones').select('id,nombre,slug,descripcion,direccion_publica,es_ejemplo').eq('verificada', true).eq('suspendida', false).or('categoria.is.null,categoria.neq.colectivo_busqueda')
        query = organizationId ? query.eq('id', organizationId) : query.eq('slug', slug!)
        const { data: organization, error: failure } = await query.maybeSingle()
        if (failure) throw failure
        if (!active) return
        setOrg(organization)
        if (!organization) return
        const [feed, requests] = await Promise.all([
          client.from('publicaciones').select('id,texto,creada_en,es_ejemplo,publicacion_medios(tipo,url,orden)').eq('organizacion_id', organization.id).eq('retirada', false).order('creada_en', { ascending: false }),
          client.from('solicitudes').select('id,titulo,es_ejemplo').eq('organizacion_id', organization.id).eq('estado', 'publicada').order('publicada_en', { ascending: false }),
        ])
        if (feed.error || requests.error) throw feed.error || requests.error
        const resolved = await Promise.all((feed.data ?? []).map(async p => ({ ...p, publicacion_medios: await Promise.all(p.publicacion_medios.sort((a,b) => a.orden - b.orden).map(async m => {
          if (m.tipo !== 'imagen') return m
          const { data } = await client.storage.from('publicaciones').createSignedUrl(m.url, 300)
          return { ...m, src: data?.signedUrl }
        })) })))
        if (active) { setPosts(resolved); setNeeds(requests.data ?? []) }
      } catch { if (active) setError('No pudimos cargar la página. Intenta de nuevo.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    // Revalidate moderation on focus and every minute, including signed images.
    const timer = window.setInterval(() => refresh(n => n + 1), 60_000)
    const focus = () => refresh(n => n + 1)
    window.addEventListener('focus', focus)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [slug, organizationId, revision])

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const client = supabase
    if (!client || !org || busy) return
    setBusy(true); setNotice('')
    let postId: string | undefined
    let imagePath: string | undefined
    try {
      const text = String(values.get('texto') ?? '').trim()
      const video = String(values.get('video') ?? '').trim()
      const image = values.get('imagen') as File
      if (!text || text.length > 5000 || !values.get('consentimiento')) throw new Error('Escribe una actualización y confirma el consentimiento.')
      if (video && !videoEmbed(video)) throw new Error('Usa un enlace HTTPS de YouTube o Vimeo.')
      const blob = image?.size ? await cleanImage(image) : null
      const result = await client.from('publicaciones').insert({ organizacion_id: org.id, texto: text, consentimiento: true }).select('id').single()
      if (result.error) throw new Error('No pudimos publicar. Verifica el acceso de tu organización.')
      postId = result.data.id
      const media: { publicacion_id: string; tipo: string; url: string; orden: number }[] = []
      if (blob) {
        const upload = await client.functions.invoke('t17-imagen', { body: blob, headers: { 'Content-Type': 'image/jpeg' } })
        if (upload.error || !upload.data?.path) throw new Error('No pudimos subir la imagen. Intenta nuevamente.')
        imagePath = String(upload.data.path)
        media.push({ publicacion_id: postId!, tipo: 'imagen', url: imagePath, orden: 0 })
      }
      if (video) media.push({ publicacion_id: postId!, tipo: 'video', url: video, orden: 1 })
      if (media.length) { const result = await client.from('publicacion_medios').insert(media); if (result.error) throw new Error('No pudimos guardar los medios.') }
      form.reset(); setComposing(false); setNotice('Tu actualización ya está publicada.'); refresh(n => n + 1)
    } catch (failure) {
      if (postId) await client.from('publicaciones').delete().eq('id', postId)
      if (imagePath) await client.storage.from('publicaciones').remove([imagePath])
      setNotice(failure instanceof Error ? failure.message : 'No pudimos publicar.')
    } finally { setBusy(false) }
  }
  async function editPost(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (!supabase || !org || busy) return
    const texto = String(new FormData(event.currentTarget).get('texto') ?? '').trim()
    if (!texto) return
    setBusy(true)
    const { data, error } = await supabase.from('publicaciones').update({ texto, consentimiento: true }).eq('id', id).eq('organizacion_id', org.id).eq('retirada', false).select('id')
    setNotice(error || !data?.length ? 'No pudimos guardar la publicación.' : 'Publicación actualizada.')
    if (!error && data?.length) { setEditing(null); refresh(n => n + 1) }
    setBusy(false)
  }
  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !report || busy) return
    const motivo = String(new FormData(event.currentTarget).get('motivo') ?? '').trim()
    if (!motivo) return
    setBusy(true)
    const { error } = await supabase.from('reportes').insert({ publicacion_id: report, motivo })
    setNotice(error ? 'No se pudo enviar el reporte. Intenta nuevamente.' : 'Reporte enviado a moderación. Gracias por cuidar este espacio.')
    if (!error) setReport(null)
    setBusy(false)
  }
  if (loading) return <Shell><CocoLoading title="Coco está buscando la página…" size={96} /></Shell>
  if (error) return <Shell><p role="alert">{error}</p><Button onClick={() => refresh(n => n + 1)}>Reintentar</Button></Shell>
  if (!org) return <Shell><EmptyState title={own ? 'Tu página aún no está disponible' : 'Página no disponible'} description="Solo las organizaciones verificadas y activas tienen página pública." /></Shell>
  return <Shell>
    <header className="org-hero"><div className="org-hero__top"><Chip>✓ Organización verificada</Chip><Coco size={72} variant="portrait" /></div>
      {org.es_ejemplo && <SampleBadge />}<h1>{org.nombre}</h1>{org.descripcion && <p>{org.descripcion}</p>}
      {org.direccion_publica && <p className="org-muted">{org.direccion_publica}</p>}
      {own && <Button variant="outline" href={paths.organization(org.slug)}>Ver página pública ↗</Button>}
    </header>
    {notice && <p role="status">{notice}</p>}
    <section className="stack"><h2 className="section-title">Necesidades abiertas</h2>
      {needs.length ? needs.map(n => <Card href={paths.request(n.id)} key={n.id}>{n.es_ejemplo && <SampleBadge />}<h3>{n.titulo}</h3><span>Ver unidades y ayudar →</span></Card>) : <p className="org-muted">Por ahora no hay necesidades abiertas.</p>}
    </section>
    {own && <Button size="lg" block onClick={() => { setNotice(''); setComposing(true) }}>Comparte una actualización</Button>}
    {/* D8: publicar y editar en FormModal; misma lógica y llamadas. */}
    <FormModal open={composing} onClose={() => setComposing(false)} title="Comparte una actualización" description="Se publica en tu página y en el feed."
      submitLabel="Publicar actualización" submittingLabel="Publicando…" submitting={busy} formId="org-publicar">
      <form id="org-publicar" className="fm-form" onSubmit={publish}>
        <fieldset className="fm-group"><legend>Mensaje</legend>
          <Field id="org-texto" label="¿Qué está pasando?"><textarea id="org-texto" name="texto" required maxLength={5000} placeholder="Cuenta cómo avanza la ayuda…" autoFocus /></Field>
        </fieldset>
        <fieldset className="fm-group"><legend>Medios opcionales</legend>
          <Field id="org-imagen" label="Imagen" hint="Hasta 5 MB. Quitamos los metadatos y la ubicación al procesar la imagen."><input {...describe('org-imagen', 'ayuda')} name="imagen" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
          <Field id="org-video" label="Video" hint="YouTube o Vimeo. Se incrusta el enlace; no subimos archivos de video."><input {...describe('org-video', 'ayuda')} name="video" type="url" placeholder="https://www.youtube.com/watch?v=…" /></Field>
        </fieldset>
        <label className="fm-check"><input name="consentimiento" type="checkbox" required />Declaro tener consentimiento de las personas que aparecen. No muestro menores de edad.</label>
        {notice && <p className="fm-alert" role="alert">{notice}</p>}
      </form>
    </FormModal>
    <section className="stack"><h2 className="section-title">Desde la organización</h2>
      {!posts.length && <EmptyState title="Aquí comienza su historia" description="Las actualizaciones de la organización aparecerán aquí." />}
      {posts.map(p => <Card key={p.id} className="org-post">{p.es_ejemplo && <SampleBadge />}<time dateTime={p.creada_en}>{new Date(p.creada_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
        <p className="org-post__text">{p.texto}</p>{p.publicacion_medios.map((m, i) => m.tipo === 'imagen' ? (m.src ? <img key={i} src={m.src} alt="Imagen compartida por la organización" loading="lazy" /> : <p key={i} className="org-muted">Imagen no disponible</p>) : videoEmbed(m.url) ? <iframe key={i} title={`Video de ${org.nombre}`} src={videoEmbed(m.url)!} loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen referrerPolicy="no-referrer" /> : null)}
        {own && <Button variant="outline" onClick={() => { setNotice(''); setEditing(p.id) }}>Editar texto</Button>}
        {own && <FormModal open={editing === p.id} onClose={() => setEditing(null)} title="Editar publicación" submitLabel="Guardar cambios" submittingLabel="Guardando…" submitting={busy} formId={`org-editar-${p.id}`}>
          <form id={`org-editar-${p.id}`} className="fm-form" onSubmit={e => void editPost(e, p.id)}>
            <Field id={`org-editar-texto-${p.id}`} label="Actualización"><textarea id={`org-editar-texto-${p.id}`} name="texto" defaultValue={p.texto ?? ''} required maxLength={5000} autoFocus /></Field>
            <label className="fm-check"><input type="checkbox" required />Confirmo el consentimiento y que no aparecen menores.</label>
            {notice && <p className="fm-alert" role="alert">{notice}</p>}
          </form>
        </FormModal>}
        <Button variant="ghost" onClick={() => setReport(p.id)}>Reportar publicación</Button>
        {report === p.id && <form className="org-form" onSubmit={sendReport}><label>¿Qué debemos revisar?<textarea name="motivo" required maxLength={1000} /></label><div className="org-actions"><Button type="submit" disabled={busy}>Enviar reporte</Button><Button variant="ghost" type="button" onClick={() => setReport(null)}>Cancelar</Button></div></form>}
      </Card>)}
    </section>
  </Shell>
}
