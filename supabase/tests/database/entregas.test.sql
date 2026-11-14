-- Entrega con foto y doble confirmación (tarea 10): recoger, subir foto al bucket
-- privado, marcar entregado, confirmar con código correcto, código incorrecto, bloqueo
-- por intentos, sin confirmación no se cierra, permisos por rol y registro de eventos.
-- Fixtures propias (prefijo ea); todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- Fixtures (como postgres, sin RLS) ------------------------------------------

insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('ea000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'fundacion-t10@ejemplo.test', now()),
  ('ea000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'otra-fundacion-t10@ejemplo.test', now()),
  ('ea000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'tienda-t10@ejemplo.test', now()),
  ('ea000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'repartidor-1-t10@ejemplo.test', now()),
  ('ea000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'repartidor-2-t10@ejemplo.test', now());

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('ea100000-0000-0000-0000-000000000001', 'fundacion', 'asilo', 'Asilo T10', 'asilo-t10', true),
  ('ea100000-0000-0000-0000-000000000003', 'fundacion', 'albergue', 'Albergue T10', 'albergue-t10', true),
  ('ea100000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda T10', 'tienda-t10', true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('ea000000-0000-0000-0000-0000000000f1', 'fundacion', 'ea100000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-0000000000f2', 'fundacion', 'ea100000-0000-0000-0000-000000000003'),
  ('ea000000-0000-0000-0000-0000000000a1', 'tienda', 'ea100000-0000-0000-0000-000000000002'),
  ('ea000000-0000-0000-0000-0000000000b1', 'repartidor', null),
  ('ea000000-0000-0000-0000-0000000000b2', 'repartidor', null);

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('ea200000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000002', 'Arroz T10', 3000);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado) values
  ('ea300000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000001',
   'ea100000-0000-0000-0000-000000000002', 'Solicitud T10', 'publicada');

insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad, unidades_pagadas) values
  ('ea400000-0000-0000-0000-000000000001', 'ea300000-0000-0000-0000-000000000001',
   'ea200000-0000-0000-0000-000000000001', 10, 5);

insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('ea500000-0000-0000-0000-000000000001', 'ea300000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000002'),
  ('ea500000-0000-0000-0000-000000000002', 'ea300000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000002');
insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades) values
  ('ea500000-0000-0000-0000-000000000001', 'ea400000-0000-0000-0000-000000000001', 2),
  ('ea500000-0000-0000-0000-000000000002', 'ea400000-0000-0000-0000-000000000001', 1);

update public.pedidos set estado = 'listo'
where id in ('ea500000-0000-0000-0000-000000000001', 'ea500000-0000-0000-0000-000000000002');

create temp table t10 on commit drop as
select
  (select id from public.tareas where pedido_id = 'ea500000-0000-0000-0000-000000000001') as uno,
  (select id from public.tareas where pedido_id = 'ea500000-0000-0000-0000-000000000002') as dos;
create temp table t10_codigo (cual text primary key, codigo text) on commit drop;
grant select on t10 to authenticated, anon;
grant select, insert on t10_codigo to authenticated;

select is((select count(*)::int from public.eventos_tarea
  where tarea_id = (select uno from t10) and tipo = 'creada'), 1, 'marcar listo deja el evento "creada"');

-- Repartidor 1: recoge, sube la foto y marca entregado ---------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select lives_ok($$select public.tomar_tarea((select uno from t10))$$, 'repartidor 1 toma la tarea uno');
select throws_ok($$select public.registrar_entrega((select uno from t10), (select uno from t10)::text || '/ea600000-0000-0000-0000-000000000001.jpg')$$,
  'P0002', 'No tienes esa tarea en camino', 'no se entrega antes de recoger');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('entregas', (select uno from t10)::text || '/ea600000-0000-0000-0000-000000000009.jpg', auth.uid()::text)$$,
  '42501', null, 'no se sube foto antes de recoger');
select throws_ok($$select public.marcar_recogida((select dos from t10))$$, 'P0002', 'No tienes esa tarea por recoger',
  'no se recoge una tarea ajena');
select lives_ok($$select public.marcar_recogida((select uno from t10))$$, 'repartidor 1 marca recogida');
select is((select estado::text from public.mi_tarea()), 'recogida', 'la tarea queda recogida');

select throws_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('entregas', (select dos from t10)::text || '/ea600000-0000-0000-0000-000000000002.jpg', auth.uid()::text)$$,
  '42501', null, 'no sube foto en la carpeta de una tarea ajena');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('entregas', (select uno from t10)::text || '/juan-perez.jpg', auth.uid()::text)$$,
  '42501', null, 'la ruta no admite nombres libres');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('entregas', (select uno from t10)::text || '/ea600000-0000-0000-0000-000000000001.jpg', auth.uid()::text)$$,
  'sube la foto en la carpeta de su tarea');
