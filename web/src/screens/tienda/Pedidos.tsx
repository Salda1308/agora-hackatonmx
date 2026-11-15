import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconCheck } from '../../components/ui/icons'
import { categoryFor } from '../../features/requests/data'
import { requestVisual } from '../../lib/request-visuals'
import { formatoPesos } from '../fundacion/api'
import { Marco } from '../fundacion/Marco'
import { cargarMiTienda, cargarPedidos, marcarListo } from './api'
import type { MiTienda, Pedido } from './api'
import { Recogida } from './Recogida'

export function Pedidos({ tiendaId }: { tiendaId: string }) {
  const [tienda, setTienda] = useState<MiTienda | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [fallo, setFallo] = useState<{ id: string; texto: string } | null>(null)
  const [recien, setRecien] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    Promise.all([cargarMiTienda(tiendaId), cargarPedidos()])
      .then(([t, p]) => {
        if (!vigente) return
        setTienda(t)
        setPedidos(p)
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [tiendaId, intento])

  // Actualiza la lista cada 5 s para ver pedidos nuevos sin recargar; un fallo aquí no tapa la lista.
  useEffect(() => {
    let vigente = true
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      cargarPedidos()
        .then((p) => vigente && setPedidos(p))
        .catch(() => undefined)
    }, 5000)
    return () => {
      vigente = false
      window.clearInterval(id)
    }
  }, [tiendaId])

  const marcar = async (id: string) => {
    setFallo(null)
    setMarcando(id)
    try {
      await marcarListo(id)
      setRecien(id)
      // Recarga para traer la tarea de recogida que se acaba de crear.
      setIntento((n) => n + 1)
    } catch (e) {
      setFallo({ id, texto: e instanceof Error ? e.message : 'No se pudo marcar.' })
    } finally {
      setMarcando(null)
    }
  }

  const porPreparar = pedidos?.filter((p) => p.estado === 'preparando') ?? []
  const listos = pedidos?.filter((p) => p.estado !== 'preparando') ?? []

  return (
    <Marco>
      <div>
        <h1 className="page-title">Pedidos</h1>
        {tienda ? <p className="page-lead">{tienda.nombre}</p> : null}
      </div>

      {tienda?.suspendida ? (
        <Card tone="yellow">
          <strong>Tu tienda está suspendida</strong>
          <p className="tda-muted">No recibirás pedidos nuevos hasta que el equipo de Ágora la reactive.</p>
        </Card>
      ) : null}

      {error ? (
        <EmptyState title="No se pudieron cargar"
          action={<Button variant="ink" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>} />
      ) : pedidos === null ? (
        <CocoLoading title="Cargando pedidos…" size={88} />
      ) : pedidos.length === 0 ? (
        <div className="tda-empty">
          <EmptyState pose="caja-suministros" title="Sin pedidos por ahora" description="Cuando alguien pague, el pedido aparece aquí." />
        </div>
      ) : (
        <>
          <section className="stack" aria-labelledby="tda-preparar">
            <h2 id="tda-preparar" className="tda-section">Por preparar · {porPreparar.length}</h2>
            {porPreparar.length === 0 ? <p className="tda-muted">Todo listo. ¡Bien!</p> : (
              <ul className="stack tda-list">
                {porPreparar.map((p) => (
                  <li key={p.id}>
                    <Card className="tda-item">
                      <TarjetaPedido pedido={p} />
                      <Button size="lg" block icon={<IconCheck />} disabled={marcando !== null}
                        onClick={() => void marcar(p.id)}>
                        {marcando === p.id ? 'Marcando…' : 'Marcar listo'}
                      </Button>
                      {fallo?.id === p.id ? <p className="tda-error" role="alert">{fallo.texto}</p> : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {listos.length > 0 ? (
            <section className="stack" aria-labelledby="tda-listos">
              <h2 id="tda-listos" className="tda-section">Listos · {listos.length}</h2>
              <ul className="stack tda-list">
                {listos.map((p) => (
                  <li key={p.id}>
                    <Card tone={recien === p.id ? 'lime' : 'surface'} className="tda-item">
                      <TarjetaPedido pedido={p} />
                      <Recogida key={p.tarea_estado ?? 'sin-tarea'} pedido={p}
                        onConfirmada={() => setIntento((n) => n + 1)} />
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <Button variant="ghost" onClick={() => setIntento((n) => n + 1)}>Actualizar</Button>
    </Marco>
  )
}

const ESTADO: Record<Pedido['estado'], string> = {
  preparando: 'Pagado', listo: 'Listo', recogido: 'Recogido', entregado: 'Entregado',
}

function TarjetaPedido({ pedido }: { pedido: Pedido }) {
  return (
    <>
      <div className="tda-item__head">
        <img className="tda-item__img" src={requestVisual(categoryFor(pedido.articulos.map((a) => a.nombre).join(' ')))}
          alt="" width={56} height={56} loading="lazy" />
        <div className="tda-item__copy">
          <h3 className="tda-item__title">{pedido.organizacion_nombre}</h3>
          <span className="tda-muted">{pedido.solicitud_titulo}</span>
        </div>
        <Chip tone={pedido.estado === 'preparando' ? 'lime' : 'surface'}>{ESTADO[pedido.estado]}</Chip>
      </div>
      <ul className="tda-lines">
        {pedido.articulos.map((a) => (
          <li key={a.nombre}><span><strong>{a.unidades} ×</strong> {a.nombre}</span></li>
        ))}
        <li className="tda-lines__total"><span>Total pagado</span><span>{formatoPesos(pedido.total_centavos)}</span></li>
      </ul>
    </>
  )
}
