import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
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

      <NuevoArticulo tiendaId={tiendaId} onListo={listo} />

      {error ? (
        <EmptyState title="No se pudo cargar" action={<Button variant="ink" onClick={recargar}>Reintentar</Button>} />
      ) : articulos === null ? (
        <p className="tda-muted" role="status">Cargando…</p>
      ) : articulos.length === 0 ? (
        <EmptyState title="Tu catálogo está vacío" description="Agrega artículos uno por uno o sube un CSV." />
      ) : (
        <ul className="stack tda-list">
          {articulos.map((a) => <li key={a.id}><FilaArticulo articulo={a} onListo={listo} /></li>)}
        </ul>
      )}

      <ImportarCsv tiendaId={tiendaId} existentes={articulos ?? []} onListo={listo} />
    </Marco>
  )
}

function NuevoArticulo({ tiendaId, onListo }: { tiendaId: string; onListo: (t: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState('pieza')
  const [precio, setPrecio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  if (!abierto) {
    return <Button size="lg" block icon={<IconPlus />} onClick={() => setAbierto(true)}>Agregar artículo</Button>
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const centavos = precioACentavos(precio)
    if (!nombre.trim() || centavos === null) {
      setFallo('Escribe un nombre y un precio válido.')
      return
    }
    setGuardando(true)
    setFallo(null)
    try {
      await agregarArticulos(tiendaId, [{ nombre: nombre.trim(), unidad: unidad.trim() || 'pieza', precio_centavos: centavos }])
      setNombre('')
      setPrecio('')
      setAbierto(false)
      onListo('Artículo agregado.')
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card>
      <form className="stack" onSubmit={(e) => void enviar(e)}>
        <label className="tda-field">Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} required autoFocus />
        </label>
        <div className="tda-row">
          <label className="tda-field">Precio ($)
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" placeholder="0.00" required />
          </label>
          <label className="tda-field">Unidad
            <input value={unidad} onChange={(e) => setUnidad(e.target.value)} maxLength={40} />
          </label>
        </div>
        {fallo ? <p className="tda-error" role="alert">{fallo}</p> : null}
        <div className="wrap-row">
          <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
        </div>
      </form>
    </Card>
  )
}

function FilaArticulo({ articulo, onListo }: { articulo: Articulo; onListo: (t: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [precio, setPrecio] = useState((articulo.precio_centavos / 100).toFixed(2))
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const guardar = async (cambios: Parameters<typeof actualizarArticulo>[1], texto: string) => {
    setGuardando(true)
    setFallo(null)
    try {
      await actualizarArticulo(articulo.id, cambios)
      setEditando(false)
      onListo(texto)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const enviarPrecio = (e: FormEvent) => {
    e.preventDefault()
    const centavos = precioACentavos(precio)
    if (centavos === null) {
      setFallo('Precio inválido.')
      return
    }
    void guardar({ precio_centavos: centavos }, `Nuevo precio de ${articulo.nombre}.`)
  }

  return (
    <div className={`tda-article${articulo.activo ? '' : ' tda-article--off'}`}>
      <div className="tda-article__head">
        <div className="tda-item__copy">
          <span className="tda-article__name">{articulo.nombre}</span>
          <span className="tda-muted">{formatoPesos(articulo.precio_centavos)} / {articulo.unidad}{articulo.activo ? '' : ' · oculto'}</span>
        </div>
      </div>
      {editando ? (
        <form className="tda-row" onSubmit={enviarPrecio}>
          <label className="tda-field">Precio ($)
            <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" autoFocus />
          </label>
          <div className="wrap-row tda-row__end">
            <Button type="submit" disabled={guardando}>Guardar</Button>
            <Button type="button" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <div className="wrap-row">
          <Button variant="outline" onClick={() => setEditando(true)}>Cambiar precio</Button>
          <Button variant="ghost" disabled={guardando}
            onClick={() => void guardar({ activo: !articulo.activo },
              articulo.activo ? `${articulo.nombre} ya no se puede pedir.` : `${articulo.nombre} vuelve al catálogo.`)}>
            {articulo.activo ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>
      )}
      {fallo ? <p className="tda-error" role="alert">{fallo}</p> : null}
    </div>
  )
}

function ImportarCsv({ tiendaId, existentes, onListo }: {
  tiendaId: string
  existentes: Articulo[]
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
    if (!csv) return
    setImportando(true)
    setFallo(null)
    try {
      const r = await importarCatalogo(tiendaId, csv.filas, existentes)
      setCsv(null)
      onListo(`CSV importado: ${r.nuevos} nuevos, ${r.actualizados} actualizados.`)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo importar.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <Card className="stack">
      <strong>Subir CSV</strong>
      <p className="tda-muted">Columnas: nombre, precio, unidad. Si el nombre ya existe, se actualiza.</p>
      <label className="tda-file">
        <input type="file" accept=".csv,text/csv" onChange={(e) => void leer(e.target.files?.[0])} />
      </label>
      {csv ? (
        <>
          <p>{csv.filas.length} artículos listos{csv.errores.length ? ` · ${csv.errores.length} con error` : ''}</p>
          {csv.errores.length ? (
            <ul className="tda-errors">{csv.errores.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>
          ) : null}
          <Button block disabled={importando || csv.filas.length === 0} onClick={() => void importar()}>
            {importando ? 'Importando…' : `Importar ${csv.filas.length}`}
          </Button>
        </>
      ) : null}
      {fallo ? <p className="tda-error" role="alert">{fallo}</p> : null}
    </Card>
  )
}
