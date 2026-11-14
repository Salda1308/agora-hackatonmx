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
