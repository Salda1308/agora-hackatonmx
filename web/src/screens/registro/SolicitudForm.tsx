import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { camposDeRol, categoriasFundacion, formularioVacio, LIMITES, validarSolicitud } from '../../auth/alta-validacion'
import type { CampoAlta, FormularioAlta } from '../../auth/alta-validacion'
import { registroPaths } from '../../auth/registro-routes'
import { roleLabels } from '../../auth/roles'
import type { ProfileRole } from '../../auth/roles'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { Marco } from '../fundacion/Marco'
import { Campo, EstadoSesion } from './comun'
import { alta, useMiSolicitud } from './datos'
import { MiRegistro } from './MiRegistro'

const textos: Record<ProfileRole, { titulo: string; lead: string }> = {
  fundacion: { titulo: 'Registra tu fundación', lead: 'Con estos datos verificamos que la organización existe antes de publicar sus solicitudes.' },
  tienda: { titulo: 'Registra tu tienda', lead: 'Con estos datos verificamos el negocio que recibirá los pedidos pagados.' },
  repartidor: { titulo: 'Hazte repartidor', lead: 'Recoge pedidos en la tienda y llévalos a quien los necesita. Al empezar verás pedidos de hasta $500.' },
}

/** `#/registro/:rol`: formulario de solicitud de alta para una cuenta sin perfil. */
export function SolicitudForm({ rol }: { rol: ProfileRole }) {
  return <EstadoSesion><Puerta rol={rol} /></EstadoSesion>
}

function Puerta({ rol }: { rol: ProfileRole }) {
  const { status, user, role } = useSession()
  const sinPerfil = status === 'ready' && user && role === 'comprador'
  const lectura = useMiSolicitud(sinPerfil ? user.id : null)
  // Sin sesión, con perfil o con una solicitud pendiente o aprobada: lo resuelve la vista general.
  if (status === 'loading' || (sinPerfil && lectura.carga === 'cargando')) {
    return <Marco><CocoLoading title="Cargando…" size={88} /></Marco>
  }
  if (!sinPerfil || lectura.carga === 'error' || (lectura.solicitud && lectura.solicitud.estado !== 'rechazada')) {
    return <MiRegistro />
  }
  const anterior = lectura.solicitud
  return (
    <Formulario key={rol} rol={rol}
      motivo={anterior?.rol === rol ? anterior.motivo : null}
      orgNombre={anterior?.rol === rol ? anterior.org_nombre : null} />
  )
}

