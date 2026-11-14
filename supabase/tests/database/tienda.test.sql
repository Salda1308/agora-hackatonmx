-- Panel de la tienda (tarea 08): pedido por pago, marcar listo, código de recogida,
-- aislamiento entre tiendas, precios congelados y tienda suspendida.
-- Correr con: npx supabase test db. Fixtures propias (prefijo e8); todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- Fixtures (como postgres, sin RLS) ------------------------------------------

insert into auth.users (id, aud, role, email) values
  ('e8000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'fundacion-t08@ejemplo.test'),
  ('e8000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'tienda-1-t08@ejemplo.test'),
  ('e8000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'tienda-2-t08@ejemplo.test');

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('e8100000-0000-0000-0000-000000000001', 'fundacion', 'asilo', 'Asilo T08', 'asilo-t08', true),
  ('e8100000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda uno T08', 'tienda-uno-t08', true),
  ('e8100000-0000-0000-0000-000000000003', 'tienda', null, 'Tienda dos T08', 'tienda-dos-t08', true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('e8000000-0000-0000-0000-0000000000f1', 'fundacion', 'e8100000-0000-0000-0000-000000000001'),
  ('e8000000-0000-0000-0000-0000000000a1', 'tienda', 'e8100000-0000-0000-0000-000000000002'),
  ('e8000000-0000-0000-0000-0000000000a2', 'tienda', 'e8100000-0000-0000-0000-000000000003');

insert into public.catalogo_articulos (id, tienda_id, nombre, precio_centavos) values
  ('e8200000-0000-0000-0000-000000000001', 'e8100000-0000-0000-0000-000000000002', 'Pañales', 25000),
  ('e8200000-0000-0000-0000-000000000002', 'e8100000-0000-0000-0000-000000000003', 'Arroz', 3000);

insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, estado) values
  ('e8300000-0000-0000-0000-000000000001', 'e8100000-0000-0000-0000-000000000001',
   'e8100000-0000-0000-0000-000000000002', 'Pañales T08', 'publicada'),
  ('e8300000-0000-0000-0000-000000000002', 'e8100000-0000-0000-0000-000000000001',
   'e8100000-0000-0000-0000-000000000003', 'Arroz T08', 'publicada');

insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad) values
  ('e8400000-0000-0000-0000-000000000001', 'e8300000-0000-0000-0000-000000000001',
   'e8200000-0000-0000-0000-000000000001', 10),
  ('e8400000-0000-0000-0000-000000000002', 'e8300000-0000-0000-0000-000000000002',
   'e8200000-0000-0000-0000-000000000002', 10);

-- Pago de 2 pañales confirmado como lo hace el webhook (unidades y estado).
insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo) values
  ('e8500000-0000-0000-0000-000000000001', 'e8300000-0000-0000-0000-000000000001',
   'e8100000-0000-0000-0000-000000000002', 50000, 'qr'),
  ('e8500000-0000-0000-0000-000000000002', 'e8300000-0000-0000-0000-000000000002',
   'e8100000-0000-0000-0000-000000000003', 3000, 'qr');
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades) values
  ('e8500000-0000-0000-0000-000000000001', 'e8400000-0000-0000-0000-000000000001', 2),
  ('e8500000-0000-0000-0000-000000000002', 'e8400000-0000-0000-0000-000000000002', 1);

update public.solicitud_articulos set unidades_pagadas = unidades_pagadas + 2
  where id = 'e8400000-0000-0000-0000-000000000001';
update public.pagos set estado = 'pagado', pagado_en = now()
  where id = 'e8500000-0000-0000-0000-000000000001';

select is((select count(*)::int from public.pedidos
  where solicitud_id = 'e8300000-0000-0000-0000-000000000001'), 1, 'el pago confirmado crea un pedido');
select is((select pa.unidades from public.pedido_articulos pa join public.pedidos p on p.id = pa.pedido_id
  where p.solicitud_id = 'e8300000-0000-0000-0000-000000000001'), 2, 'el pedido lleva las unidades pagadas');
select is((select estado::text from public.pedidos
  where solicitud_id = 'e8300000-0000-0000-0000-000000000001'), 'preparando', 'el pedido nace preparando');

-- Volver a escribir el pago (otro campo) no duplica el pedido.
update public.pagos set metadata = metadata || '{"x": 1}'::jsonb
  where id = 'e8500000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.pedidos
  where solicitud_id = 'e8300000-0000-0000-0000-000000000001'), 1, 'un pago no genera dos pedidos');

