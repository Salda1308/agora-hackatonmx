import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { FormModal } from '../../components/ui/FormModal'
import { IconCheck } from '../../components/ui/icons'
import { cargarMiTarea } from './api'
import type { MiTarea } from './api'
import { cargarMiEntrega, prepararFoto, registrarEntrega } from './entrega-api'
import type { MiEntrega } from './entrega-api'
import './entrega.css'

/**
 * Pasos de la entrega (T10): recoger, foto y marcar entregado, y el código que
 * confirma quien recibe. La recogida la confirma la tienda con el código (T21).
 * Mientras espera una confirmación consulta cada 5 s.
 */
export function PasosEntrega({ tarea, onCambio }: { tarea: MiTarea; onCambio: () => void }) {
  const [entrega, setEntrega] = useState<MiEntrega | null | undefined>(undefined)
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const avisar = useRef(onCambio)

  useEffect(() => {
    avisar.current = onCambio
  }, [onCambio])

  // Por recoger: la tienda teclea el código; al confirmarlo la tarea pasa a recogida.
  useEffect(() => {
    if (tarea.estado !== 'asignada') return
    let vigente = true
    let reloj: number | undefined
    const consultar = () => {
      cargarMiTarea()
        .then((t) => {
          if (!vigente) return
          if (t?.id !== tarea.id || t.estado !== 'asignada') {
            avisar.current()
            return
          }
          reloj = window.setTimeout(consultar, 5000)
        })
        .catch(() => {
          if (vigente) reloj = window.setTimeout(consultar, 5000)
        })
    }
    reloj = window.setTimeout(consultar, 5000)
    return () => {
      vigente = false
      window.clearTimeout(reloj)
    }
  }, [tarea.estado, tarea.id])

  useEffect(() => {
    if (tarea.estado !== 'recogida') return
    let vigente = true
    let reloj: number | undefined
    const consultar = (antes: MiEntrega | null | undefined) => {
      cargarMiEntrega()
        .then((e) => {
          if (!vigente) return
          // Tenía código y ya no aparece: la confirmaron.
          if (antes && !e) {
            avisar.current()
            return
          }
          setEntrega(e)
          if (e && !e.bloqueada) reloj = window.setTimeout(() => consultar(e), 5000)
        })
        .catch(() => {
          if (vigente) reloj = window.setTimeout(() => consultar(antes), 5000)
        })
    }
    consultar(undefined)
    return () => {
      vigente = false
      window.clearTimeout(reloj)
    }
  }, [tarea.estado, tarea.id])

  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.url)
  }, [foto])

  const elegirFoto = async (ev: ChangeEvent<HTMLInputElement>) => {
    const archivo = ev.target.files?.[0]
    ev.target.value = ''
    if (!archivo) return
    setFallo(null)
    try {
      const blob = await prepararFoto(archivo)
      setFoto({ blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo leer la foto.')
    }
  }

  const entregar = async () => {
    if (!foto || ocupado) return
    setFallo(null)
    setOcupado(true)
    try {
      await registrarEntrega(tarea.id, foto.blob)
      setFoto(null)
      setAbierto(false)
      setEntrega(await cargarMiEntrega())
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo marcar entregado.')
    } finally {
      setOcupado(false)
    }
  }


  if (tarea.estado === 'asignada') {
    return (
      <p className="rep-muted" role="status">
        En la tienda, muestra tu código de recogida. Cuando lo confirmen, sigue la entrega aquí.
      </p>
    )
  }

  if (entrega === undefined) return <p className="rep-muted" role="status">Cargando…</p>

  if (entrega) {
    return (
      <div className="ent-code" aria-live="polite">
        {entrega.bloqueada ? (
          <>
            <strong>Entrega bloqueada</strong>
            <span className="rep-muted">Hubo 5 códigos incorrectos. El equipo de Ágora la revisará.</span>
          </>
        ) : (
          <>
            <span className="rep-muted">Muestra este código a quien recibe</span>
            <strong className="rep-code__value">{entrega.codigo_entrega}</strong>
            <span className="rep-muted">Esperando su confirmación…</span>
            {entrega.intentos_restantes < 5 ? (
              <span className="rep-muted">Quedan {entrega.intentos_restantes} intentos.</span>
            ) : null}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rep-stack">
      <p className="rep-muted">Al llegar, registra la entrega con una foto de lo que entregas.</p>
      <Button size="lg" block icon={<IconCheck />} onClick={() => setAbierto(true)}>
        Registrar entrega
      </Button>
      <FormModal
        open={abierto}
        onClose={() => {
          setAbierto(false)
          setFoto(null)
          setFallo(null)
        }}
        title="Registrar entrega"
        description={`Para ${tarea.destino_nombre}`}
        submitLabel="Marcar entregado"
        submittingLabel="Enviando…"
        submitting={ocupado}
        canSubmit={Boolean(foto)}
        dirty={Boolean(foto)}
        onSubmit={() => void entregar()}
      >
        <fieldset className="fm-group">
          <legend>Foto de la entrega</legend>
          <p className="fm-hint">Sin rostros, documentos ni placas. Solo lo que entregas.</p>
          {foto ? <img className="fm-preview" src={foto.url} alt="Foto de la entrega" /> : null}
          <label className="ui-button ui-button--outline ui-button--md ui-button--block ent-file">
            <input type="file" accept="image/*" capture="environment" onChange={(e) => void elegirFoto(e)}
              aria-describedby={fallo ? 'ent-foto-error' : undefined} />
            <span>{foto ? 'Cambiar foto' : 'Tomar foto'}</span>
          </label>
          {fallo ? <p id="ent-foto-error" className="fm-error" role="alert">{fallo}</p> : null}
        </fieldset>
      </FormModal>
    </div>
  )
}
