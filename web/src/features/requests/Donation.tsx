import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { formatMXN, type PublicRequest } from './data'
import './donation.css'
import { PaymentStatus } from './PaymentStatus'

type Method = 'qr' | 'push' | 'link'
type Charge = {
  seguimientoToken?: string
  pagoId: string
  montoCentavos: number
  numRef: string
  qrString?: string
  qrImage?: string
  url?: string
}
function readPending(id: string): Charge | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`agora-payment-${id}`) ?? 'null',
    )
    return value && typeof value.pagoId === 'string' ? value : null
  } catch {
    return null
  }
}
export function Donation({ request }: { request: PublicRequest }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<Method>('qr')
  const [phone, setPhone] = useState('')
  const [charge, setCharge] = useState<Charge | null>(() =>
    readPending(request.id),
  )
  const [paid, setPaid] = useState(false)
  const markPaid = useCallback(() => setPaid(true), [])
  const [qr, setQr] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const qrImageValid =
    typeof charge?.qrImage === 'string' &&
    /^(data:image\/png;base64,)?[A-Za-z0-9+/=\s]+$/.test(charge.qrImage)
  useEffect(() => {
    let active = true
    if (charge?.qrString && (!qrImageValid || imageFailed))
      void import('qrcode')
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(charge.qrString!, {
            width: 320,
            margin: 4,
            errorCorrectionLevel: 'M',
          }),
        )
        .then((value) => {
          if (active) setQr(value)
        })
        .catch(() => {})
    return () => {
      active = false
    }
  }, [charge, imageFailed, qrImageValid])
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(`agora-attempt-${request.id}`) === 'pending'
    } catch {
      return false
    }
  })
  const items = request.items.filter((item) => (quantities[item.id] ?? 0) > 0)
  const total = items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * quantities[item.id],
    0,
  )
  const valid =
    items.length > 0 &&
    items.length <= 10 &&
    items.every(
      (item) =>
        Number.isInteger(quantities[item.id]) &&
        quantities[item.id] <= item.total - item.paid,
    )
  const create = async () => {
    if (
      locked.current ||
      charge ||
      !valid ||
      (method === 'push' && !/^\d{10}$/.test(phone))
    )
      return
    if (!supabase) {
      setMessage('El servicio no está configurado.')
      return
    }
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      sessionStorage.setItem(`agora-attempt-${request.id}`, 'pending')
    } catch {
      /* Do not retry if the response is uncertain. */
    }
    try {
      const { data, error, response } = await supabase.functions.invoke(
        'crear-cobro',
        {
          body: {
            solicitudId: request.id,
            metodo: method,
            articulos: items.map((item) => ({
              solicitudArticuloId: item.id,
              unidades: quantities[item.id],
            })),
            ...(method === 'push' ? { phoneNumber: phone } : {}),
          },
        },
      )
      setPhone('')
      let body = data
      const http =
        response ??
        (error && 'context' in error && error.context instanceof Response
          ? error.context
          : undefined)
      if (!body && http) {
        try {
          body = await http.clone().json()
        } catch {
          /* Treat invalid responses as uncertain. */
        }
      }
      if (body?.pagoId) {
        const saved: Charge = {
          seguimientoToken: body.seguimientoToken,
          pagoId: body.pagoId,
          numRef: body.numRef,
          montoCentavos: body.montoCentavos,
          ...(http?.status === 201
            ? { qrString: body.qrString, qrImage: body.qrImage, url: body.url }
            : {}),
        }
        setCharge(saved)
        try {
          sessionStorage.setItem(
            `agora-payment-${request.id}`,
            JSON.stringify(saved),
          )
          sessionStorage.removeItem(`agora-attempt-${request.id}`)
        } catch {
          /* Still retain in memory. */
        }
      }
      if (http?.status === 201 && body?.pagoId) {
        setMessage(
          method === 'push'
            ? 'Revisa la solicitud CoDi en tu app bancaria.'
            : 'Completa el pago en tu app bancaria.',
        )
      } else if (
        http &&
        [400, 404, 409, 413, 415, 422].includes(http.status) &&
        !body?.pagoId
      ) {
        setMessage(
          body?.error?.mensaje ||
            'No se pudo crear el cobro. Revisa las unidades y vuelve a intentar.',
        )
        try {
          sessionStorage.removeItem(`agora-attempt-${request.id}`)
        } catch {
          /* Storage may be unavailable. */
        }
        locked.current = false
      } else {
        setUncertain(true)
        setMessage(
          body?.error?.mensaje ||
            'No pudimos confirmar si se creó el cobro. No vuelvas a pagar; conserva esta pantalla y consulta a la organización.',
        )
      }
    } catch {
      setPhone('')
      setUncertain(true)
      setMessage(
        'Se interrumpió la conexión. El cobro pudo haberse creado; no lo repitas. Consulta a la organización.',
      )
    } finally {
      setBusy(false)
    }
  }
  if (charge || uncertain)
    return (
      <section className="donation" aria-labelledby="payment-title">
        <h2 id="payment-title">
          {paid ? 'Pago confirmado' : 'Tu intento de pago'}
        </h2>
        <p role="status">
          {paid
            ? 'Gracias por sumar unidades.'
            : message ||
              (uncertain && !charge
                ? 'No pudimos confirmar si se creó el cobro. No lo repitas; consulta a la organización.'
                : 'Tu intento de pago está guardado en esta pestaña.')}
        </p>
        {charge && (
          <>
            <p>
              Referencia: <strong>{charge.numRef}</strong> ·{' '}
              {formatMXN(charge.montoCentavos / 100)}
            </p>
            <p className="donation__reference">ID de pago: {charge.pagoId}</p>
          </>
        )}
        {!paid &&
          !imageFailed &&
          charge?.qrImage &&
          /^(data:image\/png;base64,)?[A-Za-z0-9+/=\s]+$/.test(
            charge.qrImage,
          ) && (
            <img
              className="donation__qr"
              alt="QR de CoDi para pagar"
              onError={() => setImageFailed(true)}
              src={
                charge.qrImage.startsWith('data:')
                  ? charge.qrImage
                  : `data:image/png;base64,${charge.qrImage}`
              }
            />
          )}
        {!paid && qr && (
          <img className="donation__qr" src={qr} alt="QR de CoDi para pagar" />
        )}
        {!paid && charge?.qrString && (!qrImageValid || imageFailed) && !qr && (
          <div>
            <p>Contenido del QR CoDi:</p>
            <textarea
              readOnly
              aria-label="Contenido QR CoDi"
              value={charge.qrString}
            />
          </div>
        )}
        {!paid &&
          charge?.url &&
          /^https:\/\/app\.mipey\.mx(?:\/|$)/.test(charge.url) && (
            <Button href={charge.url} size="lg" block>
              Ir a pagar con CoDi
            </Button>
          )}
        <p>
          La barra muestra el avance de toda la solicitud; un cambio no confirma
          por sí solo tu pago.
        </p>
        {charge?.seguimientoToken ? (
          <PaymentStatus token={charge.seguimientoToken} onPaid={markPaid} />
        ) : (
          <p>
            Este intento no tiene token de seguimiento. Solicita el comprobante
            a la tienda u organización.
          </p>
        )}
        {paid &&
          request.state === 'publicada' &&
          request.items.some((item) => item.paid < item.total) && (
            <Button
              variant="outline"
              block
              onClick={() => {
                try {
                  sessionStorage.removeItem(`agora-payment-${request.id}`)
                  sessionStorage.removeItem(`agora-attempt-${request.id}`)
                } catch {
                  /* Keep the confirmed receipt visible if storage cannot be cleared. */ return
                }
                setCharge(null)
                setPaid(false)
                setQr('')
                setImageFailed(false)
                setQuantities({})
                setMessage('')
                setUncertain(false)
                locked.current = false
              }}
            >
              Donar más unidades
            </Button>
          )}
      </section>
    )
  return (
    <section className="donation" aria-labelledby="donation-title">
      <h2 id="donation-title" className="section-title">
        Elige tus unidades
      </h2>
      <p>
        El pago va directo a la tienda. CoDi se confirma desde tu app bancaria.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <fieldset disabled={busy || request.state !== 'publicada'}>
          <legend>Artículos</legend>
          {request.items.map((item) => (
            <Card key={item.id}>
              <label className="donation__quantity">
                <span>
                  {item.name}
                  <small>
                    {formatMXN(item.unitPrice)} por unidad · faltan{' '}
                    {item.total - item.paid}
                  </small>
                </span>
                <input
                  aria-label={`Unidades de ${item.name}`}
                  type="number"
                  min="0"
                  max={Math.max(0, item.total - item.paid)}
                  step="1"
                  value={quantities[item.id] ?? 0}
                  onChange={(event) =>
                    setQuantities({
                      ...quantities,
                      [item.id]: Number(event.target.value),
                    })
                  }
                />
              </label>
            </Card>
          ))}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Cómo quieres pagar</legend>
          {(['qr', 'push', 'link'] as const).map((value) => (
            <label className="donation__method" key={value}>
              <input
                type="radio"
                name="payment-method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              />
              {value === 'qr'
                ? 'QR · escanéalo desde otro dispositivo'
                : value === 'push'
                  ? 'Aviso CoDi · a tu celular'
                  : 'Link · abre el pago en este dispositivo'}
            </label>
          ))}
          {method === 'push' && (
            <label>
              Celular (10 dígitos)
              <input
                className="donation__phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{10}"
                maxLength={10}
                required
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value.replace(/\D/g, ''))
                }
              />
              <small>Solo se usa para enviar este cobro; no se guarda.</small>
            </label>
          )}
        </fieldset>
        {request.state !== 'publicada' && (
          <p>Esta solicitud ya está cerrada.</p>
        )}
        {message && <p role="alert">{message}</p>}
        <Button
          type="submit"
          size="lg"
          block
          disabled={
            busy ||
            !valid ||
            request.state !== 'publicada' ||
            (method === 'push' && !/^\d{10}$/.test(phone))
          }
        >
          {busy ? 'Creando cobro…' : `Pagar ${formatMXN(total / 100)}`}
        </Button>
        <p className="detail-cta__note">
          Crear el cobro no significa que esté pagado. La disponibilidad se
          confirma al crear el cobro.
        </p>
      </form>
    </section>
  )
}
