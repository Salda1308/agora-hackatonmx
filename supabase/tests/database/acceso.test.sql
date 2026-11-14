-- Pruebas de reglas de acceso y de integridad del modelo (tarea 02).
-- Correr con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Datos de prueba (como postgres, sin RLS) ---------------------------------

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'fundacion-a@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'fundacion-b@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'tienda-1@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'tienda-2@ejemplo.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'repartidor@ejemplo.test');

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('10000000-0000-0000-0000-00000000000a', 'fundacion', 'asilo', 'Asilo verificado', 'asilo-verificado', true),
  ('10000000-0000-0000-0000-00000000000b', 'fundacion', 'albergue', 'Albergue sin verificar', 'albergue-sin-verificar', false),
  ('10000000-0000-0000-0000-00000000000c', 'fundacion', 'colectivo_busqueda', 'Colectivo', 'colectivo', true),
  ('20000000-0000-0000-0000-000000000001', 'tienda', null, 'Tienda uno', 'tienda-uno', true),
  ('20000000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda dos', 'tienda-dos', true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'fundacion', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000f2', 'fundacion', '10000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-0000000000a1', 'tienda', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', 'tienda', '20000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000b1', 'repartidor', null);

insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, credencial_ref) values
  ('20000000-0000-0000-0000-000000000001', 'Tienda uno SA de CV', 'TUN010101AB1', 'PEY_TIENDA_UNO');

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Paquete de pañales', 1);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado, publicada_en) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-000000000001', 'Pañales para noviembre', 'publicada', now());

insert into public.solicitud_articulos (id, solicitud_id, articulo_id, nombre, precio_centavos, cantidad) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', 'cualquiera', 999, 10);

insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo) values
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 1, 'qr');

insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001');

insert into public.jornadas (id, organizacion_id, titulo, inicia_en, termina_en, cupos) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
   'Jornada de limpieza', now() + interval '1 day', now() + interval '1 day 4 hours', 5);

insert into public.publicaciones (id, organizacion_id, texto, consentimiento) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Gracias a todos', true);

-- Integridad del modelo (backend) ------------------------------------------

select is(
  (select precio_centavos from public.solicitud_articulos where id = '50000000-0000-0000-0000-000000000001'),
  1, 'el artículo de la solicitud copia el precio del catálogo');

update public.catalogo_articulos set precio_centavos = 5 where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select precio_centavos from public.solicitud_articulos where id = '50000000-0000-0000-0000-000000000001'),
  1, 'cambiar el precio del catálogo no cambia una solicitud ya publicada');

select ok(
  (select num_ref between 1 and 9999999 from public.pagos where id = '60000000-0000-0000-0000-000000000001'),
  'numRef se genera con máximo 7 dígitos');

select is(
  (select s.id from public.pagos p join public.solicitudes s on s.id = p.solicitud_id
    where p.num_ref = (select num_ref from public.pagos where id = '60000000-0000-0000-0000-000000000001')),
  '40000000-0000-0000-0000-000000000001'::uuid, 'numRef se resuelve a su solicitud');

select throws_ok(
  $$insert into public.pagos (solicitud_id, tienda_id, monto_centavos, metodo, num_ref)
    select solicitud_id, tienda_id, 1, 'qr', num_ref from public.pagos
    where id = '60000000-0000-0000-0000-000000000001'$$,
  '23505', null, 'numRef no se repite');

select throws_ok(
  $$insert into public.pagos (solicitud_id, tienda_id, monto_centavos, metodo, num_ref)
    values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'qr', 10000000)$$,
  '23514', null, 'numRef de 8 dígitos se rechaza');

update public.pagos set pey_transaccion_id = 'tx-123' where id = '60000000-0000-0000-0000-000000000001';
select throws_ok(
  $$insert into public.pagos (solicitud_id, tienda_id, monto_centavos, metodo, pey_transaccion_id)
    values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'qr', 'tx-123')$$,
  '23505', null, 'la misma transacción de pey no se registra dos veces');

select throws_ok(
  $$update public.solicitud_articulos set unidades_pagadas = 11
    where id = '50000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'no se pagan más unidades que la cantidad pedida');

-- Donante anónimo -------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$update public.solicitud_articulos set unidades_pagadas = 10$$,
  '42501', null, 'anónimo no puede marcar unidades pagadas');

select throws_ok(
  $$update public.solicitudes set estado = 'cerrada'$$,
  '42501', null, 'anónimo no puede cambiar el estado de una solicitud');

