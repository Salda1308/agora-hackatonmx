-- R1: exclusivamente local/demostración. NO cargar en producción.
-- Cuentas ficticias; contraseña pública compartida: Agora-demo-2026!
-- El rol se asigna aquí en perfiles, nunca en metadata editable de Auth.
begin;

insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, descripcion, verificada, verificada_en, es_ejemplo)
values
  ('f2000000-0000-0000-0000-000000000001', 'fundacion', 'asilo',
   'Casa de la Abuela — ejemplo', 'casa-abuela-demo',
   'Organización ficticia para probar Ágora.', true, now(), true),
  ('f2000000-0000-0000-0000-000000000002', 'tienda', null,
   'Despensa del Barrio — ejemplo', 'despensa-barrio-demo',
   'Tienda ficticia para probar Ágora. No tiene credenciales de cobro.', true, now(), true)
on conflict (id) do nothing;

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  '00000000-0000-0000-0000-000000000000'::uuid, id, 'authenticated', 'authenticated',
  email, extensions.crypt('Agora-demo-2026!', extensions.gen_salt('bf')), now(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre_visible', nombre, 'es_ejemplo', true), now(), now()
from (values
  ('f1000000-0000-0000-0000-000000000001'::uuid, 'fundacion@demo.agora.test', 'Fundación demo'),
  ('f1000000-0000-0000-0000-000000000002'::uuid, 'tienda@demo.agora.test', 'Tienda demo'),
  ('f1000000-0000-0000-0000-000000000003'::uuid, 'repartidor@demo.agora.test', 'Repartidor demo'),
  ('f1000000-0000-0000-0000-000000000004'::uuid, 'comprador@demo.agora.test', 'Comprador demo')
) as demo(id, email, nombre)
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select id, id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
  now(), now()
from auth.users
where id in (
  'f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004'
)
on conflict (provider_id, provider) do nothing;

insert into public.perfiles (id, rol, organizacion_id, nombre_visible) values
  ('f1000000-0000-0000-0000-000000000001', 'fundacion', 'f2000000-0000-0000-0000-000000000001', 'Fundación demo'),
  ('f1000000-0000-0000-0000-000000000002', 'tienda', 'f2000000-0000-0000-0000-000000000002', 'Tienda demo'),
  ('f1000000-0000-0000-0000-000000000003', 'repartidor', null, 'Repartidor demo')
on conflict (id) do nothing;

-- El comprador (incluso autenticado) NO tiene un perfil de rol.
commit;

-- T05 INICIO: ejemplos públicos para el recorrido de donación. Solo local/demo.
-- Precio de prueba: 1 centavo. Sin cuentas de cobro ni credenciales de pey.
begin;
insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, descripcion, direccion_publica, latitud, longitud, verificada, verificada_en, es_ejemplo)
values
  ('f5000000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Albergue Coco — ejemplo', 'albergue-coco-t05', 'Organización ficticia para probar donaciones.', 'Ciudad de México (ubicación de ejemplo)', 19.4326, -99.1332, true, now(), true),
  ('f5000000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda Coco — ejemplo', 'tienda-coco-t05', 'Tienda ficticia sin cuenta de cobro.', null, null, null, true, now(), true),
  ('f5000000-0000-0000-0000-000000000003', 'fundacion', 'asilo', 'Casa Coco — ejemplo', 'casa-coco-t05', 'Organización ficticia con ubicación no publicada.', null, null, null, true, now(), true)
on conflict (id) do nothing;
insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('f5100000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000002', 'Garrafón de agua — prueba', 'pieza', 1, true),
  ('f5100000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000002', 'Jabón — prueba', 'pieza', 1, true)
on conflict (id) do nothing;
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('f5200000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000002', 'Agua para el albergue — ejemplo', 'Cada unidad cuesta $0.01 para probar el flujo. No es una solicitud real.', 'publicada', now(), true),
  ('f5200000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000002', 'Higiene para Casa Coco — ejemplo', 'Solicitud ficticia sin ubicación pública.', 'publicada', now(), true)
