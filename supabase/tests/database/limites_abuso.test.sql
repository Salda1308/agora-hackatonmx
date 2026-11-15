-- T20: límites de abuso en jornadas (A2) y privilegios de la tabla de conteo de
-- crear-cobro (A1). Fixtures propias; todo se revierte. La caducidad de reservas y
-- los topes de crear-cobro se prueban en supabase/functions/crear-cobro/integration_test.ts.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, aud, role, email) values
  ('20000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 't20-fundacion@ejemplo.test'),
  ('20000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 't20-empresa@ejemplo.test');

insert into public.organizaciones (id, tipo, categoria, nombre, slug, verificada) values
  ('20100000-0000-0000-0000-00000000000a', 'fundacion', 'albergue', 'T20 albergue', 't20-albergue', true),
  ('20100000-0000-0000-0000-00000000000e', 'empresa', null, 'T20 empresa', 't20-empresa', true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('20000000-0000-0000-0000-0000000000f1', 'fundacion', '20100000-0000-0000-0000-00000000000a');

insert into public.jornadas (id, organizacion_id, titulo, ubicacion, inicia_en, termina_en, cupos) values
  ('20200000-0000-0000-0000-000000000001', '20100000-0000-0000-0000-00000000000a', 'Futura',
   'Calle 1', now() + interval '1 day', now() + interval '1 day 3 hours', 20),
  ('20200000-0000-0000-0000-000000000002', '20100000-0000-0000-0000-00000000000a', 'Pasada',
   'Calle 1', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 20);

-- Visitante anónimo ------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
    values ('20200000-0000-0000-0000-000000000001', 'Directo', 'directo@ejemplo.test', 1)$$,
  '42501', null, 'anónimo no inserta directo en la tabla');

select throws_ok(
  $$select public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Muchos', 'muchos@ejemplo.test', 5)$$,
  '22023', 'Máximo 4 asistentes por inscripción', 'no más de 4 asistentes por inscripción');

select isnt(
  public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Cuatro', 'Uno@Ejemplo.test', 4),
  null, 'se inscribe con 4 asistentes');

select throws_ok(
  $$select public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Otra vez', ' uno@ejemplo.TEST ', 1)$$,
  '22023', 'Este contacto ya inscribió el máximo de asistentes',
  'el mismo contacto (sin importar mayúsculas ni espacios) no suma más de 4');

select throws_ok(
  $$select public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Tel', '55 1234 5678', 3)
    from (select public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Tel', '5512345678', 2)) x$$,
  '22023', 'Este contacto ya inscribió el máximo de asistentes',
  'un teléfono con o sin espacios cuenta como el mismo contacto');

select isnt(
  public.inscribirse_jornada('20200000-0000-0000-0000-000000000001', 'Otra', 'otra@ejemplo.test', 3),
  null, 'otro contacto sí se inscribe');

select throws_ok(
  $$select public.inscribirse_jornada('20200000-0000-0000-0000-000000000002', 'Tarde', 'tarde@ejemplo.test', 1)$$,
  '22023', 'La jornada ya empezó', 'la función no inscribe en una jornada que ya empezó');

-- Cuenta con sesión: tampoco inserta directo ni elige empresa_id -----------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.inscripciones_jornada (jornada_id, empresa_id, nombre_contacto, contacto, asistentes)
    values ('20200000-0000-0000-0000-000000000001', '20100000-0000-0000-0000-00000000000a', 'Suplanta', 's@ejemplo.test', 1)$$,
  '42501', null, 'una cuenta no inserta directo ni pone un empresa_id ajeno');

select is(
  pg_get_function_identity_arguments('public.inscribirse_jornada'::regproc),
  'p_jornada uuid, p_nombre_contacto text, p_contacto text, p_asistentes integer',
  'la función no recibe empresa_id');

-- Disparador: la regla de fecha no depende de la función ------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
    values ('20200000-0000-0000-0000-000000000002', 'Por API', 'api@ejemplo.test', 1)$$,
  '22023', 'La jornada ya empezó', 'el disparador rechaza inscripciones de la API en jornadas iniciadas');

select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$insert into public.inscripciones_jornada (id, jornada_id, nombre_contacto, contacto, asistentes, estado)
    values ('20300000-0000-0000-0000-000000000001', '20200000-0000-0000-0000-000000000002', 'Seed', 'seed@ejemplo.test', 6, 'confirmada')$$,
  'una carga administrativa sin JWT (seed) sí registra jornadas pasadas');

select is(
  (select count(*)::int from public.inscripciones_jornada
    where jornada_id = '20200000-0000-0000-0000-000000000001' and empresa_id is not null),
  0, 'las inscripciones por la función no llevan empresa_id');

-- La fundación sigue confirmando asistencia después de que empezó la jornada.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select lives_ok(
  $$update public.inscripciones_jornada set estado = 'asistio' where id = '20300000-0000-0000-0000-000000000001'$$,
  'la fundación confirma asistencia en una jornada ya iniciada');
select is(
  (select estado::text from public.inscripciones_jornada where id = '20300000-0000-0000-0000-000000000001'),
  'asistio', 'el cambio de estado se guardó');

-- A1: tabla de conteo de crear-cobro ---------------------------------------
reset role;
select ok(
  not has_table_privilege('anon', 'privado.limites_cobro', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'privado.limites_cobro', 'select, insert, update, delete'),
  'anon y authenticated no tocan el conteo por origen');
select ok(
  has_table_privilege('service_role', 'privado.limites_cobro', 'select, insert, update, delete'),
  'service_role (crear-cobro) cuenta intentos por origen');

select * from finish();
rollback;
