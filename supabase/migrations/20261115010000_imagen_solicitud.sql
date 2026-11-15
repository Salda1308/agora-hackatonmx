-- T25: imagen propia (opcional) en las solicitudes.
--   * solicitudes.imagen_ruta: ruta dentro del bucket privado `publicaciones` (T17), nunca
--     una URL libre. La sube t17-imagen (quita EXIF, valida JPEG) en la carpeta de la
--     organización; aquí solo se enlaza.
--   * Un disparador valida que la ruta sea de la carpeta de la organización dueña y que el
--     objeto exista; vale para publicar_solicitud y para cualquier otro alta.
--   * publicar_solicitud acepta p_imagen. Cambia la firma, así que se reemplaza la función
--     (drop y create) con los mismos permisos: solo authenticated.
--   * feed_publico devuelve la imagen de la solicitud en `medios`, igual que en las
--     publicaciones; misma firma y mismo tipo de retorno.
--   * La imagen se ve si la solicitud es pública, o si es de la propia organización.

alter table public.solicitudes add column imagen_ruta text
  check (imagen_ruta is null or char_length(imagen_ruta) <= 200);

grant insert (imagen_ruta) on public.solicitudes to authenticated;

create function privado.validar_imagen_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.imagen_ruta is null
     or (tg_op = 'UPDATE' and new.imagen_ruta is not distinct from old.imagen_ruta) then
    return new;
  end if;
  if new.imagen_ruta !~ ('^' || new.organizacion_id::text || '/[0-9a-f-]{36}\.jpg$')
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'publicaciones' and o.name = new.imagen_ruta
     ) then
    raise exception 'La imagen no pertenece a tu organización' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function privado.validar_imagen_solicitud() from public, anon, authenticated;

create trigger solicitudes_validar_imagen
  before insert or update of imagen_ruta on public.solicitudes
  for each row execute function privado.validar_imagen_solicitud();

-- Lectura de la imagen: la solicitud debe ser visible para quien la pide (RLS de
-- solicitudes: pública si está publicada o cerrada, o de la propia organización).
create policy "T25 imagen de solicitud visible" on storage.objects for select to anon, authenticated
using (bucket_id = 'publicaciones' and exists (
  select 1 from public.solicitudes s where s.imagen_ruta = storage.objects.name
));

drop function public.publicar_solicitud(uuid, text, jsonb, text);

-- p_articulos: [{"articulo_id": "<uuid>", "cantidad": 3}, ...]
-- p_imagen: ruta devuelta por t17-imagen (`<organizacion>/<uuid>.jpg`) o null.
create function public.publicar_solicitud(
  p_tienda_id uuid,
  p_titulo text,
  p_articulos jsonb,
  p_descripcion text default null,
  p_imagen text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := privado.mi_organizacion();
  v_id uuid;
begin
  if privado.mi_rol() is distinct from 'fundacion' then
    raise exception 'Solo una fundación publica solicitudes' using errcode = '42501';
  end if;
  if not privado.org_verificada(v_org) then
    raise exception 'Tu fundación aún no está verificada' using errcode = '42501';
  end if;
  if p_articulos is null or jsonb_typeof(p_articulos) <> 'array' or jsonb_array_length(p_articulos) = 0 then
    raise exception 'Agrega al menos un artículo' using errcode = '22023';
  end if;

  insert into public.solicitudes (organizacion_id, tienda_id, titulo, descripcion, imagen_ruta)
  values (v_org, p_tienda_id, trim(p_titulo), nullif(trim(p_descripcion), ''), nullif(trim(p_imagen), ''))
  returning id into v_id;

  insert into public.solicitud_articulos (solicitud_id, articulo_id, cantidad)
  select v_id, (e ->> 'articulo_id')::uuid, (e ->> 'cantidad')::integer
  from jsonb_array_elements(p_articulos) as e;

  update public.solicitudes set estado = 'publicada' where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.publicar_solicitud(uuid, text, jsonb, text, text) from public, anon;
grant execute on function public.publicar_solicitud(uuid, text, jsonb, text, text) to authenticated;

-- Feed: igual que en 20261114230000, salvo `medios` de las solicitudes con imagen.
create or replace function public.feed_publico(p_limite int default 20, p_antes timestamptz default null)
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
  case
    when b.tipo = 'publicacion' then coalesce((
      select jsonb_agg(jsonb_build_object('ruta', m.url, 'tipo', m.tipo) order by m.orden, m.id)
      from public.publicacion_medios m
      where m.publicacion_id = b.id
    ), '[]'::jsonb)
    when b.tipo = 'solicitud' and s.imagen_ruta is not null
      then jsonb_build_array(jsonb_build_object('ruta', s.imagen_ruta, 'tipo', 'imagen'))
    else '[]'::jsonb
  end,
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
