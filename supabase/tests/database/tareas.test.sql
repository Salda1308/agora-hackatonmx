-- Tareas del repartidor (tarea 09): tarea al marcar listo, tomar atómico (solo uno
-- la obtiene), una activa por repartidor, liberar, código solo al asignado, regla de
-- voluntario nuevo y alta propia retirada (T22). Fixtures propias (prefijo e9); todo se revierte.
-- La concurrencia real (dos conexiones) se probó aparte; ver task.md de T09.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Fixtures (como postgres, sin RLS) ------------------------------------------

insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('e9000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'fundacion-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'tienda-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'repartidor-1-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'repartidor-2-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated', 'veterano-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', 'nuevo-t09@ejemplo.test', now()),
  ('e9000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', 'sin-confirmar-t09@ejemplo.test', null);

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada, direccion_publica) values
  ('e9100000-0000-0000-0000-000000000001', 'fundacion', 'asilo', 'Asilo T09', 'asilo-t09', true, null),
  ('e9100000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda T09', 'tienda-t09', true, 'Calle T09 1');

insert into public.perfiles (id, rol, organizacion_id) values
  ('e9000000-0000-0000-0000-0000000000f1', 'fundacion', 'e9100000-0000-0000-0000-000000000001'),
  ('e9000000-0000-0000-0000-0000000000a1', 'tienda', 'e9100000-0000-0000-0000-000000000002'),
  ('e9000000-0000-0000-0000-0000000000b1', 'repartidor', null),
  ('e9000000-0000-0000-0000-0000000000b2', 'repartidor', null),
  ('e9000000-0000-0000-0000-0000000000b3', 'repartidor', null);

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('e9200000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002', 'Arroz T09', 3000),
  ('e9200000-0000-0000-0000-000000000002', 'e9100000-0000-0000-0000-000000000002', 'Pañales T09', 25000);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado) values
  ('e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000001',
   'e9100000-0000-0000-0000-000000000002', 'Solicitud T09', 'publicada');

insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad, unidades_pagadas) values
  ('e9400000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-000000000001',
   'e9200000-0000-0000-0000-000000000001', 20, 4),
  ('e9400000-0000-0000-0000-000000000002', 'e9300000-0000-0000-0000-000000000001',
   'e9200000-0000-0000-0000-000000000002', 20, 6);

-- Pedidos: bajo ($60), alto ($750), otro bajo ($60), uno sin marcar listo y tres
-- entregados del veterano.
insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('e9500000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002'),
  ('e9500000-0000-0000-0000-000000000002', 'e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002'),
  ('e9500000-0000-0000-0000-000000000003', 'e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002'),
  ('e9500000-0000-0000-0000-000000000004', 'e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002'),
  ('e9500000-0000-0000-0000-000000000005', 'e9300000-0000-0000-0000-000000000001', 'e9100000-0000-0000-0000-000000000002');
insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades) values
  ('e9500000-0000-0000-0000-000000000001', 'e9400000-0000-0000-0000-000000000001', 2),
  ('e9500000-0000-0000-0000-000000000002', 'e9400000-0000-0000-0000-000000000002', 3),
  ('e9500000-0000-0000-0000-000000000003', 'e9400000-0000-0000-0000-000000000001', 2),
  ('e9500000-0000-0000-0000-000000000004', 'e9400000-0000-0000-0000-000000000002', 1),
  ('e9500000-0000-0000-0000-000000000005', 'e9400000-0000-0000-0000-000000000002', 2);
insert into public.tareas (pedido_id, repartidor_id, estado)
select 'e9500000-0000-0000-0000-000000000005', 'e9000000-0000-0000-0000-0000000000b3', 'entregada'
from generate_series(1, 3);

update public.pedidos set estado = 'listo'
where id in ('e9500000-0000-0000-0000-000000000001', 'e9500000-0000-0000-0000-000000000002',
             'e9500000-0000-0000-0000-000000000003');

create temp table t9 on commit drop as
select
  (select id from public.tareas where pedido_id = 'e9500000-0000-0000-0000-000000000001') as bajo,
  (select id from public.tareas where pedido_id = 'e9500000-0000-0000-0000-000000000002') as alto,
  (select id from public.tareas where pedido_id = 'e9500000-0000-0000-0000-000000000003') as otro,
  (select codigo_recogida from public.pedidos where id = 'e9500000-0000-0000-0000-000000000001') as codigo;
grant select on t9 to authenticated;

