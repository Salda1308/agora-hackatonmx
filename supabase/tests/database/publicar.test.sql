-- Publicar una solicitud desde el catálogo (tarea 06). Fixtures propias; todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, aud, role, email) values
  ('06000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 't06-fundacion-a@ejemplo.test'),
  ('06000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 't06-fundacion-b@ejemplo.test'),
  ('06000000-0000-0000-0000-0000000000f3', 'authenticated', 'authenticated', 't06-sin-verificar@ejemplo.test');

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, suspendida) values
  ('06100000-0000-0000-0000-00000000000a', 'fundacion', 'asilo', 'T06 asilo', 't06-asilo', true, false),
  ('06100000-0000-0000-0000-00000000000b', 'fundacion', 'albergue', 'T06 albergue', 't06-albergue', true, false),
  ('06100000-0000-0000-0000-00000000000c', 'fundacion', 'albergue', 'T06 sin verificar', 't06-sin-verificar', false, false),
  ('06200000-0000-0000-0000-000000000001', 'tienda', null, 'T06 tienda', 't06-tienda', true, false),
  ('06200000-0000-0000-0000-000000000002', 'tienda', null, 'T06 otra tienda', 't06-otra-tienda', true, false),
  ('06200000-0000-0000-0000-000000000003', 'tienda', null, 'T06 tienda suspendida', 't06-tienda-suspendida', true, true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('06000000-0000-0000-0000-0000000000f1', 'fundacion', '06100000-0000-0000-0000-00000000000a'),
  ('06000000-0000-0000-0000-0000000000f2', 'fundacion', '06100000-0000-0000-0000-00000000000b'),
  ('06000000-0000-0000-0000-0000000000f3', 'fundacion', '06100000-0000-0000-0000-00000000000c');

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos, activo) values
  ('06300000-0000-0000-0000-000000000001', '06200000-0000-0000-0000-000000000001', 'Pañales', 250, true),
  ('06300000-0000-0000-0000-000000000002', '06200000-0000-0000-0000-000000000001', 'Leche', 100, true),
  ('06300000-0000-0000-0000-000000000003', '06200000-0000-0000-0000-000000000002', 'Arroz de otra tienda', 50, true),
  ('06300000-0000-0000-0000-000000000004', '06200000-0000-0000-0000-000000000001', 'Retirado', 50, false),
  ('06300000-0000-0000-0000-000000000005', '06200000-0000-0000-0000-000000000003', 'De suspendida', 50, true);

-- Borradores (las altas con id fijo las hace el fixture; el cliente no escribe id).
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo) values
  ('06400000-0000-0000-0000-00000000000c', '06100000-0000-0000-0000-00000000000c',
   '06200000-0000-0000-0000-000000000001', 'Borrador');
insert into public.solicitud_articulos (solicitud_id, articulo_id, cantidad) values
  ('06400000-0000-0000-0000-00000000000c', '06300000-0000-0000-0000-000000000001', 1);
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo) values
  ('06400000-0000-0000-0000-00000000000a', '06100000-0000-0000-0000-00000000000a',
   '06200000-0000-0000-0000-000000000001', 'Borrador con leche');
insert into public.solicitud_articulos (solicitud_id, articulo_id, cantidad) values
  ('06400000-0000-0000-0000-00000000000a', '06300000-0000-0000-0000-000000000002', 3);

set local role authenticated;

-- Fundación sin verificar -------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"06000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

select throws_ok(
  $$select public.publicar_solicitud('06200000-0000-0000-0000-000000000001', 'Pañales',
    '[{"articulo_id":"06300000-0000-0000-0000-000000000001","cantidad":2}]')$$,
  '42501', 'Tu fundación aún no está verificada', 'una fundación sin verificar no publica con la función');

select throws_ok(
  $$update public.solicitudes set estado = 'publicada' where id = '06400000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'una fundación sin verificar no publica su borrador');

-- Fundación A verificada --------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"06000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select throws_ok(
  $$select public.publicar_solicitud('06200000-0000-0000-0000-000000000001', 'Mezcla',
    '[{"articulo_id":"06300000-0000-0000-0000-000000000003","cantidad":1}]')$$,
  null, 'El artículo no está activo en el catálogo de la tienda de la solicitud',
  'un artículo de otra tienda es rechazado');

