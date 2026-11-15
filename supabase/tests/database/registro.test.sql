-- T22: registro por rol con aprobación del equipo. Permisos (anon, authenticated,
-- service_role), RLS de solicitudes_alta, validaciones antifraude, aprobar y rechazar.
-- Fixtures propias (prefijo e22); todo se revierte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(69);

-- Fixtures (como postgres, sin RLS) ------------------------------------------

insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('e2200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'fundacion-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'tienda-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'repartidor-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'sin-confirmar-t22@ejemplo.test', null),
  ('e2200000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'otra-t22@demo.agora.test', now()),
  ('e2200000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'alguien@mailinator.com', now()),
  ('e2200000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'con-perfil-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'intentos-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'rechazado-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'insistente-t22@ejemplo.test', now()),
  ('e2200000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'corrige-t22@ejemplo.test', now());

-- Organización existente con nombre en uso y otra cuyo slug choca con el de la solicitud.
insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('e2210000-0000-0000-0000-000000000001', 'fundacion', 'albergue', 'Albergue Esperanza', 'albergue-esperanza-t22', true),
  ('e2210000-0000-0000-0000-000000000002', 'tienda', null, 'Otro Nombre T22', 'refugio-luz-t22', true);
insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, credencial_ref) values
  ('e2210000-0000-0000-0000-000000000002', 'Titular T22', 'COB800101AB1', 'PEY_T22');

insert into public.perfiles (id, rol) values ('e2200000-0000-0000-0000-000000000007', 'repartidor');

-- 09: tres rechazos antiguos. 10: tres envíos en las últimas 24 h (dos rechazados y
-- una fila aprobada artificial, solo para contar envíos).
insert into public.solicitudes_alta (usuario_id, rol, nombre_contacto, telefono, ciudad, estado, motivo,
  creada_en, resuelta_en, resuelta_por) values
  ('e2200000-0000-0000-0000-000000000009', 'repartidor', 'Rex', '5590000001', 'CDMX', 'rechazada', 'Datos falsos',
   now() - interval '5 days', now() - interval '5 days', 'equipo'),
  ('e2200000-0000-0000-0000-000000000009', 'repartidor', 'Rex', '5590000002', 'CDMX', 'rechazada', 'Datos falsos',
   now() - interval '4 days', now() - interval '4 days', 'equipo'),
  ('e2200000-0000-0000-0000-000000000009', 'repartidor', 'Rex', '5590000003', 'CDMX', 'rechazada', 'Datos falsos',
   now() - interval '3 days', now() - interval '3 days', 'equipo'),
  ('e2200000-0000-0000-0000-000000000010', 'repartidor', 'Iván', '5591000001', 'CDMX', 'rechazada', 'Incompleta',
   now() - interval '3 hours', now() - interval '3 hours', 'equipo'),
  ('e2200000-0000-0000-0000-000000000010', 'repartidor', 'Iván', '5591000002', 'CDMX', 'rechazada', 'Incompleta',
   now() - interval '2 hours', now() - interval '2 hours', 'equipo'),
  ('e2200000-0000-0000-0000-000000000010', 'repartidor', 'Iván', '5591000003', 'CDMX', 'aprobada', null,
   now() - interval '1 hours', now() - interval '1 hours', 'equipo');

-- Tabla cerrada -----------------------------------------------------------------

select ok((select relrowsecurity from pg_class where oid = 'public.solicitudes_alta'::regclass),
  'solicitudes_alta tiene RLS activa');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'solicitudes_alta'), 0,
  'solicitudes_alta no tiene políticas para clientes');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Anon', '5500000000', 'CDMX')$$, '42501', null,
  'anon no solicita alta');
select throws_ok($$select * from public.mi_solicitud_alta()$$, '42501', null, 'anon no consulta solicitudes');
select throws_ok($$select * from public.solicitudes_alta$$, '42501', null, 'anon no lee la tabla');
select throws_ok($$select public.aprobar_alta(gen_random_uuid(), 'anon')$$, '42501', null, 'anon no aprueba');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select * from public.solicitudes_alta$$, '42501', null, 'authenticated no lee la tabla');
select throws_ok($$insert into public.solicitudes_alta (usuario_id, rol, nombre_contacto, telefono, ciudad)
  values ('e2200000-0000-0000-0000-000000000001', 'repartidor', 'Ana', '5500000000', 'CDMX')$$, '42501', null,
  'authenticated no inserta directo');
