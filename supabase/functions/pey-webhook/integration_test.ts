// Pruebas contra el Postgres y Realtime locales de Supabase, con pey simulado.
// Los pagos se reservan con el almacén real de crear-cobro (T03) para probar el
// contrato completo. Opt-in: AGORA_TEST_DATABASE_URL (y para Realtime,
// AGORA_TEST_SUPABASE_URL + AGORA_TEST_JWT_SECRET del stack local).
import { createClient } from "@supabase/supabase-js";
import { crearAlmacen as crearAlmacenT03 } from "../crear-cobro/store.ts";
import { Entrada, Metodo, Reserva } from "../crear-cobro/domain.ts";
import { crearHandler } from "./handler.ts";
import { Consulta, leerTransaccion } from "./pey.ts";
import { conectar, crearAlmacen } from "./store.ts";
import {
  assert,
  DATOS_PAGADOR,
  eventoCodi,
  eventoLink,
  igual,
  peticionFirmada,
  SECRETO_PRUEBA,
  transaccionPey,
} from "./test_helpers.ts";

const url = Deno.env.get("AGORA_TEST_DATABASE_URL");
const supabaseUrl = Deno.env.get("AGORA_TEST_SUPABASE_URL");
const jwtSecret = Deno.env.get("AGORA_TEST_JWT_SECRET");