select throws_ok($$select public.registrar_entrega((select uno from t10), (select uno from t10)::text || '/ea600000-0000-0000-0000-00000000000f.jpg')$$,
  '23514', 'Sube la foto de la entrega', 'no marca entregado sin una foto subida');
select is((select count(*)::int from public.mi_entrega()), 0, 'sin entrega marcada no hay código');

insert into t10_codigo
select 'uno', public.registrar_entrega((select uno from t10), (select uno from t10)::text || '/ea600000-0000-0000-0000-000000000001.jpg');
select ok((select codigo from t10_codigo where cual = 'uno') ~ '^[A-Z2-9]{6}$', 'marcar entregado devuelve un código de 6 caracteres');
select is((select codigo_entrega from public.mi_entrega()), (select codigo from t10_codigo where cual = 'uno'),
  'el repartidor ve su código de entrega');
select is((select intentos_restantes from public.mi_entrega()), 5, 'empieza con 5 intentos');
select throws_ok($$select * from public.confirmar_entrega((select uno from t10), (select codigo from t10_codigo where cual = 'uno'))$$,
  '42501', 'Solo la fundación que recibe confirma', 'el repartidor no se confirma a sí mismo');
select throws_ok($$update public.entregas set confirmada_en = now() where tarea_id = (select uno from t10)$$,
  '42501', null, 'el UPDATE directo a entregas no está permitido');
select throws_ok($$select codigo from privado.codigos_entrega$$, '42501', null, 'nadie lee la tabla de códigos');

-- Repartidor 2: toma la tarea dos y no ve la foto ni el código ajeno ---------------

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'entregas'), 0,
  'otro repartidor no ve la foto ajena');
select lives_ok($$select public.tomar_tarea((select dos from t10))$$, 'repartidor 2 toma la tarea dos');
select is((select count(*)::int from public.mi_entrega()), 0, 'otro repartidor no ve el código ajeno');

-- Sin confirmación la entrega no se cierra --------------------------------------

reset role;
select is((select estado::text from public.tareas where id = (select uno from t10)), 'recogida',
  'marcada como entregada, la tarea sigue abierta hasta la confirmación');
select is((select estado::text from public.pedidos where id = 'ea500000-0000-0000-0000-000000000001'), 'recogido',
  'el pedido no pasa a entregado sin confirmación');

set local role anon;
select is((select count(*)::int from public.entregas where tarea_id = (select uno from t10)), 0,
  'una entrega sin confirmar no es pública');

-- Otra fundación y la tienda no confirman -------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select throws_ok($$select * from public.confirmar_entrega((select uno from t10), (select codigo from t10_codigo where cual = 'uno'))$$,
  'P0002', 'No hay una entrega por confirmar', 'otra fundación no confirma');
select is((select count(*)::int from public.entregas_de_mi_fundacion()), 0, 'otra fundación no ve la entrega');
select is((select count(*)::int from storage.objects where bucket_id = 'entregas'), 0, 'otra fundación no ve la foto');

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select * from public.confirmar_entrega((select uno from t10), (select codigo from t10_codigo where cual = 'uno'))$$,
  '42501', 'Solo la fundación que recibe confirma', 'la tienda no confirma');

