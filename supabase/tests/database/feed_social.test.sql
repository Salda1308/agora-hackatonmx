-- T24: feed público, me gusta, comentarios, reportes y bloqueo.
-- Fixtures propias con fechas del año 2000 o anteriores: con p_antes = '2000-02-01'
-- el feed solo devuelve lo de esta prueba, aunque el seed tenga datos. Todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(74);

-- Cuentas ------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('24000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 't24-org@ejemplo.test', now()),
  ('24000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 't24-tienda@ejemplo.test', now()),
  ('24000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 't24-v1@ejemplo.test', now()),
  ('24000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 't24-v2@ejemplo.test', now()),
  ('24000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 't24-v3@ejemplo.test', now()),
  ('24000000-0000-0000-0000-0000000000c0', 'authenticated', 'authenticated', 't24-sin-confirmar@ejemplo.test', null),
  ('24000000-0000-0000-0000-0000000000d0', 'authenticated', 'authenticated', 't24@demo.agora.test', now()),
  ('24000000-0000-0000-0000-0000000000e0', 'authenticated', 'authenticated', 't24-bloqueado@ejemplo.test', now());

-- Organizaciones -------------------------------------------------------------
insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, suspendida) values
  ('24100000-0000-0000-0000-00000000000a', 'fundacion', 'albergue', 'T24 Albergue', 't24-albergue', true, false),
  ('24100000-0000-0000-0000-00000000000b', 'tienda', null, 'T24 Tienda', 't24-tienda', true, false),
  ('24100000-0000-0000-0000-00000000000c', 'fundacion', 'asilo', 'T24 Sin verificar', 't24-sin-verificar', false, false),
  ('24100000-0000-0000-0000-00000000000d', 'fundacion', 'asilo', 'T24 Suspendida', 't24-suspendida', true, true),
  ('24100000-0000-0000-0000-00000000000e', 'fundacion', 'colectivo_busqueda', 'T24 Colectivo', 't24-colectivo', true, false);

insert into public.perfiles (id, rol, organizacion_id, nombre_visible) values
  ('24000000-0000-0000-0000-0000000000a1', 'fundacion', '24100000-0000-0000-0000-00000000000a', 'Ana del albergue'),
  ('24000000-0000-0000-0000-0000000000b1', 'tienda', '24100000-0000-0000-0000-00000000000b', 'correo@ejemplo.test');

-- Contenido --------------------------------------------------------------------
insert into public.publicaciones (id, organizacion_id, texto, retirada, creada_en) values
  ('24200000-0000-0000-0000-000000000001', '24100000-0000-0000-0000-00000000000a', 'Publicación visible', false, '2000-01-10 12:00+00'),
  ('24200000-0000-0000-0000-000000000002', '24100000-0000-0000-0000-00000000000a', 'Retirada', true, '2000-01-10 13:00+00'),
  ('24200000-0000-0000-0000-000000000003', '24100000-0000-0000-0000-00000000000c', 'De no verificada', false, '2000-01-10 13:00+00'),
  ('24200000-0000-0000-0000-000000000004', '24100000-0000-0000-0000-00000000000d', 'De suspendida', false, '2000-01-10 13:00+00'),
  ('24200000-0000-0000-0000-000000000005', '24100000-0000-0000-0000-00000000000e', 'De colectivo', false, '2000-01-10 13:00+00');

-- 55 publicaciones viejas para probar el tope de 50.
insert into public.publicaciones (organizacion_id, texto, creada_en)
select '24100000-0000-0000-0000-00000000000a', 'Vieja ' || g, '1999-06-01 00:00+00'::timestamptz + make_interval(hours => g)
from generate_series(1, 55) g;

insert into public.publicacion_medios (publicacion_id, tipo, url, orden) values
  ('24200000-0000-0000-0000-000000000001', 'imagen', '24100000-0000-0000-0000-00000000000a/foto.jpg', 1),
  ('24200000-0000-0000-0000-000000000001', 'video', 'https://vimeo.com/123456', 0);

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('24300000-0000-0000-0000-000000000001', '24100000-0000-0000-0000-00000000000b', 'Croquetas', 100);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, creada_en) values
  ('24400000-0000-0000-0000-000000000001', '24100000-0000-0000-0000-00000000000a', '24100000-0000-0000-0000-00000000000b',
   'Croquetas para el albergue', 'Necesitamos croquetas', 'publicada', '2000-01-09 12:00+00', '2000-01-01 00:00+00'),
  ('24400000-0000-0000-0000-000000000002', '24100000-0000-0000-0000-00000000000a', '24100000-0000-0000-0000-00000000000b',
   'Borrador', null, 'borrador', null, '2000-01-09 13:00+00');

insert into public.solicitud_articulos (solicitud_id, articulo_id, cantidad) values
  ('24400000-0000-0000-0000-000000000001', '24300000-0000-0000-0000-000000000001', 10);
update public.solicitud_articulos set unidades_pagadas = 3
where solicitud_id = '24400000-0000-0000-0000-000000000001';

insert into public.jornadas (id, organizacion_id, titulo, descripcion, ubicacion, inicia_en, termina_en, cupos, creada_en) values
  ('24500000-0000-0000-0000-000000000001', '24100000-0000-0000-0000-00000000000a', 'Jornada futura', 'Ayudar',
   'Ciudad de México', now() + interval '3 days', now() + interval '3 days 4 hours', 20, '2000-01-08 12:00+00'),
  ('24500000-0000-0000-0000-000000000002', '24100000-0000-0000-0000-00000000000a', 'Jornada pasada', 'Ya pasó',
   'Ciudad de México', now() - interval '3 days', now() - interval '3 days' + interval '4 hours', 20, '2000-01-08 13:00+00');

insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes, estado) values
  ('24500000-0000-0000-0000-000000000001', 'Empresa', 'rh@ejemplo.test', 2, 'confirmada');

-- Feed como anónimo -------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select array_agg(tipo || ':' || id::text) from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01'),
  array[
    'publicacion:24200000-0000-0000-0000-000000000001',
    'solicitud:24400000-0000-0000-0000-000000000001',
    'jornada:24500000-0000-0000-0000-000000000001'
  ],
  'anon: feed cronológico solo con lo público (sin retiradas, no verificadas, suspendidas, colectivos, borradores ni jornadas pasadas)'
);

select is(
  (select medios from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'publicacion'),
  '[{"ruta": "https://vimeo.com/123456", "tipo": "video"}, {"ruta": "24100000-0000-0000-0000-00000000000a/foto.jpg", "tipo": "imagen"}]'::jsonb,
  'medios en orden con ruta y tipo'
);

select is(
  (select organizacion_nombre || '|' || organizacion_slug || '|' || coalesce(titulo, '-') || '|' || texto
   from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'publicacion'),
  'T24 Albergue|t24-albergue|-|Publicación visible',
  'publicación sin título, con texto y organización'
);

select is(
  (select extra from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'solicitud'),
  jsonb_build_object(
    'ejemplo', false, 'unidades_pagadas', 3, 'unidades_totales', 10, 'categoria', 'albergue',
    'tienda', jsonb_build_object('id', '24100000-0000-0000-0000-00000000000b', 'nombre', 'T24 Tienda', 'slug', 't24-tienda')),
  'extra de solicitud: unidades, categoría y tienda'
);

select is(
  (select (extra ->> 'cupos') || '|' || (extra ->> 'cupos_ocupados') || '|' || (extra ->> 'ubicacion') || '|' || (extra ->> 'permite_menores')
   from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'jornada'),
  '20|2|Ciudad de México|false',
  'extra de jornada: cupos, ocupados, lugar'
);

select ok(
  (select (extra ? 'inicia_en') and (extra ? 'termina_en') from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'jornada'),
  'extra de jornada trae fechas'
);

select is(
  (select array_agg(id::text) from public.feed_publico(1, '2000-02-01')),
  array['24200000-0000-0000-0000-000000000001'],
  'p_limite recorta'
);

select is(
  (select array_agg(id::text) from public.feed_publico(50, '2000-01-10 12:00+00') where creado_en >= '2000-01-01'),
  array['24400000-0000-0000-0000-000000000001', '24500000-0000-0000-0000-000000000001'],
  'p_antes pagina: solo lo anterior a la fecha'
);

select is((select count(*)::int from public.feed_publico(1000, '2000-01-01')), 50, 'máximo 50 por página');
select is((select count(*)::int from public.feed_publico(null, '2000-01-01')), 20, 'por omisión 20');

select is(
  (select bool_or(yo_di_me_gusta) from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01'),
  false,
  'anon: yo_di_me_gusta es false'
);

select throws_ok($$select public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon no da me gusta');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Hola')$$,
  '42501', null, 'anon no comenta');
select throws_ok($$select public.reportar_comentario(gen_random_uuid(), 'spam')$$,
  '42501', null, 'anon no reporta');
select throws_ok($$select public.borrar_comentario(gen_random_uuid())$$,
  '42501', null, 'anon no borra');
select lives_ok($$select * from public.comentarios_de('publicacion', '24200000-0000-0000-0000-000000000001')$$,
  'anon lee comentarios');
select throws_ok($$select * from public.comentarios$$, '42501', null, 'anon no lee la tabla de comentarios');
select throws_ok($$insert into public.me_gusta (tipo, objetivo_id, usuario_id) values ('publicacion', gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'anon no escribe me_gusta');

-- Me gusta -----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001'), true, 'me gusta: da');
select is(public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001'), false, 'me gusta: quita');
select is(public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001'), true, 'me gusta: vuelve a dar');
select is(
  (select me_gusta || '|' || yo_di_me_gusta from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'publicacion'),
  '1|true',
  'un solo me gusta por cuenta y yo_di_me_gusta true'
);
select throws_ok($$select public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000003')$$,
  '42501', null, 'no da me gusta a contenido no público');
select throws_ok($$select public.alternar_me_gusta('jornada', '24200000-0000-0000-0000-000000000001')$$,
  '42501', null, 'no da me gusta con el tipo equivocado');
select throws_ok($$select public.alternar_me_gusta('pedido', '24200000-0000-0000-0000-000000000001')$$,
  '22023', null, 'tipo inválido');
select throws_ok($$insert into public.comentarios (tipo, objetivo_id, usuario_id, texto) values ('publicacion', '24200000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'directo')$$,
  '42501', null, 'authenticated no escribe directo en comentarios');
select throws_ok($$select * from public.usuarios_bloqueados$$, '42501', null, 'authenticated no ve bloqueos');

select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000c0","role":"authenticated"}', true);
select throws_ok($$select public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001')$$,
  '42501', 'Confirma tu correo para participar', 'sin correo confirmado no da me gusta');

reset role;
insert into privado.eventos_me_gusta (usuario_id)
select '24000000-0000-0000-0000-000000000003' from generate_series(1, 60);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.alternar_me_gusta('publicacion', '24200000-0000-0000-0000-000000000001')$$,
  '54000', null, 'máximo 60 me gusta o quitar en 10 minutos');

-- Comentarios: validación ----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select isnt(public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', E'  Hola vecinos \n '), null, 'comenta y devuelve id');
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', E'Nos vemos el 21.11.2026\na las 10')$$,
  'acepta fechas y saltos de línea');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', '   ')$$,
  '22023', 'Escribe un comentario', 'rechaza vacío');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', repeat('a', 501))$$,
  '22023', null, 'rechaza más de 500 caracteres');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', E'hola\u0007')$$,
  '22023', 'El comentario tiene caracteres no permitidos', 'rechaza caracteres de control');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', E'ho​la')$$,
  '22023', 'El comentario tiene caracteres no permitidos', 'rechaza espacios de ancho cero');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'mira HTTPS://spam.test/x')$$,
  '22023', 'Los comentarios no pueden llevar enlaces', 'rechaza URL');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'entra a ganadinero.com ya')$$,
  '22023', 'Los comentarios no pueden llevar enlaces', 'rechaza dominio sin protocolo');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'escribe a alguien@correo.mx')$$,
  '22023', 'Los comentarios no pueden llevar correos', 'rechaza correo');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'llama al (55) 1234-5678')$$,
  '22023', 'Los comentarios no pueden llevar teléfonos', 'rechaza teléfono');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'HOLA VECINOS')$$,
  '22023', 'Ya publicaste ese comentario hace poco', 'rechaza el mismo texto en 10 minutos');
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000003', 'Hola')$$,
  '42501', null, 'no comenta contenido no público');
