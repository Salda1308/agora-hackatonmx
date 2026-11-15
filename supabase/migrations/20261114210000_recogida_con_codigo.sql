-- Recogida con código verificado por la tienda (T21, hallazgo A3 de T13).
-- Antes el repartidor marcaba "recogido" sin pasar por la tienda (marcar_recogida no
-- pedía el código). Ahora:
--   * El repartidor asignado ve el código en public.mi_tarea (sin cambios) y lo muestra.
--   * public.confirmar_recogida: solo la tienda dueña del pedido lo teclea; el servidor
--     compara con pedidos.codigo_recogida. Con el correcto: pedido recogido y tarea
--     recogida. Cada código incorrecto cuenta; con 5 se bloquea (lo destraba el equipo
--     con service_role). Los pasos quedan en eventos_tarea (codigo_incorrecto,
--     bloqueada y recogida, con actor_rol tienda).
--   * Se elimina public.marcar_recogida: el repartidor ya no recoge por sí mismo.
--   * Nadie con sesión lee pedidos.codigo_recogida directo (ni la tienda ni la
--     fundación): si la tienda lo viera en su panel, teclearlo no probaría que el
--     repartidor asignado está presente. Por eso marcar_pedido_listo ya no lo devuelve
--     y pedidos_de_mi_tienda lo cambia por el estado de la recogida.

-- Intentos de la recogida (privado: ningún cliente lee esta tabla) -------------------

create table privado.intentos_recogida (
  tarea_id uuid primary key references public.tareas (id) on delete cascade,
  intentos_fallidos smallint not null default 0,
  bloqueada_en timestamptz
);

alter table privado.intentos_recogida enable row level security;
revoke all on privado.intentos_recogida from public, anon, authenticated;

-- El repartidor ya no marca la recogida ----------------------------------------------

drop function public.marcar_recogida(uuid);

-- El código de recogida solo sale por mi_tarea ----------------------------------------

revoke select on public.pedidos from authenticated;
grant select (id, solicitud_id, tienda_id, estado, listo_en, creado_en, pago_id)
  on public.pedidos to authenticated;

drop function public.marcar_pedido_listo(uuid);

-- Invoker: aplican la política y el GRANT de T02. Ya no devuelve el código.
create function public.marcar_pedido_listo(p_pedido uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if privado.mi_rol() is distinct from 'tienda' then
    raise exception 'Solo la tienda marca pedidos listos' using errcode = '42501';
  end if;

  update public.pedidos set estado = 'listo'
  where id = p_pedido and estado = 'preparando';

  if not found then
    raise exception 'Pedido no encontrado o ya estaba listo' using errcode = 'P0002';
  end if;
end;
$$;

drop function public.pedidos_de_mi_tienda();

-- Pedidos de la tienda con sus artículos y el estado de su recogida (sin el código).
-- Definer para leer nombres de artículos y organizaciones que la tienda no ve por RLS;
-- filtra siempre por su organización. El nombre de un colectivo de búsqueda (no
-- público) no se expone.
create function public.pedidos_de_mi_tienda()
returns table (
  id uuid,
  estado public.pedido_estado,
  creado_en timestamptz,
  listo_en timestamptz,
  solicitud_titulo text,
  organizacion_nombre text,
  total_centavos bigint,
  articulos jsonb,
  tarea_id uuid,
  tarea_estado public.tarea_estado,
  intentos_restantes integer,
  bloqueada boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.estado, p.creado_en, p.listo_en,
    s.titulo,
    case when privado.org_publica(o.id) then o.nombre else 'Organización privada' end,
    privado.total_pedido(p.id),
    coalesce((select jsonb_agg(jsonb_build_object(
        'nombre', sa.nombre, 'unidades', pa.unidades, 'precio_centavos', sa.precio_centavos
      ) order by sa.nombre)
      from public.pedido_articulos pa
      join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
      where pa.pedido_id = p.id), '[]'::jsonb),
    t.id, t.estado,
    greatest(0, 5 - coalesce(i.intentos_fallidos, 0))::int,
    i.bloqueada_en is not null
  from public.pedidos p
  join public.solicitudes s on s.id = p.solicitud_id
  join public.organizaciones o on o.id = s.organizacion_id
  left join public.tareas t on t.pedido_id = p.id
  left join privado.intentos_recogida i on i.tarea_id = t.id
  where privado.mi_rol() = 'tienda'
    and p.tienda_id = privado.mi_organizacion()
  order by (p.estado = 'preparando') desc, p.creado_en desc;
$$;

-- RPC de la tienda: confirmar la recogida ---------------------------------------------

-- La tienda teclea el código que le muestra el repartidor. No lanza error ante un
-- código incorrecto para que el intento quede contado.
-- resultado: confirmada | incorrecto | bloqueada.
create function public.confirmar_recogida(p_tarea uuid, p_codigo text)
returns table (resultado text, intentos_restantes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarea public.tareas;
  v_pedido public.pedidos;
  v_intentos privado.intentos_recogida;
begin
  if privado.mi_rol() is distinct from 'tienda' then
    raise exception 'Solo la tienda del pedido confirma la recogida' using errcode = '42501';
  end if;

  -- Bloquear la tarea serializa los intentos sobre la misma recogida.
  select t.* into v_tarea from public.tareas t
  join public.pedidos p on p.id = t.pedido_id
  where t.id = p_tarea and p.tienda_id = privado.mi_organizacion()
  for update of t;

  select * into v_pedido from public.pedidos where id = v_tarea.pedido_id for update;
  if v_tarea.id is null or v_tarea.estado <> 'asignada' or v_pedido.estado <> 'listo'
     or v_pedido.codigo_recogida is null then
    raise exception 'No hay una recogida por confirmar' using errcode = 'P0002';
  end if;

  select * into v_intentos from privado.intentos_recogida where tarea_id = p_tarea;
  if v_intentos.bloqueada_en is not null then
    return query select 'bloqueada'::text, 0;
    return;
  end if;

  if upper(btrim(coalesce(p_codigo, ''))) <> v_pedido.codigo_recogida then
    insert into privado.intentos_recogida as i (tarea_id, intentos_fallidos)
    values (p_tarea, 1)
    on conflict (tarea_id) do update
      set intentos_fallidos = i.intentos_fallidos + 1
    returning * into v_intentos;
    if v_intentos.intentos_fallidos >= 5 then
      update privado.intentos_recogida set bloqueada_en = now()
      where tarea_id = p_tarea
      returning * into v_intentos;
    end if;
    perform privado.registrar_evento(p_tarea, 'codigo_incorrecto');
    if v_intentos.bloqueada_en is not null then
      perform privado.registrar_evento(p_tarea, 'bloqueada');
      return query select 'bloqueada'::text, 0;
    else
      return query select 'incorrecto'::text, (5 - v_intentos.intentos_fallidos)::int;
    end if;
    return;
  end if;

  update public.pedidos set estado = 'recogido' where id = v_pedido.id;
  -- El disparador registra el evento "recogida".
  update public.tareas set estado = 'recogida' where id = p_tarea;

  return query select 'confirmada'::text, null::int;
end;
$$;

revoke all on function public.marcar_pedido_listo(uuid) from public, anon;
revoke all on function public.pedidos_de_mi_tienda() from public, anon;
revoke all on function public.confirmar_recogida(uuid, text) from public, anon;
grant execute on function public.marcar_pedido_listo(uuid) to authenticated;
grant execute on function public.pedidos_de_mi_tienda() to authenticated;
grant execute on function public.confirmar_recogida(uuid, text) to authenticated;
