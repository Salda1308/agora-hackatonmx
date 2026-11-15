import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { demoAccounts } from '../../auth/demo'
import { categoriasFundacion } from '../../auth/alta-validacion'
import { registroPaths } from '../../auth/registro-routes'
import { roleLabels, roleNavigation } from '../../auth/roles'
import type { Role } from '../../auth/roles'
import { useSession } from '../../auth/useSession'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip, SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { OrganizationAvatar } from '../../components/ui/OrganizationAvatar'
import { ProgressBar } from '../../components/ui/Progress'
import { readStoredPayments } from '../../features/requests/receipt-storage'
import { paths } from '../../lib/router'
import { supabase } from '../../lib/supabase'
import { cargarMisSolicitudes, formatoPesos } from '../fundacion/api'
import type { MiSolicitud } from '../fundacion/api'
import { cargarMisJornadas } from '../jornadas/api'
import { useMiSolicitud } from '../registro/datos'
import { cargarMiTarea, cargarNivel } from '../repartidor/api'
import type { MiTarea, Nivel } from '../repartidor/api'
import { cargarCatalogo, cargarMiTienda, cargarPedidos } from '../tienda/api'
import type { Articulo, MiTienda, Pedido } from '../tienda/api'
import { atajosCuenta, nivelRepartidor, vistaCuenta } from './vista'
import type { VistaCuenta } from './vista'
import './cuenta.css'

/**
 * `#/cuenta` (D8): lo que cada rol ya puede leer, sus atajos y salir. No crea datos
 * ni permisos nuevos; si algo no se puede leer, se omite.
 */
export default function Cuenta() {
  const { status, user, role, organizationId, error, retry, signOut } = useSession()
  const vista = vistaCuenta({ status, hasUser: Boolean(user), role, organizationId })

  return (
    <main className="screen">
      <div className="screen__body screen__body--top cta-page">
        <div className="topbar">
          <span className="brand brand--ink">Ágora</span>
          <ThemeToggle />
        </div>
        <h1 className="page-title">Mi cuenta</h1>
        {vista === 'cargando' ? <CocoLoading title="Cargando tu cuenta…" size={88} /> : null}
        {vista === 'error' ? (
          <EmptyState
            title="No pudimos cargar tu sesión"
            description={error ?? undefined}
            action={
              <div className="wrap-row">
                <Button variant="ink" onClick={() => void retry()}>Reintentar</Button>
                <Button variant="ghost" onClick={() => void signOut().catch(() => {})}>Salir</Button>
              </div>
            }
          />
        ) : null}
        {vista === 'invitado' ? <Comprador /> : null}
        {vista === 'sin-perfil' && user ? <SinPerfil userId={user.id} email={user.email ?? null} /> : null}
        {vista === 'fundacion' && organizationId ? <Fundacion organizacionId={organizationId} /> : null}
        {vista === 'tienda' && organizationId ? <Tienda tiendaId={organizationId} /> : null}
        {vista === 'repartidor' ? <Repartidor /> : null}
        {user ? <Salir /> : null}
      </div>
    </main>
  )
}