select throws_ok($$select public.comentar('solicitud', '24400000-0000-0000-0000-000000000002', 'Hola')$$,
  '42501', null, 'no comenta un borrador');

-- Límite de 5 en 10 minutos (ya lleva 2 válidos).
select lives_ok($$select public.comentar('solicitud', '24400000-0000-0000-0000-000000000001', 'Uno')$$, 'tercer comentario');
select lives_ok($$select public.comentar('jornada', '24500000-0000-0000-0000-000000000001', 'Dos')$$, 'cuarto comentario');
select lives_ok($$select public.comentar('jornada', '24500000-0000-0000-0000-000000000001', 'Tres')$$, 'quinto comentario');
select throws_ok($$select public.comentar('jornada', '24500000-0000-0000-0000-000000000001', 'Cuatro')$$,
  '54000', 'Llegaste al límite de 5 comentarios en 10 minutos', 'máximo 5 en 10 minutos');

select is(
  (select texto || '|' || autor || '|' || es_organizacion || '|' || es_mio
   from public.comentarios_de('publicacion', '24200000-0000-0000-0000-000000000001') where texto like 'Hola%'),
  'Hola vecinos|Vecino ' || upper(substr(md5('24000000-0000-0000-0000-000000000001'), 1, 4)) || '|false|true',
  'texto recortado; sin perfil firma "Vecino" con sufijo estable; es_mio'
);

