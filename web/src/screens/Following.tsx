import { useEffect, useMemo, useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { paths } from '../lib/router'
import { supabase } from '../lib/supabase'
import { formatMXN } from '../features/requests/data'
import type { Receipt } from '../features/requests/PaymentStatus'
import { readStoredPayments, type StoredCharge } from '../features/requests/receipt-storage'
import '../features/requests/donation.css'

type ReceiptState =
  | { status: 'loading' }
  | { status: 'confirmed'; receipt: Receipt }
  | { status: 'pending'; label: string }
  | { status: 'error'; label: string }

/** Comprobantes y seguimientos que pertenecen únicamente a esta pestaña. */
export function Following() {
  const attempts = useMemo(() => readStoredPayments(), [])
  const [states, setStates] = useState<Record<string, ReceiptState>>(() =>
    Object.fromEntries(
      attempts.map((attempt) =>
        attempt.comprobante
          ? [attempt.pagoId, { status: 'confirmed', receipt: attempt.comprobante }]
          : [attempt.pagoId, { status: 'loading' }],
      ),
    ),
  )

  useEffect(() => {
    let active = true
    const load = async (attempt: StoredCharge & { requestId: string }) => {
      if (attempt.comprobante) return
      if (!attempt.seguimientoToken || !supabase) {
        if (active) {
          setStates((current) => ({
            ...current,
            [attempt.pagoId]: {
              status: 'pending',
              label: 'El comprobante se consulta desde la solicitud.',
            },
          }))
        }
        return
      }
      try {
        const { data, error } = await supabase.functions.invoke('estado-pago', {
          body: { token: attempt.seguimientoToken },
        })
        if (!active) return
        if (error || !data?.estado) {
          setStates((current) => ({
            ...current,
            [attempt.pagoId]: {
              status: 'error',
              label: 'No pudimos consultar este comprobante.',
            },
          }))
        } else if (data.estado === 'pagado' && data.comprobante) {
          setStates((current) => ({
            ...current,
            [attempt.pagoId]: { status: 'confirmed', receipt: data.comprobante },
          }))
        } else {
          setStates((current) => ({
            ...current,
            [attempt.pagoId]: {
              status: 'pending',
              label:
                data.estado === 'expirado'
                  ? 'El seguimiento expiró.'
                  : data.estado === 'fallido'
                    ? 'El cobro no fue confirmado.'
                    : 'Pago pendiente de confirmación.',
            },
          }))
        }
      } catch {
        if (active) {
          setStates((current) => ({
            ...current,
            [attempt.pagoId]: {
              status: 'error',
              label: 'No pudimos consultar este comprobante.',
            },
          }))
        }
      }
    }
    attempts.forEach((attempt) => void load(attempt))
    return () => {
      active = false
    }
  }, [attempts])

  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span className="brand brand--ink">Ágora</span>
          <ThemeToggle />
        </div>
        <h1 className="page-title">
          Mis <span className="highlight highlight--lime">comprobantes</span>
        </h1>
        {attempts.length ? (
          <>
            <p>
              Pagos y seguimientos guardados en este dispositivo. Los tokens
              existentes se consultan sin ponerlos en la URL.
            </p>
            <div className="stack receipt-list">
              {attempts.map((attempt) => {
                const state = states[attempt.pagoId]
                return (
                  <div className="receipt-list__item" key={attempt.pagoId}>
                    <Card href={paths.request(attempt.requestId)}>
                      Consultar pago · referencia {attempt.numRef}
                    </Card>
                    <div className="receipt-list__detail">
                      {state?.status === 'confirmed' ? (
                        <>
                          <div className="receipt-list__line">
                            <strong>{state.receipt.folio}</strong>
                            <strong>{formatMXN(state.receipt.montoCentavos / 100)}</strong>
                          </div>
                          <p>{new Date(state.receipt.pagadoEn).toLocaleString('es-MX')}</p>
                          <ul>
                            {state.receipt.articulos.map((item) => (
                              <li key={item.solicitudArticuloId}>
                                {item.unidades} × {item.nombre}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p role={state?.status === 'error' ? 'alert' : 'status'}>
                          {state?.status === 'loading'
                            ? 'Consultando comprobante…'
                            : state?.label ?? 'Consultando comprobante…'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            title="Aún no tienes comprobantes aquí"
            description="Cuando completes un pago, su comprobante aparecerá en este dispositivo."
            action={<Button href={paths.directory}>Explorar solicitudes</Button>}
          />
        )}
      </div>
    </main>
  )
}
