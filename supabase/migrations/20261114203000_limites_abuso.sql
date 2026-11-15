-- T20: límites de abuso en cobros y jornadas (hallazgos A1 y A2 de T13).
--   * privado.limites_cobro: conteo de intentos de crear-cobro por origen (HMAC de la IP).
--   * inscripciones_jornada: sin INSERT directo para anon ni authenticated; solo
--     public.inscribirse_jornada (security definer), que no recibe empresa_id.
--   * privado.validar_cupo_jornada: además del cupo, una petición de anon o authenticated
--     no inscribe en una jornada que ya empezó.
--   * public.inscribirse_jornada: máximo 4 asistentes por inscripción y 4 por contacto y jornada.

-- A1 ----------------------------------------------------------------------

create table privado.limites_cobro (
  clave text not null check (length(clave) between 1 and 128),
  ventana timestamptz not null,
  intentos integer not null default 1 check (intentos > 0),
  primary key (clave, ventana)
);

create index limites_cobro_ventana_idx on privado.limites_cobro (ventana);

alter table privado.limites_cobro enable row level security;
revoke all on privado.limites_cobro from public, anon, authenticated;
grant usage on schema privado to service_role;
grant select, insert, update, delete on privado.limites_cobro to service_role;

-- A2 ----------------------------------------------------------------------

revoke insert on public.inscripciones_jornada from anon, authenticated;
drop policy "inscripciones: cualquiera se inscribe" on public.inscripciones_jornada;

create or replace function privado.validar_cupo_jornada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cupos integer;
  v_inicia timestamptz;
  v_ocupados integer;
begin
  if new.estado in ('rechazada', 'no_asistio') then
    return new;
  end if;
  select cupos, inicia_en into v_cupos, v_inicia
    from public.jornadas where id = new.jornada_id for update;
  -- Las cargas administrativas (seed, SQL directo) no traen JWT y pueden registrar
  -- jornadas pasadas; las peticiones de la API no.
  if v_inicia <= now()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
       in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      raise exception 'La jornada ya empezó' using errcode = '22023';
    elsif new.jornada_id is distinct from old.jornada_id then
      raise exception 'La jornada ya empezó' using errcode = '22023';
    end if;
  end if;
  select coalesce(sum(asistentes), 0) into v_ocupados
    from public.inscripciones_jornada
    where jornada_id = new.jornada_id
      and estado not in ('rechazada', 'no_asistio')
      and id <> new.id;
  if v_ocupados + new.asistentes > v_cupos then
    raise exception 'La jornada no tiene cupo suficiente';
  end if;
  return new;
end;
$$;

create or replace function public.inscribirse_jornada(
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
  v_contacto text := regexp_replace(lower(trim(p_contacto)), '\s', '', 'g');
  v_del_contacto integer;
begin
  if not privado.jornada_publica(p_jornada) then
    raise exception 'La jornada no está disponible' using errcode = '42501';
  end if;
  if p_asistentes > 4 then
    raise exception 'Máximo 4 asistentes por inscripción' using errcode = '22023';
  end if;
  -- Serializa las inscripciones de la jornada antes de contar por contacto.
  perform 1 from public.jornadas where id = p_jornada for update;
  if exists (select 1 from public.jornadas where id = p_jornada and inicia_en <= now()) then
    raise exception 'La jornada ya empezó' using errcode = '22023';
  end if;
  select coalesce(sum(asistentes), 0) into v_del_contacto
    from public.inscripciones_jornada
    where jornada_id = p_jornada
      and estado not in ('rechazada', 'no_asistio')
      and regexp_replace(lower(trim(contacto)), '\s', '', 'g') = v_contacto;
  if v_del_contacto + p_asistentes > 4 then
    raise exception 'Este contacto ya inscribió el máximo de asistentes' using errcode = '22023';
  end if;

  insert into public.inscripciones_jornada (jornada_id, nombre_contacto, contacto, asistentes)
  values (p_jornada, trim(p_nombre_contacto), trim(p_contacto), p_asistentes)
  returning id into v_id;

  return v_id;
end;
$$;
