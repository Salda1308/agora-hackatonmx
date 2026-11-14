import type { Receipt } from './PaymentStatus'

export type StoredCharge = {
  seguimientoToken?: string
  pagoId: string
  montoCentavos: number
  numRef: string
  qrString?: string
  qrImage?: string
  url?: string
  comprobante?: Receipt | null
}

export function readPayment(requestId: string): StoredCharge | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`agora-payment-${requestId}`) ?? 'null',
    )
    return value && typeof value.pagoId === 'string' ? value : null
  } catch {
    return null
  }
}

export function readStoredPayments(): Array<StoredCharge & { requestId: string }> {
  const payments: Array<StoredCharge & { requestId: string }> = []
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith('agora-payment-')) continue
      const value = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (value && typeof value.pagoId === 'string') {
        payments.push({ ...value, requestId: key.slice('agora-payment-'.length) })
      }
    }
  } catch {
    /* La pantalla sigue funcionando si el almacenamiento está bloqueado. */
  }
  return payments
}

export function saveReceipt(requestId: string, receipt: Receipt | null) {
  try {
    const charge = readPayment(requestId)
    if (charge) {
      sessionStorage.setItem(
        `agora-payment-${requestId}`,
        JSON.stringify({ ...charge, comprobante: receipt }),
      )
    }
  } catch {
    /* El comprobante vive en memoria aunque storage no esté disponible. */
  }
}