on conflict (id) do nothing;
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad)
values
  ('f5300000-0000-0000-0000-000000000001', 'f5200000-0000-0000-0000-000000000001', 'f5100000-0000-0000-0000-000000000001', 10),
  ('f5300000-0000-0000-0000-000000000002', 'f5200000-0000-0000-0000-000000000002', 'f5100000-0000-0000-0000-000000000002', 10)
on conflict (id) do nothing;
commit;
-- T05 FIN.

-- T08 INICIO: catálogo y pedidos pagados de ejemplo para la tienda demo. Solo local/demo.
-- Pagos simulados (sin pey) para ver el panel; marcar listo genera el código de recogida.
begin;
insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('f8100000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Paquete de pañales adulto — ejemplo', 'paquete', 28900, true),
  ('f8100000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'Arroz 1 kg — ejemplo', 'bolsa', 3200, true),
  ('f8100000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'Leche 1 L — ejemplo', 'pieza', 2800, true),
  ('f8100000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'Jabón de tocador — ejemplo', 'pieza', 1500, true)
on conflict (id) do nothing;
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Despensa de noviembre — ejemplo', 'Solicitud ficticia para el panel de la tienda.', 'publicada', now(), true)
on conflict (id) do nothing;
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad)
values
  ('f8300000-0000-0000-0000-000000000001', 'f8200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000001', 6),
  ('f8300000-0000-0000-0000-000000000002', 'f8200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000002', 20)
on conflict (id) do nothing;
insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo, metadata)
values
  ('f8400000-0000-0000-0000-000000000001', 'f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 57800, 'qr', '{"ejemplo": true}'),
  ('f8400000-0000-0000-0000-000000000002', 'f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 16000, 'push', '{"ejemplo": true}')
on conflict (id) do nothing;
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades)
values
  ('f8400000-0000-0000-0000-000000000001', 'f8300000-0000-0000-0000-000000000001', 2),
  ('f8400000-0000-0000-0000-000000000002', 'f8300000-0000-0000-0000-000000000002', 5)
on conflict do nothing;
-- Como el webhook: suma unidades pagadas y confirma; el trigger de T08 crea los pedidos.
update public.solicitud_articulos sa set unidades_pagadas = pa.unidades
from public.pago_articulos pa
where pa.solicitud_articulo_id = sa.id and pa.pago_id in
  ('f8400000-0000-0000-0000-000000000001', 'f8400000-0000-0000-0000-000000000002')
  and sa.unidades_pagadas = 0;
update public.pagos set estado = 'pagado', pagado_en = now()
where id in ('f8400000-0000-0000-0000-000000000001', 'f8400000-0000-0000-0000-000000000002')
  and estado = 'creado';
commit;
-- T08 FIN.

-- T17 INICIO: publicaciones ficticias para las páginas de organizaciones demo.
insert into public.publicaciones (id, organizacion_id, texto, es_ejemplo, consentimiento)
values ('f1700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
  'Una ayuda pequeña también mueve mucho. Aquí compartiremos las novedades de nuestra comunidad. Esta publicación es ficticia y no acredita entregas.', true, true)
on conflict (id) do nothing;
-- T17 FIN.
-- T18 INICIO: jornadas de voluntariado de ejemplo. Solo local/demo.
-- Contactos ficticios; la lista de inscritos solo la ve la fundación.
begin;
insert into public.jornadas
  (id, organizacion_id, titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos, es_ejemplo)
values
  ('f1800000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
   'Tarde de lectura con abuelos — ejemplo', 'Leer y platicar con las personas residentes.',
   'Mayores de 16 años. Ropa cómoda.', 'Ciudad de México (ubicación de ejemplo)',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '7 days 16 hours') at time zone 'America/Mexico_City', (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '7 days 19 hours') at time zone 'America/Mexico_City', 12, true),
  ('f1800000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000001',
   'Limpieza del albergue — ejemplo', 'Lavar áreas comunes y ordenar la bodega.',
   'Guantes y agua. Mayores de 18 años.', 'Ciudad de México (ubicación de ejemplo)',
   (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '5 days 9 hours') at time zone 'America/Mexico_City', (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '5 days 13 hours') at time zone 'America/Mexico_City', 3, true),
  ('f1800000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001',
   'Pintura del comedor — ejemplo', 'Jornada pasada para probar la confirmación de asistencia.',
   'Ropa que se pueda manchar.', 'Ciudad de México (ubicación de ejemplo)',
   (date_trunc('day', now() at time zone 'America/Mexico_City') - interval '2 days' + interval '9 hours') at time zone 'America/Mexico_City', (date_trunc('day', now() at time zone 'America/Mexico_City') - interval '2 days' + interval '14 hours') at time zone 'America/Mexico_City', 20, true)
on conflict (id) do nothing;
insert into public.inscripciones_jornada (id, jornada_id, nombre_contacto, contacto, asistentes, estado)
values
  ('f1810000-0000-0000-0000-000000000001', 'f1800000-0000-0000-0000-000000000001', 'Empresa Ejemplo S.A.', 'voluntariado@ejemplo.test', 4, 'pendiente'),
  ('f1810000-0000-0000-0000-000000000002', 'f1800000-0000-0000-0000-000000000002', 'Ana Ejemplo', '55 0000 0000', 2, 'confirmada'),
  ('f1810000-0000-0000-0000-000000000003', 'f1800000-0000-0000-0000-000000000003', 'Constructora Ejemplo', 'rh@ejemplo.test', 6, 'confirmada'),
  ('f1810000-0000-0000-0000-000000000004', 'f1800000-0000-0000-0000-000000000003', 'Luis Ejemplo', 'luis@ejemplo.test', 1, 'asistio')
on conflict (id) do nothing;
commit;
-- T18 FIN.

-- T07 INICIO: artículos de $0.01 en el catálogo de la tienda demo para el recorrido de la entrega.
-- La fundación demo publica con ellos y el comprador paga un centavo real por CoDi. Sin credenciales.
begin;
insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('f0700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Garrafón de agua, prueba $0.01 (ejemplo)', 'pieza', 1, true),
  ('f0700000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'Arroz 1 kg, prueba $0.01 (ejemplo)', 'bolsa', 1, true)
on conflict (id) do nothing;
commit;
-- T07 FIN.

-- T09 INICIO: pedidos listos con tareas abiertas para el repartidor demo. Solo local/demo.
-- Pagos simulados (sin pey). Uno de bajo valor ($84.00) y uno alto ($1,156.00) que el
-- voluntario nuevo no ve (regla: hasta $500.00 con menos de 3 entregas).
begin;
update public.organizaciones
set direccion_publica = 'Mercado de ejemplo, local 12, Ciudad de México', latitud = 19.4270, longitud = -99.1677
where id = 'f2000000-0000-0000-0000-000000000002' and direccion_publica is null;
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('f9200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Leche y pañales — ejemplo', 'Solicitud ficticia para el recorrido del repartidor.', 'publicada', now(), true)
on conflict (id) do nothing;
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad)
values
  ('f9300000-0000-0000-0000-000000000001', 'f9200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000003', 10),
  ('f9300000-0000-0000-0000-000000000002', 'f9200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000001', 10)
on conflict (id) do nothing;
insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo, metadata)
values
  ('f9400000-0000-0000-0000-000000000001', 'f9200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 8400, 'qr', '{"ejemplo": true}'),
  ('f9400000-0000-0000-0000-000000000002', 'f9200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 115600, 'qr', '{"ejemplo": true}')
on conflict (id) do nothing;
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades)
values
  ('f9400000-0000-0000-0000-000000000001', 'f9300000-0000-0000-0000-000000000001', 3),
  ('f9400000-0000-0000-0000-000000000002', 'f9300000-0000-0000-0000-000000000002', 4)
on conflict do nothing;
update public.solicitud_articulos sa set unidades_pagadas = pa.unidades
from public.pago_articulos pa
where pa.solicitud_articulo_id = sa.id and pa.pago_id in
  ('f9400000-0000-0000-0000-000000000001', 'f9400000-0000-0000-0000-000000000002')
  and sa.unidades_pagadas = 0;
update public.pagos set estado = 'pagado', pagado_en = now()
where id in ('f9400000-0000-0000-0000-000000000001', 'f9400000-0000-0000-0000-000000000002')
  and estado = 'creado';
-- Como la tienda al marcar listo: genera el código y la tarea abierta (T09).
update public.pedidos set estado = 'listo'
where solicitud_id = 'f9200000-0000-0000-0000-000000000001' and estado = 'preparando';
commit;
-- T09 FIN.

-- T10 INICIO: otro pedido listo de bajo valor para repetir la entrega con foto y código
-- (repartidor demo recoge y entrega; fundación demo confirma). Pago simulado, sin pey.
begin;
insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo, metadata)
values
  ('fa400000-0000-0000-0000-000000000001', 'f9200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 5600, 'qr', '{"ejemplo": true}')
on conflict (id) do nothing;
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades)
values ('fa400000-0000-0000-0000-000000000001', 'f9300000-0000-0000-0000-000000000001', 2)
on conflict do nothing;
update public.solicitud_articulos sa set unidades_pagadas = sa.unidades_pagadas + pa.unidades
from public.pago_articulos pa
join public.pagos p on p.id = pa.pago_id
where pa.solicitud_articulo_id = sa.id and pa.pago_id = 'fa400000-0000-0000-0000-000000000001'
  and p.estado = 'creado';
