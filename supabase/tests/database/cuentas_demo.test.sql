-- T19: las cuentas demo no aceptan otra contraseña ni otro correo. Requiere seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select throws_ok($$
  update auth.users set encrypted_password = extensions.crypt('otra-clave-123', extensions.gen_salt('bf'))
  where email = 'fundacion@demo.agora.test' $$,
  '42501', 'La contraseña de las cuentas demo no se puede cambiar',
  'una cuenta demo no acepta otra contraseña');

select lives_ok($$
  update auth.users set encrypted_password = extensions.crypt('Agora-demo-2026!', extensions.gen_salt('bf'))
  where email = 'tienda@demo.agora.test' $$,
  'una cuenta demo acepta volver a la contraseña publicada');

select throws_ok($$
  update auth.users set email = 'atacante@example.com' where email = 'repartidor@demo.agora.test' $$,
  '42501', 'El correo de las cuentas demo no se puede cambiar',
  'una cuenta demo no acepta otro correo');

select throws_ok($$
  update auth.users set email_change = 'atacante@example.com' where email = 'comprador@demo.agora.test' $$,
  '42501', 'El correo de las cuentas demo no se puede cambiar',
  'una cuenta demo no acepta solicitud de cambio de correo');

select lives_ok($$
  update auth.users set last_sign_in_at = now(), email_change = '' where email = 'comprador@demo.agora.test' $$,
  'una cuenta demo sigue registrando inicios de sesión');

select is((select count(*)::int from auth.users where email like '%@demo.agora.test'
  and encrypted_password = extensions.crypt('Agora-demo-2026!', encrypted_password)), 4,
  'las cuatro cuentas conservan la contraseña publicada');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password)
values ('00000000-0000-0000-0000-000000000000', 'f1900000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'persona@example.com',
  extensions.crypt('clave-inicial-1', extensions.gen_salt('bf')));

select lives_ok($$
  update auth.users set encrypted_password = extensions.crypt('clave-nueva-2', extensions.gen_salt('bf')),
    email = 'persona.nueva@example.com'
  where id = 'f1900000-0000-0000-0000-000000000001' $$,
  'otra cuenta sí puede cambiar contraseña y correo');

select is((select encrypted_password = extensions.crypt('clave-nueva-2', encrypted_password)
  from auth.users where id = 'f1900000-0000-0000-0000-000000000001'), true,
  'el cambio de la otra cuenta quedó guardado');

select * from finish();
rollback;
