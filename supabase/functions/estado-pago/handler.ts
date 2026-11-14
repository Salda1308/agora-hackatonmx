const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
export type Pago = {
  id: string;
  estado: string;
  solicitud_id: string;
  monto_centavos: number;
  metodo: string;
  pagado_en: string | null;
  metadata: Record<string, unknown>;
};
// Explicit allowlist: no metadata, payer/bank details or anomalies are returned.
export function comprobantePublico(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (
    const field of [
      "version",
      "folio",
      "pagoId",
      "solicitudId",
      "tiendaId",
      "montoCentavos",
      "moneda",
      "metodo",
      "pagadoEn",
      "peyTransactionId",
    ]
  ) {
    if (typeof input[field] === "string" || typeof input[field] === "number") {
      result[field] = input[field];
    }
  }
  result.articulos = Array.isArray(input.articulos)
    ? input.articulos.map((value) => {
      const item = value && typeof value === "object"
        ? value as Record<string, unknown>
        : {};
      return Object.fromEntries(
        ["solicitudArticuloId", "nombre", "unidades", "precioUnitarioCentavos"]
          .filter((field) =>
            typeof item[field] === "string" || typeof item[field] === "number"
          ).map((field) => [field, item[field]]),
      );
    })
    : [];
  return result;
}
export function crearHandler(
  verificar: (token: string) => Promise<string | null>,
  consultar: (id: string) => Promise<Pago | null>,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (req.method !== "POST") {
      return respond({ error: "Método no permitido" }, 405);
    }
    if (!req.headers.get("content-type")?.startsWith("application/json")) {
      return respond({ error: "Usa JSON" }, 415);
    }
    try {
      const reader = req.body?.getReader();
      if (!reader) return respond({ error: "Token requerido" }, 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 1024) {
          await reader.cancel();
          return respond({ error: "Petición demasiado grande" }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      let body;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return respond({ error: "JSON inválido" }, 400);
      }
      if (
        !body || typeof body.token !== "string" ||
        Object.keys(body).length !== 1
      ) return respond({ error: "Token requerido" }, 400);
      const id = await verificar(body.token);
      if (!id) return respond({ error: "Seguimiento no disponible" }, 404);
      const pago = await consultar(id);
      if (!pago) return respond({ error: "Seguimiento no disponible" }, 404);
      return respond({
        pagoId: pago.id,
        solicitudId: pago.solicitud_id,
        estado: pago.estado,
        montoCentavos: pago.monto_centavos,
        metodo: pago.metodo,
        pagadoEn: pago.pagado_en,
        comprobante: pago.estado === "pagado"
          ? comprobantePublico(pago.metadata.comprobante)
          : null,
      });
    } catch {
      return respond({ error: "No se pudo consultar el pago" }, 503);
    }
  };
}
