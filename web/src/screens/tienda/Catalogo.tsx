import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilePicker } from '../../components/ui/FilePicker'
import { Field, FormModal } from '../../components/ui/FormModal'
import { describe } from '../../components/ui/describe'
import { IconPlus } from '../../components/ui/icons'
import { formatoPesos } from '../fundacion/api'
import { Marco } from '../fundacion/Marco'
import { actualizarArticulo, agregarArticulos, cargarCatalogo, importarCatalogo } from './api'
import type { Articulo } from './api'
import { leerCsv, precioACentavos } from './csv'
import type { ResultadoCsv } from './csv'

export function Catalogo({ tiendaId }: { tiendaId: string }) {
  const [articulos, setArticulos] = useState<Articulo[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [modal, setModal] = useState<'nuevo' | 'csv' | null>(null)
  const recargar = () => setIntento((n) => n + 1)

  useEffect(() => {
    let vigente = true
    cargarCatalogo(tiendaId)
      .then((a) => {
        if (!vigente) return
        setArticulos(a)
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [tiendaId, intento])

  const listo = (texto: string) => {
    setAviso(texto)
    recargar()
  }

  return (
    <Marco>
      <div>
        <h1 className="page-title">Catálogo</h1>
        <p className="page-lead">Las solicitudes ya publicadas conservan su precio.</p>
      </div>

      {aviso ? <p className="tda-ok" role="status">{aviso}</p> : null}

      <div className="tda-actions">
        <Button size="lg" icon={<IconPlus />} onClick={() => setModal('nuevo')}>Agregar artículo</Button>
        <Button size="lg" variant="outline" onClick={() => setModal('csv')}>Subir CSV</Button>
      </div>

      {error ? (
        <EmptyState title="No se pudo cargar" action={<Button variant="ink" onClick={recargar}>Reintentar</Button>} />
      ) : articulos === null ? (
        <CocoLoading title="Cargando catálogo…" size={88} />
      ) : articulos.length === 0 ? (
        <EmptyState
          pose="caja-suministros"
          title="Tu catálogo está vacío"
          description="Agrega artículos uno por uno o sube un CSV."
          action={<Button icon={<IconPlus />} onClick={() => setModal('nuevo')}>Agregar artículo</Button>}
        />
      ) : (
        <ul className="stack tda-list">
          {articulos.map((a) => <li key={a.id}><FilaArticulo articulo={a} onListo={listo} /></li>)}
        </ul>
      )}

      {modal === 'nuevo' ? (
        <NuevoArticulo tiendaId={tiendaId} onClose={() => setModal(null)} onListo={(t) => { setModal(null); listo(t) }} />
      ) : null}
      {modal === 'csv' ? (
        <ImportarCsv
          tiendaId={tiendaId}
          existentes={articulos ?? []}
          onClose={() => setModal(null)}
          onListo={(t) => { setModal(null); listo(t) }}
        />
      ) : null}
    </Marco>
  )
}

/** Agregar artículo en `FormModal` (D8): misma validación y llamada de T21. */
function NuevoArticulo({ tiendaId, onClose, onListo }: {
  tiendaId: string
  onClose: () => void
  onListo: (t: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState('pieza')
  const [precio, setPrecio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [errorPrecio, setErrorPrecio] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando) return
    const centavos = precioACentavos(precio)
    setErrorNombre(nombre.trim() ? null : 'Escribe un nombre.')
    setErrorPrecio(centavos === null ? 'Escribe un precio válido, por ejemplo 25.50.' : null)
    if (!nombre.trim() || centavos === null) return
    setGuardando(true)
    setFallo(null)
    try {
      await agregarArticulos(tiendaId, [{ nombre: nombre.trim(), unidad: unidad.trim() || 'pieza', precio_centavos: centavos }])
      onListo('Artículo agregado.')
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <FormModal open onClose={onClose} title="Agregar artículo" description="Las fundaciones lo verán al armar sus solicitudes."
      submitLabel="Guardar artículo" submitting={guardando} formId="tda-nuevo">
      <form id="tda-nuevo" className="fm-form" noValidate onSubmit={(e) => void enviar(e)}>
        <fieldset className="fm-group">
          <legend>Artículo</legend>
          <Field id="tda-nombre" label="Nombre" error={errorNombre}>
            <input {...describe('tda-nombre', undefined, errorNombre)} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} required autoFocus />
          </Field>
          <div className="fm-row">
            <Field id="tda-precio" label="Precio ($)" hint="Con centavos: 25.50" error={errorPrecio}>
              <input {...describe('tda-precio', 'ayuda', errorPrecio)} value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="0.00" required />
            </Field>
            <Field id="tda-unidad" label="Unidad" hint="pieza, paquete, litro">
              <input {...describe('tda-unidad', 'ayuda')} value={unidad} onChange={(e) => setUnidad(e.target.value)} maxLength={40} />
            </Field>
          </div>
        </fieldset>
        {fallo ? <p className="fm-alert" role="alert">{fallo}</p> : null}
      </form>
    </FormModal>
  )
}

function FilaArticulo({ articulo, onListo }: { articulo: Articulo; onListo: (t: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const alternar = async () => {
    setGuardando(true)
    setFallo(null)
    try {
      await actualizarArticulo(articulo.id, { activo: !articulo.activo })
      onListo(articulo.activo ? `${articulo.nombre} ya no se puede pedir.` : `${articulo.nombre} vuelve al catálogo.`)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`tda-article${articulo.activo ? '' : ' tda-article--off'}`}>
      <div className="tda-article__head">
        <div className="tda-item__copy">
          <span className="tda-article__name">{articulo.nombre}</span>
          <span className="tda-muted">{formatoPesos(articulo.precio_centavos)} / {articulo.unidad}</span>
        </div>
        <Chip tone={articulo.activo ? 'lime' : 'outline'}>{articulo.activo ? 'Visible' : 'Oculto'}</Chip>
      </div>
      <div className="wrap-row">
        <Button variant="outline" onClick={() => setEditando(true)}>Cambiar precio</Button>
        <Button variant="ghost" disabled={guardando} onClick={() => void alternar()}>
          {articulo.activo ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>
      {fallo ? <p className="tda-error" role="alert">{fallo}</p> : null}
      {editando ? (
        <CambiarPrecio articulo={articulo} onClose={() => setEditando(false)}
          onListo={(t) => { setEditando(false); onListo(t) }} />
      ) : null}
    </div>
  )
}

/** Cambiar precio en `FormModal` (D8). */
function CambiarPrecio({ articulo, onClose, onListo }: {
  articulo: Articulo
  onClose: () => void
  onListo: (t: string) => void
}) {
  const [precio, setPrecio] = useState((articulo.precio_centavos / 100).toFixed(2))
  const [guardando, setGuardando] = useState(false)
  const [errorPrecio, setErrorPrecio] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando) return
    const centavos = precioACentavos(precio)
    if (centavos === null) {
      setErrorPrecio('Precio inválido.')
      return
    }
    setErrorPrecio(null)
    setGuardando(true)
    setFallo(null)
    try {
      await actualizarArticulo(articulo.id, { precio_centavos: centavos })
      onListo(`Nuevo precio de ${articulo.nombre}.`)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  return (
    <FormModal open onClose={onClose} title="Cambiar precio" description={`${articulo.nombre} · por ${articulo.unidad}`}
      submitLabel="Guardar precio" submitting={guardando} formId="tda-precio-form">
      <form id="tda-precio-form" className="fm-form" noValidate onSubmit={(e) => void enviar(e)}>
        <Field id="tda-precio-nuevo" label="Precio ($)" hint="Las solicitudes ya publicadas conservan su precio." error={errorPrecio}>
          <input {...describe('tda-precio-nuevo', 'ayuda', errorPrecio)} value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" autoFocus />
        </Field>
        {fallo ? <p className="fm-alert" role="alert">{fallo}</p> : null}
      </form>
    </FormModal>
  )
}

/** Importar CSV en `FormModal` (D8): misma lectura y llamada de T21. */
function ImportarCsv({ tiendaId, existentes, onClose, onListo }: {
  tiendaId: string
  existentes: Articulo[]
  onClose: () => void
  onListo: (t: string) => void
}) {
  const [csv, setCsv] = useState<ResultadoCsv | null>(null)
  const [importando, setImportando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const leer = async (archivo: File | undefined) => {
    setFallo(null)
    setCsv(archivo ? leerCsv(await archivo.text()) : null)
  }

  const importar = async () => {
    if (!csv || importando) return
    setImportando(true)
    setFallo(null)
    try {
      const r = await importarCatalogo(tiendaId, csv.filas, existentes)
      onListo(`CSV importado: ${r.nuevos} nuevos, ${r.actualizados} actualizados.`)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo importar.')
      setImportando(false)
    }
  }

  const csvAria = describe('tda-csv', 'ayuda', csv && csv.errores.length ? 'x' : null)

  return (
    <FormModal open onClose={onClose} title="Subir CSV" description="Columnas: nombre, precio, unidad. Si el nombre ya existe, se actualiza."
      submitLabel={csv ? `Importar ${csv.filas.length}` : 'Elige un archivo'} submittingLabel="Importando…"
      submitting={importando} canSubmit={Boolean(csv && csv.filas.length > 0)} onSubmit={() => void importar()}>
      <Field id="tda-csv" label="Archivo CSV" hint="Ejemplo: Arroz 1 kg, 32.50, paquete"
        error={csv && csv.errores.length ? `${csv.errores.length} filas con error; no se importan.` : null}>
        <FilePicker id="tda-csv" describedBy={csvAria['aria-describedby']} invalid={csvAria['aria-invalid']}
          accept=".csv,text/csv" buttonLabel="Elegir CSV" onFile={(archivo) => void leer(archivo)} />
      </Field>
      {csv ? (
        <div className="stack">
          <p><strong>{csv.filas.length}</strong> artículos listos para importar.</p>
          {csv.errores.length ? (
            <ul className="tda-errors">{csv.errores.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
      {fallo ? <p className="fm-alert" role="alert">{fallo}</p> : null}
    </FormModal>
  )
}
