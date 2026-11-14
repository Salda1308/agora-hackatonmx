-- Requiere supabase db reset (seed.sql). Todos los cambios se revierten.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

select is((select count(*)::int from auth.users where email like '%@demo.agora.test'), 4,
  'existen cuatro cuentas demo');
select is((select count(*)::int from auth.users where email like '%@demo.agora.test'
  and email_confirmed_at is not null
  and encrypted_password = extensions.crypt('Agora-demo-2026!', encrypted_password)), 4,
  'las cuatro cuentas tienen correo confirmado y contraseña demo válida');
select is((select count(*)::int from auth.identities where provider = 'email'
  and identity_data->>'email' like '%@demo.agora.test'), 4, 'existen cuatro identidades email');
select is((select count(*)::int from public.organizaciones
  where id in ('f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002')
  and es_ejemplo and verificada and not suspendida), 2, 'organizaciones públicas marcadas de ejemplo');
select is((select count(*)::int from public.perfiles where id = 'f1000000-0000-0000-0000-000000000004'),
  0, 'comprador no tiene perfil');

-- Datos privados ajenos y una tarea abierta para probar límites entre roles.
insert into public.organizaciones (id, tipo, nombre, slug) values
  ('f2000000-0000-0000-0000-000000000003', 'tienda', 'Otra tienda', 'otra-tienda-r1-test');
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo) values
  ('f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
   'f2000000-0000-0000-0000-000000000002', 'Borrador privado');
insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('f4000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002'),
  ('f4000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000003');
insert into public.tareas (id, pedido_id) values
  ('f5000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001');
-- T08: marcar listo exige unidades pagadas en el pedido.
insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('f6000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Artículo prueba R1', 1);
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad, unidades_pagadas) values
  ('f6100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001',
   'f6000000-0000-0000-0000-000000000001', 1, 1);
insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades) values
  ('f4000000-0000-0000-0000-000000000001', 'f6100000-0000-0000-0000-000000000001', 1);

-- Visitante y comprador autenticado.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.organizaciones where es_ejemplo), 2,
  'visitante puede ver organizaciones demo');
select throws_ok($$select * from public.perfiles$$, '42501', null, 'visitante no lee perfiles');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000004","role":"authenticated","user_metadata":{"rol":"fundacion"}}', true);
select is((select count(*)::int from public.perfiles), 0, 'comprador no ve perfiles ajenos');
select is((select privado.mi_rol()::text), null::text, 'metadata no otorga rol de fundación');
select is((select count(*)::int from public.solicitudes where id = 'f3000000-0000-0000-0000-000000000001'),
  0, 'comprador no ve borradores');
select is((select count(*)::int from public.pedidos), 0, 'comprador no ve pedidos privados');
select is((select count(*)::int from public.tareas), 0, 'comprador no ve tareas');
select throws_ok($$insert into public.perfiles (id, rol, organizacion_id)
  values ('f1000000-0000-0000-0000-000000000004', 'fundacion', 'f2000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'comprador no puede asignarse un perfil');
select throws_ok($$insert into public.solicitudes (organizacion_id, tienda_id, titulo)
  values ('f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Intrusión')$$,
  '42501', null, 'comprador no crea solicitudes de fundación');
with cambiadas as (update public.tareas set repartidor_id = auth.uid(), estado = 'asignada'
  where id = 'f5000000-0000-0000-0000-000000000001' returning id)
select is((select count(*)::int from cambiadas),
  0, 'comprador no puede tomar una tarea');

-- Fundación: solo su perfil y su organización; sin privilegios de moderación.
select set_config('request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.perfiles), 1, 'fundación solo ve su perfil');
select is((select rol::text from public.perfiles), 'fundacion', 'perfil demo de fundación');
select is((select organizacion_id from public.perfiles), 'f2000000-0000-0000-0000-000000000001'::uuid,
  'fundación pertenece a la organización demo correcta');
select throws_ok($$update public.perfiles set rol = 'tienda'$$, '42501', null, 'fundación no cambia su rol');
select throws_ok($$update public.perfiles set organizacion_id = 'f2000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'fundación no cambia su organización');
select throws_ok($$update public.organizaciones set verificada = false$$,
  '42501', null, 'demo no concede privilegios de moderación');
select lives_ok($$insert into public.solicitudes (organizacion_id, tienda_id, titulo, estado)
  values ('f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Solicitud demo', 'publicada')$$,
  'fundación demo puede publicar una solicitud propia');
select throws_ok($$insert into public.catalogo_articulos (tienda_id, nombre, precio_centavos)
  values ('f2000000-0000-0000-0000-000000000002', 'Artículo ajeno', 1)$$,
  '42501', null, 'fundación no crea artículos de la tienda');

-- Tienda: su catálogo y sus pedidos; nada de cobro ni otra tienda.
select set_config('request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select rol::text from public.perfiles), 'tienda', 'tienda solo lee su perfil');
select is((select organizacion_id from public.perfiles), 'f2000000-0000-0000-0000-000000000002'::uuid,
  'tienda pertenece a la organización demo correcta');
select lives_ok($$insert into public.catalogo_articulos (tienda_id, nombre, precio_centavos)
  values ('f2000000-0000-0000-0000-000000000002', 'Artículo demo', 1)$$, 'tienda demo carga su catálogo');
select throws_ok($$insert into public.catalogo_articulos (tienda_id, nombre, precio_centavos)
  values ('f2000000-0000-0000-0000-000000000003', 'Artículo ajeno', 1)$$,
  '42501', null, 'tienda no escribe el catálogo de otra');
select is((select count(*)::int from public.pedidos
  where id in ('f4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000002')), 1,
  'tienda solo ve su pedido');
update public.pedidos set estado = 'listo' where id = 'f4000000-0000-0000-0000-000000000001';
select is((select estado::text from public.pedidos where id = 'f4000000-0000-0000-0000-000000000001'),
  'listo', 'tienda demo puede marcar listo');
select throws_ok($$select * from public.tiendas_cobro$$, '42501', null, 'tienda demo no ve datos de cobro');

-- Repartidor: sin organización, toma la tarea abierta como sí mismo.
select set_config('request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select rol::text from public.perfiles), 'repartidor', 'repartidor solo lee su perfil');
select is((select organizacion_id from public.perfiles), null::uuid, 'repartidor no necesita organización');
select is((select count(*)::int from public.pedidos), 0, 'repartidor no ve pedidos privados');
select is((select count(*)::int from public.tareas), 1, 'repartidor ve la tarea abierta');
-- Bloqueo existente confirmado en R1. El usuario pidió documentarlo y no tocar
-- políticas. Mantener la expectativa para detectar cuándo se corrija en otra tarea.
select todo('R1: política actual rechaza tomar una tarea con 42501; corrección fuera de alcance', 1);
select lives_ok($$update public.tareas set repartidor_id = auth.uid(), estado = 'asignada'
  where id = 'f5000000-0000-0000-0000-000000000001'$$,
  'repartidor demo toma una tarea abierta sin RETURNING');

reset role;
select * from finish();
rollback;