update public.pagos set estado = 'pagado', pagado_en = now()
where id = 'fa400000-0000-0000-0000-000000000001' and estado = 'creado';
update public.pedidos set estado = 'listo'
where solicitud_id = 'f9200000-0000-0000-0000-000000000001' and estado = 'preparando';
commit;
-- T10 FIN.

-- T24 INICIO: feed de Inicio con publicaciones, me gusta y comentarios ficticios. Solo local/demo.
-- Fechas escalonadas para que el feed mezcle publicaciones, solicitudes y jornadas.
-- Los comentarios tienen más de 24 h para no consumir los límites de las cuentas demo.
begin;
insert into public.publicaciones (id, organizacion_id, texto, es_ejemplo, consentimiento, creada_en)
values
  ('f2400000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001',
   'Hoy llegaron garrafones de agua gracias a quienes donaron. Esta publicación es ficticia.', true, true, now() - interval '3 hours'),
  ('f2400000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001',
   'Los abuelos prepararon una tarde de juegos de mesa. Esta publicación es ficticia.', true, true, now() - interval '1 day'),
  ('f2400000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000003',
   'Estamos organizando la bodega para recibir artículos de higiene. Esta publicación es ficticia.', true, true, now() - interval '2 days')
on conflict (id) do nothing;
insert into public.me_gusta (tipo, objetivo_id, usuario_id)
values
  ('publicacion', 'f2400000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004'),
  ('publicacion', 'f2400000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003'),
  ('publicacion', 'f2400000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000004'),
  ('solicitud', 'f5200000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004'),
  ('jornada', 'f1800000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003')
on conflict do nothing;
insert into public.comentarios (id, tipo, objetivo_id, usuario_id, texto, creado_en)
values
  ('f2410000-0000-0000-0000-000000000001', 'publicacion', 'f2400000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000004', '¡Qué gusto ver que llegó el agua!', now() - interval '26 hours'),
  ('f2410000-0000-0000-0000-000000000002', 'publicacion', 'f2400000-0000-0000-0000-000000000002',
   'f1000000-0000-0000-0000-000000000001', 'Gracias a todos los que nos apoyan.', now() - interval '25 hours'),
  ('f2410000-0000-0000-0000-000000000003', 'jornada', 'f1800000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000003', 'Ahí estaré con dos amigos.', now() - interval '30 hours')
on conflict (id) do nothing;
commit;
-- T24 FIN.
