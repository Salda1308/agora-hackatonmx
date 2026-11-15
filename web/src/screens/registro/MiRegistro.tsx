import { useEffect, useState } from 'react'
import type { MiSolicitudAlta } from '../../auth/alta-api'
import { registroPaths } from '../../auth/registro-routes'
import { roleLabels, roleNavigation } from '../../auth/roles'
import type { ProfileRole } from '../../auth/roles'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from '../fundacion/Marco'
import { EstadoSesion } from './comun'
import { useMiSolicitud } from './datos'

/** `#/registro`: sin sesión invita a crear cuenta; con sesión sin perfil, elegir rol o ver la solicitud. */
export function MiRegistro() {
  return <EstadoSesion><Contenido /></EstadoSesion>
}

function Contenido() {
  const { status, user, role, retry } = useSession()
  const sinPerfil = status === 'ready' && user && role === 'comprador'
  const lectura = useMiSolicitud(sinPerfil ? user.id : null)
  // Tras la aprobación: recargar el perfil y, si ya existe, ir al panel del rol.
  const [pidioPanel, setPidioPanel] = useState(false)
  useEffect(() => {
    if (pidioPanel && status === 'ready' && role && role !== 'comprador') window.location.hash = `#${roleNavigation[role][0].path}`
  }, [pidioPanel, status, role])
  const entrarAlPanel = () => {
    setPidioPanel(true)
    void retry()
  }

  if (status === 'loading') return <Marco><CocoLoading title={pidioPanel ? 'Activando tu acceso…' : 'Cargando sesión…'} size={88} /></Marco>
  if (!user) return <Bienvenida />
  if (role && role !== 'comprador') return <ConAcceso rol={role} />
  if (lectura.carga === 'cargando') return <Marco><CocoLoading title="Buscando tu solicitud…" size={88} /></Marco>
  if (lectura.carga === 'error') {
    return (
      <Marco>
        <EmptyState title="No pudimos ver tu solicitud" description={lectura.error}
          action={<Button variant="ink" onClick={lectura.recargar}>Reintentar</Button>} />
      </Marco>
    )
  }
  if (!lectura.solicitud) return <ElegirRol />
  return <EstadoSolicitud solicitud={lectura.solicitud} onEntrar={entrarAlPanel} sinPerfil={pidioPanel} />
}

const opciones: ReadonlyArray<{ rol: ProfileRole; titulo: string; texto: string }> = [
  { rol: 'fundacion', titulo: 'Fundación', texto: 'Albergue, asilo, refugio o colectivo que pide insumos para su gente.' },
  { rol: 'tienda', titulo: 'Tienda', texto: 'Negocio que recibe pedidos pagados y los prepara para recoger.' },
  { rol: 'repartidor', titulo: 'Repartidor', texto: 'Voluntario que recoge pedidos en la tienda y los entrega.' },
]

function Bienvenida() {
  return (
    <Marco>
      <div>
        <h1 className="page-title">Súmate a Ágora</h1>
        <p className="page-lead">Las fundaciones, tiendas y repartidores necesitan una cuenta revisada por el equipo.</p>
      </div>
      <div className="reg-stack">
        <Button size="lg" block href={registroPaths.crearCuenta}>Crear cuenta</Button>
        <Button variant="outline" size="lg" block href={registroPaths.entrar}>Ya tengo cuenta, entrar</Button>
      </div>
      <div className="reg-links"><a href={paths.home}>Solo quiero donar, no necesito cuenta</a></div>
    </Marco>
  )
}

function ConAcceso({ rol }: { rol: ProfileRole }) {
  return (
    <Marco>
      <EmptyState pose="pulgar-arriba" title={`Tu cuenta es de ${roleLabels[rol].toLowerCase()}`}
        description="Ya tienes acceso a tu panel."
        action={<Button variant="ink" href={`#${roleNavigation[rol][0].path}`}>Ir a mi panel</Button>} />
    </Marco>
  )
}