select throws_ok(
  $$select public.publicar_solicitud('06200000-0000-0000-0000-000000000001', 'Retirado',
    '[{"articulo_id":"06300000-0000-0000-0000-000000000004","cantidad":1}]')$$,
  null, 'El artículo no está activo en el catálogo de la tienda de la solicitud',
  'un artículo inactivo es rechazado');

select throws_ok(
  $$select public.publicar_solicitud('06200000-0000-0000-0000-000000000001', 'Vacía', '[]')$$,
  '22023', 'Agrega al menos un artículo', 'no se publica sin artículos');

select throws_ok(
  $$select public.publicar_solicitud('06200000-0000-0000-0000-000000000003', 'Suspendida',
    '[{"articulo_id":"06300000-0000-0000-0000-000000000005","cantidad":1}]')$$,
  '23514', 'La tienda no está verificada', 'no se publica con una tienda suspendida');

select lives_ok(
  $$select set_config('t06.solicitud', public.publicar_solicitud(
    '06200000-0000-0000-0000-000000000001', '  Pañales y leche  ',
    '[{"articulo_id":"06300000-0000-0000-0000-000000000001","cantidad":10},
      {"articulo_id":"06300000-0000-0000-0000-000000000002","cantidad":4}]',
    'Para noviembre')::text, true)$$,
  'una fundación verificada publica desde el catálogo');

select is(
  (select estado::text || '|' || titulo || '|' || (publicada_en is not null)::text
     from public.solicitudes where id = current_setting('t06.solicitud')::uuid),
  'publicada|Pañales y leche|true', 'queda publicada, con título limpio y fecha de publicación');

select is(
  (select sum(precio_centavos * cantidad)::int from public.solicitud_articulos
     where solicitud_id = current_setting('t06.solicitud')::uuid),
  2900, 'los artículos llevan el precio del catálogo');

select throws_ok(
  $$update public.solicitudes set estado = 'borrador' where id = current_setting('t06.solicitud')::uuid$$,
  '23514', 'Una solicitud publicada no vuelve a borrador', 'una solicitud publicada no vuelve a borrador');

update public.solicitud_articulos set cantidad = 99 where solicitud_id = current_setting('t06.solicitud')::uuid;
select is(
  (select sum(cantidad)::int from public.solicitud_articulos where solicitud_id = current_setting('t06.solicitud')::uuid),
  14, 'los artículos de una solicitud publicada no se editan');

-- Precio congelado al publicar: el borrador se arma con un precio y la tienda lo cambia.
reset role;
update public.catalogo_articulos set precio_centavos = 120 where id = '06300000-0000-0000-0000-000000000002';
set local role authenticated;

update public.solicitudes set estado = 'publicada' where id = '06400000-0000-0000-0000-00000000000a';
select is(
  (select precio_centavos from public.solicitud_articulos where solicitud_id = '06400000-0000-0000-0000-00000000000a'),
  120, 'al publicar el borrador se congela el precio vigente del catálogo');

reset role;
update public.catalogo_articulos set precio_centavos = 999 where id = '06300000-0000-0000-0000-000000000002';
set local role authenticated;
select is(
  (select precio_centavos from public.solicitud_articulos where solicitud_id = '06400000-0000-0000-0000-00000000000a'),
  120, 'un cambio de precio posterior no toca la solicitud publicada');

select throws_ok(
  $$update public.solicitud_articulos set precio_centavos = 1
    where solicitud_id = '06400000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'la fundación no escribe el precio');

-- Fundación B no toca la solicitud de A ----------------------------------
select set_config('request.jwt.claims',
  '{"sub":"06000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);

update public.solicitudes set titulo = 'Intrusión' where id = '06400000-0000-0000-0000-00000000000a';
reset role;
select is(
  (select titulo from public.solicitudes where id = '06400000-0000-0000-0000-00000000000a'),
  'Borrador con leche', 'otra fundación no edita mi solicitud');
set local role authenticated;

select throws_ok(
  $$insert into public.solicitudes (organizacion_id, tienda_id, titulo)
    values ('06100000-0000-0000-0000-00000000000a', '06200000-0000-0000-0000-000000000001', 'A nombre de otra')$$,
  '42501', null, 'otra fundación no crea solicitudes a mi nombre');

-- Visitante: ve la publicada en el directorio ------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select count(*)::int from public.solicitudes
     where organizacion_id = '06100000-0000-0000-0000-00000000000a' and estado = 'publicada'),
  2, 'las solicitudes publicadas aparecen en el directorio público');

reset role;
select * from finish();
rollback;