function Formulario({ rol, motivo, orgNombre }: { rol: ProfileRole; motivo: string | null; orgNombre: string | null }) {
  const [form, setForm] = useState<FormularioAlta>({ ...formularioVacio, orgNombre: orgNombre ?? '' })
  const [errores, setErrores] = useState<Partial<Record<CampoAlta, string>>>({})
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)
  const enCurso = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const campos = camposDeRol(rol)

  useEffect(() => {
    if (!enviada) return
    const id = window.setTimeout(() => { window.location.hash = registroPaths.registro }, 1200)
    return () => window.clearTimeout(id)
  }, [enviada])

  const cambiar = (campo: CampoAlta) => (valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enCurso.current || enviada) return
    setFallo(null)
    const { errores: nuevos, args } = validarSolicitud(rol, form)
    setErrores(nuevos)
    if (!args) {
      // Llevar el foco al primer campo con error, en el orden del formulario.
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (!acepto) { setFallo('Confirma que los datos son reales.'); return }
    enCurso.current = true
    setEnviando(true)
    try {
      await alta.solicitarAlta(args)
      setEnviada(true)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo enviar la solicitud. Vuelve a intentar.')
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  if (enviada) {
    return (
      <Marco>
        <EmptyState pose="pulgar-arriba" title="Solicitud enviada" description="El equipo la revisará. Te llevamos a su estado."
          action={<Button variant="ink" href={registroPaths.registro}>Ver estado</Button>} />
      </Marco>
    )
  }

  const texto = (campo: CampoAlta, etiqueta: string, opciones: { pista?: string; autoComplete?: string; max: number; inputMode?: 'tel' | 'url' | 'text' }) => (
    <Campo key={campo} etiqueta={etiqueta} pista={opciones.pista} error={errores[campo]}>
      {(props) => <input {...props} name={campo} value={form[campo]} onChange={(e) => cambiar(campo)(e.target.value)}
        autoComplete={opciones.autoComplete ?? 'off'} inputMode={opciones.inputMode} maxLength={opciones.max + 20} />}
    </Campo>
  )

  const render: Record<CampoAlta, () => ReactNode> = {
    orgNombre: () => texto('orgNombre', rol === 'tienda' ? 'Nombre de la tienda' : 'Nombre de la organización',
      { autoComplete: 'organization', max: LIMITES.orgNombre }),
    orgCategoria: () => (
      <Campo key="orgCategoria" etiqueta="Categoría" error={errores.orgCategoria}>
        {(props) => (
          <select {...props} name="orgCategoria" value={form.orgCategoria} onChange={(e) => cambiar('orgCategoria')(e.target.value)}>
            <option value="">Elige una</option>
            {categoriasFundacion.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
          </select>
        )}
      </Campo>
    ),
    orgDescripcion: () => (
      <Campo key="orgDescripcion" etiqueta="¿Qué hacen y a quién ayudan?" error={errores.orgDescripcion}
        pista={`${form.orgDescripcion.trim().length} de mínimo ${LIMITES.descripcionMin} caracteres.`}>
        {(props) => <textarea {...props} name="orgDescripcion" value={form.orgDescripcion}
          onChange={(e) => cambiar('orgDescripcion')(e.target.value)} maxLength={LIMITES.descripcionMax} rows={4} />}
      </Campo>
    ),
    enlace: () => texto('enlace', rol === 'tienda' ? 'Sitio o red social (opcional)' : 'Enlace para verificarlos',
      { pista: 'Su sitio web o red social, empezando con https://', inputMode: 'url', autoComplete: 'url', max: LIMITES.enlace }),
    ciudad: () => texto('ciudad', 'Ciudad', { autoComplete: 'address-level2', max: LIMITES.ciudad }),
    nombreContacto: () => texto('nombreContacto', rol === 'repartidor' ? 'Tu nombre' : 'Nombre de contacto',
      { autoComplete: 'name', max: LIMITES.nombreContacto }),
    telefono: () => texto('telefono', 'Teléfono', { pista: '10 dígitos. Solo el equipo lo ve.', inputMode: 'tel', autoComplete: 'tel-national', max: 16 }),
    rfc: () => texto('rfc', rol === 'tienda' ? 'RFC de la tienda' : 'RFC (opcional)', { pista: 'Como aparece en tu constancia fiscal.', max: 13 }),
  }

  return (
    <Marco>
      <div>
        <p className="reg-muted">Solicitud de alta · {roleLabels[rol]}</p>
        <h1 className="page-title">{textos[rol].titulo}</h1>
        <p className="page-lead">{textos[rol].lead}</p>
      </div>
      {motivo ? (
        <div className="reg-note">
          <p><strong>Lo que el equipo pidió corregir</strong></p>
          <p>{motivo}</p>
        </div>
      ) : null}
      <Card>
        <form ref={formRef} className="reg-form" noValidate onSubmit={(e) => void enviar(e)} aria-busy={enviando}>
          {campos.map((campo) => render[campo]())}
          <label className="reg-check">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <span>Confirmo que los datos son reales. El equipo los revisará y no se publica nada hasta aprobar la solicitud.</span>
          </label>
          <Button type="submit" size="lg" block disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</Button>
          {fallo ? <p className="reg-error" role="alert">{fallo}</p> : null}
        </form>
      </Card>
      <div className="reg-links"><a href={registroPaths.registro}>Volver</a></div>
    </Marco>
  )
}
