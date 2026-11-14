-- R1: exclusivamente local/demostración. NO cargar en producción.
-- Cuentas ficticias; contraseña pública compartida: Agora-demo-2026!
-- El rol se asigna aquí en perfiles, nunca en metadata editable de Auth.
begin;

insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, descripcion, verificada, verificada_en, es_ejemplo)
values
  ('f2000000-0000-0000-0000-000000000001', 'fundacion', 'asilo',
   'Casa de la Abuela — ejemplo', 'casa-abuela-demo',
   'Organización ficticia para probar Ágora.', true, now(), true),
  ('f2000000-0000-0000-0000-000000000002', 'tienda', null,
   'Despensa del Barrio — ejemplo', 'despensa-barrio-demo',
   'Tienda ficticia para probar Ágora. No tiene credenciales de cobro.', true, now(), true)
on conflict (id) do nothing;

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  '00000000-0000-0000-0000-000000000000'::uuid, id, 'authenticated', 'authenticated',
  email, extensions.crypt('Agora-demo-2026!', extensions.gen_salt('bf')), now(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre_visible', nombre, 'es_ejemplo', true), now(), now()
from (values
  ('f1000000-0000-0000-0000-000000000001'::uuid, 'fundacion@demo.agora.test', 'Fundación demo'),
  ('f1000000-0000-0000-0000-000000000002'::uuid, 'tienda@demo.agora.test', 'Tienda demo'),
  ('f1000000-0000-0000-0000-000000000003'::uuid, 'repartidor@demo.agora.test', 'Repartidor demo'),
  ('f1000000-0000-0000-0000-000000000004'::uuid, 'comprador@demo.agora.test', 'Comprador demo')
) as demo(id, email, nombre)
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select id, id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
  now(), now()
from auth.users
where id in (
  'f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
  'f1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000004'
)
on conflict (provider_id, provider) do nothing;

insert into public.perfiles (id, rol, organizacion_id, nombre_visible) values
  ('f1000000-0000-0000-0000-000000000001', 'fundacion', 'f2000000-0000-0000-0000-000000000001', 'Fundación demo'),
  ('f1000000-0000-0000-0000-000000000002', 'tienda', 'f2000000-0000-0000-0000-000000000002', 'Tienda demo'),
  ('f1000000-0000-0000-0000-000000000003', 'repartidor', null, 'Repartidor demo')
on conflict (id) do nothing;

-- El comprador (incluso autenticado) NO tiene un perfil de rol.
commit;

-- T05 INICIO: ejemplos públicos para el recorrido de donación. Solo local/demo.
-- Precio de prueba: 1 centavo. Sin cuentas de cobro ni credenciales de pey.
begin;
insert into public.organizaciones
  (id, tipo, categoria, nombre, slug, descripcion, direccion_publica, latitud, longitud, verificada, verificada_en, es_ejemplo)
values
  ('f5000000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Albergue Coco — ejemplo', 'albergue-coco-t05', 'Organización ficticia para probar donaciones.', 'Ciudad de México (ubicación de ejemplo)', 19.4326, -99.1332, true, now(), true),
  ('f5000000-0000-0000-0000-000000000002', 'tienda', null, 'Tienda Coco — ejemplo', 'tienda-coco-t05', 'Tienda ficticia sin cuenta de cobro.', null, null, null, true, now(), true),
  ('f5000000-0000-0000-0000-000000000003', 'fundacion', 'asilo', 'Casa Coco — ejemplo', 'casa-coco-t05', 'Organización ficticia con ubicación no publicada.', null, null, null, true, now(), true)
on conflict (id) do nothing;
insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('f5100000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000002', 'Garrafón de agua — prueba', 'pieza', 1, true),
  ('f5100000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000002', 'Jabón — prueba', 'pieza', 1, true)
on conflict (id) do nothing;
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('f5200000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000002', 'Agua para el albergue — ejemplo', 'Cada unidad cuesta $0.01 para probar el flujo. No es una solicitud real.', 'publicada', now(), true),
  ('f5200000-0000-0000-0000-000000000002', 'f5000000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000002', 'Higiene para Casa Coco — ejemplo', 'Solicitud ficticia sin ubicación pública.', 'publicada', now(), true)
on conflict (id) do nothing;
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad)
values
  ('f5300000-0000-0000-0000-000000000001', 'f5200000-0000-0000-0000-000000000001', 'f5100000-0000-0000-0000-000000000001', 10),
  ('f5300000-0000-0000-0000-000000000002', 'f5200000-0000-0000-0000-000000000002', 'f5100000-0000-0000-0000-000000000002', 10)
