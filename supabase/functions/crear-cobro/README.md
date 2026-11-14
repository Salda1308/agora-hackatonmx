# Crear cobro por solicitud (T03)

Edge Function `POST /functions/v1/crear-cobro`. El cliente elige unidades; el
servidor calcula centavos con el precio congelado de `solicitud_articulos`. No
cambia el esquema, las políticas, el webhook ni la web.

## Petición y respuesta para T05

```json
{
  "solicitudId": "<uuid>",
  "metodo": "qr",
  "articulos": [{ "solicitudArticuloId": "<uuid>", "unidades": 1 }]
}
```

Métodos: `qr`, `push`, `link`. Solo `push` exige `phoneNumber`, cadena de diez
dígitos. El teléfono se usa en el POST a pey y no se guarda, registra ni
devuelve. Se permiten entre uno y diez artículos distintos por intento, con
unidades enteras positivas. Cualquier campo extra se rechaza, incluidos
`amount`, precios, `numRef`, `metadata`, cuenta bancaria y URLs de retorno.

Respuesta HTTP 201, común a las tres vías:

```json
{
  "pagoId": "<uuid>",
  "numRef": "123",
  "metodo": "qr",
  "montoCentavos": 1,
  "moneda": "MXN",
  "estado": "creado",
  "id": "<id pey>",
  "qrString": "<payload>",
  "qrImage": "<PNG base64 o null>"
}
```

Campos adicionales según la vía:

| Método | Campos                                                       |
| ------ | ------------------------------------------------------------ |
| `qr`   | `id` (codiQrId), `qrString`, `qrImage`                       |
| `push` | `transactionId`, `codiId`                                    |
| `link` | `id` (paymentLinkId), `url` (checkout HTTPS de app.mipey.mx) |

Pey puede devolver `qrImage: null` aun con `generateImage: true`. En ese caso el
cliente debe dibujar el QR a partir de `qrString`, sin crear otro cobro. El
estado `creado` nunca significa pagado. La redirección de checkout tampoco
confirma el pago: esa confirmación pertenece a T04.

Errores `{ "error": { "codigo": "…", "mensaje": "…" } }`:

| HTTP      | Significado                                                               |
| --------- | ------------------------------------------------------------------------- |
| 400       | JSON/campos inválidos, UUID repetido o artículo ajeno a la solicitud      |
| 404       | Solicitud no publicada o actores no disponibles/verificados               |
| 409       | Unidades ya pagadas o reservadas por otro intento                         |
| 413 / 415 | Cuerpo mayor a 16 KiB / tipo distinto de JSON                             |
| 422       | Total calculado superior al límite del servidor                           |
| 503       | Cuenta/configuración incompleta o DB no disponible                        |
| 502       | Pey rechazó explícitamente la petición; pago `fallido` y reserva liberada |
| 202       | Creación incierta: conservar `pagoId`, no repetir automáticamente         |

502 y 202 incluyen además los campos comunes de la respuesta y el error
`PEY_RECHAZO_COBRO` o `COBRO_INCIERTO`. HTTP 202 conserva `estado: "creado"` y
la reserva. Un timeout, un error 5xx, un rechazo no reconocido, JSON inválido o
un fallo al persistir la respuesta **pueden ocurrir después de crear el cobro**.
No hay reintentos de POST ni garantía de idempotencia ante peticiones repetidas
del cliente. Deshabilitar el botón mientras se envía y conservar `pagoId`.

## Configuración del servidor

- `SUPABASE_DB_URL`: conexión PostgreSQL proporcionada por Supabase al runtime;
  para el pool transaccional se desactivan prepared statements. La cuenta de
  conexión debe poder asumir el rol `service_role` (la conexión predeterminada
  de Supabase puede hacerlo). La reserva lee `tiendas_cobro` con ese rol.
- `PEY_MAXIMO_CENTAVOS`: entero 1..100000000, **predeterminado 1 ($0.01)**. Si
  los artículos suman más, rechaza; nunca ajusta artificialmente el importe.
- `PEY_SUCCESS_URL`, `PEY_BACK_URL`: URLs HTTPS de la aplicación, obligatorias
  para `link`. Son configuración fija, no entradas del donante.
- `tiendas_cobro.credencial_ref`: nombre de un secreto del runtime. Por ejemplo,
  `PEY_TIENDA_DEMO`, cuyo valor es JSON, con **valores reales solo en
  secretos**:

```json
{ "apiKey": "<secreto pey de esta tienda>", "useLinkedAccount": true }
```

