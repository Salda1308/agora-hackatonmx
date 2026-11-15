import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip, SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/Progress'
import { IconBack, IconCheck, IconPin } from '../../components/ui/icons'
import { paths } from '../../lib/router'
import {
  cargarJornada,
  cargarJornadasPublicas,
  consultarInscripcion,
  formatoHorario,
  guardarFolio,
  inscribirse,
  leerFolios,
} from './api'
import type { ConsultaInscripcion, EstadoInscripcion, Jornada } from './api'
import './jornadas.css'

export type VistaJornadas = { tipo: 'lista' } | { tipo: 'detalle'; id: string } | { tipo: 'folio'; id: string }

/** Jornadas de voluntariado para el público (T18). Se carga aparte (lazy). */
export default function JornadasArea({ vista }: { vista: VistaJornadas }) {
  if (vista.tipo === 'detalle') return <Detalle key={vista.id} id={vista.id} />
  if (vista.tipo === 'folio') return <Folio key={vista.id} id={vista.id} />
  return <Lista />
}

export function Pantalla({ children, atras }: { children: ReactNode; atras?: string }) {
  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          {atras ? (
            <Button variant="ghost" href={atras} icon={<IconBack />}>Atrás</Button>
          ) : (
            <span className="brand">Ágora</span>
          )}
          <ThemeToggle />
        </div>
        {children}
      </div>
    </main>
  )
}

const yaEmpezo = (inicia: string) => Date.parse(inicia) <= Date.now()

function Cargando() {
  return <CocoLoading title="Cargando jornadas…" size={88} />
}

function Fallo({ reintentar }: { reintentar: () => void }) {
  return (
    <EmptyState
      title="No se pudo cargar"
      action={<Button variant="ink" onClick={reintentar}>Reintentar</Button>}
    />
  )
}

function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [dato, setDato] = useState<T | undefined>(undefined)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    setError(false)
    cargar()
      .then((d) => vigente && setDato(d))
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intento])
  return { dato, error, reintentar: () => setIntento((n) => n + 1) }
}

function Cupos({ jornada }: { jornada: Jornada }) {
  const libres = Math.max(jornada.cupos - jornada.ocupados, 0)
  return (
    <ProgressBar
      value={jornada.ocupados}
      max={jornada.cupos}
      label="Cupos"
      detail={libres === 0 ? 'Lleno' : `${libres} libres de ${jornada.cupos}`}
      tone="ink"
      size="sm"
    />
  )
}

