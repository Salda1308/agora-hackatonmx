import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { Coco } from '../../components/ui/Coco'
import { paths } from '../../lib/router'
import { formatMXN, type PublicRequest } from './data'
import type { Receipt } from './PaymentStatus'

type PaymentConfirmationModalProps = {
  request: PublicRequest
  receipt: Receipt | null
  amountCentavos: number
  onClose: () => void
}

export function PaymentConfirmationModal({
  request,
  receipt,
  amountCentavos,
  onClose,
}: PaymentConfirmationModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      className="payment-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="payment-modal__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-confirmation-title"
        aria-describedby="payment-confirmation-description"
      >
        <Coco size={128} pose="pulgar-arriba" animation="celebrate" />
        <p className="payment-modal__eyebrow">Pago confirmado</p>
        <h2 id="payment-confirmation-title">¡Tu ayuda ya sumó!</h2>
        <p id="payment-confirmation-description" className="payment-modal__thanks">
          Gracias por apoyar a {request.org}.
        </p>
        <div className="payment-modal__summary">
          <strong>{formatMXN((receipt?.montoCentavos ?? amountCentavos) / 100)}</strong>
          {receipt?.articulos.length ? (
            <ul>
              {receipt.articulos.map((item) => (
                <li key={item.solicitudArticuloId}>
                  {item.unidades} × {item.nombre}
                </li>
              ))}
            </ul>
          ) : (
            <p>El comprobante detallado todavía no está disponible.</p>
          )}
        </div>
        <p className="payment-modal__note">
          Tu comprobante quedará disponible en Mis comprobantes.
        </p>
        <Button ref={closeRef} variant="ink" size="lg" block onClick={onClose}>
          Ver el resumen
        </Button>
        <Button variant="ghost" href={paths.following} block>
          Ir a mis comprobantes
        </Button>
      </div>
    </div>,
    document.body,
  )
}