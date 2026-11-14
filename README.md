<img src="assets/icon.svg" width="64" height="64" alt="">

# Ágora

Red de apoyo por unidades para organizaciones en México. Una fundación publica lo que necesita eligiendo artículos del catálogo de una tienda (precio fijo por unidad); cualquiera paga unidades con CoDi directo a la tienda, y la barra de avance se llena en vivo. La tienda prepara el pedido y entrega un código de recogida.

Proyecto para Cursor Hackatón México (noviembre 2026). Equipo: Heylin Daniela Hernandez Perez y David Santiago Aldana Gonzalez.

> **Demo con datos de ejemplo.** Organizaciones, tiendas, catálogos, solicitudes, jornadas y publicaciones son ficticios y la interfaz los marca como "ejemplo". Lo único real es el cobro CoDi y su webhook (ver abajo).

## Cómo probarlo

**En vivo:** _(la URL se agrega al desplegar)_

1. Abre la web en el celular o en la computadora.
2. Entra a una solicitud de ejemplo marcada con $0.01 por unidad, elige unidades y paga con CoDi (QR, notificación al celular o enlace de pago). Es un cobro real de un centavo.
3. Cuando pey confirma el pago, la barra de la solicitud sube sola y aparece el comprobante con su folio.
4. Con el selector "Acceso de demostración" cambias de rol (fundación, tienda, repartidor, comprador) usando cuentas ficticias.

**En local** (requiere Node 20+ y Docker):

```
npm install
npm --prefix web install
npx supabase start          # aplica supabase/migrations y supabase/seed.sql
cp web/.env.example web/.env.local   # pon la llave pública que imprime `npx supabase status`
npm run web
```

Pruebas:

```
npx supabase test db                       # reglas de acceso y flujos en SQL (pgTAP)
npm --prefix web run build && npm --prefix web run lint
node --test web/tests/auth/*.test.ts
cd supabase/functions/crear-cobro && deno task test   # igual en pey-webhook y estado-pago
```

Las pruebas de integración de las funciones (`deno task test:db`) piden `AGORA_TEST_DATABASE_URL` de un stack local; ver el README de cada función.

## Qué usa de CoDi (API de pey)

| Pieza | Qué hace | Dónde |
|---|---|---|
| Cobro por QR | `POST /codi/qr`; la web dibuja el QR desde `qrString` | `supabase/functions/crear-cobro` |
| Cobro por notificación | `POST /codi/pn` al celular del pagador; el teléfono no se guarda ni se registra | `crear-cobro` |
| Enlace de pago | `POST /payment-link/create`; en la cuenta de prueba solo admite CoDi | `crear-cobro` |
| Webhook firmado | Valida la firma Standard Webhooks (`webhook-id`, `webhook-signature`); firma inválida responde 401 | `supabase/functions/pey-webhook` |
| Confirmación | Nunca confía solo en el webhook: consulta `GET /transaction/:id` y exige `PAID`, MXN, método y monto exactos | `pey-webhook` |
| Idempotencia | El mismo evento repetido produce un solo efecto (estado del pago con bloqueo y transacción única) | `pey-webhook` |
| Comprobante | Folio `AGORA-0000000`, artículos, unidades, monto, método, fecha y `transactionId` de pey; se consulta con un token firmado de 7 días | `pey-webhook`, `supabase/functions/estado-pago` |

El monto lo calcula el servidor a partir del precio congelado de cada artículo; el cliente no puede mandarlo. Los datos bancarios del pagador que trae el webhook (CLABE, banco, clave de rastreo) se descartan: no se guardan ni se registran. Cada tienda cobra con su propia credencial de pey, guardada como secreto del backend; la base solo guarda el nombre del secreto.

## Qué es real y qué es simulado

**Real**
- Cobro CoDi con la API de producción de pey, limitado a $0.01 por intento (`PEY_MAXIMO_CENTAVOS`). Antes de construir la app se hicieron cobros reales de $0.01 por QR, notificación y enlace, y se recibieron sus tres webhooks con firma válida.
- Webhook firmado, confirmación con `GET /transaction/:id`, idempotencia y comprobante. Probados en local contra Postgres real con pey simulado (pagos repetidos, concurrentes, montos distintos, referencias desconocidas, pagos pendientes).
- Barra de avance en vivo por Supabase Realtime.
- Reglas de acceso por fila: el cliente no marca pagos, no escribe contadores de unidades ni campos de moderación, y una tienda no ve pedidos de otra (pruebas pgTAP).
- Panel de la tienda: pedidos pagados, marcar listo con código de recogida, catálogo con precios y carga CSV.
- Páginas de organización con publicaciones; las imágenes pierden sus metadatos (EXIF, GPS) antes de guardarse.
- Jornadas de voluntariado con cupos sin sobreventa y folio de inscripción.