`useLinkedAccount: true` declara que la API key pertenece a la tienda y que su
cuenta vinculada es el destino correcto. Es necesario para payment links, porque
`/payment-link/create` no admite `bankAccountId`. Para QR/push se puede usar
alternativamente `{ "apiKey": "<secreto>", "bankAccountId": "<ULID>" }`. Ambas
declaraciones a la vez se rechazan para evitar dos destinos posibles. No existe
fallback a una API key global ni a una cuenta recibida del cliente. La relación
de credencial y cuenta debe configurarla el operador tras verificar la cuenta de
la tienda en pey. El esquema guarda solo los últimos cuatro dígitos de CLABE; no
hace falta agregar una columna con la CLABE completa.

El flujo de donante es anónimo. Para habilitarlo al desplegar, Supabase necesita
servir esta función con `--no-verify-jwt`; no cambia políticas de tablas. CORS
permite las llamadas desde web. La función no ofrece autenticación de donantes
ni rate limiting persistente: protección contra abuso queda para T13. **Este
ticket entrega código local; no despliega ni crea cobros reales.**

## Persistencia y contrato para T04

1. En una transacción SQL toma bloqueo de solicitud y de los artículos, verifica
   organizaciones, disponibilidad y configuración, calcula el total y escribe
   `pagos` + `pago_articulos`. La secuencia existente asigna `num_ref` único.
2. Tras COMMIT, realiza una sola llamada a pey. No mantiene bloqueos durante la
   llamada HTTP. Metadata plana: `pago_id`, `solicitud_id`, `tienda_id`,
   `num_ref`, `concept` y `articulo_N = "<solicitud_articulo_id>:<unidades>"`.
   Cumple el límite de 50 campos y 500 caracteres de pey sin truncar el detalle.
3. Guarda únicamente identificadores de la respuesta, no cuerpos completos,
   teléfono, CLABE, token, datos del pagador, imagen ni payload del QR.

`pagos.metadata` contiene `version: 1`, `concept`,
`articulos: [{ solicitudArticuloId, unidades }]` y `pey`:

- QR: `{ estado: "creado", codiQrId, expiration_seconds: 600 }`.
- Push: `{ estado: "creado", codiId, transactionId, expiration_seconds: 600 }`;
  también `pagos.pey_transaccion_id`.
- Link: `{ estado: "creado", paymentLinkId, expiration_seconds: null }`;
  `clientReferenceId` en pey es `pagos.id`. No tiene `numRef` ni `concept` como
  parámetros propios: se envían como metadata.
- Antes de recibir respuesta: `pey.estado = "reservado"`.
- Respuesta incierta: `pey.estado = "incierto"`.
- Rechazo definitivo: `pey.estado = "rechazado"`, `pagos.estado = "fallido"`.

Correlacionar por `pago_id` de metadata / `externalMetadata`, `numRef`,
`clientReferenceId` o identificador pey según el evento. El webhook puede llegar
antes de guardar los identificadores; `pago_id` y el detalle ya existen. Al
guardar el resultado la función conserva `estado`, `pagado_en`, una transacción
ya asignada y las demás claves de metadata del webhook.

Todos los `pagos.estado = 'creado'` reservan unidades. **No se liberan solo por
antigüedad**: el link no tiene vencimiento documentado y un push puede quedar
PENDING incluso después de que el banco muestre "pagado". La caducidad enviada
de 600 segundos no demuestra que no se haya pagado. T04/conciliación debe
confirmar el estado y cambiar a `fallido`/`expirado` únicamente con evidencia.
Esto puede mantener unidades reservadas si el proceso termina tras reservar y
antes de llamar a pey; requiere conciliación, no un reintento automático.

Para confirmar un pago, T04 debe actualizar pago y contadores de artículos **en
una sola transacción**, tomando los artículos en orden de id, antes del pago.
Así la reserva observa los contadores y estados de forma coherente y se evitan
bloqueos circulares. Este ticket no confirma ni incrementa unidades.

## Verificación local (sin API de pey)

Desde esta carpeta, con Deno 2:

```sh
deno task check
deno task test
AGORA_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres deno task test:db
```

La prueba DB requiere el stack local de T02 con ambas migraciones aplicadas.
Crea fixtures de ejemplo identificados por UUID y los elimina al terminar;
consume algunos valores de secuencia. No instala migraciones ni modifica RLS. El
permiso de red se limita a Postgres local y el transporte pey es simulado. Las
pruebas unitarias se ejecutan sin permiso de red.

Las pruebas reales de $0.01 por cada vía quedan pendientes: necesitan
autorización del despliegue y confirmación del usuario antes de **cada** POST a
pey. Para push, solicitar el número mediante `request_secret`, sin guardarlo ni
registrarlo.
