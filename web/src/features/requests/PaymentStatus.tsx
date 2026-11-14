import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Coco } from '../../components/ui/Coco'
import { formatMXN } from './data'
export type Receipt = {
  folio: string
  montoCentavos: number
  pagadoEn: string
  peyTransactionId: string
  articulos: { solicitudArticuloId: string; nombre: string; unidades: number }[]
}
export function PaymentStatus({
  token,
  onPaid,
}: {
  token: string
  onPaid: () => void
}) {
  const [state, setState] = useState('creado')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
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
        if (failure || !data?.estado)
          setError(
            'No pudimos consultar la confirmación. Conserva esta pantalla; volveremos a consultar.',
          )
        else {
          setError('')
          setState(data.estado)
          if (data.estado === 'pagado') {
            terminal = true
            setReceipt(data.comprobante)
            onPaid()
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
  return (
    <div aria-live="polite">
      {state === 'pagado' ? (
        <>
          <Coco size={100} />
          <h3>¡Tu ayuda ya sumó!</h3>
          <p>Pago confirmado por la tienda.</p>
          {receipt ? (
            <div className="donation__receipt">
              <strong>{receipt.folio}</strong>
              <p>
                {formatMXN(receipt.montoCentavos / 100)} ·{' '}
                {new Date(receipt.pagadoEn).toLocaleString('es-MX')}
              </p>
              <ul>
                {receipt.articulos.map((item) => (
                  <li key={item.solicitudArticuloId}>
                    {item.unidades} × {item.nombre}
                  </li>
                ))}
              </ul>
              <p className="donation__reference">
                Rastreo pey: {receipt.peyTransactionId}
              </p>
              <ButtonPrint />
            </div>
          ) : (
            <p>El comprobante todavía no está disponible.</p>
          )}
        </>
      ) : (
        <p>
          {state === 'fallido'
            ? 'El cobro fue rechazado. Consulta a la organización antes de otro intento.'
            : state === 'expirado'
              ? 'El cobro expiró sin confirmación.'
              : 'Consultando la confirmación de tu pago…'}
        </p>
      )}
      {error && <p role="status">{error}</p>}
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