**Simulado**
- Datos: organizaciones, tiendas, catálogos, solicitudes, pedidos previos, jornadas y publicaciones son de ejemplo (`es_ejemplo`) y la interfaz lo indica.
- Inicio de sesión: cuentas ficticias con una contraseña pública de demostración y un selector de rol. No hay registro real.
- Verificación de organizaciones: la hace el equipo a mano con `service_role` (ver `supabase/MODERACION.md`); no hay revisión de documentos.
- Constancia de jornada: de ejemplo, sin valor oficial.
- La tienda de prueba cobra a una CLABE pre-autorizada del evento; no es un negocio real.

**Aún no construido**
- Repartidor: toma de tareas, recogida con código y entrega con doble confirmación (su vista es un marcador; las políticas actuales todavía impiden tomar una tarea).
- Constancia de horas y niveles de voluntarios.
- Panel público y feed de uso que registre cada paso.

## Qué queda para la entrega nacional

- Una tienda real aliada y validada por pey, y una fundación real, con la entrega grabada en video.
- Registro e inicio de sesión reales, y verificación real de organizaciones y tiendas.
- Repartidores, entrega con doble confirmación y evidencia, constancias y niveles.
- Panel público con el registro de uso de cada aportación.
- Endurecimiento de seguridad y privacidad (límites de peticiones, medios subidos, conciliación de pagos pendientes).

## Estructura

- `web/`: aplicación web (Vite, React, TypeScript), mobile-first, tema claro y oscuro. Diseño en `web/DESIGN.md`.
- `supabase/migrations/`: modelo de datos, políticas por fila y funciones SQL.
- `supabase/functions/`: `crear-cobro`, `pey-webhook`, `estado-pago` y `t17-imagen` (Edge Functions de Deno).
- `supabase/tests/`: pruebas pgTAP.
- `supabase/seed.sql`: datos de ejemplo y cuentas de demostración.

## Configuración

Las credenciales van en variables de entorno o secretos del backend; nunca en el repositorio. Ver `.env.example` y `web/.env.example`.

| Variable | Dónde | Qué es |
|---|---|---|
| `VITE_SUPABASE_URL` | web | URL de la API de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | web | Llave pública de Supabase |
| `VITE_DEMO_AUTH_ENABLED` | web | `true` muestra el acceso de demostración; apagado por defecto |
| `PEY_WEBHOOK_SECRET` | `pey-webhook` | Secreto `whsec_` del webhook en el portal de pey |
| `AGORA_SEGUIMIENTO_SECRET` | `crear-cobro` y `estado-pago` | El mismo valor aleatorio en ambas (mínimo 32 caracteres); firma los tokens del comprobante |
| `PEY_SUCCESS_URL`, `PEY_BACK_URL` | `crear-cobro` | URLs HTTPS de regreso para el enlace de pago |
| `PEY_MAXIMO_CENTAVOS` | `crear-cobro` | Límite por cobro; por defecto 1 ($0.01) |
| Secreto por tienda | `crear-cobro` y `pey-webhook` | JSON con la API key de pey de la tienda; `tiendas_cobro.credencial_ref` guarda solo su nombre |

## Cuentas de demostración

`supabase/seed.sql` precarga organizaciones ficticias marcadas con `es_ejemplo` y cuatro cuentas de Supabase Auth. Localmente se aplica con `npx supabase db reset` (borra la base local).

| Rol | Correo ficticio | Perfil |
|---|---|---|
| Fundación | `fundacion@demo.agora.test` | Fundación Casa de la Abuela (ejemplo) |
| Tienda | `tienda@demo.agora.test` | Tienda Despensa del Barrio (ejemplo) |
| Repartidor | `repartidor@demo.agora.test` | Sin organización |
| Comprador | `comprador@demo.agora.test` | Sin perfil |

Contraseña pública de las cuatro cuentas, solo para la demo: `Agora-demo-2026!`. Estas cuentas solo ven datos de ejemplo y no pueden cobrar ni mover dinero.

## Modelo de datos

El cliente nunca escribe pagos, contadores de unidades, pedidos ni campos de moderación (`verificada`, `suspendida`, `retirada`): eso lo hace el backend con `service_role`. Las tablas nuevas de `public` reciben todos los privilegios por defecto; cada migración nueva debe quitarlos y dar solo los necesarios, como `20261114120100_politicas_acceso.sql`.
