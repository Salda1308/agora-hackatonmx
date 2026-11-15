import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './modal.css'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Clase extra del diálogo (p. ej. `form-modal` de D8). */
  className?: string
}

/** Hoja móvil y diálogo de escritorio. showModal hace inerte el fondo. */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const element = dialog.current
    if (!open || !element) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  return createPortal(<dialog ref={dialog} className={className ? `ui-modal ${className}` : 'ui-modal'} aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      )).filter(element => element.getClientRects().length > 0)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <div className="ui-modal__surface">
      <header className="ui-modal__header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="ui-icon-button" onClick={onClose} aria-label="Cerrar diálogo">×</button>
      </header>
      <div className="ui-modal__body">{children}</div>
      {footer && <footer className="ui-modal__footer">{footer}</footer>}
    </div>
  </dialog>, document.body)
}
