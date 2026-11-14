-- T12: agregados públicos, tickets vinculados y ninguna ruta de foto privada.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, direccion_publica, verificada, es_ejemplo)
values
  ('b1200000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Albergue T12',
   'albergue-t12', 'Calle privada 4, Puebla (ubicación pública)', true, true),
  ('b1200000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda T12',
   'tienda-t12', null, false, true);
insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos, es_ejemplo)
values ('b1200000-0000-0000-0000-000000000003', 'b1200000-0000-0000-0000-000000000002', 'Agua T12', 100, true);
insert into public.solicitudes
  (id, organizacion_id, tienda_id, titulo, estado, publicada_en, es_ejemplo)
values ('b1200000-0000-0000-0000-000000000004', 'b1200000-0000-0000-0000-000000000001',
  'b1200000-0000-0000-0000-000000000002', 'Solicitud pública T12', 'publicada', now(), true);
insert into public.solicitud_articulos
  (id, solicitud_id, articulo_id, cantidad, unidades_pagadas)
values ('b1200000-0000-0000-0000-000000000005', 'b1200000-0000-0000-0000-000000000004',
  'b1200000-0000-0000-0000-000000000003', 4, 2);
insert into public.pagos
  (id, solicitud_id, tienda_id, monto_centavos, metodo, metadata)
values ('b1200000-0000-0000-0000-000000000006', 'b1200000-0000-0000-0000-000000000004',
  'b1200000-0000-0000-0000-000000000002', 200, 'qr', '{"interno":"no publicar"}');
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades)
values ('b1200000-0000-0000-0000-000000000006', 'b1200000-0000-0000-0000-000000000005', 2);
update public.pagos set estado = 'pagado', pagado_en = now()
where id = 'b1200000-0000-0000-0000-000000000006';
update public.pedidos set estado = 'listo'
where pago_id = 'b1200000-0000-0000-0000-000000000006';

select ok((select pago_id = 'b1200000-0000-0000-0000-000000000006'::uuid
  from public.pedidos where pago_id = 'b1200000-0000-0000-0000-000000000006'),
  'cada pedido nuevo conserva el pago que lo originó');
select ok((select privado.zona_publica('b1200000-0000-0000-0000-000000000001') = 'Puebla'),
  'la zona pública elimina calle y nota de ubicación');
select is((select jsonb_array_length(public.panel_publico()->'usos') > 0), true,
  'el RPC entrega el registro de uso');
select is((select item->>'ticket'
  from jsonb_array_elements(public.panel_publico()->'usos') item
  where item->>'id' = 'b1200000-0000-0000-0000-000000000006'),
  (select 'AGORA-' || lpad(num_ref::text, 7, '0') from public.pagos
   where id = 'b1200000-0000-0000-0000-000000000006'),
  'el registro muestra el ticket del pago');
select is((select item->>'recibido'
  from jsonb_array_elements(public.panel_publico()->'solicitudes') item
  where item->>'id' = 'b1200000-0000-0000-0000-000000000004'), '2',
  'el contador recibido usa unidades pagadas');
select is((select item->>'zona'
  from jsonb_array_elements(public.panel_publico()->'solicitudes') item
  where item->>'id' = 'b1200000-0000-0000-0000-000000000004'), 'Puebla',
  'la solicitud solo devuelve la zona pública');
select ok(not (public.panel_publico()::text ~ 'interno|foto_path|actor_id|nombre_visible'),
  'el RPC no filtra metadata ni datos personales o rutas privadas');

set local role anon;
select lives_ok($$select public.panel_publico()$$, 'una persona anónima puede consultar el panel');
select throws_ok($$select count(*) from public.pagos$$, '42501', null,
  'una persona anónima no lee la tabla de pagos');
select ok(not (public.panel_publico()::text ~ 'foto_path|metadata|actor_id'),
  'el panel anónimo no expone campos privados');
reset role;

select * from finish();
rollback;
