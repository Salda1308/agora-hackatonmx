-- Jornadas de voluntariado (tarea 18). Autorizada por el usuario en el chat de T18.
-- Solo agrega; no cambia GRANTs ni políticas de T02.
--   * public.cupos_ocupados_jornadas: total ocupado por jornada visible, sin nombres.
--   * public.inscribirse_jornada: inscribe (el candado de cupo de T02 sigue actuando)
--     y devuelve el id, que sirve de folio privado para quien se inscribe.
--   * public.consultar_inscripcion: estado de una inscripción por su folio; los datos
--     de la constancia solo aparecen con asistencia confirmada.
--   * Transiciones: pendiente -> confirmada | rechazada; confirmada -> asistio | no_asistio.

create function privado.al_cambiar_estado_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = old.estado then
    return new;
  end if;
  if not (
    (old.estado = 'pendiente' and new.estado in ('confirmada', 'rechazada'))
    or (old.estado = 'confirmada' and new.estado in ('asistio', 'no_asistio'))
  ) then
    raise exception 'Cambio de estado no permitido' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inscripciones_transicion_estado
  before update of estado on public.inscripciones_jornada
  for each row execute function privado.al_cambiar_estado_inscripcion();

create function public.cupos_ocupados_jornadas(p_ids uuid[])
returns table (jornada_id uuid, ocupados integer)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id,
    coalesce(sum(i.asistentes) filter (where i.estado not in ('rechazada', 'no_asistio')), 0)::integer
  from public.jornadas j
  left join public.inscripciones_jornada i on i.jornada_id = j.id
  where j.id = any (p_ids)
    and (privado.org_publica(j.organizacion_id) or j.organizacion_id = privado.mi_organizacion())
  group by j.id;
$$;

create function public.inscribirse_jornada(
  p_jornada uuid,
  p_nombre_contacto text,
  p_contacto text,
  p_asistentes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not privado.jornada_publica(p_jornada) then
    raise exception 'La jornada no está disponible' using errcode = '42501';
  end if;
  if exists (select 1 from public.jornadas where id = p_jornada and inicia_en <= now()) then
    raise exception 'La jornada ya empezó' using errcode = '22023';
  end if;

  insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
  values (p_jornada, trim(p_nombre_contacto), trim(p_contacto), p_asistentes)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.consultar_inscripcion(p_inscripcion uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id,
    'estado', i.estado,
    'asistentes', i.asistentes,
    'jornada', jsonb_build_object(
      'id', j.id, 'titulo', j.titulo, 'inicia_en', j.inicia_en, 'termina_en', j.termina_en,
      'organizacion', o.nombre
    ),
    'constancia', case when i.estado = 'asistio' then jsonb_build_object(
      'folio', upper(left(replace(i.id::text, '-', ''), 10)),
      'nombre', i.nombre_contacto,
      'asistentes', i.asistentes,
      'horas', round(extract(epoch from (j.termina_en - j.inicia_en)) / 3600.0, 1)
    ) end
  )
  from public.inscripciones_jornada i
  join public.jornadas j on j.id = i.jornada_id
  join public.organizaciones o on o.id = j.organizacion_id
  where i.id = p_inscripcion;
$$;

revoke all on function public.cupos_ocupados_jornadas(uuid[]) from public, anon, authenticated;
revoke all on function public.inscribirse_jornada(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.consultar_inscripcion(uuid) from public, anon, authenticated;
grant execute on function public.cupos_ocupados_jornadas(uuid[]) to anon, authenticated;
grant execute on function public.inscribirse_jornada(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.consultar_inscripcion(uuid) to anon, authenticated;
