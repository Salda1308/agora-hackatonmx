import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { Stepper } from '../../components/ui/Stepper'
import { paths } from '../../lib/router'
import {
  cargarCatalogo,
  cargarMiOrganizacion,
  cargarTiendas,
  formatoPesos,
  publicarSolicitud,
} from './api'
import type { ArticuloCatalogo, MiOrganizacion, Tienda } from './api'
import { Marco } from './Marco'

const MAX_UNIDADES = 999

export function NuevaSolicitud({ organizacionId }: { organizacionId: string }) {
  const [paso, setPaso] = useState(1)
  const [org, setOrg] = useState<MiOrganizacion | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[] | null>(null)
  const [tienda, setTienda] = useState<Tienda | null>(null)
  const [catalogo, setCatalogo] = useState<ArticuloCatalogo[] | null>(null)
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cargaFallida, setCargaFallida] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [errorPublicar, setErrorPublicar] = useState<string | null>(null)
  const [publicadaId, setPublicadaId] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([cargarMiOrganizacion(organizacionId), cargarTiendas()])
      .then(([o, t]) => {
        if (!vigente) return
        setOrg(o)
        setTiendas(t)
        if (t.length === 1) {
          setTienda(t[0])
          setPaso(2)
        }
      })
      .catch(() => vigente && setCargaFallida(true))
    return () => {
      vigente = false
    }
  }, [organizacionId])

  useEffect(() => {
    if (!tienda) return
    let vigente = true
    cargarCatalogo(tienda.id)
      .then((c) => vigente && setCatalogo(c))
      .catch(() => vigente && setCargaFallida(true))
    return () => {
      vigente = false
    }
  }, [tienda])

  const elegidos = useMemo(
    () => (catalogo ?? []).filter((a) => (cantidades[a.id] ?? 0) > 0),
    [catalogo, cantidades],
  )
  const unidades = elegidos.reduce((n, a) => n + cantidades[a.id], 0)
  const total = elegidos.reduce((n, a) => n + cantidades[a.id] * a.precio_centavos, 0)
  const puedePublicar = org ? org.verificada && !org.suspendida : false

  const cambiar = (id: string, delta: number) =>
    setCantidades((prev) => ({
      ...prev,
      [id]: Math.min(MAX_UNIDADES, Math.max(0, (prev[id] ?? 0) + delta)),
    }))

  const elegirTienda = (t: Tienda) => {
    if (tienda?.id !== t.id) {
      setCantidades({})
      setCatalogo(null)
    }
    setTienda(t)
    setPaso(2)
  }

  const publicar = async () => {
    if (!tienda || publicando) return
    setPublicando(true)
    setErrorPublicar(null)
    try {
      const id = await publicarSolicitud({
        tiendaId: tienda.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        articulos: elegidos.map((a) => ({ articulo_id: a.id, cantidad: cantidades[a.id] })),
      })
      setPublicadaId(id)
    } catch (e) {
      setErrorPublicar(e instanceof Error ? e.message : 'No se pudo publicar.')
    } finally {
      setPublicando(false)
    }
  }

  if (publicadaId) {
    return (
      <Marco>
        <div className="fund-done">
          <Coco size={140} />
          <h1 className="page-title">¡Publicada!</h1>
          <p className="page-lead">Ya aparece en el directorio. Te avisamos cuando lleguen donaciones.</p>
          <div className="stack">
            <Button size="lg" block href={paths.request(publicadaId)}>Ver solicitud</Button>
            <Button variant="ghost" block href={paths.fundacion}>Mis solicitudes</Button>
          </div>
        </div>
      </Marco>
    )
  }

  if (cargaFallida) {
    return (
      <Marco>
        <EmptyState
          title="No se pudo cargar el catálogo"
          action={<Button variant="ink" onClick={() => window.location.reload()}>Reintentar</Button>}
        />
      </Marco>
    )
  }

  if (org && !puedePublicar) {
    return (
      <Marco>
        <EmptyState
          title={org.suspendida ? 'Tu fundación está suspendida' : 'Verificación pendiente'}
          description="Podrás publicar cuando el equipo de Ágora la active."
          action={<Button variant="ink" href={paths.fundacion}>Mis solicitudes</Button>}
        />
      </Marco>
    )
  }

  const atras = () => {
    if (paso === 1 || (paso === 2 && tiendas?.length === 1)) window.location.hash = paths.fundacion
    else setPaso(paso - 1)
  }

  return (
    <Marco>
      <Stepper
        current={paso}
        total={3}
        title={paso === 1 ? 'Tienda' : paso === 2 ? 'Artículos' : 'Publicar'}
        onBack={atras}
      />

      {paso === 1 ? (
        <section className="stack" aria-labelledby="fund-paso-tienda">
          <h1 id="fund-paso-tienda" className="page-title">¿En qué tienda?</h1>
          {tiendas === null ? (
            <CocoLoading title="Cargando tiendas…" size={88} />
          ) : tiendas.length === 0 ? (
            <EmptyState title="Sin tiendas por ahora" description="Aún no hay tiendas verificadas." />
          ) : (
            tiendas.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`fund-option${tienda?.id === t.id ? ' fund-option--selected' : ''}`}
                onClick={() => elegirTienda(t)}
              >
                {t.nombre}
              </button>
            ))
          )}
        </section>
      ) : null}

      {paso === 2 ? (
        <section className="stack" aria-labelledby="fund-paso-articulos">
          <div>
            <h1 id="fund-paso-articulos" className="page-title">¿Qué necesitas?</h1>
            <p className="page-lead">{tienda?.nombre}</p>
          </div>
          {catalogo === null ? (
            <CocoLoading title="Cargando tiendas…" size={88} />
          ) : catalogo.length === 0 ? (
            <EmptyState title="Catálogo vacío" description="Esta tienda aún no tiene artículos." />
          ) : (
            <ul className="stack fund-list">
              {catalogo.map((a) => {
                const n = cantidades[a.id] ?? 0
                return (
                  <li key={a.id} className={`fund-article${n > 0 ? ' fund-article--selected' : ''}`}>
                    <div className="fund-article__copy">
                      <span className="fund-article__name">{a.nombre}</span>
                      <span className="fund-muted">
                        {formatoPesos(a.precio_centavos)} / {a.unidad}
                      </span>
                    </div>
                    <div className="fund-qty" role="group" aria-label={`Cantidad de ${a.nombre}`}>
                      <button
                        type="button"
                        className="ui-icon-button fund-qty__btn"
                        onClick={() => cambiar(a.id, -1)}
                        disabled={n === 0}
                        aria-label={`Quitar una unidad de ${a.nombre}`}
                      >
                        −
                      </button>
                      <span className="fund-qty__value" aria-live="polite">{n}</span>
                      <button
                        type="button"
                        className="ui-icon-button fund-qty__btn"
                        onClick={() => cambiar(a.id, 1)}
                        disabled={n >= MAX_UNIDADES}
                        aria-label={`Agregar una unidad de ${a.nombre}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="fund-footer">
            <Button size="lg" block disabled={unidades === 0} onClick={() => setPaso(3)}>
              {unidades === 0 ? 'Elige artículos' : `Continuar · ${unidades} u · ${formatoPesos(total)}`}
            </Button>
          </div>
        </section>
      ) : null}

      {paso === 3 ? (
        <section className="stack" aria-labelledby="fund-paso-publicar">
          <h1 id="fund-paso-publicar" className="page-title">Revisa y publica</h1>
          <label className="fund-field">
            <span>Título</span>
            <input
              value={titulo}
              maxLength={200}
              placeholder="Ej. Pañales para noviembre"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
          <label className="fund-field">
            <span>Para qué (opcional)</span>
            <textarea value={descripcion} rows={3} maxLength={1000} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
          <Card>
            <ul className="fund-summary">
              {elegidos.map((a) => (
                <li key={a.id}>
                  <span>
                    {cantidades[a.id]} × {a.nombre}
                  </span>
                  <span>{formatoPesos(cantidades[a.id] * a.precio_centavos)}</span>
                </li>
              ))}
              <li className="fund-summary__total">
                <span>Total · {tienda?.nombre}</span>
                <span>{formatoPesos(total)}</span>
              </li>
            </ul>
          </Card>
          <p className="fund-muted">El precio queda fijo al publicar. Los donantes pagan directo a la tienda.</p>
          {errorPublicar ? (
            <p className="fund-error" role="alert">
              {errorPublicar}
            </p>
          ) : null}
          <div className="fund-footer">
            <Button size="lg" block disabled={!titulo.trim() || publicando} onClick={() => void publicar()}>
              {publicando ? 'Publicando…' : 'Publicar'}
            </Button>
          </div>
        </section>
      ) : null}
    </Marco>
  )
}