/** Lee una vez; `null` mientras carga, `undefined` si falló (la sección se omite). */
function useLectura<T>(leer: () => Promise<T>, deps: unknown[]) {
  const [valor, setValor] = useState<{ clave: string; dato: T | undefined } | null>(null)
  const clave = JSON.stringify(deps)
  useEffect(() => {
    let vigente = true
    leer()
      .then((dato) => vigente && setValor({ clave, dato }))
      .catch(() => vigente && setValor({ clave, dato: undefined }))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return valor?.clave === clave ? valor.dato : null
}

function Encabezado({ nombre, rol, children }: { nombre: string; rol: Role; children?: ReactNode }) {
  return (
    <Card className="cta-hero">
      <div className="cta-hero__row">
        <OrganizationAvatar name={nombre} />
        <div className="cta-hero__copy">
          <h2 className="cta-hero__name">{nombre}</h2>
          <div className="wrap-row">
            <Chip tone="ink">{roleLabels[rol]}</Chip>
            {children}
          </div>
        </div>
      </div>
    </Card>
  )
}

function Atajos({ vista }: { vista: VistaCuenta }) {
  return (
    <nav className="cta-shortcuts" aria-label="Atajos">
      {atajosCuenta(vista).map((a) => (
        <Button key={a.href} variant="outline" href={a.href}>{a.etiqueta}</Button>
      ))}
    </nav>
  )
}

function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="cta-section" aria-label={titulo}>
      <div className="cta-section__head">
        <h2 className="section-title">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

function Salir() {
  const { signOut } = useSession()
  const [saliendo, setSaliendo] = useState(false)
  return (
    <Button variant="ghost" block disabled={saliendo}
      onClick={() => {
        setSaliendo(true)
        void signOut().catch(() => {}).finally(() => setSaliendo(false))
      }}>
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  )
}

/* Fundación */

interface OrgCuenta {
  id: string
  nombre: string
  categoria: string | null
  verificada: boolean
  suspendida: boolean
  logo_url: string | null
}

// "Miembros leen la propia" (RLS de T02): incluye categoría y estado.
async function cargarOrgCuenta(id: string): Promise<OrgCuenta> {
  if (!supabase) throw new Error('El servicio no está configurado.')
  const { data, error } = await supabase
    .from('organizaciones')
    .select('id, nombre, categoria, verificada, suspendida, logo_url')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as OrgCuenta
}

/** Publicaciones del feed (T24): solo el conteo; se gestionan en Mi página. */
async function contarPublicaciones(organizacionId: string): Promise<number> {
  if (!supabase) throw new Error('El servicio no está configurado.')
  const { count, error } = await supabase
    .from('publicaciones')
    .select('id', { count: 'exact', head: true })
    .eq('organizacion_id', organizacionId)
  if (error) throw error
  return count ?? 0
}

function EstadoOrg({ org }: { org: OrgCuenta }) {
  if (org.suspendida) return <Chip tone="red">Suspendida</Chip>
  return org.verificada ? <Chip tone="lime">✓ Verificada</Chip> : <Chip tone="yellow">Verificación pendiente</Chip>
}

const ESTADO_SOLICITUD: Record<MiSolicitud['estado'], string> = {
  publicada: 'Publicadas', borrador: 'Borradores', cerrada: 'Completas', cancelada: 'Canceladas',
}

function Fundacion({ organizacionId }: { organizacionId: string }) {
  const org = useLectura(() => cargarOrgCuenta(organizacionId), [organizacionId])
  const solicitudes = useLectura(() => cargarMisSolicitudes(organizacionId), [organizacionId])
  const jornadas = useLectura(() => cargarMisJornadas(organizacionId), [organizacionId])
  const publicaciones = useLectura(() => contarPublicaciones(organizacionId), [organizacionId])
  const [ahora] = useState(() => Date.now())

  if (org === null) return <CocoLoading title="Cargando tu fundación…" size={88} />
  const categoria = categoriasFundacion.find((c) => c.valor === org?.categoria)?.etiqueta
  const conteo = (solicitudes ?? []).reduce<Record<string, number>>((n, s) => ({ ...n, [s.estado]: (n[s.estado] ?? 0) + 1 }), {})
  const proximas = (jornadas ?? []).filter((j) => new Date(j.inicia_en).getTime() > ahora)
  const porRevisar = (jornadas ?? []).reduce(
    (n, j) => n + j.inscripciones_jornada.filter((i) => i.estado === 'pendiente').length, 0)

  return (
    <>
      {org ? (
        <Encabezado nombre={org.nombre} rol="fundacion">
          <EstadoOrg org={org} />
          {categoria ? <Chip tone="outline">{categoria}</Chip> : null}
        </Encabezado>
      ) : null}
      <Atajos vista="fundacion" />

      {publicaciones === null || publicaciones === undefined ? null : (
        <Seccion titulo="Publicaciones" accion={<a className="section-link" href="#/fundacion/organizacion">Mi página</a>}>
          <div className="cta-stats">
            <Card className="cta-stat"><strong>{publicaciones}</strong><span>En el feed</span></Card>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Mis solicitudes" accion={<a className="section-link" href={paths.fundacion}>Ver todas</a>}>
        {solicitudes === null ? <CocoLoading title="Cargando…" size={64} /> : solicitudes === undefined ? null
          : solicitudes.length === 0 ? (
            <Card><p className="cta-muted">Aún no publicas solicitudes.</p></Card>
          ) : (
            <div className="cta-stats">
              {(Object.keys(ESTADO_SOLICITUD) as MiSolicitud['estado'][]).filter((e) => conteo[e]).map((e) => (
                <Card key={e} className="cta-stat"><strong>{conteo[e]}</strong><span>{ESTADO_SOLICITUD[e]}</span></Card>
              ))}
            </div>
          )}
      </Seccion>

      <Seccion titulo="Jornadas" accion={<a className="section-link" href={paths.fundacionJornadas}>Gestionar</a>}>
        {jornadas === null ? <CocoLoading title="Cargando…" size={64} /> : jornadas === undefined ? null : (
          <div className="cta-stats">
            <Card className="cta-stat"><strong>{proximas.length}</strong><span>Próximas</span></Card>
            <Card className="cta-stat"><strong>{porRevisar}</strong><span>Inscripciones por revisar</span></Card>
          </div>
        )}
      </Seccion>
    </>
  )
}

/* Tienda */

const ESTADO_PEDIDO: Record<Pedido['estado'], { texto: string; tono: 'lime' | 'surface' | 'outline' }> = {
  preparando: { texto: 'Por preparar', tono: 'lime' },
  listo: { texto: 'Listo', tono: 'surface' },
  recogido: { texto: 'Recogido', tono: 'outline' },
  entregado: { texto: 'Entregado', tono: 'outline' },
}

function Tienda({ tiendaId }: { tiendaId: string }) {
  const tienda = useLectura<MiTienda>(() => cargarMiTienda(tiendaId), [tiendaId])
  const pedidos = useLectura<Pedido[]>(() => cargarPedidos(), [tiendaId])
  const catalogo = useLectura<Articulo[]>(() => cargarCatalogo(tiendaId), [tiendaId])

  if (tienda === null) return <CocoLoading title="Cargando tu tienda…" size={88} />
  const visibles = (catalogo ?? []).filter((a) => a.activo).length

  return (
    <>
      {tienda ? (
        <Encabezado nombre={tienda.nombre} rol="tienda">
          {tienda.suspendida ? <Chip tone="red">Suspendida</Chip>
            : tienda.verificada ? <Chip tone="lime">✓ Verificada</Chip> : <Chip tone="yellow">Verificación pendiente</Chip>}
        </Encabezado>
      ) : null}
      <Atajos vista="tienda" />

      <Seccion titulo="Pedidos recientes" accion={<a className="section-link" href="#/tienda">Ver todos</a>}>
        {pedidos === null ? <CocoLoading title="Cargando…" size={64} /> : pedidos === undefined ? null
          : pedidos.length === 0 ? (
            <Card><p className="cta-muted">Sin pedidos por ahora. Cuando alguien pague, aparece aquí.</p></Card>
          ) : (
            <ul className="cta-list">
              {pedidos.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <Card className="cta-row">
                    <div className="cta-row__copy">
                      <strong>{p.organizacion_nombre}</strong>
                      <span className="cta-muted">{p.solicitud_titulo} · {formatoPesos(p.total_centavos)}</span>
                    </div>
                    <Chip tone={ESTADO_PEDIDO[p.estado].tono}>{ESTADO_PEDIDO[p.estado].texto}</Chip>
                  </Card>
                </li>
              ))}
            </ul>
          )}
      </Seccion>

      <Seccion titulo="Catálogo" accion={<a className="section-link" href="#/tienda/catalogo">Editar</a>}>
        {catalogo === null ? <CocoLoading title="Cargando…" size={64} /> : catalogo === undefined ? null : (
          <div className="cta-stats">
            <Card className="cta-stat"><strong>{visibles}</strong><span>Artículos visibles</span></Card>
            <Card className="cta-stat"><strong>{catalogo.length - visibles}</strong><span>Ocultos</span></Card>
          </div>
        )}
      </Seccion>
    </>
  )
}

/* Repartidor */

function Repartidor() {
  const { profile } = useSession()
  const nivel = useLectura<Nivel>(() => cargarNivel(), ['nivel'])
  const tarea = useLectura<MiTarea | null>(() => cargarMiTarea(), ['tarea'])

  if (nivel === null) return <CocoLoading title="Cargando tu estado…" size={88} />
  const estado = nivel ? nivelRepartidor(nivel.entregas, nivel.limite_centavos) : null

  return (
    <>
      <Encabezado nombre={profile?.nombre_visible ?? 'Repartidor'} rol="repartidor">
        {estado ? <Chip tone={estado.nuevo ? 'yellow' : 'lime'}>{estado.titulo}</Chip> : null}
      </Encabezado>
      <Atajos vista="repartidor" />

      {estado && nivel ? (
        <Seccion titulo="Tu nivel">
          <Card className="cta-level">
            {estado.nuevo && nivel.limite_centavos !== null ? (
              <>
                <p>Pedidos de hasta <strong>{formatoPesos(nivel.limite_centavos)}</strong> hasta completar 3 entregas.</p>
                <ProgressBar value={estado.hechas} max={3} label="Entregas hechas" detail={`${estado.hechas} de 3`} tone="ink" size="sm" />
              </>
            ) : (
              <p>Sin límite de monto. Llevas <strong>{estado.hechas}</strong> {estado.hechas === 1 ? 'entrega' : 'entregas'}.</p>
            )}
          </Card>
        </Seccion>
      ) : null}

      <Seccion titulo="Tarea actual" accion={<a className="section-link" href="#/repartidor">Ver tareas</a>}>
        {tarea === null ? <CocoLoading title="Cargando…" size={64} /> : tarea === undefined ? null : tarea ? (
          <Card tone="lime" href="#/repartidor" className="cta-row">
            <div className="cta-row__copy">
              <strong>{tarea.tienda_nombre}</strong>
              <span>Para {tarea.destino_nombre} · {formatoPesos(tarea.total_centavos)}</span>
            </div>
            <Chip>{tarea.estado === 'asignada' ? 'Por recoger' : 'Recogida'}</Chip>
          </Card>
        ) : (
          <Card><p className="cta-muted">No tienes una tarea en curso.</p></Card>
        )}
      </Seccion>
    </>
  )
}

/* Comprador, invitado y alta */

function Comprobantes() {
  const [total] = useState(() => readStoredPayments().length)
  return (
    <Seccion titulo="Causas que sigues">
      <Card href={paths.following} className="cta-row">
        <div className="cta-row__copy">
          <strong>Mis comprobantes</strong>
          <span className="cta-muted">
            {total === 0 ? 'Aún no hay comprobantes en este dispositivo.'
              : `${total} ${total === 1 ? 'comprobante' : 'comprobantes'} en este dispositivo.`}
          </span>
        </div>
        <span aria-hidden="true">→</span>
      </Card>
    </Seccion>
  )
}

function Invitacion() {
  return (
    <Seccion titulo="¿Fundación, tienda o repartidor?">
      <Card className="cta-invite">
        <Coco size={72} pose="saludando" />
        <p>Crea una cuenta y solicita tu alta. El equipo de Ágora la revisa antes de publicar nada.</p>
        <div className="cta-shortcuts">
          {(['fundacion', 'tienda', 'repartidor'] as const).map((r) => (
            <Button key={r} variant="outline" href={registroPaths.registroRol(r)}>{roleLabels[r]}</Button>
          ))}
        </div>
      </Card>
    </Seccion>
  )
}

function Comprador() {
  const { demoEnabled, authEnabled } = useSession()
  return (
    <>
      <Card className="cta-hero">
        <p>Para donar no necesitas cuenta. Tus comprobantes se guardan en este dispositivo.</p>
        {authEnabled ? (
          <div className="cta-shortcuts">
            <Button href={registroPaths.entrar}>Entrar</Button>
            <Button variant="outline" href={registroPaths.crearCuenta}>Crear cuenta</Button>
          </div>
        ) : null}
      </Card>
      <Atajos vista="invitado" />
      <Comprobantes />
      <Invitacion />
      {demoEnabled ? <AccesoDemo /> : null}
    </>
  )
}

function AccesoDemo() {
  const { signInDemo, loading } = useSession()
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const entrar = async (rol: Role) => {
    setOcupado(true)
    setFallo(null)
    try {
      await signInDemo(rol)
      window.location.hash = rol === 'comprador' ? paths.cuenta : `#${roleNavigation[rol][0].path}`
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Seccion titulo="Probar con una cuenta demo">
      <Card className="cta-invite">
        <SampleBadge />
        <div className="cta-shortcuts" role="group" aria-label="Entrar con un rol demo">
          {demoAccounts.map((a) => (
            <Button key={a.role} variant="outline" disabled={ocupado || loading} onClick={() => void entrar(a.role)}>
              {a.label}
            </Button>
          ))}
        </div>
        {fallo ? <p className="cta-error" role="alert">{fallo}</p> : null}
      </Card>
    </Seccion>
  )
}

const ETIQUETA_ALTA = { pendiente: 'En revisión', aprobada: 'Aprobada', rechazada: 'No aprobada' } as const

function SinPerfil({ userId, email }: { userId: string; email: string | null }) {
  const alta = useMiSolicitud(userId)
  const solicitud = alta.solicitud

  return (
    <>
      <Card className="cta-hero">
        <div className="cta-hero__copy">
          <strong>{email ?? 'Tu cuenta'}</strong>
          <span className="cta-muted">Cuenta de comprador. Donar no requiere nada más.</span>
        </div>
      </Card>
      <Atajos vista="sin-perfil" />

      {alta.carga === 'cargando' ? <CocoLoading title="Consultando tu solicitud…" size={64} /> : null}
      {solicitud ? (
        // Resumen; el detalle y las acciones viven en #/registro (T23).
        <Seccion titulo="Tu solicitud de alta">
          <Card href={registroPaths.registro} className="cta-row" tone={solicitud.estado === 'rechazada' ? 'yellow' : 'surface'}>
            <div className="cta-row__copy">
              <strong>{roleLabels[solicitud.rol]}{solicitud.org_nombre ? ` · ${solicitud.org_nombre}` : ''}</strong>
              <span className="cta-muted">
                {solicitud.estado === 'pendiente' ? 'El equipo de Ágora la está revisando.'
                  : solicitud.estado === 'rechazada' ? 'Revisa el motivo y envíala de nuevo.'
                    : 'Lista. Vuelve a entrar para usar tu cuenta.'}
              </span>
            </div>
            <Chip tone={solicitud.estado === 'aprobada' ? 'lime' : solicitud.estado === 'rechazada' ? 'red' : 'yellow'}>
              {ETIQUETA_ALTA[solicitud.estado]}
            </Chip>
          </Card>
        </Seccion>
      ) : null}

      <Comprobantes />
      {alta.carga === 'listo' && !solicitud ? <Invitacion /> : null}
    </>
  )
}
