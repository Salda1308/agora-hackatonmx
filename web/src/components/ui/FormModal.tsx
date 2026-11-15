import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'
import './form-modal.css'

export type FormModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Texto del botón primario del pie. */
  submitLabel: string
  submittingLabel?: string
  submitting: boolean
  /** Falso deshabilita el botón primario (faltan datos). */
  canSubmit?: boolean
  /** Con `formId`, el botón primario envía ese formulario; si no, llama a `onSubmit`. */
  formId?: string
  onSubmit?: () => void
  /** Datos que no se ven como edición de campos (p. ej. cantidades con botones). */
  dirty?: boolean
  /** Contenido extra del pie, antes del botón primario (resumen, paso). */
  footerStart?: ReactNode
  /** Oculta el pie (pantallas de confirmación dentro del modal). */
  hideFooter?: boolean
}

/**
 * Formulario en `Modal` (D8). Solo se monta abierto, así cada apertura empieza limpia.
 * Escape, tocar fuera o Cerrar piden confirmación si hay datos sin guardar; mientras
 * se envía no se cierra. El botón primario vive en el pie fijo y se deshabilita al enviar.
 */
export function FormModal(props: FormModalProps) {
  if (!props.open) return null
  return <Abierto {...props} />
}

function Abierto({
  onClose, title, description, children, submitLabel, submittingLabel, submitting,
  canSubmit = true, formId, onSubmit, dirty = false, footerStart, hideFooter,
}: FormModalProps) {
  const [editado, setEditado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const pedirCierre = () => {
    if (submitting) return
    if ((dirty || editado) && !hideFooter && !confirmando) {
      setConfirmando(true)
      return
    }
    onClose()
  }

  const pie = hideFooter ? undefined : confirmando ? (
    <div className="form-modal__confirm" role="alertdialog" aria-label="Cambios sin guardar">
      <p><strong>Tienes cambios sin guardar.</strong> Si cierras, se pierden.</p>
      <div className="form-modal__actions">
        <Button variant="ink" autoFocus onClick={() => setConfirmando(false)}>Seguir editando</Button>
        <Button variant="ghost" onClick={onClose}>Descartar</Button>
      </div>
    </div>
  ) : (
    <div className="form-modal__bar">
      {footerStart ? <div className="form-modal__start">{footerStart}</div> : null}
      <Button
        type={formId ? 'submit' : 'button'}
        form={formId}
        size="lg"
        block
        disabled={submitting || !canSubmit}
        aria-busy={submitting || undefined}
        onClick={formId ? undefined : onSubmit}
      >
        {submitting ? submittingLabel ?? 'Guardando…' : submitLabel}
      </Button>
    </div>
  )

  return (
    <Modal open onClose={pedirCierre} title={title} description={description} footer={pie} className="form-modal">
      <div className="form-modal__content" onInput={() => setEditado(true)} onChange={() => setEditado(true)}>
        {children}
      </div>
    </Modal>
  )
}

/** Campo con etiqueta, ayuda y error junto al control. */
export function Field({ label, hint, error, children, id }: {
  label: string
  hint?: string
  error?: string | null
  /** id del control para enlazar ayuda y error con aria-describedby. */
  id: string
  children: ReactNode
}) {
  return (
    <div className={`fm-field${error ? ' fm-field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p id={`${id}-ayuda`} className="fm-hint">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="fm-error" role="alert">{error}</p> : null}
    </div>
  )
}
