// Persistencia del webhook. Sin migraciones: la idempotencia sale del estado
// del pago (bloqueado con FOR UPDATE) y del índice único de pey_transaccion_id.
// El comprobante y las anomalías viven en claves propias de pagos.metadata;
// crear-cobro (T03) solo reemplaza la clave "pey", así que no las pisa.
import postgres from "postgres";
import { Metodo, Transaccion } from "./pey.ts";

export type Pago = {
  id: string;
  numRef: number;
  solicitudId: string;
  tiendaId: string;
  montoCentavos: number;
  metodo: Metodo;
  estado: string;
  peyTransaccionId: string | null;
  // Identificadores de pey guardados por T03 (codiQrId, codiId, paymentLinkId...).
  peyIds: string[];
  credencialRef: string | null;
};

export type Anomalia = {
  motivo: string;
  transactionId: string;
  montoCentavos: number | null;
  webhookId: string;
};

export type ResultadoConfirmacion =
  | { tipo: "confirmado"; folio: string }
  | { tipo: "duplicado" }
  | { tipo: "anomalia"; motivo: string };

export type Almacen = {
  buscarPagos(pistas: {
    pagoIds: string[];
    numRefs: number[];
    transactionId: string;
  }): Promise<Pago[]>;
  registrarAnomalia(pagoId: string, anomalia: Anomalia): Promise<void>;
  confirmar(entrada: {
    pagoId: string;
    transaccion: Transaccion;
    webhookId: string;
    evento: string;
  }): Promise<ResultadoConfirmacion>;
};

type Sql = ReturnType<typeof conectar>;
// deno-lint-ignore no-explicit-any
type Tx = any;

