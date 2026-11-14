import postgres from "postgres";
import { Almacen, ErrorCobro, Reserva } from "./domain.ts";

export function conectar(url: string) {
  // prepare:false permite usar el pool transaccional de Supabase.
  return postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export function crearAlmacen(
  sql: ReturnType<typeof conectar>,
  maximoCentavos: number,
): Almacen {
  return {
    async reservar(entrada, validarConfiguracion) {
      return await sql.begin(async (tx) => {
        // Todos los intentos de esta solicitud se serializan, incluso entre isolates.
        await tx`set local lock_timeout = '5s'`;
        await tx`set local statement_timeout = '10s'`;
        await tx`set local role service_role`;
        const [solicitud] = await tx`
          select s.tienda_id, c.credencial_ref
          from public.solicitudes s
          join public.organizaciones f on f.id = s.organizacion_id
          join public.organizaciones t on t.id = s.tienda_id
          left join public.tiendas_cobro c on c.organizacion_id = s.tienda_id
          where s.id = ${entrada.solicitudId} and s.estado = 'publicada'
            and f.tipo = 'fundacion' and f.verificada and not f.suspendida
            and f.categoria is distinct from 'colectivo_busqueda'
            and t.tipo = 'tienda' and t.verificada and not t.suspendida
          for update of s for share of f, t
        `;
        if (!solicitud) {
          throw new ErrorCobro(
            404,
            "SOLICITUD_NO_DISPONIBLE",
            "La solicitud no está disponible para recibir pagos.",
          );
        }
        if (!solicitud.credencial_ref) {
          throw new ErrorCobro(
            503,
            "TIENDA_SIN_CUENTA",
            "La tienda aún no tiene cuenta de cobro.",
          );
        }
        validarConfiguracion(solicitud.credencial_ref);
        const ids = entrada.articulos.map((a) => a.solicitudArticuloId);
        // También bloquea los contadores que actualizará el webhook.
        const filas = await tx`
          select id, precio_centavos, cantidad, unidades_pagadas
          from public.solicitud_articulos
          where solicitud_id = ${entrada.solicitudId} and id in ${tx(ids)}
          order by id for update
        `;
        if (filas.length !== ids.length) {
          throw new ErrorCobro(
            400,
            "ARTICULO_INVALIDO",
            "Los artículos deben pertenecer a la solicitud.",
          );
        }
        // Sin caducidad automática: un link no vence y un push PENDING puede ser incierto.
        const reservas = await tx`
          select pa.solicitud_articulo_id as id, sum(pa.unidades)::integer as unidades
          from public.pago_articulos pa join public.pagos p on p.id = pa.pago_id
          where pa.solicitud_articulo_id in ${tx(ids)} and p.estado = 'creado'
          group by pa.solicitud_articulo_id
        `;
        let montoCentavos = 0;
        for (const articulo of entrada.articulos) {
          const fila = filas.find((f) =>
            f.id === articulo.solicitudArticuloId
          )!;
          const reservadas = reservas.find((f) =>
            f.id === articulo.solicitudArticuloId
          )?.unidades ?? 0;
          if (
            articulo.unidades >
              fila.cantidad - fila.unidades_pagadas - reservadas
          ) {
            throw new ErrorCobro(
              409,
              "UNIDADES_NO_DISPONIBLES",
              "Las unidades elegidas ya están pagadas o reservadas.",
            );
          }
          montoCentavos += fila.precio_centavos * articulo.unidades;
        }
        if (
          !Number.isSafeInteger(montoCentavos) || montoCentavos < 1 ||
          montoCentavos > maximoCentavos
        ) {
          throw new ErrorCobro(
            422,
            "MONTO_FUERA_DE_LIMITE",
            "El total calculado excede el límite de cobro del servidor.",
          );
        }
        const [pago] = await tx`
          insert into public.pagos (solicitud_id, tienda_id, monto_centavos, metodo)
          values (${entrada.solicitudId}, ${solicitud.tienda_id}, ${montoCentavos}, ${entrada.metodo}) returning id, num_ref
        `;
        const concept = `Agora ${
          entrada.solicitudId.slice(0, 8)
        } ref${pago.num_ref} ${ids.length}art`;
        await tx`update public.pagos set metadata = ${
          tx.json({
            version: 1,
            concept,
            articulos: entrada.articulos,
            pey: {
              estado: "reservado",
              expiration_seconds: entrada.metodo === "link" ? null : 600,
            },
          })
        } where id = ${pago.id}`;
        await tx`insert into public.pago_articulos ${
          tx(entrada.articulos.map((a) => ({
            pago_id: pago.id,
            solicitud_articulo_id: a.solicitudArticuloId,
            unidades: a.unidades,
          })))
        }`;
        return {
          id: pago.id,
          numRef: pago.num_ref,
          solicitudId: entrada.solicitudId,
          tiendaId: solicitud.tienda_id,
          montoCentavos,
          metodo: entrada.metodo,
          articulos: entrada.articulos,
          concept,
          credencialRef: solicitud.credencial_ref,
        } as Reserva;
      });
    },
    async guardarResultado(r, resultado) {
      const pey = resultado.metodo === "qr"
        ? { estado: "creado", codiQrId: resultado.id, expiration_seconds: 600 }
        : resultado.metodo === "push"
        ? {
          estado: "creado",
          codiId: resultado.codiId,
          transactionId: resultado.transactionId,
          expiration_seconds: 600,
        }
        : {
          estado: "creado",
          paymentLinkId: resultado.id,
          expiration_seconds: null,
        };
      // No sobrescribir estado/pagado_en: el webhook puede haber llegado primero.
      await sql`
        update public.pagos set metadata = metadata || jsonb_build_object('pey', ${
        sql.json(pey)
      }::jsonb),
          pey_transaccion_id = coalesce(pey_transaccion_id, ${
        resultado.metodo === "push" ? resultado.transactionId : null
      })
        where id = ${r.id}
      `;
    },
    async marcarIntento(r, estado) {
      await sql`
        update public.pagos set
          estado = case when ${estado} = 'rechazado' and estado = 'creado' then 'fallido'::public.pago_estado else estado end,
          metadata = metadata || jsonb_build_object('pey', jsonb_build_object('estado', ${estado}::text))
        where id = ${r.id}
      `;
    },
  };
}
