import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { RequireRole } from '../../auth/RequireRole'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SampleBadge } from '../../components/ui/Chip'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/Progress'
import { IconPlus } from '../../components/ui/icons'
import { paths } from '../../lib/router'
import { cambiarEstado, cargarDireccion, cargarMisJornadas, crearJornada, formatoHorario } from './api'
import type { EstadoInscripcion, Inscripcion, JornadaConInscripciones } from './api'
import { EstadoChip, Pantalla } from './JornadasArea'
import './jornadas.css'

/** Jornadas de la fundación (T18). Protegida con RequireRole; RLS autoriza cada dato. */
export default function JornadasFundacion() {
  const { status, organizationId } = useSession()
  return (
    <RequireRole
      allowed={['fundacion']}
      pending={<Pantalla><CocoLoading title="Cargando sesión…" size={88} /></Pantalla>}
      fallback={
        <Pantalla>
          <EmptyState
            title="Solo para fundaciones"
            description={status === 'error' ? 'Reintenta o cierra sesión desde el panel de acceso.' : 'Entra con la cuenta de tu fundación.'}
            action={<Button variant="ink" href={paths.jornadas}>Ver jornadas públicas</Button>}
          />
        </Pantalla>
      }
    >
      {organizationId ? <Gestion organizacionId={organizationId} /> : null}
    </RequireRole>
  )
}