-- Otras cuentas comentan.
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Comentario de v2')$$, 'v2 comenta');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Gracias por su apoyo')$$, 'la organización comenta lo suyo');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Saludos desde la tienda')$$, 'miembro de otra organización comenta');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000e0","role":"authenticated"}', true);
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Antes del bloqueo')$$, 'futuro bloqueado comenta');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000d0","role":"authenticated"}', true);
select lives_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Desde la demo')$$, 'cuenta demo comenta');

reset role;
-- Ids fijos para referirlos abajo.
update public.comentarios set id = '24600000-0000-0000-0000-000000000001' where texto = 'Hola vecinos' and usuario_id = '24000000-0000-0000-0000-000000000001';
update public.comentarios set id = '24600000-0000-0000-0000-000000000002' where texto like 'Nos vemos%' and usuario_id = '24000000-0000-0000-0000-000000000001';
update public.comentarios set id = '24600000-0000-0000-0000-000000000003' where texto = 'Comentario de v2';
update public.comentarios set id = '24600000-0000-0000-0000-000000000005' where texto = 'Saludos desde la tienda';
-- Límites: la demo tiene los mismos (4 más recientes); v2 llega a 30 en el día.
insert into public.comentarios (tipo, objetivo_id, usuario_id, texto, creado_en)
select 'publicacion', '24200000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-0000000000d0', 'demo ' || g, now() - interval '1 minute'
from generate_series(1, 4) g;
insert into public.comentarios (tipo, objetivo_id, usuario_id, texto, creado_en, borrado_en)
select 'publicacion', '24200000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000002', 'viejo ' || g, now() - interval '2 hours', now()
from generate_series(1, 29) g;
-- Bloqueo por el equipo.
insert into public.usuarios_bloqueados (usuario_id, motivo, bloqueado_por) values
  ('24000000-0000-0000-0000-0000000000e0', 'spam', 'prueba');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000d0","role":"authenticated"}', true);
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Otra de la demo')$$,
  '54000', null, 'la demo tiene los mismos límites');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Otro de v2')$$,
  '54000', 'Llegaste al límite de 30 comentarios por día', 'máximo 30 por día (los borrados cuentan)');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000e0","role":"authenticated"}', true);
