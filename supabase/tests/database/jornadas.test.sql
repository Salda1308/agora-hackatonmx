-- Jornadas de voluntariado (tarea 18). Fixtures propias; todo se revierte.
-- La concurrencia real (dos sesiones al último cupo) se prueba aparte con dos
-- conexiones; ver .ai/tasks/T18/task.md.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, aud, role, email) values
  ('18000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 't18-fundacion-a@ejemplo.test'),
  ('18000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 't18-fundacion-b@ejemplo.test'),
  ('18000000-0000-0000-0000-0000000000f3', 'authenticated', 'authenticated', 't18-colectivo@ejemplo.test');

insert into public.organizaciones (id, tipo, categoria, nombre, slug, direccion_publica, verificada) values
  ('18100000-0000-0000-0000-00000000000a', 'fundacion', 'albergue', 'T18 albergue', 't18-albergue', 'Calle 1', true),
  ('18100000-0000-0000-0000-00000000000b', 'fundacion', 'asilo', 'T18 asilo', 't18-asilo', null, true),
  ('18100000-0000-0000-0000-00000000000c', 'fundacion', 'colectivo_busqueda', 'T18 colectivo', 't18-colectivo', null, true);

insert into public.perfiles (id, rol, organizacion_id) values
  ('18000000-0000-0000-0000-0000000000f1', 'fundacion', '18100000-0000-0000-0000-00000000000a'),
  ('18000000-0000-0000-0000-0000000000f2', 'fundacion', '18100000-0000-0000-0000-00000000000b'),
  ('18000000-0000-0000-0000-0000000000f3', 'fundacion', '18100000-0000-0000-0000-00000000000c');

insert into public.jornadas (id, organizacion_id, titulo, ubicacion, inicia_en, termina_en, cupos) values
  ('18200000-0000-0000-0000-000000000001', '18100000-0000-0000-0000-00000000000a', 'Futura',
   'Calle 1', now() + interval '1 day', now() + interval '1 day 3 hours', 3),
  ('18200000-0000-0000-0000-000000000002', '18100000-0000-0000-0000-00000000000a', 'Pasada',
   'Calle 1', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 3),
  ('18200000-0000-0000-0000-000000000003', '18100000-0000-0000-0000-00000000000c', 'Del colectivo',
   'Secreto', now() + interval '1 day', now() + interval '1 day 3 hours', 3);

-- Visitante anónimo ------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select isnt(
  public.inscribirse_jornada('18200000-0000-0000-0000-000000000001', ' Empresa Uno ', 'uno@ejemplo.test', 2),
  null, 'un visitante se inscribe y recibe su folio');

select results_eq(
  $$select ocupados from public.cupos_ocupados_jornadas(array['18200000-0000-0000-0000-000000000001'::uuid])$$,
  array[2], 'el visitante ve cuántos cupos están ocupados');

select throws_ok(
  $$select public.inscribirse_jornada('18200000-0000-0000-0000-000000000001', 'Empresa Dos', 'dos@ejemplo.test', 2)$$,
  'P0001', 'La jornada no tiene cupo suficiente', 'no se pasa del cupo');

select throws_ok(
  $$select public.inscribirse_jornada('18200000-0000-0000-0000-000000000002', 'Tarde', 'tarde@ejemplo.test', 1)$$,
  '22023', 'La jornada ya empezó', 'no se inscribe a una jornada que ya empezó');

select throws_ok(
  $$select public.inscribirse_jornada('18200000-0000-0000-0000-000000000003', 'X', 'x@ejemplo.test', 1)$$,
  '42501', 'La jornada no está disponible', 'las jornadas de un colectivo de búsqueda no son públicas');

select is_empty(
  $$select id from public.jornadas where id = '18200000-0000-0000-0000-000000000003'$$,
  'el visitante no ve la jornada ni el lugar del colectivo');

select is_empty(
  $$select * from public.cupos_ocupados_jornadas(array['18200000-0000-0000-0000-000000000003'::uuid])$$,
  'tampoco su ocupación');

select throws_ok(
  $$select nombre_contacto from public.inscripciones_jornada$$,
  '42501', null, 'la lista de nombres no es pública');

-- Folio para las pruebas siguientes (como postgres para leerlo).
reset role;
create temporary table folio as
  select id from public.inscripciones_jornada where jornada_id = '18200000-0000-0000-0000-000000000001';
grant select on folio to anon, authenticated;
set local role anon;

select is(
  public.consultar_inscripcion((select id from folio)) ->> 'estado', 'pendiente',
  'con su folio consulta el estado');

select is(
  public.consultar_inscripcion((select id from folio)) -> 'constancia', 'null'::jsonb,
  'sin confirmación no hay constancia');

-- Colectivo de búsqueda --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"18000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.jornadas (organizacion_id, titulo, ubicacion, inicia_en, termina_en, cupos)
    values ('18100000-0000-0000-0000-00000000000c', 'Búsqueda', 'Dirección', now() + interval '2 days',
            now() + interval '2 days 2 hours', 5)$$,
  '42501', null, 'un colectivo de búsqueda no abre jornadas con lugar');

-- Otra fundación ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"18000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);

update public.inscripciones_jornada set estado = 'confirmada' where id = (select id from folio);
select is_empty(
  $$select id from public.inscripciones_jornada$$,
  'otra fundación no ve inscripciones ajenas');

-- Fundación dueña --------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"18000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is(
  (select estado::text from public.inscripciones_jornada where id = (select id from folio)), 'pendiente',
  'otra fundación no cambió el estado');

select lives_ok(
  $$insert into public.jornadas (organizacion_id, titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos)
    values ('18100000-0000-0000-0000-00000000000a', 'Nueva', 'Ayudar', 'Guantes', 'Calle 1',
            now() + interval '3 days', now() + interval '3 days 2 hours', 10)$$,
  'la fundación abre una jornada');

select throws_ok(
  $$update public.inscripciones_jornada set estado = 'asistio' where id = (select id from folio)$$,
  '23514', 'Cambio de estado no permitido', 'no confirma asistencia sin aceptar antes');

update public.inscripciones_jornada set estado = 'confirmada' where id = (select id from folio);
select is(
  public.consultar_inscripcion((select id from folio)) -> 'constancia', 'null'::jsonb,
  'aceptada aún no tiene constancia');

update public.inscripciones_jornada set estado = 'asistio' where id = (select id from folio);
select is(
  public.consultar_inscripcion((select id from folio)) -> 'constancia' ->> 'nombre', 'Empresa Uno',
  'con asistencia confirmada se genera la constancia');

select throws_ok(
  $$update public.inscripciones_jornada set estado = 'pendiente' where id = (select id from folio)$$,
  '23514', 'Cambio de estado no permitido', 'la asistencia confirmada no se revierte');

-- Rechazar libera el cupo.
reset role;
insert into public.inscripciones_jornada (id, jornada_id, nombre_contacto, contacto, asistentes) values
  ('18300000-0000-0000-0000-000000000001', '18200000-0000-0000-0000-000000000001', 'Tres', 'tres@ejemplo.test', 1);
set local role authenticated;
update public.inscripciones_jornada set estado = 'rechazada' where id = '18300000-0000-0000-0000-000000000001';
select results_eq(
  $$select ocupados from public.cupos_ocupados_jornadas(array['18200000-0000-0000-0000-000000000001'::uuid])$$,
  array[2], 'una inscripción rechazada libera su cupo');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$update public.inscripciones_jornada set estado = 'confirmada'$$,
  '42501', null, 'un visitante no cambia estados');

select * from finish();
rollback;