async function jwtAnon(secret: string): Promise<string> {
  const b64 = (s: string | Uint8Array) =>
    btoa(typeof s === "string" ? s : String.fromCharCode(...s))
      .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({
    role: "anon",
    iss: "supabase-demo",
    exp: Math.floor(Date.now() / 1000) + 600,
  }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64(new Uint8Array(sig))}`;
}

let contadorTx = 0;
const nuevaTx = () => `01KT04PRUEBA${String(++contadorTx).padStart(14, "0")}`;

Deno.test({
  name:
    "Postgres real: confirmación atómica, idempotencia, anomalías, contrato con T03 y Realtime",
  ignore: !url,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const sql = conectar(url!);
    const otraSql = conectar(url!);
    const t03 = crearAlmacenT03(sql, 100000000);
    const fundacion = crypto.randomUUID(), tienda = crypto.randomUUID();
    const solicitudId = crypto.randomUUID();
    const catA = crypto.randomUUID(), catB = crypto.randomUUID();
    const artA = crypto.randomUUID(), artB = crypto.randomUUID();

    // pey simulado: cada transacción se define en la prueba.
    const transacciones = new Map<string, unknown>();
    const consultas: string[] = [];
    const logs: Record<string, unknown>[] = [];
    const deps = (almacen = crearAlmacen(sql)) => ({
      secreto: SECRETO_PRUEBA,
      almacen,
      apiKeyDe: (ref: string) =>
        ref === "PEY_TIENDA_T04" ? "clave-ficticia" : null,
      consultar: (_k: string, id: string): Promise<Consulta> => {
        consultas.push(id);
        const tr = leerTransaccion(transacciones.get(id));
        return Promise.resolve(
          tr ? { tipo: "ok", transaccion: tr } : { tipo: "no_encontrada" },
        );
      },
      log: (r: Record<string, unknown>) => logs.push(r),
    });
    const handler = crearHandler(deps());
    const handlerOtro = crearHandler(deps(crearAlmacen(otraSql)));

    const reservar = (metodo: Metodo, articulos: [string, number][]) =>
      t03.reservar(
        {
          solicitudId,
          metodo,
          articulos: articulos.map(([solicitudArticuloId, unidades]) => ({
            solicitudArticuloId,
            unidades,
          })),
        } as Entrada,
        () => {},
      );
    const pagadas = async () => {
      const filas =
        await sql`select id, unidades_pagadas from public.solicitud_articulos
        where solicitud_id = ${solicitudId}`;
      return Object.fromEntries(filas.map((f) => [f.id, f.unidades_pagadas]));
    };
    const pago = async (id: string) =>
      (await sql`select * from public.pagos where id = ${id}`)[0];
    const enviar = async (cuerpo: unknown, webhookId?: string) =>
      (await handler(await peticionFirmada(cuerpo, { webhookId }))).status;
    const transaccionDe = (
      r: Reserva,
      tx: string,
      extra: Record<string, unknown> = {},
    ) =>
      transaccionPey({
        id: tx,
        pagoId: r.id,
        numRef: r.numRef,
        amount: r.montoCentavos / 100,
        payableType: {
          qr: "API_CODI_QR",
          push: "API_CODI_PN",
          link: "PAYMENT_LINK",
        }[r.metodo],
        ...extra,
      });

    try {
      await sql`insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, es_ejemplo) values
        (${fundacion}, 'fundacion', 'asilo', 'T04 test', ${`t04-${fundacion}`}, true, true),
        (${tienda}, 'tienda', null, 'T04 test', ${`t04-${tienda}`}, true, true)`;
      await sql`insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, credencial_ref)
        values (${tienda}, 'TEST', 'AAA010101AAA', 'PEY_TIENDA_T04')`;
      await sql`insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos, es_ejemplo) values
        (${catA}, ${tienda}, 'Garrafón de prueba', 1, true),
        (${catB}, ${tienda}, 'Pañales de prueba', 1, true)`;
      await sql`insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado, es_ejemplo)
        values (${solicitudId}, ${fundacion}, ${tienda}, 'T04 test', 'publicada', true)`;
      await sql`insert into public.solicitud_articulos (id, solicitud_id, articulo_id, nombre, precio_centavos, cantidad) values
        (${artA}, ${solicitudId}, ${catA}, 'x', 999, 5),
        (${artB}, ${solicitudId}, ${catB}, 'x', 999, 5)`;

      await t.step(
        "QR: confirma, sube contadores y emite comprobante sin datos del pagador",
        async () => {
          const r = await reservar("qr", [[artA, 1]]);
          await t03.guardarResultado(r, {
            metodo: "qr",
            id: "QRFICTICIO",
            qrString: "x",
            qrImage: null,
          });
          const tx = nuevaTx();
          transacciones.set(tx, transaccionDe(r, tx));
          igual(
            await enviar(
              eventoCodi("qr", {
                transactionId: tx,
                pagoId: r.id,
                numRef: r.numRef,
              }),
            ),
            200,
          );
          const p = await pago(r.id);
          igual(p.estado, "pagado");
          igual(p.pey_transaccion_id, tx);
          igual(
            p.pagado_en.toISOString(),
            new Date(1763143020 * 1000).toISOString(),
          );
          igual((await pagadas())[artA], 1);
          const c = p.metadata.comprobante;
          igual(c.folio, `AGORA-${String(r.numRef).padStart(7, "0")}`);
          igual(c.solicitudId, solicitudId);
          igual(c.articulos, [{
            solicitudArticuloId: artA,
            nombre: "Garrafón de prueba",
            unidades: 1,
            precioUnitarioCentavos: 1,
          }]);
          igual([c.montoCentavos, c.metodo, c.peyTransactionId], [1, "qr", tx]);
          // La clave "pey" de T03 sigue intacta.
          igual(p.metadata.pey.codiQrId, "QRFICTICIO");
          const texto = JSON.stringify(p.metadata);
          for (
            const v of [
              DATOS_PAGADOR.clabe,
              DATOS_PAGADOR.trackingKey,
              DATOS_PAGADOR.description,
            ]
          ) {
            assert(!texto.includes(v), "metadata con datos del pagador");
          }
          assert(!/clabe|bankCode|trackingKey|accountType/.test(texto));
        },
      );

      await t.step(
        "mismo evento repetido y entregas concurrentes: un solo efecto",
        async () => {
          const r = await reservar("qr", [[artA, 1]]);
          const tx = nuevaTx();
          transacciones.set(tx, transaccionDe(r, tx));
          const ev = eventoCodi("qr", {
            transactionId: tx,
            pagoId: r.id,
            numRef: r.numRef,
          });
          const antes = (await pagadas())[artA];
          // Cinco entregas a la vez por dos conexiones distintas.
          const estados = await Promise.all(
            [0, 1, 2, 3, 4].map(async (i) =>
              (await (i % 2 ? handlerOtro : handler)(
                await peticionFirmada(ev, { webhookId: "msg_concurrente" }),
              )).status
            ),
          );
          igual(estados, [200, 200, 200, 200, 200]);
          igual(await enviar(ev, "msg_concurrente"), 200);
          igual(await enviar(ev, "msg_otro_id"), 200);
          igual((await pagadas())[artA], antes + 1);
          const [{ n }] = await sql`select count(*)::int as n from public.pagos
          where pey_transaccion_id = ${tx}`;
          igual(n, 1);
        },
      );

      await t.step(
        "numRef desconocido: se registra y no financia nada",
        async () => {
          const antes = await pagadas();
          const [{ n: pagosAntes }] =
            await sql`select count(*)::int as n from public.pagos
          where solicitud_id = ${solicitudId} and estado = 'pagado'`;
          const tx = nuevaTx();
          consultas.length = 0;
          igual(
            await enviar(
              eventoCodi("qr", { transactionId: tx, numRef: 9999999 }),
            ),
            200,
          );
          igual(await pagadas(), antes);
          const [{ n }] = await sql`select count(*)::int as n from public.pagos
          where solicitud_id = ${solicitudId} and estado = 'pagado'`;
          igual(n, pagosAntes);
          igual(consultas, []);
          igual(
            (logs.at(-1)!.resultados as { resultado: string }[])[0].resultado,
            "pago_desconocido",
          );
        },
      );

      await t.step(
        "monto distinto: anomalía anotada una vez, pago sigue reservado",
        async () => {
          const r = await reservar("qr", [[artA, 1]]);
          const tx = nuevaTx();
          transacciones.set(tx, transaccionDe(r, tx, { amount: 0.02 }));
          const antes = await pagadas();
          const ev = eventoCodi("qr", {
            transactionId: tx,
            pagoId: r.id,
            numRef: r.numRef,
            amount: 0.02,
          });
          igual(await enviar(ev), 200);
          igual(await enviar(ev), 200);
          const p = await pago(r.id);
          igual(p.estado, "creado");
          igual(p.pey_transaccion_id, null);
          igual(p.metadata.anomalias.map((a: { motivo: string }) => a.motivo), [
            "monto_distinto",
          ]);
          igual(p.metadata.anomalias[0].montoCentavos, 2);
          igual(await pagadas(), antes);
        },
      );

      await t.step(
        "payment link antes de que T03 guarde ids; T03 después no pisa el pago",
        async () => {
          const r = await reservar("link", [[artA, 1], [artB, 2]]);
          igual(r.montoCentavos, 3);
          const tx = nuevaTx();
          transacciones.set(
            tx,
            transaccionDe(r, tx, { payableId: "01LINKFICTICIO000000000000" }),
          );
          const antes = await pagadas();
          const ev = eventoLink({
            transactionIds: [tx],
            clientReferenceId: r.id,
          });
          ev.transactions[0].amount = 0.03;
          ev.transactions[0].amountBreakdown.base = 0.03;
          igual(await enviar(ev), 200);
          const despues = await pagadas();
          igual([despues[artA] - antes[artA], despues[artB] - antes[artB]], [
            1,
            2,
          ]);
          await t03.guardarResultado(r, {
            metodo: "link",
            id: "01LINKFICTICIO000000000000",
            url: "https://x",
          });
          const p = await pago(r.id);
          igual(p.estado, "pagado");
          igual(p.metadata.comprobante.articulos.length, 2);
          igual(p.metadata.pey.paymentLinkId, "01LINKFICTICIO000000000000");
        },
      );

      await t.step(
        "push: correlaciona por numRef; otra transacción para el mismo pago no suma",
        async () => {
          const r = await reservar("push", [[artB, 1]]);
          const tx = nuevaTx();
          await t03.guardarResultado(r, {
            metodo: "push",
            transactionId: tx,
            codiId: "CODIFICTICIO",
          });
          transacciones.set(tx, transaccionDe(r, tx));
          const antes = (await pagadas())[artB];
          igual(
            await enviar(
              eventoCodi("pn", { transactionId: tx, numRef: r.numRef }),
            ),
            200,
          );
          igual((await pagadas())[artB], antes + 1);
          const tx2 = nuevaTx();
          transacciones.set(tx2, transaccionDe(r, tx2));
          igual(
            await enviar(
              eventoCodi("pn", { transactionId: tx2, numRef: r.numRef }),
            ),
            200,
          );
          igual((await pagadas())[artB], antes + 1);
          const p = await pago(r.id);
          igual(p.pey_transaccion_id, tx);
          igual(
            p.metadata.anomalias.map((a: { motivo: string }) => a.motivo),
            ["pago_ya_confirmado_con_otra_transaccion"],
          );
        },
      );

      await t.step(
        "PENDING responde 503 y no libera; pago fallido y exceso no financian",
        async () => {
          const r = await reservar("qr", [[artA, 1]]);
          const tx = nuevaTx();
          transacciones.set(tx, transaccionDe(r, tx, { status: "PENDING" }));
          const antes = await pagadas();
          const ev = eventoCodi("qr", {
            transactionId: tx,
            pagoId: r.id,
            numRef: r.numRef,
          });
          igual(await enviar(ev), 503);
          igual((await pago(r.id)).estado, "creado");

          // Rechazo de T03 libera la reserva; un pago tardío no la revive.
          await t03.marcarIntento(r, "rechazado");
          transacciones.set(tx, transaccionDe(r, tx));
          igual(await enviar(ev), 200);
          const p = await pago(r.id);
          igual(p.estado, "fallido");
          igual(p.metadata.anomalias.map((a: { motivo: string }) => a.motivo), [
            "pago_no_vigente",
          ]);

          // Si los contadores ya no admiten las unidades, nada se escribe.
          const r2 = await reservar("qr", [[artA, 1]]);
          await sql`update public.solicitud_articulos set unidades_pagadas = cantidad where id = ${artA}`;
          const tx2 = nuevaTx();
          transacciones.set(tx2, transaccionDe(r2, tx2));
          igual(
            await enviar(
              eventoCodi("qr", {
                transactionId: tx2,
                pagoId: r2.id,
                numRef: r2.numRef,
              }),
            ),
            200,
          );
          const p2 = await pago(r2.id);
          igual([p2.estado, p2.metadata.anomalias[0].motivo], [
            "creado",
            "excede_cantidad",
          ]);
          await sql`update public.solicitud_articulos set unidades_pagadas = ${
            antes[artA]
          } where id = ${artA}`;
          igual(await pagadas(), antes);
        },
      );

      await t.step({
        name:
          "Realtime: un cliente anónimo recibe el cambio de unidades_pagadas",
        ignore: !supabaseUrl || !jwtSecret,
        fn: async () => {
          const anon = await jwtAnon(jwtSecret!);
          const cliente = createClient(supabaseUrl!, anon, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const recibidos: Record<string, unknown>[] = [];
          let suscrito!: () => void;
          const listo = new Promise<void>((res) => (suscrito = res));
          const canal = cliente.channel(`t04-${solicitudId}`)
            .on("postgres_changes", {
              event: "UPDATE",
              schema: "public",
              table: "solicitud_articulos",
              filter: `solicitud_id=eq.${solicitudId}`,
            }, (p) => recibidos.push(p.new))
            .subscribe((estado) => {
              if (estado === "SUBSCRIBED") suscrito();
            });
          try {
            await Promise.race([
              listo,
              new Promise((_, rej) =>
                setTimeout(() => rej(new Error("sin suscripción")), 15000)
              ),
            ]);
            // Margen para que Realtime registre la suscripción en la réplica.
            await new Promise((res) => setTimeout(res, 1500));
            const r = await reservar("qr", [[artB, 1]]);
            const tx = nuevaTx();
            transacciones.set(tx, transaccionDe(r, tx));
            const esperado = (await pagadas())[artB] + 1;
            igual(
              await enviar(
                eventoCodi("qr", {
                  transactionId: tx,
                  pagoId: r.id,
                  numRef: r.numRef,
                }),
              ),
              200,
            );
            const limite = Date.now() + 10000;
            while (
              !recibidos.some((n) =>
                n.id === artB && n.unidades_pagadas === esperado
              )
            ) {
              if (Date.now() > limite) {
                throw new Error("Realtime no entregó el cambio");
              }
              await new Promise((res) => setTimeout(res, 200));
            }
            // Control negativo: con la solicitud en borrador, RLS no deja pasar el cambio.
            await sql`update public.solicitudes set estado = 'borrador' where id = ${solicitudId}`;
            const n = recibidos.length;
            await sql`update public.solicitud_articulos set unidades_listas = unidades_listas where id = ${artB}`;
            await new Promise((res) => setTimeout(res, 2500));
            igual(recibidos.length, n);
            await sql`update public.solicitudes set estado = 'publicada' where id = ${solicitudId}`;
          } finally {
            await cliente.removeChannel(canal);
            await cliente.realtime.disconnect();
          }
        },
      });
    } finally {
      await sql`delete from public.pago_articulos where pago_id in (select id from public.pagos where solicitud_id = ${solicitudId})`;
      await sql`delete from public.pagos where solicitud_id = ${solicitudId}`;
      await sql`delete from public.solicitud_articulos where solicitud_id = ${solicitudId}`;
      await sql`delete from public.solicitudes where id = ${solicitudId}`;
      await sql`delete from public.catalogo_articulos where tienda_id = ${tienda}`;
      await sql`delete from public.tiendas_cobro where organizacion_id = ${tienda}`;
      await sql`delete from public.organizaciones where id in (${fundacion}, ${tienda})`;
      await sql.end();
      await otraSql.end();
    }
  },
});