select is((select count(*)::int from public.tareas t
  where t.pedido_id in ('e9500000-0000-0000-0000-000000000001', 'e9500000-0000-0000-0000-000000000002',
    'e9500000-0000-0000-0000-000000000003') and t.estado = 'abierta' and t.repartidor_id is null), 3,
  'marcar listo crea una tarea abierta por pedido');
select is((select count(*)::int from public.tareas where pedido_id = 'e9500000-0000-0000-0000-000000000004'), 0,
  'un pedido en preparación no tiene tarea');

-- Repartidor 1 (nuevo) ---------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select limite_centavos from public.mi_nivel_repartidor()), 50000::bigint,
  'voluntario nuevo tiene límite de $500');
select ok((select bajo from t9) in (select id from public.tareas_disponibles()), 've la tarea de bajo valor');
select ok((select alto from t9) not in (select id from public.tareas_disponibles()), 'no ve la tarea de alto valor');
select is((select count(*)::int from public.mi_tarea()), 0, 'sin tarea activa no hay código');

-- Prueba de aceptación: dos voluntarios piden la misma tarea; solo uno la obtiene.
select lives_ok($$select public.tomar_tarea((select bajo from t9))$$, 'repartidor 1 toma la tarea');
select is((select codigo_recogida from public.mi_tarea()), (select codigo from t9),
  'el asignado ve el código de recogida');
select is((select tienda_direccion from public.mi_tarea()), 'Calle T09 1', 'el asignado ve el punto de recogida');
select throws_ok($$select public.tomar_tarea((select otro from t9))$$, 'P0001', 'Ya tienes una tarea activa',
  'un repartidor no toma dos tareas a la vez');

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select public.tomar_tarea((select bajo from t9))$$, 'P0001', 'La tarea ya no está disponible',
  'repartidor 2 no obtiene la misma tarea');
select is((select count(*)::int from public.mi_tarea()), 0, 'repartidor 2 no ve el código ajeno');
select ok((select bajo from t9) not in (select id from public.tareas_disponibles()),
  'la tarea tomada ya no aparece disponible');
select is((select count(*)::int from public.pedidos where id = 'e9500000-0000-0000-0000-000000000001'), 0,
  'el repartidor no lee pedidos (ni su código) directamente');
select throws_ok($$update public.tareas set repartidor_id = auth.uid(), estado = 'asignada'
  where id = (select otro from t9)$$, '42501', null, 'el UPDATE directo ya no está permitido');
select throws_ok($$select public.tomar_tarea((select alto from t9))$$, '42501',
  'Como voluntario nuevo solo tomas pedidos de bajo valor', 'voluntario nuevo no toma pedidos de alto valor');
select throws_ok($$select public.liberar_tarea((select bajo from t9))$$, 'P0002', null,
  'no se libera una tarea ajena');

reset role;
select is((select repartidor_id from public.tareas where id = (select bajo from t9)),
  'e9000000-0000-0000-0000-0000000000b1'::uuid, 'la tarea quedó solo con el repartidor 1');
select is((select estado::text from public.tareas where id = (select bajo from t9)), 'asignada',
  'la tarea quedó asignada');

-- Liberar --------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$select public.liberar_tarea((select bajo from t9))$$, 'el asignado libera su tarea');
select is((select count(*)::int from public.mi_tarea()), 0, 'al liberar deja de ver el código');

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$select public.tomar_tarea((select bajo from t9))$$, 'otra persona toma la tarea liberada');

reset role;
update public.tareas set estado = 'recogida' where id = (select bajo from t9);
set local role authenticated;
select throws_ok($$select public.liberar_tarea((select bajo from t9))$$, 'P0002', null,
  'una tarea recogida ya no se libera');

-- Veterano sin límite; otros roles no toman ----------------------------------

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select limite_centavos from public.mi_nivel_repartidor()), null::bigint,
  'con 3 entregas ya no hay límite');
select lives_ok($$select public.tomar_tarea((select alto from t9))$$, 'el veterano toma un pedido de alto valor');

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.tomar_tarea((select otro from t9))$$, '42501', null, 'la tienda no toma tareas');
select is((select count(*)::int from public.tareas_disponibles()), 0, 'la tienda no ve tareas disponibles');

-- Alta propia retirada (T22): el repartidor entra solo por solicitud aprobada ------

select set_config('request.jwt.claims', '{"sub":"e9000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.alta_repartidor('Ana Nueva')$$, '42501', null,
  'authenticated ya no ejecuta alta_repartidor');

reset role;
select * from finish();
rollback;