select throws_ok(
  $$update public.pagos set estado = 'pagado', pagado_en = now()$$,
  '42501', null, 'anónimo no puede marcar pagado un pago');

select throws_ok(
  $$insert into public.pagos (solicitud_id, tienda_id, monto_centavos, metodo)
    values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'qr')$$,
  '42501', null, 'anónimo no puede crear pagos');

select throws_ok(
  $$select * from public.tiendas_cobro$$,
  '42501', null, 'anónimo no puede leer el titular de cobro');

select throws_ok(
  $$select * from public.pagos$$,
  '42501', null, 'anónimo no puede leer pagos');

select is(
  -- Aislar las organizaciones de esta prueba de los datos de supabase/seed.sql.
  (select array_agg(slug order by slug) from public.organizaciones where id in (
    '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  )),
  array['asilo-verificado', 'tienda-dos', 'tienda-uno'],
  'anónimo solo ve organizaciones verificadas y ningún colectivo de búsqueda');

select is((select count(*)::int from public.solicitud_articulos), 1,
  'anónimo ve los artículos de la solicitud publicada');

select lives_ok(
  $$insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
    values ('80000000-0000-0000-0000-000000000001', 'Empresa X', 'rh@empresa.test', 4)$$,
  'anónimo se inscribe a una jornada pública');

select throws_ok(
  $$insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
    values ('80000000-0000-0000-0000-000000000001', 'Empresa Y', 'rh@otra.test', 2)$$,
  'P0001', null, 'no se pasa del cupo de la jornada');

select throws_ok(
  $$select * from public.inscripciones_jornada$$,
  '42501', null, 'la lista de inscritos no es pública');

select lives_ok(
  $$insert into public.reportes (publicacion_id, motivo)
    values ('90000000-0000-0000-0000-000000000001', 'Contenido inapropiado')$$,
  'anónimo puede reportar una publicación');

reset role;

-- Fundación sin verificar ---------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);

select throws_ok(
  $$update public.organizaciones set verificada = true where id = '10000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'una fundación no puede marcarse verificada a sí misma');

select throws_ok(
  $$update public.organizaciones set suspendida = false where id = '10000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'una fundación no puede quitarse una suspensión');

select throws_ok(
  $$update public.perfiles set rol = 'tienda'$$,
  '42501', null, 'un usuario no puede cambiarse de rol');

select throws_ok(
  $$insert into public.solicitudes (organizacion_id, tienda_id, titulo, estado)
    values ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', 'Agua', 'publicada')$$,
  '42501', null, 'una fundación sin verificar no puede publicar una solicitud');

select lives_ok(
  $$insert into public.solicitudes (organizacion_id, tienda_id, titulo)
    values ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', 'Agua')$$,
  'una fundación sin verificar puede guardar un borrador');

select throws_ok(
  $$insert into public.publicaciones (organizacion_id, texto, consentimiento)
    values ('10000000-0000-0000-0000-00000000000b', 'Hola', true)$$,
  '42501', null, 'una organización sin verificar no puede publicar en su página');

-- Fundación verificada -------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select throws_ok(
  $$update public.solicitud_articulos set unidades_pagadas = 10$$,
  '42501', null, 'la fundación no puede marcar unidades pagadas');

select throws_ok(
  $$update public.pagos set estado = 'pagado', pagado_en = now()$$,
  '42501', null, 'la fundación no puede marcar pagado un pago');

select lives_ok(
  $$insert into public.publicaciones (organizacion_id, texto, consentimiento)
    values ('10000000-0000-0000-0000-00000000000a', 'Nueva jornada', true)$$,
  'una organización verificada publica en su página');

select is((select count(*)::int from public.inscripciones_jornada), 1,
  'la fundación ve las inscripciones de sus jornadas');

-- Tiendas ----------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select is((select count(*)::int from public.pedidos), 0,
  'una tienda no ve los pedidos de otra');

select is((select count(*)::int from public.pagos), 0,
  'una tienda no ve los pagos de otra');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*)::int from public.pedidos), 1,
  'la tienda ve sus pedidos');

update public.pedidos set estado = 'listo' where id = '70000000-0000-0000-0000-000000000001';
select is((select estado::text from public.pedidos where id = '70000000-0000-0000-0000-000000000001'), 'listo',
  'la tienda marca listo su pedido');

reset role;

select * from finish();
rollback;