-- Pedido sin pagar (unidades por encima de lo pagado) en la tienda dos.
insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('e8600000-0000-0000-0000-000000000002', 'e8300000-0000-0000-0000-000000000002',
   'e8100000-0000-0000-0000-000000000003');
insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades) values
  ('e8600000-0000-0000-0000-000000000002', 'e8400000-0000-0000-0000-000000000002', 1);
-- Pedido sin artículos en la tienda uno.
insert into public.pedidos (id, solicitud_id, tienda_id) values
  ('e8600000-0000-0000-0000-000000000003', 'e8300000-0000-0000-0000-000000000001',
   'e8100000-0000-0000-0000-000000000002');

set local role authenticated;

-- Tienda dos: no ve los de la tienda uno y no puede marcar su pedido sin pagar.
select set_config('request.jwt.claims',
  '{"sub":"e8000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.pedidos), 1, 'una tienda no ve pedidos de otra (tabla)');
select is((select count(*)::int from public.pedidos_de_mi_tienda()), 1, 'una tienda no ve pedidos de otra (panel)');
select throws_ok($$select public.marcar_pedido_listo('e8600000-0000-0000-0000-000000000002')$$,
  '23514', 'El pedido no está pagado', 'no se marca listo un pedido sin pagar');
select throws_ok($$update public.pedidos set estado = 'listo' where id = 'e8600000-0000-0000-0000-000000000002'$$,
  '23514', 'El pedido no está pagado', 'tampoco con un update directo');

-- Tienda uno.
select set_config('request.jwt.claims',
  '{"sub":"e8000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.pedidos_de_mi_tienda()), 2, 'la tienda ve sus pedidos en el panel');
select is((select organizacion_nombre from public.pedidos_de_mi_tienda() where total_centavos = 50000),
  'Asilo T08', 'el panel muestra fundación y total');
select throws_ok($$select public.marcar_pedido_listo('e8600000-0000-0000-0000-000000000003')$$,
  '23514', 'El pedido no está pagado', 'un pedido sin artículos no se marca listo');
select ok((select public.marcar_pedido_listo(id) from public.pedidos_de_mi_tienda() where total_centavos = 50000)
  ~ '^[A-HJKMNP-Z2-9]{6}$', 'marcar listo devuelve un código de recogida');
select is((select estado::text from public.pedidos_de_mi_tienda() where total_centavos = 50000), 'listo',
  'el pedido pagado pasa a listo');
select isnt((select listo_en from public.pedidos_de_mi_tienda() where total_centavos = 50000), null,
  'se registra cuándo quedó listo');
select throws_ok(format('select public.marcar_pedido_listo(%L)',
    (select id from public.pedidos_de_mi_tienda() where total_centavos = 50000)),
  'P0002', null, 'un pedido listo no se vuelve a marcar');

-- Cambiar el precio del catálogo no altera la solicitud publicada.
update public.catalogo_articulos set precio_centavos = 99900 where id = 'e8200000-0000-0000-0000-000000000001';
select is((select precio_centavos from public.catalogo_articulos where id = 'e8200000-0000-0000-0000-000000000001'),
  99900, 'la tienda cambia su precio');
select is((select precio_centavos from public.solicitud_articulos where id = 'e8400000-0000-0000-0000-000000000001'),
  25000, 'la solicitud publicada conserva su precio');

-- Fundación: ve el código pero no marca pedidos.
select set_config('request.jwt.claims',
  '{"sub":"e8000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok($$select public.marcar_pedido_listo('e8600000-0000-0000-0000-000000000003')$$,
  '42501', null, 'una fundación no marca pedidos listos');

reset role;

select is((select unidades_listas from public.solicitud_articulos where id = 'e8400000-0000-0000-0000-000000000001'),
  2, 'las unidades listas se suman a la solicitud');

-- Tienda suspendida: no recibe pedidos nuevos ni marca listo.
update public.organizaciones set suspendida = true where id = 'e8100000-0000-0000-0000-000000000003';
update public.solicitud_articulos set unidades_pagadas = unidades_pagadas + 1
  where id = 'e8400000-0000-0000-0000-000000000002';
update public.pagos set estado = 'pagado', pagado_en = now()
  where id = 'e8500000-0000-0000-0000-000000000002';
select is((select metadata->>'pedido_omitido' from public.pagos where id = 'e8500000-0000-0000-0000-000000000002'),
  'tienda_suspendida', 'una tienda suspendida no recibe pedidos nuevos');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e8000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$select public.marcar_pedido_listo('e8600000-0000-0000-0000-000000000002')$$,
  '42501', 'La tienda está suspendida', 'una tienda suspendida no marca listo');
reset role;

select * from finish();
rollback;
