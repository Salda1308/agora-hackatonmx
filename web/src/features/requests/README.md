# T05: solicitudes públicas y donación

Inicio, directorio y detalle leen Supabase con la llave pública y RLS existente.
No hay fallback a `data/sample.ts`. Solo se muestran publicadas/cerradas y su
organización visible; los colectivos de búsqueda no se publican ni geolocalizan.
`es_ejemplo` de solicitud/organización activa la etiqueta de ejemplo. Las
categorías visuales se infieren del nombre de los insumos (el modelo no tiene
categoría de solicitud). El precio congelado se muestra con dos decimales.

La barra escucha `solicitud_articulos` por Realtime y vuelve a leer al suscribir,
reconectar, volver del banco y cada 15 segundos. El cambio público de unidades
nunca se interpreta como confirmación del pago individual. El detalle distingue
la financiación parcial de una etapa completamente terminada.

El mapa usa Leaflet + teselas públicas OSM, sin API key. Solo incluye coordenadas
públicas; las solicitudes sin ubicación permanecen en la lista. Muestra un aviso
si fallan las teselas. La carga del mapa y el generador QR se difiere para no
cargar ambos en inicio. `qrcode` dibuja el payload localmente, sin enviarlo a
servicios de imágenes externos.

Donación: 1–10 artículos con cantidades enteras, QR/push/link. El servidor es la
fuente de precio/disponibilidad. No hay reintentos automáticos de POST. Doble
clic queda bloqueado. Antes del envío se guarda un marcador de intento; 202,
503, respuesta inválida o conexión perdida conservan el bloqueo al recargar.
Solo errores definitivos de validación permiten volver al formulario. El
comprobante confirmado permite iniciar explícitamente una donación adicional.

Se guarda `pagoId`, referencia, instrucciones de pago y token en sessionStorage
(de esta pestaña), nunca el teléfono. El teléfono se vacía tras la respuesta.
“Siguiendo” recupera los intentos de la pestaña sin poner tokens en URLs.
El retorno de un link tampoco significa pagado. La pantalla consulta
`estado-pago` cada 4 segundos hasta confirmación/rechazo/expiración; el token
inválido o vencido remite a la organización. El comprobante puede imprimirse o
guardarse como PDF desde el diálogo del navegador.

## Puesta en marcha

Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` al construir la
web; solo credenciales públicas. No poner secretos de pey ni service_role en
Vite. Usar las instrucciones de `crear-cobro` y `estado-pago`: ambas necesitan
el mismo `AGORA_SEGUIMIENTO_SECRET` aleatorio, mínimo 32 caracteres. El secreto
no se genera ni despliega desde este frontend.

El bloque final T05 de seed.sql añade dos solicitudes ficticias, precios de
$0.01 y una ubicación de ejemplo. No añade tiendas_cobro ni credenciales: un
operador debe verificar/configurar una cuenta real por separado antes de un
cobro real autorizado. Los fixtures de pruebas integradas usan cuentas falsas
y se eliminan al terminar.

## Verificación reproducible

- `npm --prefix web run build` y `npm --prefix web run lint`.
- En `supabase/functions/crear-cobro`: `deno task check && deno task test`.
- En `supabase/functions/estado-pago`: `deno task check && deno task test`.
- Con stack **aislado** `hackatonmx-t05`, API 57321 y DB 57322:
  `AGORA_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:57322/postgres deno task test:db`
  desde estado-pago. Recorre QR/push/link, webhook firmado, idempotencia,
  contadores y comprobante por token usando pey simulado.
- La regresión `pey-webhook/integration_test.ts` también verifica Realtime anon.
  Ejecutarla con las variables locales de su README, cambiando los puertos y
  los permisos Deno a 57321/57322; no usar los del stack compartido.
- Con Vite en 5175 contra ese stack, ejecutar `node web/tests/public-flow.mjs`.
  Requiere Playwright ya disponible (se puede indicar `PLAYWRIGHT_MODULE` a un
  módulo instalado y `PLAYWRIGHT_CHANNEL=chrome`). No añade dependencia al repo.
  Intercepta siempre los endpoints de pago: nunca llama a pey. Comprueba las
  tres vías, doble clic, comprobante, restauración, no guardar teléfono,
  errores inciertos y ausencia de overflow en 320/390/1280, claro/oscuro.

- `node web/tests/public-realtime.mjs` usa Chrome y Docker contra
  `supabase_db_hackatonmx-t05`. Actualiza y restaura únicamente el artículo
  semilla T05: comprueba que la barra React cambie en menos de 5 segundos, sin
  recargar y sin declarar un pago individual confirmado. No ejecutarlo sobre
  datos modificados: exige el seed inicial.

Pendiente de autorización aparte: despliegue, secreto de seguimiento remoto y
recorrido con cobro real de $0.01 por cada método. La vuelta a la app bancaria,
notificaciones CoDi, teselas externas y safe-area de Capacitor requieren
verificación en dispositivo y red reales.
