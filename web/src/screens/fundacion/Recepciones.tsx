import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { IconCheck } from '../../components/ui/icons'
import { formatoPesos } from './api'
import { cargarEntregas, confirmarEntrega, urlFoto } from './entregas-api'
import type { EntregaRecibida } from './entregas-api'
import './recepciones.css'

/**
 * Entregas que llegan a la fundación (T10). Quien recibe revisa la foto y escribe
 * el código que le muestra el voluntario; solo así se cierra la entrega.
 * Sin entregas no muestra nada.
 */
export function Recepciones() {
  const [entregas, setEntregas] = useState<EntregaRecibida[] | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    cargarEntregas()
      .then((e) => vigente && setEntregas(e))
      .catch(() => vigente && setEntregas([]))
    return () => {
      vigente = false
    }
  }, [intento])

  if (!entregas || entregas.length === 0) return null
  const pendientes = entregas.filter((e) => !e.confirmada_en)
  const recibidas = entregas.filter((e) => e.confirmada_en).slice(0, 5)

  return (
    <section className="rec-section" aria-labelledby="rec-titulo">
      <h2 id="rec-titulo" className="rec-heading">Entregas</h2>
      <ul className="stack fund-list">
        {pendientes.map((e) => (
          <li key={e.tarea_id}>
            <Pendiente entrega={e} onCambio={() => setIntento((n) => n + 1)} />
          </li>
        ))}
        {recibidas.map((e) => (
          <li key={e.tarea_id}>
            <Card className="fund-item">
              <div className="fund-item__head">
                <h3 className="fund-item__title">{e.solicitud_titulo}</h3>
                <Chip tone="surface">Recibida</Chip>
              </div>
              <p className="fund-muted">{e.tienda_nombre} · {formatoPesos(e.total_centavos)}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Pendiente({ entrega, onCambio }: { entrega: EntregaRecibida; onCambio: () => void }) {
  const [foto, setFoto] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [restantes, setRestantes] = useState(entrega.intentos_restantes)
  const [bloqueada, setBloqueada] = useState(entrega.bloqueada)

  useEffect(() => {
    if (!entrega.foto_path) return
    let vigente = true
    urlFoto(entrega.foto_path).then((u) => vigente && setFoto(u)).catch(() => {})
    return () => {
      vigente = false
    }
  }, [entrega.foto_path])

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (codigo.trim().length === 0) return
    setAviso(null)
    setEnviando(true)
    try {
      const r = await confirmarEntrega(entrega.tarea_id, codigo)
      setRestantes(r.intentos_restantes)
      if (r.resultado === 'confirmada') {
        onCambio()
        return
      }
      setCodigo('')
      if (r.resultado === 'bloqueada') setBloqueada(true)
      else setAviso(`Código incorrecto. Quedan ${r.intentos_restantes} intentos.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo confirmar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card tone="lime" className="fund-item rec-item">
      <div className="fund-item__head">
        <h3 className="fund-item__title">{entrega.solicitud_titulo}</h3>
        <Chip>{bloqueada ? 'Bloqueada' : 'Por confirmar'}</Chip>
      </div>
      <p className="fund-muted">{entrega.tienda_nombre} · {formatoPesos(entrega.total_centavos)}</p>
      {foto ? <img className="rec-foto" src={foto} alt="Foto que tomó el voluntario al entregar" /> : null}
      <ul className="rec-lines">
        {entrega.articulos.map((a) => (
          <li key={a.nombre}><strong>{a.unidades} ×</strong> {a.nombre}</li>
        ))}
      </ul>

      {bloqueada ? (
        <p className="fund-error" role="alert">
          Hubo 5 códigos incorrectos. El equipo de Ágora revisará esta entrega.
        </p>
      ) : (
        <form className="rec-form" onSubmit={(ev) => void enviar(ev)}>
          <label className="fund-field">
            Código que te muestra el voluntario
            <input
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              className="rec-input"
            />
          </label>
          <Button type="submit" size="lg" block icon={<IconCheck />} disabled={enviando || codigo.trim().length === 0}>
            {enviando ? 'Confirmando…' : 'Confirmar recibido'}
          </Button>
          {aviso ? <p className="fund-error" role="alert">{aviso}</p> : null}
          {!aviso && restantes < 5 ? <p className="fund-muted">Quedan {restantes} intentos.</p> : null}
        </form>
      )}
    </Card>
  )
}
