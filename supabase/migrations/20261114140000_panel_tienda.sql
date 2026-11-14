-- Panel de la tienda (tarea 08).
-- Solo agrega y endurece; no cambia GRANTs ni políticas de T02.
--   * Al confirmarse un pago (webhook, service_role) se crea su pedido con las
--     unidades pagadas, salvo que la tienda esté suspendida (se anota en el pago).
--   * Un pedido pasa de preparando a listo solo si es de una tienda activa, tiene
--     artículos y sus unidades están pagadas (el check de solicitud_articulos
--     unidades_listas <= unidades_pagadas lo garantiza). Se fija listo_en y se genera
--     el código de recogida que usará el voluntario.
--   * public.marcar_pedido_listo y public.pedidos_de_mi_tienda para el panel.

-- Pedido por pago confirmado ------------------------------------------------

create function privado.crear_pedido_de_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido uuid;
begin
  if exists (select 1 from public.organizaciones where id = new.tienda_id and suspendida) then
    update public.pagos
    set metadata = metadata || jsonb_build_object('pedido_omitido', 'tienda_suspendida')
    where id = new.id;
    return new;
  end if;

  insert into public.pedidos (solicitud_id, tienda_id)
  values (new.solicitud_id, new.tienda_id)
  returning id into v_pedido;

  insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades)
  select v_pedido, solicitud_articulo_id, unidades
  from public.pago_articulos
  where pago_id = new.id;

  return new;
end;
$$;

-- Solo en la transición a pagado: un pago confirmado una vez genera un solo pedido.
create trigger pagos_crear_pedido
  after update of estado on public.pagos
  for each row
  when (new.estado = 'pagado' and old.estado is distinct from 'pagado')
  execute function privado.crear_pedido_de_pago();

-- Marcar listo -----------------------------------------------------------------

-- 6 caracteres sin 0/O, 1/I/L para dictarlo o teclearlo sin errores.
create function privado.nuevo_codigo_recogida()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.pedidos where codigo_recogida = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

create function privado.al_marcar_pedido_listo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = old.estado then
    return new;
  end if;

  if old.estado = 'preparando' and new.estado = 'listo' then
    if exists (select 1 from public.organizaciones where id = new.tienda_id and suspendida) then
      raise exception 'La tienda está suspendida' using errcode = '42501';
    end if;
    if not exists (select 1 from public.pedido_articulos where pedido_id = new.id) then
      raise exception 'El pedido no está pagado' using errcode = '23514';
    end if;

    begin
      update public.solicitud_articulos sa
      set unidades_listas = sa.unidades_listas + pa.unidades
      from public.pedido_articulos pa
      where pa.pedido_id = new.id and pa.solicitud_articulo_id = sa.id;
    exception when check_violation then
      raise exception 'El pedido no está pagado' using errcode = '23514';
    end;

    new.listo_en := now();
    new.codigo_recogida := privado.nuevo_codigo_recogida();
  end if;

  return new;
end;
$$;

create trigger pedidos_al_marcar_listo
  before update of estado on public.pedidos
  for each row execute function privado.al_marcar_pedido_listo();

revoke all on function privado.crear_pedido_de_pago() from public, anon, authenticated;
revoke all on function privado.nuevo_codigo_recogida() from public, anon, authenticated;
revoke all on function privado.al_marcar_pedido_listo() from public, anon, authenticated;

-- RPC del panel ------------------------------------------------------------------

-- Devuelve el código de recogida. Invoker: aplican la política y el GRANT de T02.
create function public.marcar_pedido_listo(p_pedido uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if privado.mi_rol() is distinct from 'tienda' then
    raise exception 'Solo la tienda marca pedidos listos' using errcode = '42501';
  end if;

  update public.pedidos set estado = 'listo'
  where id = p_pedido and estado = 'preparando'
  returning codigo_recogida into v_codigo;

  if v_codigo is null then
    raise exception 'Pedido no encontrado o ya estaba listo' using errcode = 'P0002';
  end if;
  return v_codigo;
end;
$$;

-- Pedidos de la tienda con sus artículos. Definer para leer nombres de artículos y
-- organizaciones que la tienda no ve por RLS; filtra siempre por su organización.
-- El nombre de un colectivo de búsqueda (no público) no se expone.
create function public.pedidos_de_mi_tienda()
returns table (
  id uuid,
  estado public.pedido_estado,
  codigo_recogida text,
  creado_en timestamptz,
  listo_en timestamptz,
  solicitud_titulo text,
  organizacion_nombre text,
  total_centavos bigint,
  articulos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.estado, p.codigo_recogida, p.creado_en, p.listo_en,
    s.titulo,
    case when privado.org_publica(o.id) then o.nombre else 'Organización privada' end,
    coalesce(sum(pa.unidades * sa.precio_centavos), 0)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'nombre', sa.nombre, 'unidades', pa.unidades, 'precio_centavos', sa.precio_centavos
    ) order by sa.nombre) filter (where pa.pedido_id is not null), '[]'::jsonb)
  from public.pedidos p
  join public.solicitudes s on s.id = p.solicitud_id
  join public.organizaciones o on o.id = s.organizacion_id
  left join public.pedido_articulos pa on pa.pedido_id = p.id
  left join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
  where privado.mi_rol() = 'tienda'
    and p.tienda_id = privado.mi_organizacion()
  group by p.id, s.titulo, o.id, o.nombre
  order by (p.estado = 'preparando') desc, p.creado_en desc;
$$;

revoke all on function public.marcar_pedido_listo(uuid) from public, anon;
revoke all on function public.pedidos_de_mi_tienda() from public, anon;
grant execute on function public.marcar_pedido_listo(uuid) to authenticated;
grant execute on function public.pedidos_de_mi_tienda() to authenticated;
