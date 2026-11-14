# Webhook de pey (T04)

Edge Function pública `POST /functions/v1/pey-webhook`. Recibe
`codi.qr.payment_received`, `codi.pn.payment_received` y
`payment_link.status_updated`, confirma cada transacción con
`GET /transaction/:id` y financia una sola vez el pago creado por `crear-cobro`
(T03). No cambia el esquema ni las políticas.

## Flujo

1. **Firma** Standard Webhooks (`webhook-id`, `webhook-timestamp` con tolerancia
   de 5 minutos, `webhook-signature`). Sin secreto configurado responde 503;
   firma ausente, vieja o inválida, 401. Nada se procesa antes de la firma.
2. **Pistas del cuerpo** (no financian por sí solas): `transactionId`
   (`transactions[]` en el link, cada una por separado),
   `externalMetadata.pago_id`, `numRef` / `num_ref` y `clientReferenceId`. Con
   ellas se busca el pago, también por `pey_transaccion_id`. Funciona aunque T03
   todavía no haya guardado los identificadores de pey.
3. **Confirmación con pey** usando la API key de la tienda del pago
   (`tiendas_cobro.credencial_ref`, mismo secreto JSON que T03; sin API key
   global). Se exige `status: PAID`, el mismo `transactionId`, moneda `MXN`,
   método igual al del pago (`payableType`), monto base (`amountBreakdown.base`,
   sin propina ni comisión) igual a `monto_centavos`, y que la correlación la
   respalde pey: `pago_id` o `numRef` de su metadata, `payableId` guardado por
   T03 o el `transactionId` ya guardado. Si pey contradice al pago, es anomalía.
4. **Confirmación atómica** en una transacción con `service_role`: bloquea los
   `solicitud_articulos` del pago en orden de id y luego el pago (mismo orden
   que T03), vuelve a validar estado y monto, suma `unidades_pagadas`, pasa el
   pago a `pagado` con `pagado_en` = `datePaid` de pey, guarda
   `pey_transaccion_id` y el comprobante.

## Idempotencia

- Un pago `pagado` con el mismo `transactionId` es un duplicado: responde 200
  sin consultar pey ni escribir. Vale para el mismo `webhook-id` reentregado y
  para otro `webhook-id` con la misma transacción.
- Entregas concurrentes se serializan con `FOR UPDATE` sobre artículos y pago;
  el índice único de `pey_transaccion_id` impide usar una transacción en dos
  pagos.
- El `webhook-id` que confirmó queda en `pagos.metadata.confirmacion`.

## Respuestas

| HTTP | Caso                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| 200  | Confirmado, duplicado, anomalía registrada, pago desconocido o evento ignorado      |
| 400  | JSON inválido (con firma válida)                                                    |
| 401  | Firma ausente, vieja o inválida                                                     |
| 413  | Cuerpo mayor a 256 KiB                                                              |
| 503  | Transitorio: DB, pey caído, credencial de la tienda ausente o transacción `PENDING` |

Con 503 pey puede reintentar; el efecto sigue siendo único. Un `PENDING` nunca
libera ni marca el pago: sigue `creado` (T01 vio un push PENDING aunque el banco
mostró "pagado").

## Anomalías (se registran y no financian)

Si el pago se identifica, se agrega a `pagos.metadata.anomalias` una entrada
`{ motivo, transactionId, montoCentavos, webhookId, registradaEn }`, una sola
vez por motivo y transacción (máximo 20). Motivos: `monto_distinto`,
`moneda_distinta`, `metodo_distinto`, `correlacion_distinta`,
`correlacion_no_confirmada`, `transaccion_inconsistente`,
`transaccion_no_encontrada`, `pago_no_vigente` (pago `fallido`/`expirado` que sí
se cobró: requiere conciliación manual),
`pago_ya_confirmado_con_otra_transaccion`, `transaccion_distinta_a_la_guardada`,
`transaccion_de_otro_pago`, `excede_cantidad`, `pago_sin_detalle`,
`detalle_no_cuadra`.

Un `numRef` o `pago_id` desconocido, o pistas que apuntan a pagos distintos, no
tienen pago donde anotarse: quedan solo en el log (`pago_desconocido`,
`correlacion_ambigua`). Un registro durable de esos eventos necesitaría una
tabla nueva (migración no incluida).

## Comprobante

`pagos.metadata.comprobante`, legible por la tienda y la fundación con las
políticas actuales de `pagos`:

```json
{
  "version": 1,
  "folio": "AGORA-0001401",
  "pagoId": "<uuid>",
  "solicitudId": "<uuid>",
  "tiendaId": "<uuid>",
  "articulos": [{
    "solicitudArticuloId": "<uuid>",
    "nombre": "Garrafón",
    "unidades": 1,
    "precioUnitarioCentavos": 1
  }],
  "montoCentavos": 1,
  "moneda": "MXN",
  "metodo": "qr",
  "pagadoEn": "2026-11-14T17:57:00.000Z",
  "peyTransactionId": "<ULID de pey>"
}
```

El identificador de rastreo es el `transactionId` de pey. Los datos bancarios
del pagador (`clabe`, `bankCode`, `accountType`, `description`, `trackingKey`)
se descartan: no se guardan, no se cifran y no aparecen en logs (lista de campos
permitidos de T01). T03 solo reemplaza la clave `pey` de la metadata, así que no
pisa `comprobante`, `confirmacion` ni `anomalias`.

## Barra en vivo

`solicitud_articulos` ya está en la publicación `supabase_realtime`. La prueba
de integración suscribe un cliente anónimo y comprueba que recibe el nuevo
`unidades_pagadas`, y que con la solicitud en borrador RLS no deja pasar el
cambio. No se relajó ninguna política.

## Configuración

- `PEY_WEBHOOK_SECRET`: secreto `whsec_` del portal (ya existe en el remoto).
- `SUPABASE_DB_URL`: la provee Supabase; la conexión debe poder asumir
  `service_role`.
- Secreto JSON de la tienda nombrado por `tiendas_cobro.credencial_ref` (ver
  README de `crear-cobro`). `PEY_API_KEY` ya no se usa.
- Desplegar con `--no-verify-jwt`.

Limitación: pey admite un webhook por API key y la función usa un solo
`PEY_WEBHOOK_SECRET`. Con varias tiendas y varias API keys hará falta aceptar
varios secretos.

## Verificación local

Desde esta carpeta, con Deno 2 y el stack local de Supabase:

```sh
deno task check
deno task test
AGORA_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
AGORA_TEST_SUPABASE_URL=http://127.0.0.1:54321 \
AGORA_TEST_JWT_SECRET="<API_JWT_SECRET del contenedor realtime local>" \
deno task test:db
```

Las pruebas usan pey simulado y el almacén real de `crear-cobro` para reservar;
crean fixtures por UUID y los borran al terminar. Sin las variables de Realtime
se omite ese paso.