select throws_ok($$select public.aprobar_alta(gen_random_uuid(), 'yo')$$, '42501', null,
  'authenticated no aprueba');
select throws_ok($$select public.rechazar_alta(gen_random_uuid(), 'porque sí', 'yo')$$, '42501', null,
  'authenticated no rechaza');
select is((select count(*)::int from public.mi_solicitud_alta()), 0, 'sin solicitudes, mi_solicitud_alta vacía');

-- Cuenta ------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Nadie', '5500000000', 'CDMX')$$, '42501',
  'Inicia sesión primero', 'sin usuario no hay solicitud');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Sin Confirmar', '5500000000', 'CDMX')$$, '42501',
  'Confirma tu correo primero', 'correo sin confirmar no solicita');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Demo', '5500000000', 'CDMX')$$, '42501',
  'Las cuentas demo no pueden solicitar alta', 'cuenta demo no solicita');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Temporal', '5500000000', 'CDMX')$$, '42501',
  'Usa un correo permanente, no uno desechable', 'correo desechable no solicita');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Ya Tengo', '5500000000', 'CDMX')$$, '42501',
  'Tu cuenta ya tiene un perfil', 'cuenta con perfil no solicita');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Rex', '5590000009', 'CDMX')$$, '42501',
  'Alcanzaste el máximo de solicitudes rechazadas. Escribe al equipo.', 'tres rechazos bloquean nuevas solicitudes');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000010","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('repartidor', 'Iván', '5591000009', 'CDMX')$$, '42501',
  'Demasiados envíos. Intenta de nuevo mañana.', 'tres envíos en 24 h bloquean el cuarto');

-- Validaciones (usuario 08; ninguna crea solicitud) --------------------------------

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000008","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('comprador', 'Ana', '5500000008', 'CDMX')$$, '22023',
  'Elige fundación, tienda o repartidor', 'rol desconocido');
select throws_ok($$select public.solicitar_alta('repartidor', E'Ana\u0007', '5500000008', 'CDMX')$$, '23514',
  'El nombre de contacto tiene caracteres no permitidos', 'caracteres de control');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana www.estafa.com', '5500000008', 'CDMX')$$, '23514',
  'El nombre no puede llevar direcciones web', 'URL en el nombre de contacto');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación ayuda.com',
  'asilo', repeat('Descripción suficiente. ', 3), null, 'https://ejemplo.org')$$, '23514',
  'El nombre no puede llevar direcciones web', 'URL en el nombre de la organización');
select throws_ok($$select public.solicitar_alta('repartidor', repeat('a', 121), '5500000008', 'CDMX')$$, '23514',
  'El nombre de contacto admite máximo 120 caracteres', 'nombre demasiado largo');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '12345', 'CDMX')$$, '23514',
  'El teléfono debe tener 10 dígitos', 'teléfono inválido');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '5500000008', '   ')$$, '23514',
  'Escribe la ciudad', 'ciudad vacía');
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Tienda Ana T22',
  null, null, 'ANA800101AB1', 'http://ejemplo.org')$$, '23514',
  'El enlace debe empezar con https:// y ser una dirección válida', 'enlace sin https');
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Tienda Ana T22',
  null, null, 'ANA800101AB1', 'https://bit.ly/abc')$$, '23514',
  'Usa el enlace completo, sin acortadores', 'enlace acortado');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '5500000008', 'CDMX', 'Mi Empresa')$$, '22023',
  'El repartidor no lleva datos de organización', 'repartidor con organización');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '5500000008', 'CDMX', null, null, null,
  'ANA800101AB1')$$, '22023', 'El repartidor no lleva datos de organización', 'repartidor con RFC');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación Ana T22',
  null, repeat('Descripción suficiente. ', 3), null, 'https://ejemplo.org')$$, '23514',
  'Elige una categoría válida', 'fundación sin categoría');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación Ana T22',
  'iglesia', repeat('Descripción suficiente. ', 3), null, 'https://ejemplo.org')$$, '23514',
  'Elige una categoría válida', 'fundación con categoría inválida');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación Ana T22',
  'asilo', 'Muy corta', null, 'https://ejemplo.org')$$, '23514',
  'La descripción necesita al menos 40 caracteres', 'descripción corta');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación Ana T22',
  'asilo', repeat('Descripción suficiente. ', 3))$$, '23514',
  'Agrega un enlace verificable (sitio o red social)', 'fundación sin enlace');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'Fundación Ana T22',
  'asilo', repeat('Descripción suficiente. ', 3), 'XX12', 'https://ejemplo.org')$$, '23514',
  'El RFC no tiene un formato válido', 'RFC opcional pero con formato');
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Tienda Ana T22')$$, '23514',
  'El RFC es obligatorio para tiendas', 'tienda sin RFC');
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Tienda Ana T22',
  'asilo', null, 'ANA800101AB1')$$, '22023', 'La categoría solo aplica a fundaciones', 'tienda con categoría');
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', '  ALBERGUE  esperánza ',
  'albergue', repeat('Descripción suficiente. ', 3), null, 'https://ejemplo.org')$$, '23505',
  'Ya existe una organización con ese nombre', 'nombre ya usado por una organización (sin acentos ni mayúsculas)');
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Tienda Ana T22',
  null, null, 'cob-800101-ab1')$$, '23505', 'Ese RFC ya está registrado', 'RFC ya usado en tiendas_cobro');