select throws_ok($$select public.comentar('publicacion', '24200000-0000-0000-0000-000000000001', 'Después del bloqueo')$$,
  '42501', 'Tu cuenta no puede participar por ahora', 'bloqueado no comenta');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select string_agg(autor || ':' || es_organizacion, ',' order by texto)
   from public.comentarios_de('publicacion', '24200000-0000-0000-0000-000000000001')
   where texto in ('Gracias por su apoyo', 'Saludos desde la tienda')),
  'T24 Albergue:true,Vecino ' || upper(substr(md5('24000000-0000-0000-0000-0000000000b1'), 1, 4)) || ':false',
  'la organización dueña firma con su nombre; un nombre con @ no se muestra'
);
select is(
  (select count(*)::int from public.comentarios_de('publicacion', '24200000-0000-0000-0000-000000000001')),
  10,
  'oculta comentarios del bloqueado y borrados; muestra 6 + 4 de la demo'
);

-- Reportes -------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000001', 'Spam')$$, 'reporta');
select lives_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000001', 'Spam otra vez')$$, 'repetir no falla');
select throws_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000003', 'Mío')$$,
  '22023', 'No puedes reportar tu propio comentario', 'no reporta lo propio');
select throws_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000001', '  ')$$,
  '22023', null, 'motivo obligatorio');
