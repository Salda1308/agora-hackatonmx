import { seguimiento } from "../_shared/seguimiento.ts";
import { comprobantePublico, crearHandler, type Pago } from "./handler.ts";
const assert = (condition: unknown) => {
  if (!condition) throw new Error("Assertion failed");
};
const id = "f5000000-0000-0000-0000-000000000001";
Deno.test("token firmado: válido, alterado, vencido y secreto distinto", async () => {
  const tokens = seguimiento("a".repeat(40));
  const now = 1794700000000;
  const token = await tokens.emitir(id, now);
  assert(await tokens.verificar(token, now) === id);
  assert(await tokens.verificar(token.replace("f500", "f600"), now) === null);
  assert(await tokens.verificar(token, now + 604800000) === null);
  assert(await seguimiento("b".repeat(40)).verificar(token, now) === null);
});
Deno.test("comprobante: lista permitida excluye datos bancarios y metadata", () => {
  const value = comprobantePublico({
    folio: "AGORA-1",
    clabe: "private",
    metadata: { secret: 1 },
    articulos: [{ nombre: "Agua", unidades: 1, phone: "private" }],
  });
  assert(value?.folio === "AGORA-1");
  assert(!JSON.stringify(value).includes("private"));
  assert(!("metadata" in value!));
});
const request = (token: string) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
Deno.test("rechaza token inválido antes de consultar DB", async () => {
  let reads = 0;
  const handler = crearHandler(async () => null, async () => {
    reads++;
    return null;
  });
  assert((await handler(request("invalid"))).status === 404);
  assert(reads === 0);
});
Deno.test("pago creado no entrega comprobante; pagado entrega solo su comprobante", async () => {
  const row: Pago = {
    id,
    solicitud_id: id,
    estado: "creado",
    monto_centavos: 1,
    metodo: "qr",
    pagado_en: null,
    metadata: { secret: "private", comprobante: { folio: "AGORA-1" } },
  };
  const handler = crearHandler(
    async (token) => token === "valid" ? id : null,
    async (requested) => {
      assert(requested === id);
      return row;
    },
  );
  const first = await handler(request("valid"));
  assert(first.headers.get("cache-control") === "no-store");
  assert((await first.json()).comprobante === null);
  row.estado = "pagado";
  row.pagado_en = new Date().toISOString();
  const second = await (await handler(request("valid"))).json();
  assert(second.comprobante.folio === "AGORA-1");
  assert(!JSON.stringify(second).includes("private"));
});
Deno.test("limita cuerpo y no revela excepciones", async () => {
  const handler = crearHandler(async () => id, async () => {
    throw new Error("private");
  });
  const result = await handler(request("valid"));
  assert(result.status === 503);
  assert(!(await result.text()).includes("private"));
  assert((await handler(request("x".repeat(1100)))).status === 413);
});
