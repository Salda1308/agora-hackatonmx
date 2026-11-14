# Estado y comprobante por token (T05)

Ampliación autorizada por el usuario el 14 Nov 2026. No cambia tablas, RLS,
GRANTs ni migraciones. No desplegada; no produce cobros.

`POST /functions/v1/estado-pago` con `Content-Type: application/json`:

```json
{ "token": "<seguimientoToken devuelto por crear-cobro>" }
```

El token HMAC-SHA256 autoriza solamente el pago al que fue ligado. Caduca a los
7 días. UUID, referencia o usuario anónimo por sí solos no autorizan lectura. No
admite IDs alternativos ni otros campos; cuerpo máximo de 1 KiB. El token se
manda en cuerpo, nunca query string, y no se registra. Respuestas no-store.

200 devuelve `pagoId`, `solicitudId`, `estado`, `montoCentavos`, `metodo`,
`pagadoEn` y `comprobante` (null hasta `pagado`). El comprobante copia
únicamente los campos permitidos de T04 y el detalle de artículos; descarta
cualquier otra metadata. No expone datos bancarios, pagador, credenciales ni
anomalías. 404 cubre indistintamente token inválido, caducado o pago
inexistente. 503 es transitorio. Nunca modifica pagos, no consulta pey ni
confirma por su cuenta. La UI consulta cada 4 segundos hasta estado terminal y
al volver del banco. La barra pública continúa por Realtime, con reconciliación
de lecturas.

Configurar un mismo `AGORA_SEGUIMIENTO_SECRET` aleatorio (mínimo 32 caracteres)
en ambas funciones; `SUPABASE_DB_URL` viene del runtime. La rotación invalida
los tokens emitidos. Desplegar `estado-pago` con `--no-verify-jwt`, igual que
`crear-cobro`: la autorización aquí es el token de capacidad, no una sesión. No
hace falta publicar `pagos` en Realtime. El poseedor del token puede leer el
comprobante durante su vigencia: no compartirlo. Rate limiting persistente sigue
correspondiendo a T13, igual que en crear-cobro.

Verificación local: `deno task check`, `deno task test`. Pruebas sin red, sin
pey ni secretos reales: firma, alteración, expiración, secreto distinto, rechazo
antes de consultar DB, allowlist y estados pendiente/confirmado.