select throws_ok($$select public.reportar_comentario(gen_random_uuid(), 'No existe')$$,
  'P0002', null, 'comentario inexistente');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000001', 'Spam')$$, 'segundo reporte');
reset role;
select is((select count(*)::int || '|' || bool_or(c.oculto) from public.reportes_comentario r join public.comentarios c on c.id = r.comentario_id
  where r.comentario_id = '24600000-0000-0000-0000-000000000001'), '2|false', 'un reporte por cuenta; con 2 sigue visible');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000d0","role":"authenticated"}', true);
select lives_ok($$select public.reportar_comentario('24600000-0000-0000-0000-000000000001', 'Spam')$$, 'tercer reporte');
reset role;
select is((select oculto from public.comentarios where id = '24600000-0000-0000-0000-000000000001'), true,
  'con 3 reportes de cuentas distintas queda oculto (sigue guardado)');

-- Borrado ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.borrar_comentario('24600000-0000-0000-0000-000000000002')$$,
  '42501', 'No puedes borrar este comentario', 'no borra comentario ajeno');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.borrar_comentario('24600000-0000-0000-0000-000000000002')$$, 'el autor borra el suyo');
select set_config('request.jwt.claims', '{"sub":"24000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$select public.borrar_comentario('24600000-0000-0000-0000-000000000003')$$, 'la organización dueña borra en su contenido');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select public.borrar_comentario('24600000-0000-0000-0000-000000000005')$$, 'el equipo borra con service_role');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select comentarios from public.feed_publico(50, '2000-02-01') where creado_en >= '2000-01-01' and tipo = 'publicacion'),
  6,
  'el feed cuenta solo comentarios visibles (organización + 5 de la demo)'
);

-- Privilegios y RLS -----------------------------------------------------------------
reset role;
select is(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.me_gusta'::regclass, 'public.comentarios'::regclass,
    'public.reportes_comentario'::regclass, 'public.usuarios_bloqueados'::regclass,
    'privado.eventos_me_gusta'::regclass)),
  true,
  'RLS activo en las tablas nuevas'
);
select is(
  (select bool_or(has_table_privilege(r, t, 'select,insert,update,delete'))
   from unnest(array['anon', 'authenticated']) r,
        unnest(array['public.me_gusta', 'public.comentarios', 'public.reportes_comentario', 'public.usuarios_bloqueados', 'privado.eventos_me_gusta']) t),
  false,
  'anon y authenticated no tienen privilegios en las tablas nuevas'
);
select is(
  (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('feed_publico', 'alternar_me_gusta', 'comentar', 'comentarios_de', 'borrar_comentario', 'reportar_comentario')
     and prosecdef and proconfig @> array['search_path=""']),
  6,
  'las seis funciones son security definer con search_path fijo'
);

select * from finish();
rollback;
