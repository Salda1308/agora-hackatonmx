import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Coco } from '../../components/ui/Coco'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { formatMXN } from './data'

export type Receipt = {
  folio: string
  montoCentavos: number
  pagadoEn: string
  peyTransactionId: string
  articulos: { solicitudArticuloId: string; nombre: string; unidades: number }[]
}

type PaymentStatusProps = {
  token: string
  onPaid: (receipt: Receipt | null) => void
}

export function PaymentStatus({ token, onPaid }: PaymentStatusProps) {
  const [state, setState] = useState('creado')
  const [error, setError] = useState(supabase ? '' : 'El seguimiento no está disponible en este momento.')
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    let inFlight = false
    let terminal = false
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      if (!active || inFlight || terminal) return
      inFlight = true
      try {
        const { data, error: failure } = await client.functions.invoke(
          'estado-pago',
          { body: { token } },
        )
        if (!active) return
        if (
          failure &&
          'context' in failure &&
          failure.context instanceof Response &&
          failure.context.status === 404
        ) {
          terminal = true
          setError(
            'El seguimiento venció o no es válido. Solicita el comprobante a la organización.',
          )
          return
        }
        if (failure || !data?.estado) {
          setError(
            'No pudimos consultar la confirmación. Conserva esta pantalla; volveremos a consultar.',
          )
        } else {
          setError('')
          setState(data.estado)
          if (data.estado === 'pagado') {
            terminal = true
            onPaid(data.comprobante ?? null)
            return
          }
          if (data.estado === 'fallido' || data.estado === 'expirado') {
            terminal = true
            return
          }
        }
      } catch {
        if (!active) return
        setError(
          'No pudimos conectar con el seguimiento. Volveremos a consultar.',
        )
      } finally {
        inFlight = false
      }
      if (!active || terminal) return
      timer = setTimeout(() => {
        void check()
      }, 4000)
    }
    void check()
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer)
        void check()
      }
    }
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [token, onPaid])

  if (state === 'pagado') return null
  if (state === 'fallido' || state === 'expirado' || error) {
    return (
      <div className="payment-status payment-status--attention" aria-live="polite">
        <Coco size={88} pose="triste" animation="settle" />
        <p>
          {state === 'fallido'
            ? 'El cobro fue rechazado. Consulta a la organización antes de otro intento.'
            : state === 'expirado'
              ? 'El cobro expiró sin confirmación.'
              : 'Todavía no podemos consultar el seguimiento.'}
        </p>
        {error && <p role="status">{error}</p>}
        {state === 'fallido' || state === 'expirado' || error ? (
          <Button variant="outline" href="#/solicitudes">
            Volver a solicitudes
          </Button>
        ) : null}
      </div>
    )
  }
  return (
    <div className="payment-status" aria-live="polite">
      <CocoLoading title="Consultando tu pago…" description="La confirmación puede tardar unos segundos." size={100} />
    </div>
  )
}

export function ReceiptSummary({ receipt }: { receipt: Receipt }) {
  return (
    <div className="donation__receipt">
      <div className="donation__receipt-head">
        <div>
          <span className="donation__receipt-label">Folio</span>
          <strong>{receipt.folio}</strong>
        </div>
        <strong>{formatMXN(receipt.montoCentavos / 100)}</strong>
      </div>
      <p>{new Date(receipt.pagadoEn).toLocaleString('es-MX')}</p>
      <ul>
        {receipt.articulos.map((item) => (
          <li key={item.solicitudArticuloId}>
            {item.unidades} × {item.nombre}
          </li>
        ))}
      </ul>
      <p className="donation__reference">Rastreo pey: {receipt.peyTransactionId}</p>
      <ButtonPrint />
    </div>
  )
}

function ButtonPrint() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Guardar comprobante
    </Button>
  )
}
