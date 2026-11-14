import {
  Entrada,
  ErrorCobro,
  Metodo,
  objeto,
  Reserva,
  ResultadoPey,
} from "./domain.ts";

export type Cuenta = {
  apiKey: string;
  bankAccountId?: string;
  useLinkedAccount: boolean;
};
export type Configuracion = {
  cuenta: (ref: string, metodo: Metodo) => Cuenta;
  successUrl: string;
  backUrl: string;
  maximoCentavos: number;
};

function configuracionInvalida(): never {
  throw new ErrorCobro(
    503,
    "CONFIGURACION_INCOMPLETA",
    "El cobro no está disponible para esta tienda.",
  );
}

export function leerCuenta(
  get: (key: string) => string | undefined,
  ref: string,
  metodo: Metodo,
): Cuenta {
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(ref)) configuracionInvalida();
  let raw: unknown;
  try {
    raw = JSON.parse(get(ref) ?? "null");
  } catch {
    configuracionInvalida();
  }
  if (!objeto(raw) || typeof raw.apiKey !== "string" || !raw.apiKey.trim()) {
    configuracionInvalida();
  }
  const bankAccountId = typeof raw.bankAccountId === "string"
    ? raw.bankAccountId
    : undefined;
  if (
    bankAccountId !== undefined &&
    !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(bankAccountId)
  ) configuracionInvalida();
  const useLinkedAccount = raw.useLinkedAccount === true;
  // Payment Link no acepta bankAccountId: su cuenta se elige mediante la API key.
  if (
    metodo === "link" ? !useLinkedAccount : !bankAccountId && !useLinkedAccount
  ) configuracionInvalida();
  // Evita declarar simultáneamente dos posibles destinos para una credencial.
  if (bankAccountId && useLinkedAccount) configuracionInvalida();
  return { apiKey: raw.apiKey, bankAccountId, useLinkedAccount };
}

export function validarUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      configuracionInvalida();
    }
  } catch {
    configuracionInvalida();
  }
}

export class ErrorPey extends Error {
  constructor(public definitivo: boolean) {
    super("No se pudo confirmar la creación del cobro.");
  }
}

export function construirPeticion(
  r: Reserva,
  entrada: Entrada,
  cuenta: Cuenta,
  config: Configuracion,
) {
  const metadata: Record<string, string> = {
    pago_id: r.id,
    solicitud_id: r.solicitudId,
    tienda_id: r.tiendaId,
    num_ref: String(r.numRef),
    concept: r.concept,
  };
  r.articulos.forEach((a, i) =>
    metadata[`articulo_${i + 1}`] = `${a.solicitudArticuloId}:${a.unidades}`
  );
  const common = { amount: r.montoCentavos / 100, metadata };
  if (r.metodo === "link") {
    return {
      path: "/payment-link/create",
      body: {
        ...common,
        clientReferenceId: r.id,
        hasTip: false,
        successUrl: config.successUrl,
        backUrl: config.backUrl,
      },
    };
  }
  return {
    path: r.metodo === "qr" ? "/codi/qr" : "/codi/pn",
    body: {
      ...common,
      concept: r.concept,
      numRef: String(r.numRef),
      expiration: 600,
      ...(cuenta.bankAccountId ? { bankAccountId: cuenta.bankAccountId } : {}),
      ...(r.metodo === "qr"
        ? { generateImage: true }
        : { phoneNumber: entrada.phoneNumber }),
    },
  };
}

export async function crearEnPey(
  r: Reserva,
  entrada: Entrada,
  cuenta: Cuenta,
  config: Configuracion,
  fetcher: typeof fetch = fetch,
): Promise<ResultadoPey> {
  const { path, body } = construirPeticion(r, entrada, cuenta, config);
  try {
    // Nunca reintentar este POST: pey no documenta una llave de idempotencia.
    const response = await fetcher(`https://api.pey.mx${path}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      headers: {
        Authorization: `Bearer ${cuenta.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const type = objeto(result) && objeto(result.error)
        ? result.error.type
        : undefined;
      const definitivos = [
        "INVALID_REQUEST",
        "INVALID_PARAMETER",
        "INVALID_AMOUNT",
        "INVALID_STATE",
        "INCOMPLETE_PARAMETERS",
        "INVALID_URL",
        "INVALID_HAS_TIP",
        "INVALID_CLIENT_REFERENCE_ID",
        "REQUEST_PARSING_ERROR",
        "AUTH_ERROR",
      ];
      throw new ErrorPey(
        [401, 403].includes(response.status) ||
          response.status === 400 && definitivos.includes(type as string),
      );
    }
    if (!objeto(result)) throw new ErrorPey(false);
    const str = (key: string): string => {
      if (typeof result[key] !== "string" || !result[key]) {
        throw new ErrorPey(false);
      }
      return result[key] as string;
    };
    // Lista explícita de campos: nunca guardar el cuerpo completo del proveedor.
    if (r.metodo === "qr") {
      return {
        metodo: "qr",
        id: str("id"),
        qrString: str("qrString"),
        qrImage: typeof result.qrImage === "string" ? result.qrImage : null,
      };
    }
    if (r.metodo === "push") {
      return {
        metodo: "push",
        transactionId: str("transactionId"),
        codiId: str("codiId"),
      };
    }
    const url = str("url");
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" || parsed.hostname !== "app.mipey.mx" ||
      parsed.username || parsed.password
    ) throw new ErrorPey(false);
    return { metodo: "link", id: str("id"), url };
  } catch (error) {
    if (error instanceof ErrorPey) throw error;
    throw new ErrorPey(false);
  }
}
