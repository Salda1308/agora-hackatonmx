-- Tareas del repartidor (tarea 09). Autorizada por el usuario en el chat de T09.
-- Corrige el bloqueo de R1: tomar una tarea con UPDATE directo daba 42501 porque la
-- fila nueva no pasa la política SELECT (tarea_visible_para_mi lee la fila vieja).
-- En vez de relajar políticas, la única vía de escritura es una función atómica.
--   * Al marcar un pedido listo se crea su tarea abierta (si no tiene una).
--   * public.tomar_tarea: atómica (FOR UPDATE); una tarea, un repartidor; un
--     repartidor, una tarea activa (además lo garantiza un índice único).
--   * public.liberar_tarea: el asignado la devuelve mientras siga asignada.
--   * public.tareas_disponibles / public.mi_tarea / public.mi_nivel_repartidor.
--     El código de recogida solo lo devuelve mi_tarea, al repartidor asignado.
--   * public.alta_repartidor: alta propia con verificación básica (correo confirmado).
--   * Regla de voluntario nuevo: con menos de 3 tareas entregadas solo ve y toma
--     pedidos de hasta $500.00 (50000 centavos). Ver privado.limite_repartidor.
--   * Endurece: se quita la política UPDATE y el GRANT update de tareas para
--     authenticated. Estados que deja listos para la tarea 10: asignada -> recogida
--     -> entregada (la entrega con foto y doble confirmación no está aquí).

-- Un repartidor, una tarea activa ---------------------------------------------------

create unique index tareas_una_activa_por_repartidor
  on public.tareas (repartidor_id)
  where estado in ('asignada', 'recogida');

-- Regla de voluntario nuevo ---------------------------------------------------------

-- Límite en centavos para el repartidor; null = sin límite.
create function privado.limite_repartidor(p_usuario uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select count(*) from public.tareas
          where repartidor_id = p_usuario and estado = 'entregada') < 3
      then 50000::bigint
  end;
$$;

create function privado.total_pedido(p_pedido uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(pa.unidades * sa.precio_centavos), 0)::bigint
  from public.pedido_articulos pa
  join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
  where pa.pedido_id = p_pedido;
$$;

-- Tarea al marcar listo ---------------------------------------------------------

create function privado.crear_tarea_de_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tareas (pedido_id)
  select new.id
  where not exists (select 1 from public.tareas where pedido_id = new.id);
  return new;
end;
$$;

create trigger pedidos_crear_tarea
  after update of estado on public.pedidos
  for each row
  when (old.estado = 'preparando' and new.estado = 'listo')
  execute function privado.crear_tarea_de_pedido();

revoke all on function privado.limite_repartidor(uuid) from public, anon, authenticated;
revoke all on function privado.total_pedido(uuid) from public, anon, authenticated;
revoke all on function privado.crear_tarea_de_pedido() from public, anon, authenticated;

-- Endurecer: solo las funciones escriben tareas -------------------------------------

drop policy "tareas: el repartidor toma una abierta" on public.tareas;
revoke update (repartidor_id, estado) on public.tareas from authenticated;
revoke update on public.tareas from authenticated;

-- RPC del repartidor ------------------------------------------------------------

create function public.tomar_tarea(p_tarea uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_tarea public.tareas;
  v_limite bigint;
begin
  if v_yo is null or privado.mi_rol() is distinct from 'repartidor' then
    raise exception 'Solo los repartidores toman tareas' using errcode = '42501';
  end if;

  -- Serializa por repartidor (dos tareas distintas a la vez) y por tarea.
  perform 1 from public.perfiles where id = v_yo for update;
  select * into v_tarea from public.tareas where id = p_tarea for update;

  if v_tarea.id is null or v_tarea.estado <> 'abierta' or v_tarea.repartidor_id is not null
     or v_tarea.modalidad <> 'repartidor'
     or not exists (select 1 from public.pedidos where id = v_tarea.pedido_id and estado = 'listo') then
    raise exception 'La tarea ya no está disponible' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.tareas
             where repartidor_id = v_yo and estado in ('asignada', 'recogida')) then
    raise exception 'Ya tienes una tarea activa' using errcode = 'P0001';
  end if;

  v_limite := privado.limite_repartidor(v_yo);
  if v_limite is not null and privado.total_pedido(v_tarea.pedido_id) > v_limite then
    raise exception 'Como voluntario nuevo solo tomas pedidos de bajo valor' using errcode = '42501';
  end if;

  update public.tareas set repartidor_id = v_yo, estado = 'asignada' where id = p_tarea;
  return p_tarea;
end;
$$;