select is((select count(*)::int from public.mi_solicitud_alta()), 0, 'los intentos inválidos no dejan solicitud');

-- Solicitudes válidas ------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.solicitar_alta('fundacion', '  Ana Pérez  ', '+52 (55) 1234-5678',
  '  Ciudad de México ', 'Refugio Luz T22', 'refugio_animales',
  'Refugio de perros y gatos rescatados en Iztapalapa desde 2015.', null,
  'https://www.facebook.com/refugioluz')$$, 'la fundación envía su solicitud');
select is((select estado || ':' || rol || ':' || org_nombre from public.mi_solicitud_alta()),
  'pendiente:fundacion:Refugio Luz T22', 'mi_solicitud_alta muestra la pendiente');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '5500000001', 'CDMX')$$, '23505',
  'Ya tienes una solicitud en revisión', 'una sola pendiente por usuario');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000008","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('fundacion', 'Ana', '5500000008', 'CDMX', 'refugio luz t22',
  'albergue', repeat('Descripción suficiente. ', 3), null, 'https://ejemplo.org')$$, '23505',
  'Ya existe una organización con ese nombre', 'nombre ya usado por una solicitud pendiente');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '55 1234 5678', 'CDMX')$$, '23505',
  'Ese teléfono ya está registrado', 'un teléfono, una cuenta');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.solicitar_alta('tienda', 'Mary López', '55 2222 3333', 'Puebla',
  'Abarrotes Doña Mary T22', null, null, 'tie-900202-aa1')$$, 'la tienda envía su solicitud');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000008","role":"authenticated"}', true);
select throws_ok($$select public.solicitar_alta('tienda', 'Ana', '5500000008', 'CDMX', 'Otra Tienda T22',
  null, null, 'TIE900202AA1')$$, '23505', 'Ese RFC ya está registrado', 'RFC ya usado en una solicitud');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select lives_ok($$select public.solicitar_alta('repartidor', 'Luis Gómez', '5533334444', 'Puebla')$$,
  'el repartidor envía su solicitud');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000011","role":"authenticated"}', true);
select lives_ok($$select public.solicitar_alta('repartidor', 'Rosa', '5544445555', 'Toluca')$$,
  'otra persona envía su solicitud');

reset role;
select is((select telefono || '|' || nombre_contacto || '|' || ciudad from public.solicitudes_alta
  where usuario_id = 'e2200000-0000-0000-0000-000000000001'), '5512345678|Ana Pérez|Ciudad de México',
  'teléfono normalizado y textos recortados');
select is((select rfc from public.solicitudes_alta where usuario_id = 'e2200000-0000-0000-0000-000000000002'),
  'TIE900202AA1', 'RFC normalizado');

create temp table t22 as select
  (select id from public.solicitudes_alta where usuario_id = 'e2200000-0000-0000-0000-000000000001') as fundacion,
  (select id from public.solicitudes_alta where usuario_id = 'e2200000-0000-0000-0000-000000000002') as tienda,
  (select id from public.solicitudes_alta where usuario_id = 'e2200000-0000-0000-0000-000000000003') as repartidor,
  (select id from public.solicitudes_alta where usuario_id = 'e2200000-0000-0000-0000-000000000011') as rosa;
