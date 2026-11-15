-- T24: feed público, me gusta y comentarios.
--   * public.feed_publico: publicaciones, solicitudes publicadas y jornadas que no han
--     empezado, de organizaciones visibles al público (privado.org_publica), en un solo
--     orden cronológico. Solo datos que un anónimo ya puede leer.
--   * Me gusta y comentarios sobre lo que el público ve. Nadie escribe directo en las
--     tablas: solo funciones security definer con search_path fijo.
--   * Antiabuso en servidor: texto limpio, sin enlaces, correos ni teléfonos, sin
--     repetir, límites por usuario, reportes con ocultado automático y bloqueo por el
--     equipo (ver supabase/MODERACION.md).
--   * Los contadores se calculan al leer (count sobre índices): no hay contadores
--     guardados que puedan quedar desfasados. Las acciones de un mismo usuario se
--     serializan con un candado de transacción, así los límites no se rebasan en paralelo.

-- Tablas ------------------------------------------------------------------

create table public.me_gusta (
  tipo text not null check (tipo in ('publicacion', 'solicitud', 'jornada')),
  objetivo_id uuid not null,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (tipo, objetivo_id, usuario_id)
);

create index me_gusta_usuario_idx on public.me_gusta (usuario_id);

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('publicacion', 'solicitud', 'jornada')),
  objetivo_id uuid not null,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  creado_en timestamptz not null default now(),
  -- Oculto por 3 reportes o por el equipo; queda guardado para moderación.
  oculto boolean not null default false,
  oculto_en timestamptz,
  -- Borrado lógico: sigue contando para los límites de su autor.
  borrado_en timestamptz,
  borrado_por uuid
);

create index comentarios_objetivo_idx on public.comentarios (tipo, objetivo_id, creado_en desc);
create index comentarios_usuario_idx on public.comentarios (usuario_id, creado_en desc);