-- La fundación receptora: código incorrecto y luego correcto ------------------------

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select confirmada_en from public.entregas_de_mi_fundacion() where tarea_id = (select uno from t10)), null,
  'la fundación ve la entrega por confirmar');
select is((select count(*)::int from storage.objects where bucket_id = 'entregas'), 1,
  'la fundación ve la foto registrada de su entrega');
select is((select resultado from public.confirmar_entrega((select uno from t10), 'ZZZZZZ')), 'incorrecto',
  'un código incorrecto no confirma');
select is((select intentos_restantes from public.entregas_de_mi_fundacion() where tarea_id = (select uno from t10)), 4,
  'el intento fallido se cuenta');
select is((select confirmada_en from public.entregas where tarea_id = (select uno from t10)), null,
  'tras el código incorrecto la entrega sigue sin cerrar');
select is((select resultado from public.confirmar_entrega((select uno from t10),
  ' ' || lower((select codigo from t10_codigo where cual = 'uno')) || ' ')), 'confirmada',
  'el código correcto (sin importar mayúsculas ni espacios) confirma');
select throws_ok($$select * from public.confirmar_entrega((select uno from t10), (select codigo from t10_codigo where cual = 'uno'))$$,
  'P0002', 'No hay una entrega por confirmar', 'no se confirma dos veces');
select throws_ok($$select actor_id from public.eventos_tarea$$, '42501', null,
  'el registro no expone quién hizo cada paso');
select throws_ok($$insert into public.eventos_tarea (tarea_id, tipo, actor_rol)
  values ((select dos from t10), 'confirmada', 'fundacion')$$, '42501', null, 'nadie escribe eventos directo');

reset role;
select ok((select t.estado = 'entregada' and p.estado = 'entregado' and e.confirmada_en is not null
  from public.tareas t join public.pedidos p on p.id = t.pedido_id join public.entregas e on e.tarea_id = t.id
  where t.id = (select uno from t10)), 'confirmada: tarea entregada, pedido entregado y fecha de confirmación');
select is((select unidades_entregadas from public.solicitud_articulos where id = 'ea400000-0000-0000-0000-000000000001'), 2,
  'la solicitud suma las unidades entregadas');
select is((select array_agg(tipo::text order by id) from public.eventos_tarea where tarea_id = (select uno from t10)),
  array['creada', 'tomada', 'recogida', 'foto_subida', 'entrega_marcada', 'codigo_incorrecto', 'confirmada'],
  'cada paso queda en el registro');

-- Bloqueo por intentos (tarea dos, repartidor 2) ---------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select public.marcar_recogida((select dos from t10));
insert into storage.objects (bucket_id, name, owner_id)
values ('entregas', (select dos from t10)::text || '/ea600000-0000-0000-0000-000000000002.jpg', auth.uid()::text);
insert into t10_codigo
select 'dos', public.registrar_entrega((select dos from t10), (select dos from t10)::text || '/ea600000-0000-0000-0000-000000000002.jpg');

select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select public.confirmar_entrega((select dos from t10), 'AAAAAA') from generate_series(1, 4);
select is((select resultado from public.confirmar_entrega((select dos from t10), 'AAAAAA')), 'bloqueada',
  'el quinto código incorrecto bloquea la entrega');
select is((select resultado from public.confirmar_entrega((select dos from t10), (select codigo from t10_codigo where cual = 'dos'))),
  'bloqueada', 'bloqueada, ni el código correcto la cierra');

reset role;
select is((select estado::text from public.tareas where id = (select dos from t10)), 'recogida',
  'la entrega bloqueada sigue sin cerrar');
select is((select (count(*) filter (where tipo = 'codigo_incorrecto'))::text || '/' || (count(*) filter (where tipo = 'bloqueada'))::text
  from public.eventos_tarea where tarea_id = (select dos from t10)), '5/1', 'el registro guarda los 5 intentos y el bloqueo');

select * from finish();
rollback;