grant select on t22 to service_role;

-- El equipo resuelve (service_role) -----------------------------------------------

set local role service_role;
select lives_ok($$select public.aprobar_alta((select fundacion from t22), 'equipo-t22')$$, 'aprueba la fundación');
select lives_ok($$select public.aprobar_alta((select tienda from t22), 'equipo-t22')$$, 'aprueba la tienda');
select lives_ok($$select public.aprobar_alta((select repartidor from t22), 'equipo-t22')$$, 'aprueba el repartidor');
select throws_ok($$select public.aprobar_alta((select fundacion from t22), 'equipo-t22')$$, 'P0001',
  'La solicitud no está pendiente', 'no se aprueba dos veces');
select throws_ok($$select public.rechazar_alta((select rosa from t22), 'no', 'equipo-t22')$$, '23514',
  'Escribe un motivo de 5 a 500 caracteres', 'rechazar exige motivo');
select lives_ok($$select public.rechazar_alta((select rosa from t22), 'No pudimos verificar tu teléfono',
  'equipo-t22')$$, 'rechaza con motivo');
select throws_ok($$select public.rechazar_alta((select rosa from t22), 'Otra vez', 'equipo-t22')$$, 'P0001',
  'La solicitud no está pendiente', 'no se rechaza dos veces');
reset role;

select is((select o.tipo || ':' || o.categoria || ':' || o.verificada || ':' || (o.verificada_en is not null)
  || ':' || o.slug from public.organizaciones o join public.perfiles p on p.organizacion_id = o.id
  where p.id = 'e2200000-0000-0000-0000-000000000001'),
  'fundacion:refugio_animales:true:true:refugio-luz-t22-2', 'la fundación queda verificada con slug único');
select is((select rol || ':' || nombre_visible from public.perfiles where id = 'e2200000-0000-0000-0000-000000000001'),
  'fundacion:Ana Pérez', 'perfil de fundación con su organización');
select is((select o.tipo || ':' || o.verificada || ':'
  || (select count(*) from public.tiendas_cobro c where c.organizacion_id = o.id)
  from public.organizaciones o join public.perfiles p on p.organizacion_id = o.id
  where p.id = 'e2200000-0000-0000-0000-000000000002'), 'tienda:true:0',
  'la tienda aprobada no tiene cobro hasta que el equipo cree tiendas_cobro');
select is((select rol || ':' || (organizacion_id is null) from public.perfiles
  where id = 'e2200000-0000-0000-0000-000000000003'), 'repartidor:true', 'perfil de repartidor sin organización');
select is(privado.limite_repartidor('e2200000-0000-0000-0000-000000000003'), 50000::bigint,
  'el repartidor aprobado empieza con el tope de voluntario nuevo');
select is((select count(*)::int from public.acciones_moderacion where moderador = 'equipo-t22'), 6,
  'cada aprobación, verificación y rechazo queda registrada');
select is((select count(*)::int from public.solicitudes_alta
  where estado = 'aprobada' and resuelta_por = 'equipo-t22' and resuelta_en is not null), 3,
  'las aprobadas registran quién y cuándo');

-- Lo que ve cada usuario después ---------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select estado from public.mi_solicitud_alta()), 'aprobada', 'la fundación ve su solicitud aprobada');
select is((select rol::text from public.perfiles), 'fundacion', 'la fundación ya tiene su rol');
select throws_ok($$select public.solicitar_alta('repartidor', 'Ana', '5500000001', 'CDMX')$$, '42501',
  'Tu cuenta ya tiene un perfil', 'la cuenta aprobada no vuelve a solicitar');

select set_config('request.jwt.claims', '{"sub":"e2200000-0000-0000-0000-000000000011","role":"authenticated"}', true);
select is((select estado || ':' || motivo from public.mi_solicitud_alta()),
  'rechazada:No pudimos verificar tu teléfono', 'la persona rechazada ve el motivo');
select lives_ok($$select public.solicitar_alta('repartidor', 'Rosa Díaz', '5544445555', 'Toluca')$$,
  'tras el rechazo puede corregir y reenviar con el mismo teléfono');

reset role;
select * from finish();
rollback;