function Lista() {
  const { dato: jornadas, error, reintentar } = useCarga(cargarJornadasPublicas, [])
  const [folios] = useState(leerFolios)

  return (
    <Pantalla>
      <div>
        <h1 className="page-title">Voluntariado</h1>
        <p className="page-lead">Dona tu tiempo: personas y empresas.</p>
      </div>

      {folios.length > 0 ? (
        <Card className="jor-item">
          <strong>Mis inscripciones</strong>
          <ul className="jor-list jor-list--tight">
            {folios.map((f, i) => (
              <li key={f}>
                <a className="section-link" href={paths.folio(f)}>Inscripción {folios.length - i}</a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {error ? (
        <Fallo reintentar={reintentar} />
      ) : jornadas === undefined ? (
        <Cargando />
      ) : jornadas.length === 0 ? (
        <EmptyState title="Aún no hay jornadas" description="Vuelve pronto: Coco te avisa aquí." />
      ) : (
        <ul className="jor-list">
          {jornadas.map((j) => (
            <li key={j.id}>
              <Card href={paths.jornada(j.id)} className="jor-item jor-item--media">
                <img className="jor-item__img" src="/coco/saludando.webp" alt="" width={72} height={72} loading="lazy" />
                <div className="jor-item__body">
                  <h2 className="jor-item__title">{j.titulo}</h2>
                  {j.es_ejemplo ? <SampleBadge /> : null}
                  <p className="jor-muted">
                    {j.organizacion?.nombre} · {formatoHorario(j.inicia_en, j.termina_en)}
                  </p>
                  <Cupos jornada={j} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Pantalla>
  )
}

function Detalle({ id }: { id: string }) {
  const { dato: jornada, error, reintentar } = useCarga(() => cargarJornada(id), [id])
  const [folio, setFolio] = useState<string | null>(null)

  if (error) return <Pantalla atras={paths.jornadas}><Fallo reintentar={reintentar} /></Pantalla>
  if (jornada === undefined) return <Pantalla atras={paths.jornadas}><Cargando /></Pantalla>
  if (jornada === null) {
    return (
      <Pantalla atras={paths.jornadas}>
        <EmptyState title="No encontramos esa jornada" action={<Button variant="ink" href={paths.jornadas}>Ver jornadas</Button>} />
      </Pantalla>
    )
  }

  const libres = Math.max(jornada.cupos - jornada.ocupados, 0)
  const empezo = yaEmpezo(jornada.inicia_en)

  return (
    <Pantalla atras={paths.jornadas}>
      {jornada.es_ejemplo ? <SampleBadge /> : null}
      <div>
        <p className="jor-muted">{jornada.organizacion?.nombre}</p>
        <h1 className="page-title">{jornada.titulo}</h1>
      </div>

      <Card className="jor-item">
        <p className="jor-fact"><strong>{formatoHorario(jornada.inicia_en, jornada.termina_en)}</strong></p>
        {jornada.ubicacion ? (
          <p className="jor-fact"><IconPin /> {jornada.ubicacion}</p>
        ) : null}
        <Cupos jornada={jornada} />
      </Card>

      {jornada.descripcion ? <p>{jornada.descripcion}</p> : null}
      {jornada.requisitos ? (
        <div className="jor-item">
          <h2 className="section-title">Requisitos</h2>
          <p>{jornada.requisitos}</p>
        </div>
      ) : null}

      {folio ? (
        <Card className="jor-done">
          <Coco variant="portrait" size={88} />
          <strong>¡Listo! Tu inscripción está en revisión.</strong>
          <p className="jor-muted">La fundación te escribirá al contacto que dejaste.</p>
          <Button variant="ink" block href={paths.folio(folio)}>Ver mi inscripción</Button>
        </Card>
      ) : empezo ? (
        <EmptyState title="Esta jornada ya empezó" />
      ) : libres === 0 ? (
        <EmptyState title="Jornada llena" description="Busca otra fecha en la lista." />
      ) : (
        <FormularioInscripcion
          jornadaId={jornada.id}
          libres={libres}
          onListo={(f) => {
            guardarFolio(f)
            setFolio(f)
          }}
          onCupo={reintentar}
        />
      )}
    </Pantalla>
  )
}

function FormularioInscripcion({
  jornadaId,
  libres,
  onListo,
  onCupo,
}: {
  jornadaId: string
  libres: number
  onListo: (folio: string) => void
  onCupo: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [asistentes, setAsistentes] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setFallo(null)
    setEnviando(true)
    try {
      onListo(await inscribirse({ jornadaId, nombre: nombre.trim(), contacto: contacto.trim(), asistentes }))
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo inscribir.')
      onCupo()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="jor-form" onSubmit={(e) => void enviar(e)}>
      <h2 className="section-title">Inscríbete</h2>
      <label className="jor-field">
        Nombre (persona o empresa)
        <input required maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="organization" />
      </label>
      <label className="jor-field">
        Correo o teléfono
        <input required minLength={3} maxLength={200} value={contacto} onChange={(e) => setContacto(e.target.value)} />
      </label>
      <label className="jor-field">
        Asistentes
        <input
          type="number"
          required
          min={1}
          max={Math.min(libres, 4)}
          value={asistentes}
          onChange={(e) => setAsistentes(Number(e.target.value))}
        />
      </label>
      <p className="jor-muted">Solo la fundación ve tu nombre y contacto.</p>
      {fallo ? <p className="jor-error" role="alert">{fallo}</p> : null}
      <Button type="submit" size="lg" block disabled={enviando}>
        {enviando ? 'Enviando…' : 'Inscribirme'}
      </Button>
    </form>
  )
}

const ESTADOS: Record<EstadoInscripcion, { texto: string; tono: 'lime' | 'surface' | 'outline' | 'yellow' }> = {
  pendiente: { texto: 'En revisión', tono: 'yellow' },
  confirmada: { texto: 'Aceptada', tono: 'lime' },
  rechazada: { texto: 'No aceptada', tono: 'outline' },
  asistio: { texto: 'Asististe', tono: 'lime' },
  no_asistio: { texto: 'Sin asistencia', tono: 'outline' },
}

export function EstadoChip({ estado, fundacion }: { estado: EstadoInscripcion; fundacion?: boolean }) {
  const e = ESTADOS[estado]
  return <Chip tone={e.tono}>{fundacion && estado === 'asistio' ? 'Asistió' : e.texto}</Chip>
}

function Folio({ id }: { id: string }) {
  const { dato, error, reintentar } = useCarga<ConsultaInscripcion | null>(() => consultarInscripcion(id), [id])

  if (error) return <Pantalla atras={paths.jornadas}><Fallo reintentar={reintentar} /></Pantalla>
  if (dato === undefined) return <Pantalla atras={paths.jornadas}><Cargando /></Pantalla>
  if (dato === null) {
    return (
      <Pantalla atras={paths.jornadas}>
        <EmptyState title="No encontramos esa inscripción" />
      </Pantalla>
    )
  }

  const { jornada, constancia } = dato
  return (
    <Pantalla atras={paths.jornadas}>
      <div className="jor-item__head">
        <div>
          <p className="jor-muted">{jornada.organizacion}</p>
          <h1 className="page-title">{jornada.titulo}</h1>
        </div>
        <EstadoChip estado={dato.estado} />
      </div>
      <p className="jor-muted">
        {formatoHorario(jornada.inicia_en, jornada.termina_en)} · {dato.asistentes}{' '}
        {dato.asistentes === 1 ? 'persona' : 'personas'}
      </p>

      {constancia ? (
        <article className="jor-constancia" aria-label="Constancia de voluntariado">
          <div className="jor-constancia__head">
            <Coco variant="portrait" size={64} />
            <div>
              <p className="jor-muted">Constancia de voluntariado</p>
              <h2 className="jor-constancia__name">{constancia.nombre}</h2>
            </div>
          </div>
          <p>
            Participó con {constancia.asistentes} {constancia.asistentes === 1 ? 'persona' : 'personas'} en
            “{jornada.titulo}”, de {jornada.organizacion}, durante {constancia.horas} h.
          </p>
          <p className="jor-fact"><IconCheck /> Asistencia confirmada por la fundación.</p>
          <p className="jor-muted">
            Folio {constancia.folio}. Sin valor de canje; no es recibo de donativo ni comprobante fiscal.
          </p>
          <Button variant="outline" block onClick={() => window.print()}>Imprimir o guardar</Button>
        </article>
      ) : (
        <Card className="jor-item">
          <p className="jor-muted">
            {dato.estado === 'rechazada' || dato.estado === 'no_asistio'
              ? 'Esta inscripción no tiene constancia.'
              : 'La constancia aparece aquí cuando la fundación confirma tu asistencia.'}
          </p>
        </Card>
      )}

      <p className="jor-muted">Guarda este enlace: es tu acceso a la inscripción.</p>
    </Pantalla>
  )
}
