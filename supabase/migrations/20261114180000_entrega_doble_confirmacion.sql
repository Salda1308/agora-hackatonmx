-- Entrega con foto y doble confirmación (tarea 10).
-- Sigue a T09 (asignada -> recogida -> entregada). Solo funciones escriben:
--   * public.marcar_recogida: el repartidor asignado recoge (tarea recogida, pedido recogido).
--   * public.registrar_entrega: el repartidor sube la foto (bucket privado "entregas") y
--     marca entregado. Se genera el código de entrega, que solo ve él (public.mi_entrega)
--     y que muestra a quien recibe.
--   * public.confirmar_entrega: la fundación receptora teclea el código. Solo con el código
--     correcto se cierra: entregas.confirmada_en, tarea entregada, pedido entregado y
--     unidades_entregadas de la solicitud. Cada código incorrecto cuenta; con 5 se bloquea
--     (lo destraba el equipo con service_role).
--   * public.eventos_tarea: registro de cada paso (creada, tomada, liberada, recogida,
--     foto_subida, entrega_marcada, codigo_incorrecto, bloqueada, confirmada).
--   * Endurece: se quita la política UPDATE y el GRANT update de entregas para
--     authenticated (antes el repartidor podía fijar entregada_en directo).
-- La foto: JPEG, máximo 3 MB, bucket privado; la ve el repartidor de la tarea y la
-- fundación receptora. La web la recodifica en el navegador (sin EXIF ni ubicación).

-- Registro de eventos --------------------------------------------------------------

create type public.evento_tarea_tipo as enum (
  'creada', 'tomada', 'liberada', 'recogida', 'foto_subida', 'entrega_marcada',
  'codigo_incorrecto', 'bloqueada', 'confirmada'
);

create table public.eventos_tarea (
  id bigint generated always as identity primary key,
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  tipo public.evento_tarea_tipo not null,
  -- Interno (auditoría); no se concede lectura de esta columna a los clientes.
  actor_id uuid references auth.users (id) on delete set null,
  -- repartidor, fundacion, tienda o sistema (backend o disparador sin sesión).
  actor_rol text not null,
  creado_en timestamptz not null default now()
);

create index eventos_tarea_tarea_idx on public.eventos_tarea (tarea_id, creado_en);

alter table public.eventos_tarea enable row level security;
-- Los privilegios por defecto de public darían todo a anon y authenticated.
revoke all on public.eventos_tarea from anon, authenticated;
grant select (id, tarea_id, tipo, actor_rol, creado_en) on public.eventos_tarea to authenticated;

create policy "eventos_tarea: participantes leen los de sus tareas"
  on public.eventos_tarea for select to authenticated
  using (privado.tarea_visible_para_mi(tarea_id));

create function privado.registrar_evento(p_tarea uuid, p_tipo public.evento_tarea_tipo)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.eventos_tarea (tarea_id, tipo, actor_id, actor_rol)
  values (p_tarea, p_tipo, (select auth.uid()), coalesce(privado.mi_rol()::text, 'sistema'));
$$;

create function privado.evento_de_tarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform privado.registrar_evento(new.id, 'creada');
  elsif old.estado = 'abierta' and new.estado = 'asignada' then
    perform privado.registrar_evento(new.id, 'tomada');
  elsif old.estado = 'asignada' and new.estado = 'abierta' then
    perform privado.registrar_evento(new.id, 'liberada');
  elsif old.estado = 'asignada' and new.estado = 'recogida' then
    perform privado.registrar_evento(new.id, 'recogida');
  elsif old.estado = 'recogida' and new.estado = 'entregada' then
    perform privado.registrar_evento(new.id, 'confirmada');
  end if;
  return null;
end;
$$;

create trigger tareas_evento_alta
  after insert on public.tareas
  for each row execute function privado.evento_de_tarea();

create trigger tareas_evento_estado
  after update of estado on public.tareas
  for each row
  when (old.estado is distinct from new.estado)
  execute function privado.evento_de_tarea();

