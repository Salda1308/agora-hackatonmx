// Consulta de la transacción en pey: única fuente de verdad para financiar.
// De la respuesta solo se conservan campos no personales.
import { centavos, numRef, objeto, transaccionId, uuid } from "./evento.ts";

export const PEY_API = "https://api.pey.mx";

export type Metodo = "qr" | "push" | "link";

export type Transaccion = {
  id: string;
  status: string;
  // Monto cobrado sin propina ni comisión (amountBreakdown.base, o amount).
  montoBaseCentavos: number | null;
  moneda: string | null;
  metodo: Metodo | null;
  payableId: string | null;
  datePaid: number | null;
  pagoId: string | null;
  numRef: number | null;
};

export type Consulta =
  | { tipo: "ok"; transaccion: Transaccion }
  | { tipo: "no_encontrada" }
  | { tipo: "error"; http: number | null };

const METODOS: Record<string, Metodo> = {
  API_CODI_QR: "qr",
  API_CODI_PN: "push",
  PAYMENT_LINK: "link",
};

export function leerTransaccion(raw: unknown): Transaccion | null {
  if (!objeto(raw)) return null;
  const id = transaccionId(raw.id);
  if (!id || typeof raw.status !== "string") return null;
  const meta = objeto(raw.metadata) ? raw.metadata : {};
  const ext = objeto(meta.externalMetadata) ? meta.externalMetadata : {};
  const base =
    objeto(raw.amountBreakdown) && raw.amountBreakdown.base !== undefined
      ? raw.amountBreakdown.base
      : raw.amount;
  return {
    id,
    status: raw.status,
    montoBaseCentavos: centavos(base),
    moneda: typeof raw.currency === "string" ? raw.currency : null,
    metodo: typeof raw.payableType === "string"
      ? METODOS[raw.payableType] ?? null
      : null,
    payableId: typeof raw.payableId === "string" ? raw.payableId : null,
    datePaid:
      typeof raw.datePaid === "number" && Number.isSafeInteger(raw.datePaid)
        ? raw.datePaid
        : null,
    pagoId: uuid(ext.pago_id),
    numRef: numRef(meta.numRef) ?? numRef(ext.num_ref),
  };
}

export async function consultarTransaccion(
  fetchFn: typeof fetch,
  apiKey: string,
  id: string,
  timeoutMs = 8000,
): Promise<Consulta> {
  try {
    const res = await fetchFn(
      `${PEY_API}/transaction/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.status === 404) {
      await res.body?.cancel();
      return { tipo: "no_encontrada" };
    }
    if (res.status !== 200) {
      await res.body?.cancel();
      return { tipo: "error", http: res.status };
    }
    const transaccion = leerTransaccion(await res.json().catch(() => null));
    return transaccion
      ? { tipo: "ok", transaccion }
      : { tipo: "error", http: 200 };
  } catch {
    return { tipo: "error", http: null };
  }
}

// Mismo formato de credencial que crear-cobro (T03): secreto JSON con apiKey,
// nombrado por tiendas_cobro.credencial_ref. Sin API key global de respaldo.
export function leerApiKey(
  get: (key: string) => string | undefined,
  ref: string,
): string | null {
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(ref)) return null;
  try {
    const raw: unknown = JSON.parse(get(ref) ?? "null");
    return objeto(raw) && typeof raw.apiKey === "string" && raw.apiKey.trim()
      ? raw.apiKey
      : null;
  } catch {
    return null;
  }
}
