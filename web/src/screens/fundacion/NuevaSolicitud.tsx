import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, FormModal } from '../../components/ui/FormModal'
import { describe } from '../../components/ui/describe'
import { Stepper } from '../../components/ui/Stepper'
import { paths } from '../../lib/router'
import { IMAGE_LIMIT } from '../organizacion/media'
import {
  cargarCatalogo,
  cargarMiOrganizacion,
  cargarTiendas,
  formatoPesos,
  publicarSolicitud,
} from './api'
import type { ArticuloCatalogo, MiOrganizacion, Tienda } from './api'

const MAX_UNIDADES = 999
const FORM_ID = 'fund-nueva-solicitud'

/**
 * Nueva solicitud en `FormModal` (D8). Mismos tres pasos, datos y llamada de T06;
 * solo cambia dónde se presenta. Se monta al abrir, así cada apertura empieza limpia.
 */
export function NuevaSolicitud({ organizacionId, onClose, onPublicada }: {
  organizacionId: string
  onClose: () => void
  onPublicada: () => void
}) {
  const [paso, setPaso] = useState(1)
  const [org, setOrg] = useState<MiOrganizacion | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[] | null>(null)
  const [tienda, setTienda] = useState<Tienda | null>(null)
  const [catalogo, setCatalogo] = useState<ArticuloCatalogo[] | null>(null)
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [imagen, setImagen] = useState<File | null>(null)
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const vistaPrevia = useMemo(() => (imagen ? URL.createObjectURL(imagen) : null), [imagen])
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia)
  }, [vistaPrevia])
  const [cargaFallida, setCargaFallida] = useState(false)
  const [intento, setIntento] = useState(0)
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
        setCargaFallida(false)
        if (t.length === 1) {
          setTienda(t[0])
          setPaso(2)
        }
      })
      .catch(() => vigente && setCargaFallida(true))
    return () => {
      vigente = false
    }
  }, [organizacionId, intento])

  useEffect(() => {
    if (!tienda) return
    let vigente = true
    cargarCatalogo(tienda.id)
      .then((c) => vigente && setCatalogo(c))
      .catch(() => vigente && setCargaFallida(true))
    return () => {
      vigente = false
    }
  }, [tienda, intento])

  const elegidos = useMemo(
    () => (catalogo ?? []).filter((a) => (cantidades[a.id] ?? 0) > 0),
    [catalogo, cantidades],
  )
  const unidades = elegidos.reduce((n, a) => n + cantidades[a.id], 0)
  const total = elegidos.reduce((n, a) => n + cantidades[a.id] * a.precio_centavos, 0)
  const puedePublicar = org ? org.verificada && !org.suspendida : false

  const elegirImagen = (file: File | undefined) => {
    if (!file) return
    if (file.size > IMAGE_LIMIT || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorImagen('Elige JPG, PNG o WebP de hasta 5 MB.')
      return
    }
    setErrorImagen(null)
    setImagen(file)
  }

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
        imagen,
      })
      setPublicadaId(id)
      onPublicada()
    } catch (e) {
      setErrorPublicar(e instanceof Error ? e.message : 'No se pudo publicar.')
    } finally {
      setPublicando(false)
    }
  }

  const bloqueada = cargaFallida || (org !== null && !puedePublicar)
  const comun = { open: true, onClose, title: 'Nueva solicitud', submitting: publicando }

  if (publicadaId) {
    return (
      <FormModal {...comun} submitLabel="" hideFooter>
        <div className="fund-done">
          <Coco size={120} />
          <h3 className="page-title">¡Publicada!</h3>
          <p className="page-lead">Ya aparece en el directorio. Te avisamos cuando lleguen donaciones.</p>
          <div className="stack">
            <Button size="lg" block href={paths.request(publicadaId)}>Ver solicitud</Button>
            <Button variant="ghost" block onClick={onClose}>Mis solicitudes</Button>
          </div>
        </div>
      </FormModal>
    )
  }

  if (bloqueada) {
    return (
      <FormModal {...comun} submitLabel="" hideFooter>
        {cargaFallida ? (
          <EmptyState
            title="No se pudo cargar el catálogo"
            action={<Button variant="ink" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>}
          />
        ) : (
          <EmptyState
            title={org?.suspendida ? 'Tu fundación está suspendida' : 'Verificación pendiente'}
            description="Podrás publicar cuando el equipo de Ágora la active."
            action={<Button variant="ink" onClick={onClose}>Mis solicitudes</Button>}
          />
        )}
      </FormModal>
    )
  }

  const atras = paso === 1 || (paso === 2 && tiendas?.length === 1) ? undefined : () => setPaso(paso - 1)
  const titulos = ['Elige la tienda', 'Elige artículos y cantidades', 'Revisa y publica']

  // Pie: el paso 1 avanza al tocar una tienda; el 2 continúa con el resumen; el 3 publica.
  const pie =
    paso === 2
      ? {
          submitLabel: unidades === 0 ? 'Elige artículos' : `Continuar · ${unidades} u · ${formatoPesos(total)}`,
          canSubmit: unidades > 0,
          onSubmit: () => setPaso(3),
        }
      : paso === 3
        ? { submitLabel: 'Publicar', submittingLabel: 'Publicando…', canSubmit: Boolean(titulo.trim()), formId: FORM_ID }
        : { submitLabel: 'Elige una tienda', canSubmit: false }

  return (
    <FormModal
      {...comun}
      {...pie}
      description={titulos[paso - 1]}
      dirty={unidades > 0}
      hideFooter={paso === 1}
    >
      <Stepper current={paso} total={3} title={tienda?.nombre ?? 'Tienda'} onBack={atras} />

      {paso === 1 ? (
        <fieldset className="fm-group">
          <legend>¿En qué tienda?</legend>
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
        </fieldset>
      ) : null}

      {paso === 2 ? (
        <fieldset className="fm-group">
          <legend>¿Qué necesitas?</legend>
          {catalogo === null ? (
            <CocoLoading title="Cargando catálogo…" size={88} />
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
        </fieldset>
      ) : null}

      {paso === 3 ? (
        <form
          id={FORM_ID}
          className="fm-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (titulo.trim()) void publicar()
          }}
        >
          <fieldset className="fm-group">
            <legend>Cuéntale a los donantes</legend>
            <Field id="fund-titulo" label="Título" hint="Corto y concreto. Ej. Pañales para noviembre">
              <input
                {...describe('fund-titulo', 'ayuda')}
                value={titulo}
                maxLength={200}
                required
                autoFocus
                onChange={(e) => setTitulo(e.target.value)}
              />
            </Field>
            <Field id="fund-descripcion" label="Para qué (opcional)">
              <textarea
                id="fund-descripcion"
                value={descripcion}
                rows={3}
                maxLength={1000}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Field>
            <Field
              id="fund-imagen"
              label="Imagen (opcional)"
              hint="JPG, PNG o WebP de hasta 5 MB. Quitamos metadatos y ubicación. Sin imagen usamos una ilustración."
              error={errorImagen}
            >
              <input
                {...describe('fund-imagen', 'ayuda', errorImagen)}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  elegirImagen(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Field>
            {vistaPrevia ? (
              <figure className="fund-photo">
                <img src={vistaPrevia} alt={`Vista previa de la imagen de ${titulo.trim() || 'la solicitud'}`} />
                <figcaption>
                  <span className="fund-muted">Así se recorta en la tarjeta</span>
                  <Button variant="ghost" onClick={() => setImagen(null)}>Quitar imagen</Button>
                </figcaption>
              </figure>
            ) : null}
          </fieldset>
          <fieldset className="fm-group">
            <legend>Resumen</legend>
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
            <p className="fm-hint">El precio queda fijo al publicar. Los donantes pagan directo a la tienda.</p>
          </fieldset>
          {errorPublicar ? (
            <p className="fm-alert" role="alert">
              {errorPublicar}
            </p>
          ) : null}
        </form>
      ) : null}
    </FormModal>
  )
}
