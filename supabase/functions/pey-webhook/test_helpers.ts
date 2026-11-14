import { firmar } from "./firma.ts";

export function assert(
  value: unknown,
  message = "Falló una comprobación",
): asserts value {
  if (!value) throw new Error(message);
}

export function igual(actual: unknown, expected: unknown) {
  const normalizar = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalizar);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map((
          [k, v],
        ) => [k, normalizar(v)]),
      );
    }
    return value;
  };
  const a = JSON.stringify(normalizar(actual));
  const e = JSON.stringify(normalizar(expected));
  assert(a === e, `Esperado ${e}, obtenido ${a}`);
}

// Secreto de prueba generado aquí; no es el de pey.
export const SECRETO_PRUEBA = "whsec_" +
  btoa("secreto-de-prueba-local-32-bytes!!");

export async function peticionFirmada(
  cuerpo: unknown,
  opciones: { webhookId?: string; secreto?: string; ahora?: number } = {},
): Promise<Request> {
  const body = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  const id = opciones.webhookId ?? `msg_${crypto.randomUUID()}`;
  const ts = String(Math.floor((opciones.ahora ?? Date.now()) / 1000));
  const sig = await firmar(opciones.secreto ?? SECRETO_PRUEBA, id, ts, body);
  return new Request("http://localhost/pey-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${sig}`,
    },
    body,
  });
}

// Datos bancarios ficticios del pagador: deben descartarse siempre.
export const DATOS_PAGADOR = {
  accountType: 40,
  bankCode: 40012,
  clabe: "012180000000000000",
  description: "PAGADOR FICTICIO",
  trackingKey: "RASTREO-FICTICIO-123",
};

export function eventoCodi(
  tipo: "qr" | "pn",
  datos: {
    transactionId: string;
    pagoId?: string;
    numRef?: number;
    amount?: number;
  },
) {
  return {
    type: `codi.${tipo}.payment_received`,
    amount: datos.amount ?? 0.01,
    apiKeyId: "01APIKEYFICTICIO0000000000",
    bankAccountId: null,
    ...(tipo === "qr" ? { codiQrId: "QRFICTICIO" } : {}),
    concept: "Agora prueba",
    datePaid: 1763143020,
    numRef: datos.numRef !== undefined ? String(datos.numRef) : undefined,
    transactionId: datos.transactionId,
    metadata: {
      ...DATOS_PAGADOR,
      externalMetadata: datos.pagoId
        ? { pago_id: datos.pagoId, num_ref: String(datos.numRef ?? "") }
        : {},
    },
  };
}

export function eventoLink(
  datos: {
    transactionIds: string[];
    clientReferenceId?: string;
    status?: string;
  },
) {
  return {
    type: "payment_link.status_updated",
    apiKeyId: "01APIKEYFICTICIO0000000000",
    paymentLinkId: "01LINKFICTICIO000000000000",
    status: datos.status ?? "paid",
    clientReferenceId: datos.clientReferenceId,
    transactions: datos.transactionIds.map((transactionId) => ({
      transactionId,
      paymentMethod: "CODI",
      datePaid: 1763143620,
      amount: 0.01,
      amountBreakdown: { base: 0.01, tip: 0 },
      applicationFee: null,
      metadata: { ...DATOS_PAGADOR, externalMetadata: {} },
    })),
    metadata: {},
  };
}

export function transaccionPey(datos: {
  id: string;
  status?: string;
  amount?: number;
  base?: number;
  currency?: string;
  payableType?: string;
  payableId?: string;
  pagoId?: string;
  numRef?: number;
}) {
  return {
    id: datos.id,
    status: datos.status ?? "PAID",
    amount: datos.amount ?? 0.01,
    amountBreakdown: { base: datos.base ?? datos.amount ?? 0.01, tip: 0 },
    currency: datos.currency ?? "MXN",
    paymentMethod: "CODI",
    payableType: datos.payableType ?? "API_CODI_QR",
    payableId: datos.payableId ?? "QRFICTICIO",
    dateCreated: 1763142900,
    datePaid: 1763143020,
    metadata: {
      ...DATOS_PAGADOR,
      externalMetadata: datos.pagoId
        ? { pago_id: datos.pagoId, num_ref: String(datos.numRef ?? "") }
        : {},
    },
  };
}
