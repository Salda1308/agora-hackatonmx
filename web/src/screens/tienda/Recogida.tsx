import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, FormModal } from '../../components/ui/FormModal'
import { describe } from '../../components/ui/describe'
import { IconCheck } from '../../components/ui/icons'
import { confirmarRecogida } from './api'
import type { Pedido } from './api'

/**
 * Recogida de un pedido listo (T21). La tienda no ve el código: lo teclea cuando el
 * voluntario se lo muestra y el servidor lo compara. 5 códigos incorrectos la bloquean.
 */
export function Recogida({ pedido, onConfirmada }: { pedido: Pedido; onConfirmada: () => void }) {
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [restantes, setRestantes] = useState(pedido.intentos_restantes)
  const [bloqueada, setBloqueada] = useState(pedido.bloqueada)
  const [abierto, setAbierto] = useState(false)

  if (pedido.estado !== 'listo' || !pedido.tarea_id) return null

  if (pedido.tarea_estado !== 'asignada') {
    return <p className="tda-muted">Esperando a que un voluntario tome la recogida.</p>
  }

  if (bloqueada) {
    return (
      <p className="tda-error" role="alert">
        Hubo 5 códigos incorrectos. El equipo de Ágora revisará esta recogida.
      </p>
    )
  }

  const tarea = pedido.tarea_id
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (codigo.trim().length === 0 || enviando) return
    setAviso(null)
    setEnviando(true)
    try {
      const r = await confirmarRecogida(tarea, codigo)
      if (r.resultado === 'confirmada') {
        setAbierto(false)
        onConfirmada()
        return
      }
      setCodigo('')
      setRestantes(r.intentos_restantes)
      if (r.resultado === 'bloqueada') {
        setAbierto(false)
        setBloqueada(true)
      }
      else setAviso(`Código incorrecto. Quedan ${r.intentos_restantes} intentos.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo confirmar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button size="lg" block icon={<IconCheck />} onClick={() => setAbierto(true)}>
        Confirmar recogida
      </Button>
      {restantes < 5 ? <p className="tda-muted">Quedan {restantes} intentos.</p> : null}
      <FormModal
        open={abierto}
        onClose={() => {
          setAbierto(false)
          setCodigo('')
          setAviso(null)
        }}
        title="Confirmar recogida"
        description={`${pedido.organizacion_nombre} · ${pedido.solicitud_titulo}`}
        submitLabel="Confirmar recogida"
        submittingLabel="Confirmando…"
        submitting={enviando}
        canSubmit={codigo.trim().length > 0}
        formId="tda-recogida-form"
      >
        <form id="tda-recogida-form" className="fm-form" onSubmit={(ev) => void enviar(ev)}>
          <Field
            id="tda-codigo"
            label="Código que te muestra el voluntario"
            hint={aviso ? '6 letras o números.' : `6 letras o números. Quedan ${restantes} intentos.`}
            error={aviso}
          >
            <input
              {...describe('tda-codigo', 'ayuda', aviso)}
              value={codigo}
              onChange={(ev) => setCodigo(ev.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              autoFocus
              className="tda-recogida__input"
            />
          </Field>
        </form>
      </FormModal>
    </>
  )
}