export function conectar(url: string) {
  // prepare:false permite usar el pool transaccional de Supabase.
  return postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function folio(numRef: number): string {
  return `AGORA-${String(numRef).padStart(7, "0")}`;
}

const MAX_ANOMALIAS = 20;

async function anotarAnomalia(tx: Tx, pagoId: string, a: Anomalia) {
  // Una entrada por (motivo, transacción): un reintento no la duplica.
  await tx`
    update public.pagos set metadata = jsonb_set(
      metadata, '{anomalias}',
      coalesce(metadata->'anomalias', '[]'::jsonb) || jsonb_build_array(${
    tx.json({ ...a, registradaEn: new Date().toISOString() })
  }::jsonb)
    )
    where id = ${pagoId}
      and not coalesce(metadata->'anomalias', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object(
        'motivo', ${a.motivo}::text, 'transactionId', ${a.transactionId}::text))
      and jsonb_array_length(coalesce(metadata->'anomalias', '[]'::jsonb)) < ${MAX_ANOMALIAS}
  `;
}

export function crearAlmacen(sql: Sql): Almacen {
  const comoServicio = <T>(fn: (tx: Tx) => Promise<T>) =>
    sql.begin(async (tx: Tx) => {
      await tx`set local lock_timeout = '5s'`;
      await tx`set local statement_timeout = '10s'`;
      await tx`set local role service_role`;
      return await fn(tx);
    }) as Promise<T>;

  return {
    async buscarPagos({ pagoIds, numRefs, transactionId }) {
      const filas = await comoServicio<Record<string, unknown>[]>((tx) =>
        tx`
        select p.id, p.num_ref, p.solicitud_id, p.tienda_id, p.monto_centavos,
               p.metodo, p.estado, p.pey_transaccion_id, p.metadata->'pey' as pey,
               c.credencial_ref
        from public.pagos p
        left join public.tiendas_cobro c on c.organizacion_id = p.tienda_id
        where p.id = any(${pagoIds}::uuid[])
           or p.num_ref = any(${numRefs}::integer[])
           or p.pey_transaccion_id = ${transactionId}
        limit 5
      `
      );
      return filas.map((f) => {
        const pey = (f.pey ?? {}) as Record<string, unknown>;
        return {
          id: f.id as string,
          numRef: f.num_ref as number,
          solicitudId: f.solicitud_id as string,
          tiendaId: f.tienda_id as string,
          montoCentavos: f.monto_centavos as number,
          metodo: f.metodo as Metodo,
          estado: f.estado as string,
          peyTransaccionId: f.pey_transaccion_id as string | null,
          peyIds: ["codiQrId", "codiId", "paymentLinkId", "transactionId"]
            .map((k) => pey[k])
            .filter((v): v is string => typeof v === "string" && v !== ""),
          credencialRef: f.credencial_ref as string | null,
        };
      });
    },

    async registrarAnomalia(pagoId, anomalia) {
      await comoServicio((tx) => anotarAnomalia(tx, pagoId, anomalia));
    },

    async confirmar({ pagoId, transaccion, webhookId, evento }) {
      return await comoServicio(async (tx): Promise<ResultadoConfirmacion> => {
        const anomalia = async (motivo: string) => {
          await anotarAnomalia(tx, pagoId, {
            motivo,
            transactionId: transaccion.id,
            montoCentavos: transaccion.montoBaseCentavos,
            webhookId,
          });
          return { tipo: "anomalia", motivo } as const;
        };
        // Orden de bloqueos igual que crear-cobro: artículos por id y luego el pago.
        const detalle = await tx`
          select solicitud_articulo_id, unidades from public.pago_articulos
          where pago_id = ${pagoId} order by solicitud_articulo_id
        `;
        const ids = detalle.map((d: Record<string, unknown>) =>
          d.solicitud_articulo_id
        );
        const articulos = ids.length
          ? await tx`
            select id, nombre, precio_centavos, cantidad, unidades_pagadas
            from public.solicitud_articulos
            where id in ${tx(ids)} order by id for update
          `
          : [];
        const [pago] = await tx`
          select id, num_ref, solicitud_id, tienda_id, monto_centavos, metodo,
                 estado, pey_transaccion_id
          from public.pagos where id = ${pagoId} for update
        `;
        if (!pago) return { tipo: "anomalia", motivo: "pago_inexistente" };
        if (pago.estado === "pagado") {
          return pago.pey_transaccion_id === transaccion.id
            ? { tipo: "duplicado" }
            : await anomalia("pago_ya_confirmado_con_otra_transaccion");
        }
        if (pago.estado !== "creado") return await anomalia("pago_no_vigente");
        if (
          pago.pey_transaccion_id && pago.pey_transaccion_id !== transaccion.id
        ) {
          return await anomalia("transaccion_distinta_a_la_guardada");
        }
        const [otro] = await tx`
          select 1 from public.pagos
          where pey_transaccion_id = ${transaccion.id} and id <> ${pagoId}
        `;
        if (otro) return await anomalia("transaccion_de_otro_pago");
        if (transaccion.montoBaseCentavos !== pago.monto_centavos) {
          return await anomalia("monto_distinto");
        }
        if (!detalle.length || articulos.length !== detalle.length) {
          return await anomalia("pago_sin_detalle");
        }
        let suma = 0;
        for (const d of detalle) {
          const a = articulos.find((x: Record<string, unknown>) =>
            x.id === d.solicitud_articulo_id
          );
          if (a.unidades_pagadas + d.unidades > a.cantidad) {
            return await anomalia("excede_cantidad");
          }
          suma += a.precio_centavos * d.unidades;
        }
        if (suma !== pago.monto_centavos) {
          return await anomalia("detalle_no_cuadra");
        }

        for (const d of detalle) {
          await tx`
            update public.solicitud_articulos
            set unidades_pagadas = unidades_pagadas + ${d.unidades}
            where id = ${d.solicitud_articulo_id}
          `;
        }
        const pagadoEn = transaccion.datePaid !== null
          ? new Date(transaccion.datePaid * 1000)
          : new Date();
        const comprobante = {
          version: 1,
          folio: folio(pago.num_ref),
          pagoId: pago.id,
          solicitudId: pago.solicitud_id,
          tiendaId: pago.tienda_id,
          articulos: detalle.map((d: Record<string, unknown>) => {
            const a = articulos.find((x: Record<string, unknown>) =>
              x.id === d.solicitud_articulo_id
            );
            return {
              solicitudArticuloId: d.solicitud_articulo_id,
              nombre: a.nombre,
              unidades: d.unidades,
              precioUnitarioCentavos: a.precio_centavos,
            };
          }),
          montoCentavos: pago.monto_centavos,
          moneda: "MXN",
          metodo: pago.metodo,
          pagadoEn: pagadoEn.toISOString(),
          // Identificador de rastreo: el transactionId de pey, nunca la clave del banco.
          peyTransactionId: transaccion.id,
        };
        await tx`
          update public.pagos set
            estado = 'pagado',
            pagado_en = ${pagadoEn},
            pey_transaccion_id = ${transaccion.id},
            metadata = metadata || jsonb_build_object(
              'comprobante', ${tx.json(comprobante)}::jsonb,
              'confirmacion', ${
          tx.json({ webhookId, evento, confirmadoEn: new Date().toISOString() })
        }::jsonb
            )
          where id = ${pagoId}
        `;
        return { tipo: "confirmado", folio: comprobante.folio };
      });
    },
  };
}