export function ElegirRol() {
  return (
    <Marco>
      <div>
        <h1 className="page-title">¿Qué quieres ser?</h1>
        <p className="page-lead">Elige una opción. El equipo revisa cada solicitud antes de darte acceso.</p>
      </div>
      <ul className="reg-roles">
        {opciones.map((o) => (
          <li key={o.rol}>
            <Card href={registroPaths.registroRol(o.rol)} className="reg-role">
              <span className="reg-role__title">{o.titulo}</span>
              <span className="reg-role__text">{o.texto}</span>
            </Card>
          </li>
        ))}
        <li>
          <Card href={paths.home} className="reg-role">
            <span className="reg-role__title">Solo quiero donar</span>
            <span className="reg-role__text">No necesitas cuenta. Elige una solicitud y paga desde tu banco.</span>
          </Card>
        </li>
      </ul>
    </Marco>
  )
}

const titulos = {
  pendiente: 'Tu solicitud está en revisión',
  aprobada: '¡Tu solicitud fue aprobada!',
  rechazada: 'Tu solicitud no fue aprobada',
} as const

const etiquetasEstado = { pendiente: 'En revisión', aprobada: 'Aprobada', rechazada: 'Rechazada' } as const

function fecha(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })
}

function EstadoSolicitud({ solicitud, onEntrar, sinPerfil }: {
  solicitud: MiSolicitudAlta
  onEntrar: () => void
  sinPerfil: boolean
}) {
  return (
    <Marco>
      <Card className="reg-status">
        <div className="reg-status__head">
          <span className="reg-badge" data-estado={solicitud.estado}>{etiquetasEstado[solicitud.estado]}</span>
          <span className="reg-muted">{roleLabels[solicitud.rol]}</span>
        </div>
        <h1 className="reg-status__title">{titulos[solicitud.estado]}</h1>
        <dl className="reg-dl">
          {solicitud.org_nombre ? <><dt>Nombre</dt><dd>{solicitud.org_nombre}</dd></> : null}
          {fecha(solicitud.creada_en) ? <><dt>Enviada</dt><dd>{fecha(solicitud.creada_en)}</dd></> : null}
          {solicitud.estado !== 'pendiente' && fecha(solicitud.resuelta_en) ? <><dt>Revisada</dt><dd>{fecha(solicitud.resuelta_en)}</dd></> : null}
        </dl>
      </Card>

      {solicitud.estado === 'pendiente' ? (
        <div className="reg-note" role="status">
          <p><strong>El equipo revisará tus datos a mano.</strong></p>
          <p className="reg-muted">No se publica nada a tu nombre hasta que aprobemos la solicitud. Esta página se actualiza sola.</p>
        </div>
      ) : null}

      {solicitud.estado === 'aprobada' ? (
        <div className="reg-stack">
          {solicitud.rol === 'tienda' ? (
            <div className="reg-note">
              <p className="reg-muted">Para recibir cobros, el equipo configurará la cuenta de cobro de tu tienda y te avisará.</p>
            </div>
          ) : null}
          <Button size="lg" block onClick={onEntrar}>Entrar a mi panel</Button>
          {sinPerfil ? <p className="reg-muted" role="status">Tu acceso aún se está activando. Espera unos segundos y vuelve a intentar.</p> : null}
        </div>
      ) : null}

      {solicitud.estado === 'rechazada' ? (
        <div className="reg-stack">
          <div className="reg-note">
            <p><strong>Motivo del equipo</strong></p>
            <p>{solicitud.motivo ?? 'El equipo no dejó un motivo.'}</p>
          </div>
          <p className="reg-muted">Si aún tienes intentos, puedes corregir tus datos y enviarla otra vez.</p>
          <Button size="lg" block href={registroPaths.registroRol(solicitud.rol)}>Corregir y enviar de nuevo</Button>
          <p className="reg-muted reg-center">
            ¿Era otro rol?{' '}
            {opciones.filter((o) => o.rol !== solicitud.rol).map((o, i) => (
              <span key={o.rol}>{i > 0 ? ' o ' : ''}<a href={registroPaths.registroRol(o.rol)}>{o.titulo}</a></span>
            ))}
          </p>
        </div>
      ) : null}

      <div className="reg-links"><a href={paths.home}>Ir al inicio</a></div>
    </Marco>
  )
}