on conflict (id) do nothing;
commit;
-- T05 FIN.

-- T08 INICIO: catálogo y pedidos pagados de ejemplo para la tienda demo. Solo local/demo.
-- Pagos simulados (sin pey) para ver el panel; marcar listo genera el código de recogida.
begin;
insert into public.catalogo_articulos (id, tienda_id, nombre, unidad, precio_centavos, es_ejemplo)
values
  ('f8100000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Paquete de pañales adulto — ejemplo', 'paquete', 28900, true),
  ('f8100000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'Arroz 1 kg — ejemplo', 'bolsa', 3200, true),
  ('f8100000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'Leche 1 L — ejemplo', 'pieza', 2800, true),
  ('f8100000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000002', 'Jabón de tocador — ejemplo', 'pieza', 1500, true)
on conflict (id) do nothing;
insert into public.solicitudes (id, organizacion_id, tienda_id, titulo, descripcion, estado, publicada_en, es_ejemplo)
values
  ('f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Despensa de noviembre — ejemplo', 'Solicitud ficticia para el panel de la tienda.', 'publicada', now(), true)
on conflict (id) do nothing;
insert into public.solicitud_articulos (id, solicitud_id, articulo_id, cantidad)
values
  ('f8300000-0000-0000-0000-000000000001', 'f8200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000001', 6),
  ('f8300000-0000-0000-0000-000000000002', 'f8200000-0000-0000-0000-000000000001', 'f8100000-0000-0000-0000-000000000002', 20)
on conflict (id) do nothing;
insert into public.pagos (id, solicitud_id, tienda_id, monto_centavos, metodo, metadata)
values
  ('f8400000-0000-0000-0000-000000000001', 'f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 57800, 'qr', '{"ejemplo": true}'),
  ('f8400000-0000-0000-0000-000000000002', 'f8200000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 16000, 'push', '{"ejemplo": true}')
on conflict (id) do nothing;
insert into public.pago_articulos (pago_id, solicitud_articulo_id, unidades)
values
  ('f8400000-0000-0000-0000-000000000001', 'f8300000-0000-0000-0000-000000000001', 2),
  ('f8400000-0000-0000-0000-000000000002', 'f8300000-0000-0000-0000-000000000002', 5)
on conflict do nothing;
-- Como el webhook: suma unidades pagadas y confirma; el trigger de T08 crea los pedidos.
update public.solicitud_articulos sa set unidades_pagadas = pa.unidades
from public.pago_articulos pa
where pa.solicitud_articulo_id = sa.id and pa.pago_id in
  ('f8400000-0000-0000-0000-000000000001', 'f8400000-0000-0000-0000-000000000002')
  and sa.unidades_pagadas = 0;
update public.pagos set estado = 'pagado', pagado_en = now()
where id in ('f8400000-0000-0000-0000-000000000001', 'f8400000-0000-0000-0000-000000000002')
  and estado = 'creado';
commit;
-- T08 FIN.

-- T17 INICIO: publicaciones ficticias para las páginas de organizaciones demo.
insert into public.publicaciones (id, organizacion_id, texto, es_ejemplo, consentimiento)
values ('f1700000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
  'Una ayuda pequeña también mueve mucho. Aquí compartiremos las novedades de nuestra comunidad. Esta publicación es ficticia y no acredita entregas.', true, true)
on conflict (id) do nothing;
-- T17 FIN.
