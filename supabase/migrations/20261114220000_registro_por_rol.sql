-- T22: registro por rol con aprobación del equipo y validaciones antifraude.
--   * public.solicitudes_alta: una solicitud por intento; sin acceso directo para anon
--     ni authenticated (RLS activa y sin políticas; solo las funciones la tocan).
--   * public.solicitar_alta: una cuenta con correo confirmado y sin perfil pide ser
--     fundación, tienda o repartidor. Todas las validaciones viven aquí.
--   * public.mi_solicitud_alta: la solicitud más reciente del usuario.
--   * public.aprobar_alta / public.rechazar_alta: solo service_role (el equipo). Aprobar
--     crea organización verificada (fundación y tienda) y perfil en una transacción y
--     deja registro en acciones_moderacion. La tienda aprobada aún no cobra: el equipo
--     crea su tiendas_cobro aparte (ver supabase/MODERACION.md).
--   * public.alta_repartidor deja de ser ejecutable por authenticated.
-- Códigos: 42501 permiso o abuso, 23505 duplicado, 23514 dato inválido,
-- 22023 combinación inválida, P0001 estado (la solicitud ya no está pendiente).

create type public.alta_estado as enum ('pendiente', 'aprobada', 'rechazada');

-- Normalización ---------------------------------------------------------------------

-- Nombre comparable: sin acentos, sin mayúsculas, sin signos ni espacios.
create function privado.normalizar_nombre(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    lower(translate(p, 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
                       'AAAAEEEEIIIIOOOOUUUUNaaaaeeeeiiiioooouuuun')),
    '[^a-z0-9]+', '', 'g');
$$;

-- Teléfono mexicano: 10 dígitos; acepta espacios, guiones, puntos, paréntesis y +52.
create function privado.normalizar_telefono(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p, ''), '[[:space:]().-]', '', 'g');
begin
  if v ~ '^\+?52[0-9]{10}$' then
    v := right(v, 10);
  end if;
  if v !~ '^[0-9]{10}$' then
    raise exception 'El teléfono debe tener 10 dígitos' using errcode = '23514';
  end if;
  return v;
end;
$$;

