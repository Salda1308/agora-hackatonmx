// Interpreta el cuerpo de los webhooks de pey. Nada de aquí financia: solo da
// pistas (transactionId, pago_id, numRef) que después se confirman con
// GET /transaction/:id. Los datos bancarios del pagador nunca se copian.

export type Candidato = {
  transactionId: string;
  pagoIds: string[];
  numRefs: number[];
};

export type Evento =
  | { tipo: "pago"; type: string; candidatos: Candidato[] }
  | { tipo: "ignorado"; type: string; motivo: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRANSACCION = /^[0-9A-Za-z_-]{1,64}$/;

export function objeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function uuid(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null;
}

export function numRef(v: unknown): number | null {
  const s = typeof v === "number" ? String(v) : v;
  return typeof s === "string" && /^[0-9]{1,7}$/.test(s) && Number(s) >= 1
    ? Number(s)
    : null;
}

export function transaccionId(v: unknown): string | null {
  return typeof v === "string" && TRANSACCION.test(v) ? v : null;
}

// Pesos (número o cadena) a centavos enteros; null si no es exacto.
export function centavos(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  const c = Math.round(n * 100);
  return Math.abs(n * 100 - c) < 1e-6 && Number.isSafeInteger(c) ? c : null;
}

function unicos<T>(xs: (T | null)[]): T[] {
  return [...new Set(xs.filter((x): x is T => x !== null))];
}

function externa(metadata: unknown): Record<string, unknown> {
  return objeto(metadata) && objeto(metadata.externalMetadata)
    ? metadata.externalMetadata
    : {};
}

export function interpretarEvento(raw: unknown): Evento {
  if (!objeto(raw)) return { tipo: "ignorado", type: "", motivo: "no_objeto" };
  const type = typeof raw.type === "string" ? raw.type.slice(0, 64) : "";

  if (
    type === "codi.qr.payment_received" || type === "codi.pn.payment_received"
  ) {
    const id = transaccionId(raw.transactionId);
    if (!id) return { tipo: "ignorado", type, motivo: "sin_transaccion" };
    const ext = externa(raw.metadata);
    const meta = objeto(raw.metadata) ? raw.metadata : {};
    return {
      tipo: "pago",
      type,
      candidatos: [{
        transactionId: id,
        pagoIds: unicos([uuid(ext.pago_id)]),
        numRefs: unicos([
          numRef(raw.numRef),
          numRef(meta.numRef),
          numRef(ext.num_ref),
        ]),
      }],
    };
  }

  if (type === "payment_link.status_updated") {
    if (raw.status !== "paid") {
      return { tipo: "ignorado", type, motivo: "link_no_pagado" };
    }
    const transacciones = Array.isArray(raw.transactions)
      ? raw.transactions
      : [];
    const linkMeta = objeto(raw.metadata) ? raw.metadata : {};
    const candidatos: Candidato[] = [];
    for (const t of transacciones.slice(0, 20)) {
      if (!objeto(t)) continue;
      const id = transaccionId(t.transactionId);
      if (!id) continue;
      const ext = externa(t.metadata);
      candidatos.push({
        transactionId: id,
        pagoIds: unicos([
          uuid(ext.pago_id),
          uuid(linkMeta.pago_id),
          uuid(raw.clientReferenceId),
        ]),
        numRefs: unicos([numRef(ext.num_ref), numRef(linkMeta.num_ref)]),
      });
    }
    return candidatos.length
      ? { tipo: "pago", type, candidatos }
      : { tipo: "ignorado", type, motivo: "sin_transacciones" };
  }

  return { tipo: "ignorado", type, motivo: "tipo_desconocido" };
}

// Lista de campos permitidos de T01: el resto se registra solo por su tipo
// (CLABE, banco, tipo de cuenta, descripción, clave de rastreo, nombres).
const SAFE_KEYS = new Set([
  "type",
  "amount",
  "codiQrId",
  "concept",
  "datePaid",
  "numRef",
  "transactionId",
  "paymentLinkId",
  "clientReferenceId",
  "status",
  "method",
  "paymentMethod",
  "externalMetadata",
  "createdAt",
  "updatedAt",
]);

export function redact(value: unknown, keepScalars = false): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, keepScalars));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redact(v, keepScalars || SAFE_KEYS.has(k)),
      ]),
    );
  }
  return keepScalars || value === null ? value : `[${typeof value}]`;
}
