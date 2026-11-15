import { Entrada, ErrorCobro, Metodo } from "./domain.ts";
import { crearHandler } from "./handler.ts";
import { conectar, crearAlmacen } from "./store.ts";
import { assert, igual } from "./test_helpers.ts";

// Opt-in explícito. El permiso de red del comando limita a Postgres local.
const url = Deno.env.get("AGORA_TEST_DATABASE_URL");
Deno.test({
  name:
    "Postgres real: reservas, concurrencia, rollback, estados y persistencia de las tres vías",
  ignore: !url,
  fn: async (t) => {
    const sql = conectar(url!);
    const fundacion = crypto.randomUUID(),
      tienda = crypto.randomUUID(),
      solicitudId = crypto.randomUUID();
    const articulo = crypto.randomUUID(),
      solicitudArticuloId = crypto.randomUUID();
    const storage = crearAlmacen(sql, 100000000);
    const input = (unidades = 1, metodo: Metodo = "qr"): Entrada => ({
      solicitudId,
      metodo,
      articulos: [{ solicitudArticuloId, unidades }],
      ...(metodo === "push" ? { phoneNumber: "0000000000" } : {}),
    });
    const noConfig = () => {};
    const reset = async (cantidad = 1, pagadas = 0) => {
      await sql`delete from public.pago_articulos where pago_id in (select id from public.pagos where solicitud_id = ${solicitudId})`;
      await sql`delete from public.pagos where solicitud_id = ${solicitudId}`;
      await sql`update public.solicitud_articulos set cantidad = ${cantidad}, unidades_pagadas = ${pagadas} where id = ${solicitudArticuloId}`;
    };
    const rechazo = async (fn: () => Promise<unknown>, codigo: string) => {
      let error: unknown;
      try {
        await fn();
      } catch (caught) {
        error = caught;
      }
      assert(error instanceof ErrorCobro);
      igual(error.codigo, codigo);
    };
    try {
      await sql`insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, es_ejemplo) values
        (${fundacion}, 'fundacion', 'asilo', 'T03 test', ${`t03-${fundacion}`}, true, true),
        (${tienda}, 'tienda', null, 'T03 test', ${`t03-${tienda}`}, true, true)`;
      await sql`insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, credencial_ref)
        values (${tienda}, 'TEST', 'AAA010101AAA', 'PEY_TIENDA_TEST')`;
      await sql`insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos, es_ejemplo)
        values (${articulo}, ${tienda}, 'Unidad de prueba', 1, true)`;
      await sql`insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado, es_ejemplo)
        values (${solicitudId}, ${fundacion}, ${tienda}, 'T03 test', 'publicada', true)`;
      await sql`insert into public.solicitud_articulos (id, solicitud_id, articulo_id, nombre, precio_centavos, cantidad)
        values (${solicitudArticuloId}, ${solicitudId}, ${articulo}, 'copiado por trigger', 999, 10)`;

      await t.step(
        "usa precio congelado, secuencia y detalle atómico",
        async () => {
          await sql`update public.catalogo_articulos set precio_centavos = 999 where id = ${articulo}`;
          const first = await storage.reservar(input(2), noConfig);
          const second = await storage.reservar(input(1), noConfig);
          igual(first.montoCentavos, 2);
          assert(second.numRef > first.numRef && second.numRef <= 9999999);
          const [p] =
            await sql`select * from public.pagos where id = ${first.id}`;
          const [detail] =
            await sql`select * from public.pago_articulos where pago_id = ${first.id}`;
          igual(p.estado, "creado");
          igual(detail.unidades, 2);
          igual(p.tienda_id, tienda);
          igual(p.metadata.articulos, input(2).articulos);
          assert(!JSON.stringify(p.metadata).includes("phoneNumber"));
        },
      );
      await t.step(
        "dos conexiones compiten por la última unidad: solo una reserva",
        async () => {
          await reset();
          const otherSql = conectar(url!);
          try {
            const otherStorage = crearAlmacen(otherSql, 100000000);
            const results = await Promise.allSettled([
              storage.reservar(input(), noConfig),
              otherStorage.reservar(input(), noConfig),
            ]);
            igual(results.filter((r) => r.status === "fulfilled").length, 1);
            const failed = results.find((r) =>
              r.status === "rejected"
            ) as PromiseRejectedResult;
            igual(failed.reason.codigo, "UNIDADES_NO_DISPONIBLES");
            const [count] =
              await sql`select count(*)::integer as n from public.pagos where solicitud_id = ${solicitudId}`;
            igual(count.n, 1);
          } finally {
            await otherSql.end();
          }
        },
      );
      await t.step(
        "pagadas y reservadas se descuentan; rechazo definitivo libera",
        async () => {
          await reset(3, 1);
          const r = await storage.reservar(input(2), noConfig);
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "UNIDADES_NO_DISPONIBLES",
          );
          await storage.marcarIntento(r, "rechazado");
          const next = await storage.reservar(input(2), noConfig);
          assert(next.numRef > r.numRef);
          await reset(1, 1);
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "UNIDADES_NO_DISPONIBLES",
          );
        },
      );
      await t.step(
        "T20: un pendiente reserva 15 minutos y después sigue en creado para el webhook",
        async () => {
          await reset();
          const r = await storage.reservar(input(), noConfig);
          await storage.marcarIntento(r, "incierto");
          await sql`update public.pagos set creado_en = now() - interval '14 minutes' where id = ${r.id}`;
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "UNIDADES_NO_DISPONIBLES",
          );
          await sql`update public.pagos set creado_en = now() - interval '16 minutes' where id = ${r.id}`;
          const nuevo = await storage.reservar(input(), noConfig);
          const [viejo] =
            await sql`select estado from public.pagos where id = ${r.id}`;
          igual(viejo.estado, "creado");
          assert(nuevo.id !== r.id);
        },
      );
      await t.step(
        "T20: máximo 3 pendientes recientes por solicitud",
        async () => {
          await reset(10);
          const pagos = [];
          for (let i = 0; i < 3; i++) {
            pagos.push(await storage.reservar(input(), noConfig));
          }
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "DEMASIADOS_PAGOS_PENDIENTES",
          );
          await storage.marcarIntento(pagos[0], "rechazado");
          pagos.push(await storage.reservar(input(), noConfig));
          await sql`update public.pagos set creado_en = now() - interval '16 minutes' where id = ${
            pagos[1].id
          }`;
          await storage.reservar(input(), noConfig);
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "DEMASIADOS_PAGOS_PENDIENTES",
          );
        },
      );
      await t.step(
        "T20: límite por origen cuenta también intentos rechazados",
        async () => {
          await reset(10);
          const clave = `t20-${crypto.randomUUID()}`;
          const otra = `t20-${crypto.randomUUID()}`;
          try {
            await storage.reservar(input(), noConfig, clave);
            await sql`update privado.limites_cobro set intentos = 20 where clave = ${clave}`;
            await rechazo(
              () => storage.reservar(input(), noConfig, clave),
              "DEMASIADOS_INTENTOS",
            );
            const [fila] =
              await sql`select sum(intentos)::integer as n from privado.limites_cobro where clave = ${clave}`;
            igual(fila.n, 21);
            await storage.reservar(input(), noConfig, otra);
          } finally {
            await sql`delete from privado.limites_cobro where clave in (${clave}, ${otra})`;
          }
        },
      );
      await t.step(
        "rechaza artículo ajeno, tienda suspendida, solicitud cerrada y cuenta ausente",
        async () => {
          await reset(10);
          await rechazo(
            () =>
              storage.reservar({
                ...input(),
                articulos: [{
                  solicitudArticuloId: crypto.randomUUID(),
                  unidades: 1,
                }],
              }, noConfig),
            "ARTICULO_INVALIDO",
          );
          await sql`update public.organizaciones set suspendida = true where id = ${tienda}`;
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "SOLICITUD_NO_DISPONIBLE",
          );
          await sql`update public.organizaciones set suspendida = false where id = ${tienda}`;
          await sql`update public.solicitudes set estado = 'cerrada' where id = ${solicitudId}`;
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "SOLICITUD_NO_DISPONIBLE",
          );
          await sql`update public.solicitudes set estado = 'publicada' where id = ${solicitudId}`;
          await sql`delete from public.tiendas_cobro where organizacion_id = ${tienda}`;
          await rechazo(
            () => storage.reservar(input(), noConfig),
            "TIENDA_SIN_CUENTA",
          );
          await sql`insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, credencial_ref) values (${tienda}, 'TEST', 'AAA010101AAA', 'PEY_TIENDA_TEST')`;
        },
      );
      await t.step(
        "límite $0.01 y configuración inválida abortan antes de crear pago",
        async () => {
          await reset(10);
          await rechazo(
            () => crearAlmacen(sql, 1).reservar(input(2), noConfig),
            "MONTO_FUERA_DE_LIMITE",
          );
          await rechazo(() =>
            storage.reservar(input(), () => {
              throw new ErrorCobro(503, "CONFIG_TEST", "test");
            }), "CONFIG_TEST");
          const [count] =
            await sql`select count(*)::integer as n from public.pagos where solicitud_id = ${solicitudId}`;
          igual(count.n, 0);
        },
      );
      await t.step(
        "fallo después del INSERT pagos revierte también esa fila",
        async () => {
          await reset(10);
          // Aborta la transacción real justo antes de insertar el detalle, sin DDL.
          const aborting = new Proxy(sql, {
            get(target, key, receiver) {
              if (key !== "begin") return Reflect.get(target, key, receiver);
              return (callback: (tx: unknown) => Promise<unknown>) =>
                target.begin(async (tx) => {
                  const wrapped = new Proxy(tx, {
                    apply(callable, thisArg, args) {
                      const template = (args[0] as TemplateStringsArray).join(
                        "",
                      );
                      if (
                        template.includes("insert into public.pago_articulos")
                      ) throw new Error("rollback-test");
                      return Reflect.apply(callable, thisArg, args);
                    },
                  });
                  return await callback(wrapped);
                });
            },
          });
          let failed = false;
          try {
            await crearAlmacen(aborting, 1).reservar(input(), noConfig);
          } catch {
            failed = true;
          }
          assert(failed);
          const [count] =
            await sql`select count(*)::integer as n from public.pagos where solicitud_id = ${solicitudId}`;
          igual(count.n, 0);
        },
      );
      await t.step(
        "HTTP QR, push y link con DB real y transporte simulado",
        async () => {
          await reset(10);
          for (const metodo of ["qr", "push", "link"] as const) {
            const h = crearHandler(storage, {
              cuenta: (ref) => {
                igual(ref, "PEY_TIENDA_TEST");
                return { apiKey: "fake", useLinkedAccount: true };
              },
              maximoCentavos: 100,
              successUrl: "https://example.com/ok",
              backUrl: "https://example.com/back",
            }, (_url, init) => {
              const body = JSON.parse(String(init?.body));
              igual(body.amount, .01);
              return Promise.resolve(Response.json(
                metodo === "qr"
                  ? { id: "QR_DB", qrString: "payload", qrImage: null }
                  : metodo === "push"
                  ? { transactionId: "TX_T03_TEST", codiId: "CODI_DB" }
                  : {
                    id: "LINK_DB",
                    url: "https://app.mipey.mx/checkout/payment-link/test",
                  },
              ));
            });
            const response = await h(
              new Request("https://example.com", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input(1, metodo)),
              }),
            );
            igual(response.status, 201);
            const result = await response.json();
            const [p] =
              await sql`select * from public.pagos where id = ${result.pagoId}`;
            igual(p.estado, "creado");
            igual(p.metodo, metodo);
            igual(
              p.pey_transaccion_id,
              metodo === "push" ? "TX_T03_TEST" : null,
            );
            assert(!JSON.stringify(p).includes("phoneNumber"));
            if (metodo === "qr") {
              igual(p.metadata.pey.codiQrId, "QR_DB");
            }
            if (metodo === "link") {
              igual(p.metadata.pey.paymentLinkId, "LINK_DB");
            }
          }
        },
      );
      await t.step(
        "webhook que llega primero conserva estado pagado y metadata ajena",
        async () => {
          await reset(10);
          const r = await storage.reservar(input(1, "push"), noConfig);
          await sql`update public.pagos set estado = 'pagado', pagado_en = now(), pey_transaccion_id = 'TX_RACE_TEST',
          metadata = metadata || '{"webhook_confirmado":true}'::jsonb where id = ${r.id}`;
          await storage.guardarResultado(r, {
            metodo: "push",
            transactionId: "TX_RACE_TEST",
            codiId: "CODI_RACE",
          });
          await storage.marcarIntento(r, "rechazado");
          const [p] = await sql`select * from public.pagos where id = ${r.id}`;
          igual(p.estado, "pagado");
          assert(p.pagado_en);
          igual(p.metadata.webhook_confirmado, true);
        },
      );
    } finally {
      try {
        await reset();
        await sql`delete from public.pedidos where solicitud_id = ${solicitudId}`; // T08: pedido por pago confirmado
        await sql`delete from public.solicitud_articulos where id = ${solicitudArticuloId}`;
        await sql`delete from public.solicitudes where id = ${solicitudId}`;
        await sql`delete from public.catalogo_articulos where id = ${articulo}`;
        await sql`delete from public.tiendas_cobro where organizacion_id = ${tienda}`;
        await sql`delete from public.organizaciones where id in (${fundacion}, ${tienda})`;
      } finally {
        await sql.end();
      }
    }
  },
});
