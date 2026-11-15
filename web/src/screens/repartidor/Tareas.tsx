import { useEffect, useState } from 'react'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip, SampleBadge } from '../../components/ui/Chip'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconCheck, IconPin } from '../../components/ui/icons'
import { categoryFor } from '../../features/requests/data'
import { requestVisual } from '../../lib/request-visuals'
import { formatoPesos } from '../fundacion/api'
import { Marco } from '../fundacion/Marco'
import { cargarDisponibles, cargarMiTarea, cargarNivel, liberarTarea, tomarTarea } from './api'
import type { ArticuloTarea, MiTarea, Nivel, TareaDisponible } from './api'
import { PasosEntrega } from './Entrega'

interface Datos {
  activa: MiTarea | null
  disponibles: TareaDisponible[]
  nivel: Nivel
}

export function Tareas() {
  const { profile } = useSession()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([cargarMiTarea(), cargarDisponibles(), cargarNivel()])
      .then(([activa, disponibles, nivel]) => {
        if (!vigente) return
        setDatos({ activa, disponibles, nivel })
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [intento])

  const recargar = () => setIntento((n) => n + 1)

  const tomar = async (id: string) => {
    setAviso(null)
    setOcupado(id)
    try {
      await tomarTarea(id)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo tomar.')
    } finally {
      setOcupado(null)
      recargar()
    }
  }

  const liberar = async (id: string) => {
    setAviso(null)
    setOcupado(id)
    try {
      await liberarTarea(id)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo liberar.')
    } finally {
      setOcupado(null)
      recargar()
    }
  }

  return (
    <Marco>
      <SampleBadge />
      <div>
        <h1 className="page-title">{datos?.activa ? 'Tu tarea' : 'Tareas'}</h1>
        {profile?.nombre_visible ? <p className="page-lead">{profile.nombre_visible}</p> : null}
      </div>

      {aviso ? <p className="rep-error" role="alert">{aviso}</p> : null}

      {error ? (
        <EmptyState title="No se pudieron cargar"
          action={<Button variant="ink" onClick={recargar}>Reintentar</Button>} />
      ) : datos === null ? (
        <CocoLoading title="Cargando entregas…" size={88} />
      ) : datos.activa ? (
        <TareaActiva tarea={datos.activa} ocupado={ocupado !== null} onLiberar={() => void liberar(datos.activa!.id)}
          onCambio={recargar} />
      ) : (
        <>
          {datos.nivel.limite_centavos !== null ? (
            <Card className="rep-nivel">
              <Coco size={56} variant="portrait" />
              <div className="rep-nivel__copy">
                <Chip tone="yellow">Voluntario nuevo</Chip>
                <p>Pedidos de hasta {formatoPesos(datos.nivel.limite_centavos)}. Con 3 entregas
                  ves todos.</p>
              </div>
            </Card>
          ) : null}

          {datos.disponibles.length === 0 ? (
            <EmptyState pose="volando-garrafon" title="Sin tareas por ahora"
              description="Cuando una tienda tenga un pedido listo, aparece aquí."
              action={<Button variant="ink" onClick={recargar}>Buscar de nuevo</Button>} />
          ) : (
            <ul className="rep-list">
              {datos.disponibles.map((t) => (
                <li key={t.id}>
                  <Card className="rep-stack">
                    <div className="rep-head">
                      <img className="rep-img" src={requestVisual(categoryFor(t.articulos.map((a) => a.nombre).join(' ')))}
                        alt="" width={56} height={56} loading="lazy" />
                      <div className="rep-copy">
                        <h2 className="rep-title">{t.tienda_nombre}</h2>
                        <span className="rep-muted">Para {t.destino_nombre}</span>
                      </div>
                      <Chip tone="lime">{formatoPesos(t.total_centavos)}</Chip>
                    </div>
                    {t.tienda_direccion ? (
                      <p className="rep-place"><IconPin /> {t.tienda_direccion}</p>
                    ) : null}
                    <Articulos articulos={t.articulos} />
                    <Button size="lg" block icon={<IconCheck />} disabled={ocupado !== null}
                      onClick={() => void tomar(t.id)}>
                      {ocupado === t.id ? 'Tomando…' : 'Tomar tarea'}
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Button variant="ghost" onClick={recargar}>Actualizar</Button>
    </Marco>
  )
}

function TareaActiva({ tarea, ocupado, onLiberar, onCambio }: {
  tarea: MiTarea; ocupado: boolean; onLiberar: () => void; onCambio: () => void
}) {
  const mapa = tarea.tienda_latitud !== null && tarea.tienda_longitud !== null
    ? `https://www.openstreetmap.org/?mlat=${tarea.tienda_latitud}&mlon=${tarea.tienda_longitud}#map=17/${tarea.tienda_latitud}/${tarea.tienda_longitud}`
    : null
  return (
    <Card tone="lime" className="rep-stack">
      <div className="rep-head">
        <div className="rep-copy">
          <span className="rep-muted">{tarea.estado === 'asignada' ? 'Recoge en' : 'Recogido en'}</span>
          <h2 className="rep-title">{tarea.tienda_nombre}</h2>
        </div>
        <Chip>{tarea.estado === 'asignada' ? 'Por recoger' : 'Recogida'}</Chip>
      </div>
      {tarea.tienda_direccion ? <p className="rep-place"><IconPin /> {tarea.tienda_direccion}</p> : null}
      {mapa ? <Button variant="outline" block href={mapa} target="_blank" rel="noreferrer">Ver en el mapa</Button> : null}

      {/* Ya recogida, el código de recogida no sirve y competiría con el de entrega. */}
      {tarea.estado === 'asignada' && tarea.codigo_recogida ? (
        <div className="rep-code">
          <span className="rep-muted">Código de recogida</span>
          <strong className="rep-code__value">{tarea.codigo_recogida}</strong>
          <span className="rep-muted">Muéstralo en la tienda para que lo confirmen.</span>
        </div>
      ) : null}

      <Articulos articulos={tarea.articulos} />
      <p className="rep-muted">Entrega a <strong>{tarea.destino_nombre}</strong> · {formatoPesos(tarea.total_centavos)}</p>
      <PasosEntrega tarea={tarea} onCambio={onCambio} />

      {tarea.estado === 'asignada' ? (
        <Button variant="ghost" block disabled={ocupado} onClick={onLiberar}>
          {ocupado ? 'Liberando…' : 'Liberar tarea'}
        </Button>
      ) : null}
    </Card>
  )
}

function Articulos({ articulos }: { articulos: ArticuloTarea[] }) {
  return (
    <ul className="rep-lines">
      {articulos.map((a) => (
        <li key={a.nombre}><strong>{a.unidades} ×</strong> {a.nombre}</li>
      ))}
    </ul>
  )
}