create function public.liberar_tarea(p_tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tareas set repartidor_id = null, estado = 'abierta'
  where id = p_tarea and repartidor_id = (select auth.uid()) and estado = 'asignada';
  if not found then
    raise exception 'No tienes esa tarea o ya la recogiste' using errcode = 'P0002';
  end if;
end;
$$;

-- Tareas abiertas que el repartidor puede tomar (ya filtradas por la regla). Sin código.
create function public.tareas_disponibles()
returns table (
  id uuid,
  creada_en timestamptz,
  tienda_nombre text,
  tienda_direccion text,
  destino_nombre text,
  total_centavos bigint,
  articulos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.creada_en,
    ti.nombre, ti.direccion_publica,
    case when privado.org_publica(o.id) then o.nombre else 'Organización privada' end,
    privado.total_pedido(p.id),
    coalesce((select jsonb_agg(jsonb_build_object('nombre', sa.nombre, 'unidades', pa.unidades) order by sa.nombre)
      from public.pedido_articulos pa
      join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
      where pa.pedido_id = p.id), '[]'::jsonb)
  from public.tareas t
  join public.pedidos p on p.id = t.pedido_id
  join public.organizaciones ti on ti.id = p.tienda_id
  join public.solicitudes s on s.id = p.solicitud_id
  join public.organizaciones o on o.id = s.organizacion_id
  where privado.mi_rol() = 'repartidor'
    and t.estado = 'abierta' and t.repartidor_id is null and t.modalidad = 'repartidor'
    and p.estado = 'listo'
    and (privado.limite_repartidor((select auth.uid())) is null
         or privado.total_pedido(p.id) <= privado.limite_repartidor((select auth.uid())))
  order by t.creada_en;
$$;

-- La tarea activa del repartidor con punto de recogida y código. Solo la suya.
create function public.mi_tarea()
returns table (
  id uuid,
  estado public.tarea_estado,
  tienda_nombre text,
  tienda_direccion text,
  tienda_latitud double precision,
  tienda_longitud double precision,
  codigo_recogida text,
  destino_nombre text,
  total_centavos bigint,
  articulos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id, t.estado,
    ti.nombre, ti.direccion_publica, ti.latitud, ti.longitud,
    p.codigo_recogida,
    case when privado.org_publica(o.id) then o.nombre else 'Organización privada' end,
    privado.total_pedido(p.id),
    coalesce((select jsonb_agg(jsonb_build_object('nombre', sa.nombre, 'unidades', pa.unidades) order by sa.nombre)
      from public.pedido_articulos pa
      join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
      where pa.pedido_id = p.id), '[]'::jsonb)
  from public.tareas t
  join public.pedidos p on p.id = t.pedido_id
  join public.organizaciones ti on ti.id = p.tienda_id
  join public.solicitudes s on s.id = p.solicitud_id
  join public.organizaciones o on o.id = s.organizacion_id
  where privado.mi_rol() = 'repartidor'
    and t.repartidor_id = (select auth.uid())
    and t.estado in ('asignada', 'recogida');
$$;

create function public.mi_nivel_repartidor()
returns table (entregas integer, limite_centavos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.tareas
     where repartidor_id = (select auth.uid()) and estado = 'entregada'),
    privado.limite_repartidor((select auth.uid()))
  where privado.mi_rol() = 'repartidor';
$$;

-- Alta propia: cuenta autenticada, sin perfil y con correo confirmado.
create function public.alta_repartidor(p_nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_nombre text := btrim(coalesce(p_nombre, ''));
begin
  if v_yo is null then
    raise exception 'Inicia sesión primero' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = v_yo and email_confirmed_at is not null) then
    raise exception 'Confirma tu correo primero' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfiles where id = v_yo) then
    raise exception 'Tu cuenta ya tiene un perfil' using errcode = '23505';
  end if;
  if length(v_nombre) not between 2 and 120 then
    raise exception 'Escribe tu nombre' using errcode = '23514';
  end if;
  insert into public.perfiles (id, rol, nombre_visible) values (v_yo, 'repartidor', v_nombre);
end;
$$;

revoke all on function public.tomar_tarea(uuid) from public, anon;
revoke all on function public.liberar_tarea(uuid) from public, anon;
revoke all on function public.tareas_disponibles() from public, anon;
revoke all on function public.mi_tarea() from public, anon;
revoke all on function public.mi_nivel_repartidor() from public, anon;
revoke all on function public.alta_repartidor(text) from public, anon;
grant execute on function public.tomar_tarea(uuid) to authenticated;
grant execute on function public.liberar_tarea(uuid) to authenticated;
grant execute on function public.tareas_disponibles() to authenticated;
grant execute on function public.mi_tarea() to authenticated;
grant execute on function public.mi_nivel_repartidor() to authenticated;
grant execute on function public.alta_repartidor(text) to authenticated;
