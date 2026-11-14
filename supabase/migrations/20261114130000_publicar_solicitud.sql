-- Publicar una solicitud (tarea 06).
-- Solo agrega y endurece; no cambia GRANTs ni políticas de T02.
--   * public.publicar_solicitud: crea el borrador, sus artículos y lo publica en una
--     sola transacción, como la fundación (security invoker: aplican RLS y GRANTs).
--   * Al pasar de borrador a publicada: exige artículos y tienda verificada, vuelve a
--     copiar nombre y precio del catálogo (queda el precio del momento de publicar) y
--     fija publicada_en.
--   * Una solicitud que dejó de ser borrador no vuelve a borrador (sus artículos
--     quedarían editables después de recibir pagos).

create function privado.al_cambiar_estado_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fuera integer;
begin
  if tg_op = 'UPDATE' and old.estado <> 'borrador' and new.estado = 'borrador' then
    raise exception 'Una solicitud publicada no vuelve a borrador' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.estado = 'publicada' and old.estado = 'borrador' then
    if not exists (
      select 1 from public.organizaciones
      where id = new.tienda_id and tipo = 'tienda' and verificada and not suspendida
    ) then
      raise exception 'La tienda no está verificada' using errcode = '23514';
    end if;

    if not exists (select 1 from public.solicitud_articulos where solicitud_id = new.id) then
      raise exception 'La solicitud necesita al menos un artículo' using errcode = '23514';
    end if;

    select count(*) into v_fuera
    from public.solicitud_articulos sa
    join public.catalogo_articulos c on c.id = sa.articulo_id
    where sa.solicitud_id = new.id
      and (
        not c.activo
        or c.tienda_id <> new.tienda_id
        or current_date < c.vigente_desde
        or (c.vigente_hasta is not null and current_date > c.vigente_hasta)
      );
    if v_fuera > 0 then
      raise exception 'Hay artículos que ya no están en el catálogo de la tienda' using errcode = '23514';
    end if;

    -- Precio congelado al publicar.
    update public.solicitud_articulos sa
    set nombre = c.nombre, precio_centavos = c.precio_centavos
    from public.catalogo_articulos c
    where c.id = sa.articulo_id and sa.solicitud_id = new.id;

    new.publicada_en := now();
  elsif new.estado = 'publicada' and new.publicada_en is null then
    -- Altas directas ya publicadas (datos de ejemplo, backend).
    new.publicada_en := now();
  end if;

  return new;
end;
$$;

create trigger solicitudes_al_cambiar_estado
  before insert or update of estado on public.solicitudes
  for each row execute function privado.al_cambiar_estado_solicitud();

-- p_articulos: [{"articulo_id": "<uuid>", "cantidad": 3}, ...]
create function public.publicar_solicitud(
  p_tienda_id uuid,
  p_titulo text,
  p_articulos jsonb,
  p_descripcion text default null
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

  insert into public.solicitudes (organizacion_id, tienda_id, titulo, descripcion)
  values (v_org, p_tienda_id, trim(p_titulo), nullif(trim(p_descripcion), ''))
  returning id into v_id;

  insert into public.solicitud_articulos (solicitud_id, articulo_id, cantidad)
  select v_id, (e ->> 'articulo_id')::uuid, (e ->> 'cantidad')::integer
  from jsonb_array_elements(p_articulos) as e;

  update public.solicitudes set estado = 'publicada' where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.publicar_solicitud(uuid, text, jsonb, text) from public, anon;
grant execute on function public.publicar_solicitud(uuid, text, jsonb, text) to authenticated;
