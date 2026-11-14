// Webhook de pey (T04): firma Standard Webhooks, confirmación con
// GET /transaction/:id y financiamiento idempotente del pago creado por T03.
// Respuestas: 401 firma inválida, 400 JSON inválido, 503 fallo transitorio
// (pey puede reintentar; el efecto sigue siendo único), 200 en lo demás,
// incluidos eventos desconocidos o anómalos, que se registran sin financiar.
import { Candidato, interpretarEvento, redact } from "./evento.ts";
import { verificarFirma } from "./firma.ts";
import { Consulta } from "./pey.ts";
import { Almacen, Pago } from "./store.ts";

export type Dependencias = {
  secreto: string | undefined;
  almacen: Almacen | null;
  apiKeyDe: (credencialRef: string) => string | null;
  consultar: (apiKey: string, transactionId: string) => Promise<Consulta>;
  log: (registro: Record<string, unknown>) => void;
  ahora?: () => number;
};

type Resultado = {
  transactionId: string;
  pagoId?: string;
  resultado:
    | "confirmado"
    | "duplicado"
    | "anomalia"
    | "pago_desconocido"
    | "correlacion_ambigua"
    | "transitorio";
  motivo?: string;
  folio?: string;
};

const MAX_BODY = 256 * 1024;

const respuesta = (status: number, texto: string) =>
  new Response(texto, { status, headers: { "content-type": "text/plain" } });

export function crearHandler(deps: Dependencias) {
  const ahora = deps.ahora ?? (() => Date.now());

  async function procesar(
    c: Candidato,
    almacen: Almacen,
    webhookId: string,
    type: string,
  ): Promise<Resultado> {
    const base = { transactionId: c.transactionId };
    let pagos: Pago[];
    try {
      pagos = await almacen.buscarPagos(c);
    } catch {
      return { ...base, resultado: "transitorio", motivo: "db" };
    }
    if (pagos.length === 0) return { ...base, resultado: "pago_desconocido" };
    if (pagos.length > 1) return { ...base, resultado: "correlacion_ambigua" };
    const pago = pagos[0];
    const conPago = { ...base, pagoId: pago.id };
    // Reentrega de un evento ya aplicado: sin efecto y sin volver a consultar pey.
    if (pago.estado === "pagado" && pago.peyTransaccionId === c.transactionId) {
      return { ...conPago, resultado: "duplicado" };
    }

    const apiKey = pago.credencialRef
      ? deps.apiKeyDe(pago.credencialRef)
      : null;
    if (!apiKey) {
      return {
        ...conPago,
        resultado: "transitorio",
        motivo: "credencial_tienda",
      };
    }
    const consulta = await deps.consultar(apiKey, c.transactionId);
    if (consulta.tipo === "error") {
      return {
        ...conPago,
        resultado: "transitorio",
        motivo: `pey_${consulta.http ?? "red"}`,
      };
    }

    const anomalia = async (motivo: string, montoCentavos: number | null) => {
      try {
        await almacen.registrarAnomalia(pago.id, {
          motivo,
          transactionId: c.transactionId,
          montoCentavos,
          webhookId,
        });
        return { ...conPago, resultado: "anomalia", motivo } as Resultado;
      } catch {
        return {
          ...conPago,
          resultado: "transitorio",
          motivo: "db",
        } as Resultado;
      }
    };

    if (consulta.tipo === "no_encontrada") {
      return await anomalia("transaccion_no_encontrada", null);
    }
    const t = consulta.transaccion;
    // Un PENDING no es un rechazo: se responde 503 para que pey reintente y el
    // pago sigue "creado" (nunca se libera solo por tiempo).
    if (t.status !== "PAID") {
      return {
        ...conPago,
        resultado: "transitorio",
        motivo: "transaccion_no_pagada",
      };
    }
    if (t.id !== c.transactionId) {
      return await anomalia("transaccion_inconsistente", t.montoBaseCentavos);
    }
    if (t.moneda !== "MXN") {
      return await anomalia("moneda_distinta", t.montoBaseCentavos);
    }
    // La correlación debe sostenerse con lo que dice pey, no solo con el cuerpo.
    if (
      (t.pagoId !== null && t.pagoId !== pago.id) ||
      (t.numRef !== null && t.numRef !== pago.numRef)
    ) {
      return await anomalia("correlacion_distinta", t.montoBaseCentavos);
    }
    const respaldada = t.pagoId === pago.id || t.numRef === pago.numRef ||
      pago.peyTransaccionId === t.id ||
      (t.payableId !== null && pago.peyIds.includes(t.payableId));
    if (!respaldada) {
      return await anomalia("correlacion_no_confirmada", t.montoBaseCentavos);
    }
    if (t.metodo !== pago.metodo) {
      return await anomalia("metodo_distinto", t.montoBaseCentavos);
    }
    if (t.montoBaseCentavos !== pago.montoCentavos) {
      return await anomalia("monto_distinto", t.montoBaseCentavos);
    }

    try {
      const r = await almacen.confirmar({
        pagoId: pago.id,
        transaccion: t,
        webhookId,
        evento: type,
      });
      if (r.tipo === "confirmado") {
        return { ...conPago, resultado: "confirmado", folio: r.folio };
      }
      if (r.tipo === "duplicado") return { ...conPago, resultado: "duplicado" };
      return { ...conPago, resultado: "anomalia", motivo: r.motivo };
    } catch {
      return { ...conPago, resultado: "transitorio", motivo: "db" };
    }
  }

  return async (req: Request): Promise<Response> => {
    // pey (o el portal) puede probar la URL con GET.
    if (req.method !== "POST") return respuesta(200, "ok");

    const largo = Number(req.headers.get("content-length") ?? "0");
    if (largo > MAX_BODY) return respuesta(413, "payload too large");
    const body = await req.text();
    if (body.length > MAX_BODY) return respuesta(413, "payload too large");

    if (!deps.secreto) {
      deps.log({ msg: "pey-webhook: secreto no configurado" });
      return respuesta(503, "not configured");
    }
    const firma = await verificarFirma(
      deps.secreto,
      req.headers,
      body,
      Math.floor(ahora() / 1000),
    );
    if (firma !== "valida") {
      deps.log({ msg: "pey-webhook: firma rechazada", firma });
      return respuesta(401, "invalid signature");
    }
    const webhookId = (req.headers.get("webhook-id") ?? "").slice(0, 128);

    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      deps.log({ msg: "pey-webhook: JSON inválido", webhookId });
      return respuesta(400, "bad request");
    }

    const evento = interpretarEvento(raw);
    if (evento.tipo === "ignorado") {
      deps.log({
        msg: "pey-webhook: ignorado",
        webhookId,
        type: evento.type,
        motivo: evento.motivo,
        event: redact(raw),
      });
      return respuesta(200, "ok");
    }
    if (!deps.almacen) {
      deps.log({ msg: "pey-webhook: sin base de datos", webhookId });
      return respuesta(503, "not configured");
    }

    const resultados: Resultado[] = [];
    for (const c of evento.candidatos) {
      resultados.push(await procesar(c, deps.almacen, webhookId, evento.type));
    }
    deps.log({
      msg: "pey-webhook: procesado",
      webhookId,
      type: evento.type,
      resultados,
      event: redact(raw),
    });
    return resultados.some((r) => r.resultado === "transitorio")
      ? respuesta(503, "retry")
      : respuesta(200, "ok");
  };
}
