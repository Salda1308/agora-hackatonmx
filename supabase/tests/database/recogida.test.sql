-- Recogida con código verificado por la tienda (T21, hallazgo A3 de T13): el repartidor
-- ya no marca la recogida; la tienda dueña teclea el código que él le muestra. Código
-- correcto, incorrecto, 5 intentos y bloqueo, otra tienda, repartidor, fundación,
-- anónimo y registro de eventos. Fixtures propias (prefijo c21); todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Fixtures (como postgres, sin RLS) ------------------------------------------

insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('c2100000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'fundacion-t21@ejemplo.test', now()),
  ('c2100000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'tienda-t21@ejemplo.test', now()),
  ('c2100000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'otra-tienda-t21@ejemplo.test', now()),
  ('c2100000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'repartidor-1-t21@ejemplo.test', now()),
  ('c2100000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'repartidor-2-t21@ejemplo.test', now());

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('c2110000-0000-0000-0000-000000000001', 'fundacion', 'asilo', 'Asilo T21', 'asilo-t21', true),
  ('c2110000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda T21', 'tienda-t21', true),
  ('c2110000-0000-0000-0000-000000000003', 'tienda', null, 'Otra tienda T21', 'otra-tienda-t21', true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('c2100000-0000-0000-0000-0000000000f1', 'fundacion', 'c2110000-0000-0000-0000-000000000001'),
  ('c2100000-0000-0000-0000-0000000000a1', 'tienda', 'c2110000-0000-0000-0000-000000000002'),
  ('c2100000-0000-0000-0000-0000000000a2', 'tienda', 'c2110000-0000-0000-0000-000000000003'),
  ('c2100000-0000-0000-0000-0000000000b1', 'repartidor', null),
  ('c2100000-0000-0000-0000-0000000000b2', 'repartidor', null);

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('c2120000-0000-0000-0000-000000000001', 'c2110000-0000-0000-0000-000000000002', 'Frijol T21', 2000);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado) values
  ('c2130000-0000-0000-0000-000000000001', 'c2110000-0000-0000-0000-000000000001',
   'c2110000-0000-0000-0000-000000000002', 'Solicitud T21', 'publicada');

insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad, unidades_pagadas) values
  ('c2140000-0000-0000-0000-000000000001', 'c2130000-0000-0000-0000-000000000001',
   'c2120000-0000-0000-0000-000000000001', 10, 3);

insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('c2150000-0000-0000-0000-000000000001', 'c2130000-0000-0000-0000-000000000001', 'c2110000-0000-0000-0000-000000000002'),
  ('c2150000-0000-0000-0000-000000000002', 'c2130000-0000-0000-0000-000000000001', 'c2110000-0000-0000-0000-000000000002');
insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades) values
  ('c2150000-0000-0000-0000-000000000001', 'c2140000-0000-0000-0000-000000000001', 2),
  ('c2150000-0000-0000-0000-000000000002', 'c2140000-0000-0000-0000-000000000001', 1);

update public.pedidos set estado = 'listo'
where id in ('c2150000-0000-0000-0000-000000000001', 'c2150000-0000-0000-0000-000000000002');

create temp table t21 on commit drop as
select
  (select id from public.tareas where pedido_id = 'c2150000-0000-0000-0000-000000000001') as uno,
  (select id from public.tareas where pedido_id = 'c2150000-0000-0000-0000-000000000002') as dos,
  (select codigo_recogida from public.pedidos where id = 'c2150000-0000-0000-0000-000000000001') as cod_uno,
  (select codigo_recogida from public.pedidos where id = 'c2150000-0000-0000-0000-000000000002') as cod_dos;
grant select on t21 to authenticated, anon;

select hasnt_function('public', 'marcar_recogida', array['uuid'], 'el repartidor ya no tiene marcar_recogida');

-- Antes de que un repartidor la tome no hay recogida por confirmar -------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  'P0002', 'No hay una recogida por confirmar', 'sin repartidor asignado no se confirma la recogida');

-- Repartidores toman las tareas y ven el código para mostrarlo ------------------------

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.tomar_tarea((select uno from t21))$$, 'repartidor 1 toma la tarea uno');
select is((select codigo_recogida from public.mi_tarea()), (select cod_uno from t21),
  'el repartidor asignado ve el código para mostrarlo en la tienda');
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  '42501', 'Solo la tienda del pedido confirma la recogida', 'el repartidor no confirma su propia recogida');

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.tomar_tarea((select dos from t21))$$, 'repartidor 2 toma la tarea dos');