-- Texto limpio: recortado, null si queda vacío, sin caracteres de control.
create function privado.texto_limpio(p text, p_campo text, p_max integer, p_saltos boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(p, E' \t\r\n');
begin
  if v is null or v = '' then
    return null;
  end if;
  if (p_saltos and v ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]')
     or (not p_saltos and v ~ '[\x01-\x1F\x7F]') then
    raise exception '% tiene caracteres no permitidos', p_campo using errcode = '23514';
  end if;
  if length(v) > p_max then
    raise exception '% admite máximo % caracteres', p_campo, p_max using errcode = '23514';
  end if;
  return v;
end;
$$;

-- Los nombres no llevan direcciones web.
create function privado.tiene_url(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p ~* '(https?:|www\.|[a-z0-9-]\.(com|net|org|mx|io|ly|co|me|info|xyz|app|site|link|gl|cc|to)\M)';
$$;

-- Slug libre derivado del nombre: base, base-2, base-3...
create function privado.slug_libre(p_nombre text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text := btrim(left(btrim(regexp_replace(
    lower(translate(p_nombre, 'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑáàäâéèëêíìïîóòöôúùüûñ',
                              'AAAAEEEEIIIIOOOOUUUUNaaaaeeeeiiiioooouuuun')),
    '[^a-z0-9]+', '-', 'g'), '-'), 60), '-');
  v_slug text;
  v_n integer := 1;
begin
  if v_base = '' then
    v_base := 'organizacion';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.organizaciones where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

revoke all on function privado.normalizar_nombre(text) from public, anon, authenticated;
revoke all on function privado.normalizar_telefono(text) from public, anon, authenticated;
revoke all on function privado.texto_limpio(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function privado.tiene_url(text) from public, anon, authenticated;
revoke all on function privado.slug_libre(text) from public, anon, authenticated;

-- Tabla -----------------------------------------------------------------------------

create table public.solicitudes_alta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol public.usuario_rol not null,
  nombre_contacto text not null check (length(nombre_contacto) between 2 and 120),
  telefono text not null check (telefono ~ '^[0-9]{10}$'),
  ciudad text not null check (length(ciudad) between 2 and 80),
  org_nombre text check (length(org_nombre) between 3 and 120),
  org_categoria public.fundacion_categoria,
  org_descripcion text check (length(org_descripcion) <= 1000),
  rfc text check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  enlace text check (enlace ~ '^https://' and length(enlace) <= 300),
  estado public.alta_estado not null default 'pendiente',
  motivo text check (length(motivo) <= 500),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz,
  resuelta_por text,
  constraint solicitudes_alta_org_check check ((rol = 'repartidor') = (org_nombre is null)),
  constraint solicitudes_alta_categoria_check check ((rol = 'fundacion') = (org_categoria is not null)),
  constraint solicitudes_alta_repartidor_check check (
    rol <> 'repartidor' or (org_descripcion is null and rfc is null and enlace is null)),
  constraint solicitudes_alta_tienda_rfc_check check (rol <> 'tienda' or rfc is not null),
  constraint solicitudes_alta_fundacion_check check (
    rol <> 'fundacion' or (enlace is not null and length(org_descripcion) >= 40)),
  constraint solicitudes_alta_resuelta_check check (
    (estado = 'pendiente') = (resuelta_en is null)
    and (estado = 'pendiente') = (resuelta_por is null)
    and (estado <> 'rechazada' or motivo is not null))
);

comment on table public.solicitudes_alta is
  'Solicitudes de alta por rol. Solo las escriben solicitar_alta (usuario) y aprobar_alta/rechazar_alta (service_role).';

create unique index solicitudes_alta_una_pendiente
  on public.solicitudes_alta (usuario_id) where estado = 'pendiente';
create unique index solicitudes_alta_telefono_unico
  on public.solicitudes_alta (telefono) where estado in ('pendiente', 'aprobada');
create unique index solicitudes_alta_rfc_unico
  on public.solicitudes_alta (rfc) where rfc is not null and estado in ('pendiente', 'aprobada');
create unique index solicitudes_alta_org_pendiente_unica
  on public.solicitudes_alta (privado.normalizar_nombre(org_nombre))
  where org_nombre is not null and estado = 'pendiente';
create index solicitudes_alta_usuario_idx on public.solicitudes_alta (usuario_id, creada_en desc);
create index solicitudes_alta_pendientes_idx on public.solicitudes_alta (creada_en) where estado = 'pendiente';

alter table public.solicitudes_alta enable row level security;
revoke all on public.solicitudes_alta from public, anon, authenticated;
grant select, insert, update, delete on public.solicitudes_alta to service_role;

-- Solicitar -------------------------------------------------------------------------

create function public.solicitar_alta(
  p_rol text,
  p_nombre_contacto text,
  p_telefono text,
  p_ciudad text,
  p_org_nombre text default null,
  p_org_categoria text default null,
  p_org_descripcion text default null,
  p_rfc text default null,
  p_enlace text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_correo text;
  v_confirmado boolean;
  v_rol public.usuario_rol;
  v_contacto text;
  v_telefono text;
  v_ciudad text;
  v_org text;
  v_categoria public.fundacion_categoria;
  v_descripcion text;
  v_rfc text;
  v_enlace text;
  v_host text;
  v_id uuid;
  v_restriccion text;
begin
  -- Cuenta ---------------------------------------------------------------------------
  if v_yo is null then
    raise exception 'Inicia sesión primero' using errcode = '42501';
  end if;
  select lower(email), email_confirmed_at is not null into v_correo, v_confirmado
    from auth.users where id = v_yo;
  if not coalesce(v_confirmado, false) then
    raise exception 'Confirma tu correo primero' using errcode = '42501';
  end if;
  if v_correo like '%@demo.agora.test' then
    raise exception 'Las cuentas demo no pueden solicitar alta' using errcode = '42501';
  end if;
  if split_part(v_correo, '@', 2) in (
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com',
    'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'maildrop.cc',
    'dispostable.com', 'throwawaymail.com', 'fakeinbox.com', 'mailnesia.com', 'moakt.com',
    'tempmail.net', 'emailondeck.com', 'mintemail.com', 'mohmal.com') then
    raise exception 'Usa un correo permanente, no uno desechable' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfiles where id = v_yo) then
    raise exception 'Tu cuenta ya tiene un perfil' using errcode = '42501';
  end if;

  -- Una solicitud a la vez por usuario (también ordena los contadores de abajo).
  perform pg_advisory_xact_lock(hashtextextended('solicitar_alta:' || v_yo::text, 0));

  if (select count(*) from public.solicitudes_alta
      where usuario_id = v_yo and estado = 'rechazada') >= 3 then
    raise exception 'Alcanzaste el máximo de solicitudes rechazadas. Escribe al equipo.' using errcode = '42501';
  end if;
  if (select count(*) from public.solicitudes_alta
      where usuario_id = v_yo and creada_en > now() - interval '24 hours') >= 3 then
    raise exception 'Demasiados envíos. Intenta de nuevo mañana.' using errcode = '42501';
  end if;
  if exists (select 1 from public.solicitudes_alta where usuario_id = v_yo and estado = 'pendiente') then
    raise exception 'Ya tienes una solicitud en revisión' using errcode = '23505';
  end if;

  -- Rol y combinación de campos --------------------------------------------------------
  if p_rol is null or p_rol not in ('fundacion', 'tienda', 'repartidor') then
    raise exception 'Elige fundación, tienda o repartidor' using errcode = '22023';
  end if;
  v_rol := p_rol::public.usuario_rol;

  v_contacto := privado.texto_limpio(p_nombre_contacto, 'El nombre de contacto', 120);
  v_ciudad := privado.texto_limpio(p_ciudad, 'La ciudad', 80);
  v_org := privado.texto_limpio(p_org_nombre, 'El nombre de la organización', 120);
  v_descripcion := privado.texto_limpio(p_org_descripcion, 'La descripción', 1000, true);
  v_rfc := nullif(upper(regexp_replace(coalesce(p_rfc, ''), '[[:space:]-]', '', 'g')), '');
  v_enlace := privado.texto_limpio(p_enlace, 'El enlace', 300);

  if v_rol = 'repartidor' and (v_org is not null or nullif(btrim(p_org_categoria), '') is not null
     or v_descripcion is not null or v_rfc is not null or v_enlace is not null) then
    raise exception 'El repartidor no lleva datos de organización' using errcode = '22023';
  end if;
  if v_rol = 'tienda' and nullif(btrim(p_org_categoria), '') is not null then
    raise exception 'La categoría solo aplica a fundaciones' using errcode = '22023';
  end if;

  -- Datos comunes -------------------------------------------------------------------
  if v_contacto is null or length(v_contacto) < 2 then
    raise exception 'Escribe el nombre de contacto' using errcode = '23514';
  end if;
  if privado.tiene_url(v_contacto) then
    raise exception 'El nombre no puede llevar direcciones web' using errcode = '23514';
  end if;
  v_telefono := privado.normalizar_telefono(p_telefono);
  if v_ciudad is null or length(v_ciudad) < 2 then
    raise exception 'Escribe la ciudad' using errcode = '23514';
  end if;

  -- Organización (fundación y tienda) --------------------------------------------------
  if v_rol in ('fundacion', 'tienda') then
    if v_org is null or length(v_org) < 3 or length(privado.normalizar_nombre(v_org)) < 2 then
      raise exception 'Escribe el nombre de la organización' using errcode = '23514';
    end if;
    if privado.tiene_url(v_org) then
      raise exception 'El nombre no puede llevar direcciones web' using errcode = '23514';
    end if;
    if exists (select 1 from public.organizaciones
               where privado.normalizar_nombre(nombre) = privado.normalizar_nombre(v_org))
       or exists (select 1 from public.solicitudes_alta
                  where estado = 'pendiente' and org_nombre is not null
                    and privado.normalizar_nombre(org_nombre) = privado.normalizar_nombre(v_org)) then
      raise exception 'Ya existe una organización con ese nombre' using errcode = '23505';
    end if;
  end if;

  if v_rol = 'fundacion' then
    if nullif(btrim(p_org_categoria), '') is null
       or btrim(p_org_categoria) not in ('albergue', 'asilo', 'refugio_animales', 'colectivo_busqueda') then
      raise exception 'Elige una categoría válida' using errcode = '23514';
    end if;
    v_categoria := btrim(p_org_categoria)::public.fundacion_categoria;
    if v_descripcion is null or length(v_descripcion) < 40 then
      raise exception 'La descripción necesita al menos 40 caracteres' using errcode = '23514';
    end if;
    if v_enlace is null then
      raise exception 'Agrega un enlace verificable (sitio o red social)' using errcode = '23514';
    end if;
  end if;

  if v_rol = 'tienda' and v_rfc is null then
    raise exception 'El RFC es obligatorio para tiendas' using errcode = '23514';
  end if;

  if v_rfc is not null then
    if v_rfc !~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' then
      raise exception 'El RFC no tiene un formato válido' using errcode = '23514';
    end if;
    if exists (select 1 from public.tiendas_cobro where rfc = v_rfc)
       or exists (select 1 from public.solicitudes_alta
                  where rfc = v_rfc and estado in ('pendiente', 'aprobada')) then
      raise exception 'Ese RFC ya está registrado' using errcode = '23505';
    end if;
  end if;

  if v_enlace is not null then
    if v_enlace !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$' then
      raise exception 'El enlace debe empezar con https:// y ser una dirección válida' using errcode = '23514';
    end if;
    v_host := regexp_replace(lower(substring(v_enlace from '^https://([^/?#:]+)')), '^www\.', '');
    if v_host in ('bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
                  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 's.id', 't.ly', 'lnkd.in') then
      raise exception 'Usa el enlace completo, sin acortadores' using errcode = '23514';
    end if;
  end if;

  -- Un teléfono, una cuenta.
  if exists (select 1 from public.solicitudes_alta
             where telefono = v_telefono and estado in ('pendiente', 'aprobada')) then
    raise exception 'Ese teléfono ya está registrado' using errcode = '23505';
  end if;

  begin
    insert into public.solicitudes_alta (usuario_id, rol, nombre_contacto, telefono, ciudad, org_nombre,
      org_categoria, org_descripcion, rfc, enlace, creada_en)
    values (v_yo, v_rol, v_contacto, v_telefono, v_ciudad, v_org, v_categoria, v_descripcion, v_rfc, v_enlace,
            clock_timestamp())
    returning id into v_id;
  exception when unique_violation then
    -- Carrera entre dos cuentas: los índices únicos son la última defensa.
    get stacked diagnostics v_restriccion = constraint_name;
    raise exception '%', case v_restriccion
      when 'solicitudes_alta_telefono_unico' then 'Ese teléfono ya está registrado'
      when 'solicitudes_alta_rfc_unico' then 'Ese RFC ya está registrado'
      when 'solicitudes_alta_org_pendiente_unica' then 'Ya existe una organización con ese nombre'
      else 'Ya tienes una solicitud en revisión' end
      using errcode = '23505';
  end;

  return v_id;
end;
$$;

create function public.mi_solicitud_alta()
returns table (
  id uuid,
  rol text,
  estado text,
  motivo text,
  org_nombre text,
  creada_en timestamptz,
  resuelta_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.rol::text, s.estado::text, s.motivo, s.org_nombre, s.creada_en, s.resuelta_en
  from public.solicitudes_alta s
  where s.usuario_id = (select auth.uid())
  order by s.creada_en desc, s.id
  limit 1;
$$;

-- Resolver (solo el equipo) -----------------------------------------------------------

create function public.aprobar_alta(p_id uuid, p_moderador text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.solicitudes_alta;
  v_moderador text := btrim(p_moderador);
  v_org uuid;
begin
  if v_moderador is null or v_moderador = '' then
    raise exception 'Indica quién modera' using errcode = '23514';
  end if;
  select * into v_s from public.solicitudes_alta where id = p_id for update;
  if v_s.id is null or v_s.estado <> 'pendiente' then
    raise exception 'La solicitud no está pendiente' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles where id = v_s.usuario_id) then
    raise exception 'La cuenta ya tiene un perfil' using errcode = 'P0001';
  end if;

  if v_s.rol in ('fundacion', 'tienda') then
    if exists (select 1 from public.organizaciones
               where privado.normalizar_nombre(nombre) = privado.normalizar_nombre(v_s.org_nombre)) then
      raise exception 'Ya existe una organización con ese nombre' using errcode = '23505';
    end if;
    if v_s.rfc is not null and exists (select 1 from public.tiendas_cobro where rfc = v_s.rfc) then
      raise exception 'Ese RFC ya está registrado' using errcode = '23505';
    end if;
    insert into public.organizaciones (tipo, categoria, nombre, slug, descripcion, verificada, verificada_en)
    values (v_s.rol::text::public.organizacion_tipo, v_s.org_categoria, v_s.org_nombre,
            privado.slug_libre(v_s.org_nombre), v_s.org_descripcion, true, now())
    returning id into v_org;
    insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
    values (v_moderador, 'verificar_organizacion', 'organizaciones', v_org, 'Alta aprobada ' || p_id::text);
  end if;

  insert into public.perfiles (id, rol, organizacion_id, nombre_visible)
  values (v_s.usuario_id, v_s.rol, v_org, v_s.nombre_contacto);

  update public.solicitudes_alta
    set estado = 'aprobada', resuelta_en = now(), resuelta_por = v_moderador
    where id = p_id;

  insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id)
  values (v_moderador, 'aprobar_alta', 'solicitudes_alta', p_id);
end;
$$;

create function public.rechazar_alta(p_id uuid, p_motivo text, p_moderador text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderador text := btrim(p_moderador);
  v_motivo text := btrim(p_motivo);
begin
  if v_moderador is null or v_moderador = '' then
    raise exception 'Indica quién modera' using errcode = '23514';
  end if;
  if v_motivo is null or length(v_motivo) not between 5 and 500 then
    raise exception 'Escribe un motivo de 5 a 500 caracteres' using errcode = '23514';
  end if;
  update public.solicitudes_alta
    set estado = 'rechazada', motivo = v_motivo, resuelta_en = now(), resuelta_por = v_moderador
    where id = p_id and estado = 'pendiente';
  if not found then
    raise exception 'La solicitud no está pendiente' using errcode = 'P0001';
  end if;
  insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
  values (v_moderador, 'rechazar_alta', 'solicitudes_alta', p_id, v_motivo);
end;
$$;

revoke all on function public.solicitar_alta(text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.mi_solicitud_alta() from public, anon, authenticated;
revoke all on function public.aprobar_alta(uuid, text) from public, anon, authenticated;
revoke all on function public.rechazar_alta(uuid, text, text) from public, anon, authenticated;
grant execute on function public.solicitar_alta(text, text, text, text, text, text, text, text, text)
  to authenticated;
grant execute on function public.mi_solicitud_alta() to authenticated;
grant execute on function public.aprobar_alta(uuid, text) to service_role;
grant execute on function public.rechazar_alta(uuid, text, text) to service_role;

-- El repartidor entra solo por solicitud aprobada ----------------------------------------

revoke execute on function public.alta_repartidor(text) from authenticated;