function Gestion({ organizacionId }: { organizacionId: string }) {
  const [jornadas, setJornadas] = useState<JornadaConInscripciones[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    let vigente = true
    cargarMisJornadas(organizacionId)
      .then((j) => {
        if (!vigente) return
        setJornadas(j)
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [organizacionId, intento])

  const recargar = () => setIntento((n) => n + 1)

  if (creando) {
    return (
      <NuevaJornada
        organizacionId={organizacionId}
        onCancelar={() => setCreando(false)}
        onCreada={() => {
          setCreando(false)
          recargar()
        }}
      />
    )
  }

  return (
    <Pantalla>
      <div>
        <h1 className="page-title">Jornadas</h1>
        <p className="page-lead">Voluntariado de personas y empresas.</p>
      </div>
      <Button size="lg" block icon={<IconPlus />} onClick={() => setCreando(true)}>
        Nueva jornada
      </Button>

      {error ? (
        <EmptyState title="No se pudieron cargar" action={<Button variant="ink" onClick={recargar}>Reintentar</Button>} />
      ) : jornadas === null ? (
        <CocoLoading title="Cargando jornadas…" size={88} />
      ) : jornadas.length === 0 ? (
        <EmptyState title="Aún no hay jornadas" description="Abre una con fecha, lugar y cupos." />
      ) : (
        <ul className="jor-list">
          {jornadas.map((j) => (
            <li key={j.id}>
              <TarjetaJornada jornada={j} onCambio={recargar} />
            </li>
          ))}
        </ul>
      )}
    </Pantalla>
  )
}

function TarjetaJornada({ jornada, onCambio }: { jornada: JornadaConInscripciones; onCambio: () => void }) {
  const inscripciones = [...jornada.inscripciones_jornada].sort((a, b) => a.creada_en.localeCompare(b.creada_en))
  return (
    <Card className="jor-item">
      <div className="jor-item__head">
        <h2 className="jor-item__title">{jornada.titulo}</h2>
        {jornada.es_ejemplo ? <SampleBadge label="Ejemplo" /> : null}
      </div>
      <p className="jor-muted">{formatoHorario(jornada.inicia_en, jornada.termina_en)}</p>
      <ProgressBar
        value={jornada.ocupados}
        max={jornada.cupos}
        label="Cupos"
        detail={`${jornada.ocupados} de ${jornada.cupos}`}
        tone="ink"
        size="sm"
      />
      {inscripciones.length === 0 ? (
        <p className="jor-muted">Sin inscripciones todavía.</p>
      ) : (
        <ul className="jor-list jor-list--tight">
          {inscripciones.map((i) => (
            <FilaInscripcion key={i.id} inscripcion={i} onCambio={onCambio} />
          ))}
        </ul>
      )}
    </Card>
  )
}

const ACCIONES: Partial<Record<EstadoInscripcion, { estado: EstadoInscripcion; texto: string; variante: 'ink' | 'outline' }[]>> = {
  pendiente: [
    { estado: 'confirmada', texto: 'Aceptar', variante: 'ink' },
    { estado: 'rechazada', texto: 'Rechazar', variante: 'outline' },
  ],
  confirmada: [
    { estado: 'asistio', texto: 'Asistió', variante: 'ink' },
    { estado: 'no_asistio', texto: 'No asistió', variante: 'outline' },
  ],
}

function FilaInscripcion({ inscripcion, onCambio }: { inscripcion: Inscripcion; onCambio: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const acciones = ACCIONES[inscripcion.estado] ?? []

  const cambiar = async (estado: EstadoInscripcion) => {
    setFallo(null)
    setEnviando(true)
    try {
      await cambiarEstado(inscripcion.id, estado)
      onCambio()
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <li className="jor-row">
      <div className="jor-item__head">
        <div className="jor-row__copy">
          <strong>{inscripcion.nombre_contacto}</strong>
          <span className="jor-muted">
            {inscripcion.asistentes} {inscripcion.asistentes === 1 ? 'persona' : 'personas'} · {inscripcion.contacto}
          </span>
        </div>
        <EstadoChip estado={inscripcion.estado} fundacion />
      </div>
      {acciones.length > 0 ? (
        <div className="jor-actions">
          {acciones.map((a) => (
            <Button key={a.estado} variant={a.variante} disabled={enviando} onClick={() => void cambiar(a.estado)}>
              {a.texto}
            </Button>
          ))}
        </div>
      ) : null}
      {inscripcion.estado === 'asistio' ? (
        <a className="section-link" href={paths.folio(inscripcion.id)}>Ver constancia para compartir</a>
      ) : null}
      {fallo ? <p className="jor-error" role="alert">{fallo}</p> : null}
    </li>
  )
}

function NuevaJornada({
  organizacionId,
  onCancelar,
  onCreada,
}: {
  organizacionId: string
  onCancelar: () => void
  onCreada: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [fecha, setFecha] = useState('')
  const [inicio, setInicio] = useState('09:00')
  const [fin, setFin] = useState('13:00')
  const [cupos, setCupos] = useState(10)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    cargarDireccion(organizacionId)
      .then((d) => vigente && d && setUbicacion((u) => u || d))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [organizacionId])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const iniciaEn = new Date(`${fecha}T${inicio}`)
    const terminaEn = new Date(`${fecha}T${fin}`)
    if (!(terminaEn > iniciaEn)) return setFallo('La hora de fin debe ser después del inicio.')
    if (iniciaEn <= new Date()) return setFallo('Elige una fecha futura.')
    setFallo(null)
    setEnviando(true)
    try {
      await crearJornada({
        organizacionId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        requisitos: requisitos.trim(),
        ubicacion: ubicacion.trim(),
        iniciaEn: iniciaEn.toISOString(),
        terminaEn: terminaEn.toISOString(),
        cupos,
      })
      onCreada()
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
      setEnviando(false)
    }
  }

  return (
    <Pantalla>
      <h1 className="page-title">Nueva jornada</h1>
      <form className="jor-form" onSubmit={(e) => void enviar(e)}>
        <label className="jor-field">
          Título
          <input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="jor-field">
          Qué harán
          <textarea required rows={3} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <label className="jor-field">
          Requisitos
          <textarea required rows={2} maxLength={500} value={requisitos} onChange={(e) => setRequisitos(e.target.value)} />
        </label>
        <label className="jor-field">
          Lugar
          <input required maxLength={300} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </label>
        <label className="jor-field">
          Fecha
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <div className="jor-pair">
          <label className="jor-field">
            Inicio
            <input type="time" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="jor-field">
            Fin
            <input type="time" required value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>
        <label className="jor-field">
          Cupos
          <input type="number" required min={1} max={500} value={cupos} onChange={(e) => setCupos(Number(e.target.value))} />
        </label>
        <p className="jor-muted">El lugar es público. Sin dinero de por medio: las empresas que quieran donar compran unidades.</p>
        {fallo ? <p className="jor-error" role="alert">{fallo}</p> : null}
        <Button type="submit" size="lg" block disabled={enviando}>
          {enviando ? 'Guardando…' : 'Abrir jornada'}
        </Button>
        <Button variant="ghost" block onClick={onCancelar}>Cancelar</Button>
      </form>
    </Pantalla>
  )
}
