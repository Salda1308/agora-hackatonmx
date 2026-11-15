-- T25: imagen propia de la solicitud. Fixtures exclusivas; todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, aud, role, email) values
  ('25000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 't25-fundacion-a@ejemplo.test'),
  ('25000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 't25-fundacion-b@ejemplo.test');
insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, suspendida) values
  ('25100000-0000-0000-0000-00000000000a', 'fundacion', 'asilo', 'T25 asilo', 't25-asilo', true, false),
  ('25100000-0000-0000-0000-00000000000b', 'fundacion', 'albergue', 'T25 albergue', 't25-albergue', true, false),
  ('25200000-0000-0000-0000-000000000001', 'tienda', null, 'T25 tienda', 't25-tienda', true, false);
insert into public.perfiles (id, rol, organizacion_id) values
  ('25000000-0000-0000-0000-0000000000f1', 'fundacion', '25100000-0000-0000-0000-00000000000a'),
  ('25000000-0000-0000-0000-0000000000f2', 'fundacion', '25100000-0000-0000-0000-00000000000b');
insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos, activo) values
  ('25300000-0000-0000-0000-000000000001', '25200000-0000-0000-0000-000000000001', 'Pañales', 250, true);
-- Objetos ya sanitizados por t17-imagen (los guarda service_role).
insert into storage.objects (bucket_id, name) values
  ('publicaciones', '25100000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000a1.jpg'),
  ('publicaciones', '25100000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000b1.jpg');

select has_column('public', 'solicitudes', 'imagen_ruta', 'solicitudes tiene imagen_ruta');
select ok(not has_function_privilege('anon', 'public.publicar_solicitud(uuid, text, jsonb, text, text)', 'execute'),
  'anónimo no ejecuta publicar_solicitud');
select ok(has_function_privilege('authenticated', 'public.publicar_solicitud(uuid, text, jsonb, text, text)', 'execute'),
  'authenticated ejecuta publicar_solicitud');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"25000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select lives_ok($$select public.publicar_solicitud('25200000-0000-0000-0000-000000000001', 'Sin imagen',
  '[{"articulo_id":"25300000-0000-0000-0000-000000000001","cantidad":1}]')$$, 'publica sin imagen (firma previa)');
select lives_ok($$select public.publicar_solicitud('25200000-0000-0000-0000-000000000001', 'Con imagen',
  '[{"articulo_id":"25300000-0000-0000-0000-000000000001","cantidad":1}]', 'Texto',
  '25100000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000a1.jpg')$$, 'publica con imagen propia');
select is((select imagen_ruta from public.solicitudes where titulo = 'Con imagen'),
  '25100000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000a1.jpg', 'guarda la ruta');
select is((select imagen_ruta from public.solicitudes where titulo = 'Sin imagen'), null, 'sin imagen queda nula');
select throws_ok($$select public.publicar_solicitud('25200000-0000-0000-0000-000000000001', 'Ajena',
  '[{"articulo_id":"25300000-0000-0000-0000-000000000001","cantidad":1}]', null,
  '25100000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-0000000000b1.jpg')$$,
  '42501', 'La imagen no pertenece a tu organización', 'rechaza la imagen de otra organización');
select throws_ok($$select public.publicar_solicitud('25200000-0000-0000-0000-000000000001', 'URL libre',
  '[{"articulo_id":"25300000-0000-0000-0000-000000000001","cantidad":1}]', null,
  'https://ejemplo.test/foto.jpg')$$,
  '42501', 'La imagen no pertenece a tu organización', 'rechaza una URL libre');
select throws_ok($$select public.publicar_solicitud('25200000-0000-0000-0000-000000000001', 'Inexistente',
  '[{"articulo_id":"25300000-0000-0000-0000-000000000001","cantidad":1}]', null,
  '25100000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000ff.jpg')$$,
  '42501', 'La imagen no pertenece a tu organización', 'rechaza una ruta propia que no existe');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select medios from public.feed_publico(50) where titulo = 'Con imagen'),
  '[{"ruta": "25100000-0000-0000-0000-00000000000a/00000000-0000-0000-0000-0000000000a1.jpg", "tipo": "imagen"}]'::jsonb,
  'el anónimo ve la imagen en el feed');
select is((select medios from public.feed_publico(50) where titulo = 'Sin imagen'), '[]'::jsonb,
  'sin imagen el feed no trae medios');
select is((select count(*)::int from storage.objects where bucket_id = 'publicaciones' and name like '25100000-%'), 1,
  'el anónimo lee solo la imagen enlazada a una solicitud pública');
reset role;

select * from finish();
rollback;
