import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconCheck } from '../../components/ui/icons'
import { formatoPesos } from '../fundacion/api'
import { Marco } from '../fundacion/Marco'
import { cargarMiTienda, cargarPedidos, marcarListo } from './api'
import type { MiTienda, Pedido } from './api'

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

  const marcar = async (id: string) => {
    setFallo(null)
    setMarcando(id)
    try {
      const codigo = await marcarListo(id)
      setPedidos((prev) => prev?.map((p) => (p.id === id
        ? { ...p, estado: 'listo', codigo_recogida: codigo, listo_en: new Date().toISOString() } : p)) ?? null)
      setRecien(id)
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
                      {p.codigo_recogida ? (
                        <div className="tda-code" role={recien === p.id ? 'status' : undefined}>
                          <span className="tda-muted">Código de recogida</span>
                          <strong className="tda-code__value">{p.codigo_recogida}</strong>
                          <span className="tda-muted">Pídelo al voluntario al entregar.</span>
                        </div>
                      ) : null}
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