-- Otros roles no confirman ----------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  'P0002', 'No hay una recogida por confirmar', 'otra tienda no confirma la recogida');

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  '42501', 'Solo la tienda del pedido confirma la recogida', 'la fundación no confirma la recogida');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  '42501', null, 'un anónimo no confirma la recogida');

-- La tienda dueña: código incorrecto y luego correcto ---------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select tarea_estado::text || '/' || intentos_restantes::text || '/' || bloqueada::text
  from public.pedidos_de_mi_tienda() where id = 'c2150000-0000-0000-0000-000000000001'), 'asignada/5/false',
  'el panel de la tienda muestra la recogida pendiente con 5 intentos');
select is((select resultado || '/' || intentos_restantes::text
  from public.confirmar_recogida((select uno from t21), 'ZZZZZZ')), 'incorrecto/4', 'un código incorrecto no confirma');
select is((select intentos_restantes from public.pedidos_de_mi_tienda() where id = 'c2150000-0000-0000-0000-000000000001'), 4,
  'el intento fallido se cuenta en el panel');
select is((select estado::text from public.pedidos_de_mi_tienda() where id = 'c2150000-0000-0000-0000-000000000001'), 'listo',
  'tras el código incorrecto el pedido sigue listo');
select is((select resultado from public.confirmar_recogida((select uno from t21),
  ' ' || lower((select cod_uno from t21)) || ' ')), 'confirmada',
  'el código correcto (sin importar mayúsculas ni espacios) confirma la recogida');
select is((select estado::text || '/' || tarea_estado::text from public.pedidos_de_mi_tienda()
  where id = 'c2150000-0000-0000-0000-000000000001'), 'recogido/recogida', 'pedido recogido y tarea recogida');
select throws_ok($$select * from public.confirmar_recogida((select uno from t21), (select cod_uno from t21))$$,
  'P0002', 'No hay una recogida por confirmar', 'no se confirma dos veces');
select throws_ok($$select * from privado.intentos_recogida$$, '42501', null, 'nadie lee la tabla de intentos');

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select estado::text from public.mi_tarea()), 'recogida', 'el repartidor ve su tarea recogida');

-- Bloqueo por intentos (tarea dos) --------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"c2100000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.confirmar_recogida((select dos from t21), 'AAAAAA') from generate_series(1, 3);
select is((select resultado || '/' || intentos_restantes::text
  from public.confirmar_recogida((select dos from t21), 'AAAAAA')), 'incorrecto/1', 'el cuarto intento deja uno');
select is((select resultado || '/' || intentos_restantes::text
  from public.confirmar_recogida((select dos from t21), 'AAAAAA')), 'bloqueada/0', 'el quinto código incorrecto bloquea');
select is((select resultado from public.confirmar_recogida((select dos from t21), (select cod_dos from t21))),
  'bloqueada', 'bloqueada, ni el código correcto la confirma');
select is((select bloqueada from public.pedidos_de_mi_tienda() where id = 'c2150000-0000-0000-0000-000000000002'), true,
  'el panel de la tienda muestra el bloqueo');

reset role;
select is((select t.estado::text || '/' || p.estado::text from public.tareas t join public.pedidos p on p.id = t.pedido_id
  where t.id = (select dos from t21)), 'asignada/listo', 'la recogida bloqueada no avanza');
select is((select (count(*) filter (where tipo = 'codigo_incorrecto'))::text || '/' || (count(*) filter (where tipo = 'bloqueada'))::text
  from public.eventos_tarea where tarea_id = (select dos from t21)), '5/1', 'el registro guarda los 5 intentos y el bloqueo');
select is((select array_agg(tipo::text || ':' || actor_rol order by id) from public.eventos_tarea where tarea_id = (select uno from t21)),
  array['creada:sistema', 'tomada:repartidor', 'codigo_incorrecto:tienda', 'recogida:tienda'],
  'cada paso de la recogida queda en el registro, confirmado por la tienda');
select is((select intentos_fallidos::int from privado.intentos_recogida where tarea_id = (select dos from t21)), 5,
  'los intentos se guardan por tarea');

select * from finish();
rollback;