create table public.reportes_comentario (
  comentario_id uuid not null references public.comentarios (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (char_length(motivo) between 1 and 500),
  estado public.reporte_estado not null default 'abierto',
  creado_en timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);

-- Cuentas que no pueden comentar, dar me gusta ni reportar. Solo el equipo (service_role).
create table public.usuarios_bloqueados (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  motivo text,
  bloqueado_por text,
  creado_en timestamptz not null default now()
);

-- Bitácora corta para el límite de me gusta (se purga en cada acción del usuario).
create table privado.eventos_me_gusta (
  usuario_id uuid not null,
  creado_en timestamptz not null default now()
);

create index eventos_me_gusta_usuario_idx on privado.eventos_me_gusta (usuario_id, creado_en);

alter table public.me_gusta enable row level security;
alter table public.comentarios enable row level security;
alter table public.reportes_comentario enable row level security;
alter table public.usuarios_bloqueados enable row level security;
alter table privado.eventos_me_gusta enable row level security;

-- Sin políticas ni privilegios para anon y authenticated: todo pasa por las funciones.
revoke all on public.me_gusta, public.comentarios, public.reportes_comentario,
  public.usuarios_bloqueados from public, anon, authenticated;
revoke all on privado.eventos_me_gusta from public, anon, authenticated;
grant select, insert, update, delete on public.me_gusta, public.comentarios,
  public.reportes_comentario, public.usuarios_bloqueados to service_role;
grant select, insert, update, delete on privado.eventos_me_gusta to service_role;

-- Apoyo (privado) -----------------------------------------------------------

-- Organización dueña del objetivo, exista o no al público.
create function privado.objetivo_dueno(p_tipo text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo
    when 'publicacion' then (select organizacion_id from public.publicaciones where id = p_id)
    when 'solicitud' then (select organizacion_id from public.solicitudes where id = p_id)
    when 'jornada' then (select organizacion_id from public.jornadas where id = p_id)
  end;
$$;

-- Organización dueña si el objetivo es visible al público (mismas reglas que las
-- políticas de lectura de anon); null si no lo es.
create function privado.objetivo_visible(p_tipo text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tipo
    when 'publicacion' then (
      select organizacion_id from public.publicaciones
      where id = p_id and not retirada and privado.org_publica(organizacion_id))
    when 'solicitud' then (
      select organizacion_id from public.solicitudes
      where id = p_id and estado in ('publicada', 'cerrada') and privado.org_publica(organizacion_id))
    when 'jornada' then (
      select organizacion_id from public.jornadas
      where id = p_id and privado.org_publica(organizacion_id))
  end;
$$;

create function privado.validar_tipo_social(p_tipo text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_tipo is null or p_tipo not in ('publicacion', 'solicitud', 'jornada') then
    raise exception 'Tipo de contenido inválido' using errcode = '22023';
  end if;
end;
$$;

-- Cuenta que participa: con sesión, correo confirmado y no bloqueada.
create function privado.usuario_social()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión para participar' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'Confirma tu correo para participar' using errcode = '42501';
  end if;
  if exists (select 1 from public.usuarios_bloqueados where usuario_id = v_uid) then
    raise exception 'Tu cuenta no puede participar por ahora' using errcode = '42501';
  end if;
  -- Serializa las acciones de esta cuenta hasta el fin de la transacción.
  perform pg_advisory_xact_lock(hashtextextended('t24-social:' || v_uid::text, 0));
  return v_uid;
end;
$$;

-- Recorta y valida el texto de un comentario; devuelve el texto a guardar.
create function privado.limpiar_comentario(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(replace(replace(coalesce(p_texto, ''), E'\r\n', E'\n'), E'\r', E'\n'), E' \n');
begin
  if v = '' then
    raise exception 'Escribe un comentario' using errcode = '22023';
  end if;
  if char_length(v) > 500 then
    raise exception 'El comentario puede tener máximo 500 caracteres' using errcode = '22023';
  end if;
  -- Controles C0 y C1 (salvo salto de línea), espacios de ancho cero y marcas de dirección.
  if v ~ '[\x01-\x09\x0b-\x1f\x7f-\x9f​-‏‪-‮⁠-⁩﻿]' then
    raise exception 'El comentario tiene caracteres no permitidos' using errcode = '22023';
  end if;
  if v ~ '[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+' then
    raise exception 'Los comentarios no pueden llevar correos' using errcode = '22023';
  end if;
  if v ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|mx|io|co|me|ly|app|info|biz|xyz|link|site|online|store|shop|gg|tv|es|us|gl|to|page|dev)\M)' then
    raise exception 'Los comentarios no pueden llevar enlaces' using errcode = '22023';
  end if;
  -- 10 o más dígitos seguidos o separados por espacios, puntos, guiones o paréntesis.
  if v ~ '([0-9][ .()-]{0,2}){10,}' then
    raise exception 'Los comentarios no pueden llevar teléfonos' using errcode = '22023';
  end if;
  return v;
end;
$$;

revoke all on function privado.objetivo_dueno(text, uuid) from public, anon, authenticated;
revoke all on function privado.objetivo_visible(text, uuid) from public, anon, authenticated;
revoke all on function privado.validar_tipo_social(text) from public, anon, authenticated;
revoke all on function privado.usuario_social() from public, anon, authenticated;
revoke all on function privado.limpiar_comentario(text) from public, anon, authenticated;

-- Feed ----------------------------------------------------------------------

create function public.feed_publico(p_limite int default 20, p_antes timestamptz default null)
returns table (
  tipo text,
  id uuid,
  creado_en timestamptz,
  organizacion_id uuid,
  organizacion_nombre text,
  organizacion_slug text,
  organizacion_logo text,
  titulo text,
  texto text,
  medios jsonb,
  extra jsonb,
  me_gusta int,
  comentarios int,
  yo_di_me_gusta boolean
)
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select u.tipo, u.id, u.creado_en, u.organizacion_id
  from (
    select 'publicacion'::text as tipo, p.id, p.creada_en as creado_en, p.organizacion_id
    from public.publicaciones p
    where not p.retirada and privado.org_publica(p.organizacion_id)
    union all
    select 'solicitud', s.id, coalesce(s.publicada_en, s.creada_en), s.organizacion_id
    from public.solicitudes s
    where s.estado = 'publicada' and privado.org_publica(s.organizacion_id)
    union all
    select 'jornada', j.id, j.creada_en, j.organizacion_id
    from public.jornadas j
    where j.inicia_en > now() and privado.org_publica(j.organizacion_id)
  ) u
  where p_antes is null or u.creado_en < p_antes
  order by u.creado_en desc, u.id desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50)
)
select
  b.tipo,
  b.id,
  b.creado_en,
  o.id,
  o.nombre,
  o.slug,
  o.logo_url,
  case b.tipo when 'solicitud' then s.titulo when 'jornada' then j.titulo end,
  case b.tipo when 'publicacion' then p.texto when 'solicitud' then s.descripcion else j.descripcion end,
  case when b.tipo = 'publicacion' then coalesce((
    select jsonb_agg(jsonb_build_object('ruta', m.url, 'tipo', m.tipo) order by m.orden, m.id)
    from public.publicacion_medios m
    where m.publicacion_id = b.id
  ), '[]'::jsonb) else '[]'::jsonb end,
  case b.tipo
    when 'publicacion' then jsonb_build_object('ejemplo', p.es_ejemplo or o.es_ejemplo)
    when 'solicitud' then jsonb_build_object(
      'ejemplo', s.es_ejemplo or o.es_ejemplo,
      'unidades_pagadas', (select coalesce(sum(sa.unidades_pagadas), 0)::int
        from public.solicitud_articulos sa where sa.solicitud_id = b.id),
      'unidades_totales', (select coalesce(sum(sa.cantidad), 0)::int
        from public.solicitud_articulos sa where sa.solicitud_id = b.id),
      'categoria', o.categoria,
      'tienda', case when privado.org_publica(t.id)
        then jsonb_build_object('id', t.id, 'nombre', t.nombre, 'slug', t.slug) end)
    else jsonb_build_object(
      'ejemplo', j.es_ejemplo or o.es_ejemplo,
      'inicia_en', j.inicia_en,
      'termina_en', j.termina_en,
      'ubicacion', j.ubicacion,
      'cupos', j.cupos,
      'cupos_ocupados', (select coalesce(sum(i.asistentes), 0)::int
        from public.inscripciones_jornada i
        where i.jornada_id = b.id and i.estado not in ('rechazada', 'no_asistio')),
      'permite_menores', j.permite_menores)
  end,
  (select count(*)::int from public.me_gusta g
    where g.tipo = b.tipo and g.objetivo_id = b.id),
  (select count(*)::int from public.comentarios c
    where c.tipo = b.tipo and c.objetivo_id = b.id
      and not c.oculto and c.borrado_en is null
      and not exists (select 1 from public.usuarios_bloqueados ub where ub.usuario_id = c.usuario_id)),
  exists (select 1 from public.me_gusta g
    where g.tipo = b.tipo and g.objetivo_id = b.id and g.usuario_id = (select auth.uid()))
from base b
join public.organizaciones o on o.id = b.organizacion_id
left join public.publicaciones p on b.tipo = 'publicacion' and p.id = b.id
left join public.solicitudes s on b.tipo = 'solicitud' and s.id = b.id
left join public.jornadas j on b.tipo = 'jornada' and j.id = b.id
left join public.organizaciones t on t.id = s.tienda_id
order by b.creado_en desc, b.id desc;
$$;

-- Me gusta --------------------------------------------------------------------

create function public.alternar_me_gusta(p_tipo text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  perform privado.validar_tipo_social(p_tipo);
  v_uid := privado.usuario_social();
  if privado.objetivo_visible(p_tipo, p_id) is null then
    raise exception 'Este contenido no está disponible' using errcode = '42501';
  end if;

  delete from privado.eventos_me_gusta
  where usuario_id = v_uid and creado_en < now() - interval '10 minutes';
  if (select count(*) from privado.eventos_me_gusta where usuario_id = v_uid) >= 60 then
    raise exception 'Vas muy rápido; intenta en unos minutos' using errcode = '54000';
  end if;
  insert into privado.eventos_me_gusta (usuario_id) values (v_uid);

  delete from public.me_gusta
  where tipo = p_tipo and objetivo_id = p_id and usuario_id = v_uid;
  if found then
    return false;
  end if;
  insert into public.me_gusta (tipo, objetivo_id, usuario_id)
  values (p_tipo, p_id, v_uid)
  on conflict do nothing;
  return true;
end;
$$;

-- Comentarios -------------------------------------------------------------------

create function public.comentar(p_tipo text, p_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_texto text;
  v_id uuid;
begin
  perform privado.validar_tipo_social(p_tipo);
  v_uid := privado.usuario_social();
  if privado.objetivo_visible(p_tipo, p_id) is null then
    raise exception 'Este contenido no está disponible' using errcode = '42501';
  end if;
  v_texto := privado.limpiar_comentario(p_texto);

  if exists (
    select 1 from public.comentarios
    where usuario_id = v_uid and lower(texto) = lower(v_texto)
      and creado_en > now() - interval '10 minutes'
  ) then
    raise exception 'Ya publicaste ese comentario hace poco' using errcode = '22023';
  end if;
  if (select count(*) from public.comentarios
      where usuario_id = v_uid and creado_en > now() - interval '10 minutes') >= 5 then
    raise exception 'Llegaste al límite de 5 comentarios en 10 minutos' using errcode = '54000';
  end if;
  if (select count(*) from public.comentarios
      where usuario_id = v_uid and creado_en > now() - interval '24 hours') >= 30 then
    raise exception 'Llegaste al límite de 30 comentarios por día' using errcode = '54000';
  end if;

  insert into public.comentarios (tipo, objetivo_id, usuario_id, texto)
  values (p_tipo, p_id, v_uid, v_texto)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.comentarios_de(
  p_tipo text,
  p_id uuid,
  p_limite int default 20,
  p_antes timestamptz default null
)
returns table (
  id uuid,
  autor text,
  es_organizacion boolean,
  texto text,
  creado_en timestamptz,
  es_mio boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case
      when pf.organizacion_id = d.dueno then org.nombre
      when pf.nombre_visible is not null and btrim(pf.nombre_visible) <> ''
        and position('@' in pf.nombre_visible) = 0 then btrim(pf.nombre_visible)
      else 'Vecino ' || upper(substr(md5(c.usuario_id::text), 1, 4))
    end,
    coalesce(pf.organizacion_id = d.dueno, false),
    c.texto,
    c.creado_en,
    coalesce(c.usuario_id = (select auth.uid()), false)
  from (select privado.objetivo_visible(p_tipo, p_id) as dueno) d
  join public.comentarios c on c.tipo = p_tipo and c.objetivo_id = p_id
  join public.organizaciones org on org.id = d.dueno
  left join public.perfiles pf on pf.id = c.usuario_id
  where not c.oculto and c.borrado_en is null
    and not exists (select 1 from public.usuarios_bloqueados ub where ub.usuario_id = c.usuario_id)
    and (p_antes is null or c.creado_en < p_antes)
  order by c.creado_en desc, c.id desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;

create function public.borrar_comentario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.comentarios;
  v_uid uuid := (select auth.uid());
  v_mi_org uuid := privado.mi_organizacion();
  v_rol text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  select * into v_c from public.comentarios where id = p_id for update;
  if not found then
    raise exception 'El comentario no existe' using errcode = 'P0002';
  end if;
  if not (
    v_rol = 'service_role'
    or (v_uid is not null and v_c.usuario_id = v_uid)
    or (v_mi_org is not null and privado.objetivo_dueno(v_c.tipo, v_c.objetivo_id) = v_mi_org)
  ) then
    raise exception 'No puedes borrar este comentario' using errcode = '42501';
  end if;
  if v_c.borrado_en is null then
    update public.comentarios set borrado_en = now(), borrado_por = v_uid where id = p_id;
  end if;
end;
$$;

-- Reportes ----------------------------------------------------------------------

create function public.reportar_comentario(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_c public.comentarios;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  v_uid := privado.usuario_social();
  if char_length(v_motivo) not between 1 and 500 then
    raise exception 'Escribe un motivo de 1 a 500 caracteres' using errcode = '22023';
  end if;
  -- Bloquea el comentario: los reportes simultáneos se cuentan uno tras otro.
  select * into v_c from public.comentarios where id = p_id for update;
  if not found or v_c.borrado_en is not null or v_c.oculto
     or privado.objetivo_visible(v_c.tipo, v_c.objetivo_id) is null then
    raise exception 'El comentario no existe' using errcode = 'P0002';
  end if;
  if v_c.usuario_id = v_uid then
    raise exception 'No puedes reportar tu propio comentario' using errcode = '22023';
  end if;

  insert into public.reportes_comentario (comentario_id, usuario_id, motivo)
  values (p_id, v_uid, v_motivo)
  on conflict do nothing;

  if found and (select count(*) from public.reportes_comentario where comentario_id = p_id) >= 3 then
    update public.comentarios set oculto = true, oculto_en = now() where id = p_id;
  end if;
end;
$$;

-- Privilegios de las funciones -------------------------------------------------------

revoke all on function public.feed_publico(int, timestamptz) from public, anon, authenticated;
revoke all on function public.alternar_me_gusta(text, uuid) from public, anon, authenticated;
revoke all on function public.comentar(text, uuid, text) from public, anon, authenticated;
revoke all on function public.comentarios_de(text, uuid, int, timestamptz) from public, anon, authenticated;
revoke all on function public.borrar_comentario(uuid) from public, anon, authenticated;
revoke all on function public.reportar_comentario(uuid, text) from public, anon, authenticated;

grant execute on function public.feed_publico(int, timestamptz) to anon, authenticated, service_role;
grant execute on function public.comentarios_de(text, uuid, int, timestamptz) to anon, authenticated, service_role;
grant execute on function public.alternar_me_gusta(text, uuid) to authenticated;
grant execute on function public.comentar(text, uuid, text) to authenticated;
grant execute on function public.reportar_comentario(uuid, text) to authenticated;
grant execute on function public.borrar_comentario(uuid) to authenticated, service_role;