-- Código de entrega (privado: ningún cliente lee esta tabla) -------------------------

create table privado.codigos_entrega (
  entrega_id uuid primary key references public.entregas (id) on delete cascade,
  codigo text not null,
  intentos_fallidos smallint not null default 0,
  bloqueada_en timestamptz,
  creado_en timestamptz not null default now()
);

alter table privado.codigos_entrega enable row level security;
revoke all on privado.codigos_entrega from public, anon, authenticated;

-- Endurecer: solo las funciones escriben entregas ------------------------------------

drop policy "entregas: el repartidor sube evidencia" on public.entregas;
revoke update (foto_path, entregada_en) on public.entregas from authenticated;
revoke update on public.entregas from authenticated;

-- Fotos de entrega: bucket privado ----------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 3145728, array['image/jpeg']);

-- Ruta: <tarea_id>/<uuid>.jpg. Sin nombres ni datos de personas en la ruta.
create function privado.puedo_subir_foto_entrega(p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and exists (
      select 1 from public.tareas t
      left join public.entregas e on e.tarea_id = t.id
      where t.id::text = split_part(p_nombre, '/', 1)
        and t.repartidor_id = (select auth.uid())
        and t.estado = 'recogida'
        and e.confirmada_en is null
        and privado.mi_rol() = 'repartidor'
    );
$$;

-- El repartidor ve las fotos de sus tareas; la fundación, solo la foto registrada
-- de una entrega dirigida a ella.
create function privado.foto_entrega_visible(p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tareas t
    where t.id::text = split_part(p_nombre, '/', 1)
      and t.repartidor_id = (select auth.uid())
  ) or exists (
    select 1 from public.entregas e
    join public.tareas t on t.id = e.tarea_id
    join public.pedidos p on p.id = t.pedido_id
    join public.solicitudes s on s.id = p.solicitud_id
    where e.foto_path = p_nombre
      and privado.mi_rol() = 'fundacion'
      and s.organizacion_id = privado.mi_organizacion()
  );
$$;

create policy "T10 repartidor sube la foto de su entrega" on storage.objects for insert to authenticated
with check (bucket_id = 'entregas' and privado.puedo_subir_foto_entrega(name));

create policy "T10 fotos de entrega para repartidor y receptora" on storage.objects for select to authenticated
using (bucket_id = 'entregas' and privado.foto_entrega_visible(name));

-- RPC del repartidor ------------------------------------------------------------

create function public.marcar_recogida(p_tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarea public.tareas;
begin
  if privado.mi_rol() is distinct from 'repartidor' then
    raise exception 'Solo los repartidores recogen pedidos' using errcode = '42501';
  end if;

  select * into v_tarea from public.tareas
  where id = p_tarea and repartidor_id = (select auth.uid())
  for update;
  if v_tarea.id is null or v_tarea.estado <> 'asignada' then
    raise exception 'No tienes esa tarea por recoger' using errcode = 'P0002';
  end if;

  update public.pedidos set estado = 'recogido' where id = v_tarea.pedido_id and estado = 'listo';
  if not found then
    raise exception 'El pedido no está listo' using errcode = 'P0001';
  end if;
  update public.tareas set estado = 'recogida' where id = p_tarea;
end;
$$;

-- Registra la foto y marca entregado. Devuelve el código que se muestra a quien recibe.
-- Se puede repetir con otra foto mientras no se confirme; el código y los intentos se
-- conservan.
create function public.registrar_entrega(p_tarea uuid, p_foto_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_tarea public.tareas;
  v_entrega public.entregas;
  v_codigo text;
begin
  if privado.mi_rol() is distinct from 'repartidor' then
    raise exception 'Solo los repartidores entregan' using errcode = '42501';
  end if;

  select * into v_tarea from public.tareas
  where id = p_tarea and repartidor_id = v_yo
  for update;
  if v_tarea.id is null or v_tarea.estado <> 'recogida' then
    raise exception 'No tienes esa tarea en camino' using errcode = 'P0002';
  end if;

  if p_foto_path is null or split_part(p_foto_path, '/', 1) <> p_tarea::text
     or not exists (select 1 from storage.objects
                    where bucket_id = 'entregas' and name = p_foto_path and owner_id = v_yo::text) then
    raise exception 'Sube la foto de la entrega' using errcode = '23514';
  end if;

  select * into v_entrega from public.entregas where tarea_id = p_tarea for update;
  if v_entrega.id is null then
    insert into public.entregas (tarea_id, foto_path, entregada_en)
    values (p_tarea, p_foto_path, now())
    returning * into v_entrega;
    v_codigo := privado.nuevo_codigo_recogida();
    insert into privado.codigos_entrega (entrega_id, codigo) values (v_entrega.id, v_codigo);
    perform privado.registrar_evento(p_tarea, 'foto_subida');
    perform privado.registrar_evento(p_tarea, 'entrega_marcada');
  else
    if v_entrega.confirmada_en is not null then
      raise exception 'La entrega ya está confirmada' using errcode = 'P0001';
    end if;
    update public.entregas set foto_path = p_foto_path where id = v_entrega.id;
    select codigo into v_codigo from privado.codigos_entrega where entrega_id = v_entrega.id;
    perform privado.registrar_evento(p_tarea, 'foto_subida');
  end if;

  return v_codigo;
end;
$$;

-- La entrega en curso del repartidor (tarea recogida) con su código. Solo la suya.
create function public.mi_entrega()
returns table (
  tarea_id uuid,
  foto_path text,
  entregada_en timestamptz,
  codigo_entrega text,
  intentos_restantes integer,
  bloqueada boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, e.foto_path, e.entregada_en, c.codigo,
    greatest(0, 5 - c.intentos_fallidos)::int, c.bloqueada_en is not null
  from public.tareas t
  join public.entregas e on e.tarea_id = t.id
  join privado.codigos_entrega c on c.entrega_id = e.id
  where privado.mi_rol() = 'repartidor'
    and t.repartidor_id = (select auth.uid())
    and t.estado = 'recogida'
    and e.confirmada_en is null;
$$;

-- RPC de la fundación receptora ---------------------------------------------------

-- Entregas dirigidas a mi fundación: por confirmar y las últimas confirmadas.
-- Sin datos del repartidor.
create function public.entregas_de_mi_fundacion()
returns table (
  tarea_id uuid,
  tienda_nombre text,
  solicitud_titulo text,
  total_centavos bigint,
  articulos jsonb,
  foto_path text,
  entregada_en timestamptz,
  confirmada_en timestamptz,
  intentos_restantes integer,
  bloqueada boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select t.id, ti.nombre, s.titulo, privado.total_pedido(p.id),
      coalesce((select jsonb_agg(jsonb_build_object('nombre', sa.nombre, 'unidades', pa.unidades) order by sa.nombre)
        from public.pedido_articulos pa
        join public.solicitud_articulos sa on sa.id = pa.solicitud_articulo_id
        where pa.pedido_id = p.id), '[]'::jsonb),
      e.foto_path, e.entregada_en, e.confirmada_en,
      greatest(0, 5 - c.intentos_fallidos)::int, c.bloqueada_en is not null
    from public.entregas e
    join privado.codigos_entrega c on c.entrega_id = e.id
    join public.tareas t on t.id = e.tarea_id
    join public.pedidos p on p.id = t.pedido_id
    join public.organizaciones ti on ti.id = p.tienda_id
    join public.solicitudes s on s.id = p.solicitud_id
    where privado.mi_rol() = 'fundacion'
      and s.organizacion_id = privado.mi_organizacion()
      and e.entregada_en is not null
    order by (e.confirmada_en is null) desc, coalesce(e.confirmada_en, e.entregada_en) desc
    limit 30
  ) x;
$$;

-- Quien recibe confirma con el código. No lanza error ante un código incorrecto para
-- que el intento quede contado. resultado: confirmada | incorrecto | bloqueada.
create function public.confirmar_entrega(p_tarea uuid, p_codigo text)
returns table (resultado text, intentos_restantes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tarea public.tareas;
  v_entrega public.entregas;
  v_codigo privado.codigos_entrega;
begin
  if privado.mi_rol() is distinct from 'fundacion' then
    raise exception 'Solo la fundación que recibe confirma' using errcode = '42501';
  end if;

  select t.* into v_tarea from public.tareas t
  join public.pedidos p on p.id = t.pedido_id
  join public.solicitudes s on s.id = p.solicitud_id
  where t.id = p_tarea and s.organizacion_id = privado.mi_organizacion()
  for update of t;

  select * into v_entrega from public.entregas where tarea_id = v_tarea.id for update;
  if v_tarea.id is null or v_tarea.estado <> 'recogida' or v_entrega.id is null
     or v_entrega.entregada_en is null or v_entrega.confirmada_en is not null then
    raise exception 'No hay una entrega por confirmar' using errcode = 'P0002';
  end if;

  select * into v_codigo from privado.codigos_entrega where entrega_id = v_entrega.id for update;
  if v_codigo.bloqueada_en is not null then
    return query select 'bloqueada'::text, 0;
    return;
  end if;

  if upper(btrim(coalesce(p_codigo, ''))) <> v_codigo.codigo then
    update privado.codigos_entrega
    set intentos_fallidos = intentos_fallidos + 1,
        bloqueada_en = case when intentos_fallidos + 1 >= 5 then now() end
    where entrega_id = v_entrega.id
    returning * into v_codigo;
    perform privado.registrar_evento(p_tarea, 'codigo_incorrecto');
    if v_codigo.bloqueada_en is not null then
      perform privado.registrar_evento(p_tarea, 'bloqueada');
      return query select 'bloqueada'::text, 0;
    else
      return query select 'incorrecto'::text, (5 - v_codigo.intentos_fallidos)::int;
    end if;
    return;
  end if;

  update public.entregas set confirmada_en = now() where id = v_entrega.id;
  update public.pedidos set estado = 'entregado' where id = v_tarea.pedido_id and estado = 'recogido';
  if not found then
    raise exception 'El pedido no está en camino' using errcode = 'P0001';
  end if;
  update public.solicitud_articulos sa
  set unidades_entregadas = sa.unidades_entregadas + pa.unidades
  from public.pedido_articulos pa
  where pa.pedido_id = v_tarea.pedido_id and pa.solicitud_articulo_id = sa.id;
  -- El disparador registra el evento "confirmada".
  update public.tareas set estado = 'entregada' where id = p_tarea;

  return query select 'confirmada'::text, null::int;
end;
$$;

revoke all on function privado.registrar_evento(uuid, public.evento_tarea_tipo) from public, anon, authenticated;
revoke all on function privado.evento_de_tarea() from public, anon, authenticated;
-- Las políticas de Storage las evalúan con el rol del cliente: deben poder ejecutarlas.
revoke all on function privado.puedo_subir_foto_entrega(text) from public, anon;
revoke all on function privado.foto_entrega_visible(text) from public, anon;
grant execute on function privado.puedo_subir_foto_entrega(text) to authenticated;
grant execute on function privado.foto_entrega_visible(text) to authenticated;

revoke all on function public.marcar_recogida(uuid) from public, anon;
revoke all on function public.registrar_entrega(uuid, text) from public, anon;
revoke all on function public.mi_entrega() from public, anon;
revoke all on function public.entregas_de_mi_fundacion() from public, anon;
revoke all on function public.confirmar_entrega(uuid, text) from public, anon;
grant execute on function public.marcar_recogida(uuid) to authenticated;
grant execute on function public.registrar_entrega(uuid, text) to authenticated;
grant execute on function public.mi_entrega() to authenticated;
grant execute on function public.entregas_de_mi_fundacion() to authenticated;
grant execute on function public.confirmar_entrega(uuid, text) to authenticated;
