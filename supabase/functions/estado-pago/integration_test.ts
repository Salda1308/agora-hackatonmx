// Only isolated local Postgres; pey transport and transaction lookup are mocked.
import { conectar, crearAlmacen as cobros } from "../crear-cobro/store.ts";
import { crearHandler as crearCobro } from "../crear-cobro/handler.ts";
import { crearHandler as crearWebhook } from "../pey-webhook/handler.ts";
import { crearAlmacen as webhookStore } from "../pey-webhook/store.ts";
import { leerTransaccion } from "../pey-webhook/pey.ts";
import {
  eventoCodi,
  eventoLink,
  peticionFirmada,
  SECRETO_PRUEBA,
  transaccionPey,
} from "../pey-webhook/test_helpers.ts";
import { seguimiento } from "../_shared/seguimiento.ts";
import { crearHandler as estado, type Pago } from "./handler.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Assertion failed");
};
const url = Deno.env.get("AGORA_TEST_DATABASE_URL");
Deno.test({
  name: "T05: QR/push/link -> webhook -> token -> comprobante, Postgres real",
  ignore: !url,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    if (
      !/^postgres(?:ql)?:\/\/[^@]*@127\.0\.0\.1:57322\//.test(url!)
    ) throw new Error("Usar solamente el stack T05 aislado en 57322");
    const sql = conectar(url!);
    const org = crypto.randomUUID(),
      store = crypto.randomUUID(),
      catalog = crypto.randomUUID(),
      requestId = crypto.randomUUID(),
      article = crypto.randomUUID();
    const tokens = seguimiento("local-test-secret-with-at-least-32-characters");
    const status = estado(
      tokens.verificar,
      async (id) =>
        (await sql<Pago[]>`select * from public.pagos where id = ${id}`)[0] ??
          null,
    );
    const post = (body: unknown) =>
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      await sql`insert into public.organizaciones(id,tipo,categoria,nombre,slug,verificada,es_ejemplo) values
      (${org},'fundacion','asilo','T05 fixture',${`t05-${org}`},true,true), (${store},'tienda',null,'T05 fixture',${`t05-${store}`},true,true)`;
      await sql`insert into public.tiendas_cobro(organizacion_id,titular_nombre,rfc,credencial_ref) values(${store},'TEST','AAA010101AAA','PEY_T05_TEST')`;
      await sql`insert into public.catalogo_articulos(id,tienda_id,nombre,precio_centavos,es_ejemplo) values(${catalog},${store},'Agua T05',1,true)`;
      await sql`insert into public.solicitudes(id,organizacion_id,tienda_id,titulo,estado,es_ejemplo) values(${requestId},${org},${store},'T05 fixture','publicada',true)`;
      await sql`insert into public.solicitud_articulos(id,solicitud_id,articulo_id,cantidad) values(${article},${requestId},${catalog},10)`;
      let paid = 0;
      for (const method of ["qr", "push", "link"] as const) {
        let calls = 0;
        const transactionId = `01T05TEST${method.toUpperCase()}000000000000`;
        const create = crearCobro(cobros(sql, 1), {
          cuenta: () => ({ apiKey: "fake", useLinkedAccount: true }),
          maximoCentavos: 1,
          successUrl: "https://example.com",
          backUrl: "https://example.com",
        }, () => {
          calls++;
          return Promise.resolve(
            Response.json(
              method === "qr"
                ? { id: "QR_TEST", qrString: "payload-test", qrImage: null }
                : method === "push"
                ? { transactionId, codiId: "CODI_TEST" }
                : {
                  id: "LINK_TEST",
                  url: "https://app.mipey.mx/checkout/payment-link/test",
                },
            ),
          );
        }, tokens.emitir);
        const response = await create(
          post({
            solicitudId: requestId,
            metodo: method,
            articulos: [{ solicitudArticuloId: article, unidades: 1 }],
            ...(method === "push" ? { phoneNumber: "0000000000" } : {}),
          }),
        );
        assert(response.status === 201 && calls === 1);
        const charge = await response.json();
        assert(
          await tokens.verificar(charge.seguimientoToken) === charge.pagoId,
        );
        const pending =
          await (await status(post({ token: charge.seguimientoToken }))).json();
        assert(pending.estado === "creado" && pending.comprobante === null);
        const transaction = leerTransaccion(
          transaccionPey({
            id: transactionId,
            pagoId: charge.pagoId,
            numRef: charge.numRef,
            amount: 0.01,
            payableType: {
              qr: "API_CODI_QR",
              push: "API_CODI_PN",
              link: "PAYMENT_LINK",
            }[method],
          }),
        )!;
        const hook = crearWebhook({
          secreto: SECRETO_PRUEBA,
          almacen: webhookStore(sql),
          apiKeyDe: () => "fake",
          consultar: () =>
            Promise.resolve({ tipo: "ok", transaccion: transaction }),
          log: () => {},
        });
        const event = method === "link"
          ? eventoLink({
            transactionIds: [transactionId],
            clientReferenceId: charge.pagoId,
          })
          : eventoCodi(method === "push" ? "pn" : "qr", {
            transactionId,
            pagoId: charge.pagoId,
            numRef: charge.numRef,
          });
        assert((await hook(await peticionFirmada(event))).status === 200);
        assert((await hook(await peticionFirmada(event))).status === 200);
        paid++;
        const receipt =
          await (await status(post({ token: charge.seguimientoToken }))).json();
        assert(
          receipt.estado === "pagado" &&
            receipt.comprobante.pagoId === charge.pagoId &&
            receipt.comprobante.montoCentavos === 1,
        );
        assert(receipt.comprobante.articulos[0].unidades === 1);
        const [counter] =
          await sql`select unidades_pagadas from public.solicitud_articulos where id = ${article}`;
        assert(counter.unidades_pagadas === paid);
        assert(
          !/clabe|trackingKey|phoneNumber|fake/.test(JSON.stringify(receipt)),
        );
      }
    } finally {
      await sql`delete from public.pago_articulos where pago_id in (select id from public.pagos where solicitud_id = ${requestId})`;
      await sql`delete from public.pagos where solicitud_id = ${requestId}`;
      await sql`delete from public.solicitud_articulos where solicitud_id = ${requestId}`;
      await sql`delete from public.solicitudes where id = ${requestId}`;
      await sql`delete from public.catalogo_articulos where id = ${catalog}`;
      await sql`delete from public.tiendas_cobro where organizacion_id = ${store}`;
      await sql`delete from public.organizaciones where id in (${org},${store})`;
      await sql.end();
    }
  },
});
