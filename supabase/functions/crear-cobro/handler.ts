import { Almacen, ErrorCobro, validarEntrada } from "./domain.ts";
import { Configuracion, crearEnPey, ErrorPey, validarUrl } from "./pey.ts";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const responder = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

async function leerJson(req: Request): Promise<unknown> {
  if (
    !req.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) {
    throw new ErrorCobro(415, "CONTENIDO_INVALIDO", "Usa application/json.");
  }
  const reader = req.body?.getReader();
  if (!reader) {
    throw new ErrorCobro(400, "JSON_INVALIDO", "Envía un objeto JSON válido.");
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 16384) {
      await reader.cancel();
      throw new ErrorCobro(
        413,
        "PETICION_DEMASIADO_GRANDE",
        "La petición excede el tamaño permitido.",
      );
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    throw new ErrorCobro(400, "JSON_INVALIDO", "Envía un objeto JSON válido.");
  }
}

export function crearHandler(
  almacen: Almacen,
  config: Configuracion,
  fetcher: typeof fetch = fetch,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: HEADERS });
    }
    if (req.method !== "POST") {
      return responder({ error: { codigo: "METODO_NO_PERMITIDO" } }, 405);
    }
    try {
      const entrada = validarEntrada(await leerJson(req));
      if (entrada.metodo === "link") {
        validarUrl(config.successUrl);
        validarUrl(config.backUrl);
      }
      const reserva = await almacen.reservar(entrada, (ref) => {
        config.cuenta(ref, entrada.metodo);
      });
      const resumen = {
        pagoId: reserva.id,
        numRef: String(reserva.numRef),
        metodo: reserva.metodo,
        montoCentavos: reserva.montoCentavos,
        moneda: "MXN",
      };
      let definitivo = false;
      try {
        const resultado = await crearEnPey(
          reserva,
          entrada,
          config.cuenta(reserva.credencialRef, entrada.metodo),
          config,
          fetcher,
        );
        await almacen.guardarResultado(reserva, resultado);
        return responder({ ...resumen, estado: "creado", ...resultado }, 201);
      } catch (error) {
        definitivo = error instanceof ErrorPey && error.definitivo;
        try {
          await almacen.marcarIntento(
            reserva,
            definitivo ? "rechazado" : "incierto",
          );
        } catch {
          // Si no se puede liberar la reserva, tratarla también como incierta.
          definitivo = false;
        }
      }
      return responder({
        ...resumen,
        estado: definitivo ? "fallido" : "creado",
        error: {
          codigo: definitivo ? "PEY_RECHAZO_COBRO" : "COBRO_INCIERTO",
          mensaje: definitivo
            ? "Pey rechazó el cobro."
            : "El cobro requiere conciliación. Conserva pagoId y no repitas el intento automáticamente.",
        },
      }, definitivo ? 502 : 202);
    } catch (error) {
      if (error instanceof ErrorCobro) {
        return responder({
          error: { codigo: error.codigo, mensaje: error.message },
        }, error.status);
      }
      // Nunca imprimir excepciones SQL, cuerpos, secretos ni el teléfono del push.
      return responder({
        error: {
          codigo: "COBRO_NO_DISPONIBLE",
          mensaje: "El servicio de cobro no está disponible.",
        },
      }, 503);
    }
  };
}
