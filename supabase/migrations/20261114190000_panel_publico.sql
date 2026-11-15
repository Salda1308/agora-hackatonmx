-- Panel público (T12).
-- Entrega solo agregados y referencias de uso. Nunca devuelve personas, metadata
-- de pagos ni la ruta de una foto privada.

-- Cada pedido nace de un pago confirmado. La relación explícita evita intentar
-- reconstruir un vínculo cuando una solicitud recibe varios pagos del mismo artículo.
alter table public.pedidos
  add column pago_id uuid references public.pagos (id) on delete set null;

create unique index pedidos_pago_unico on public.pedidos (pago_id)
  where pago_id is not null;

create index pedidos_pago_idx on public.pedidos (pago_id);

-- El trigger de T08 se conserva, pero guarda la relación que acaba de declararse.
create or replace function privado.crear_pedido_de_pago()
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

  insert into public.pedidos (pago_id, solicitud_id, tienda_id)
  values (new.id, new.solicitud_id, new.tienda_id)
  returning id into v_pedido;

  insert into public.pedido_articulos (pedido_id, solicitud_articulo_id, unidades)
  select v_pedido, solicitud_articulo_id, unidades
  from public.pago_articulos
  where pago_id = new.id;

  return new;
end;
$$;

revoke all on function privado.crear_pedido_de_pago() from public, anon, authenticated;

-- Zona pública: solo el último segmento de la ubicación que la organización
-- decidió publicar. Se elimina la nota entre paréntesis y no se exponen calles.
create function privado.zona_publica(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(regexp_replace(
        case
          when position(',' in o.direccion_publica) > 0
            then split_part(o.direccion_publica, ',', array_length(string_to_array(o.direccion_publica, ','), 1))
          else o.direccion_publica
        end,
        E'\\s*\\([^)]*\\)\\s*$', '', 'g'
      )),
      ''
    ),
    'Zona no publicada'
  )
  from public.organizaciones o
  where o.id = p_org;
$$;

revoke all on function privado.zona_publica(uuid) from public, anon, authenticated;

grant usage on schema privado to anon, authenticated;

-- Un solo RPC para que la vista pública no tenga que leer pagos, pedidos o
-- entregas directamente. El nombre del evento es el alcance de este panel;
-- no representa una entidad editable ni contiene datos personales.
create function public.panel_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with solicitudes_publicas as (
  select
    s.id,
    s.titulo,
    o.nombre as organizacion,
    privado.zona_publica(o.id) as zona,
    (s.es_ejemplo or o.es_ejemplo) as ejemplo
  from public.solicitudes s
  join public.organizaciones o on o.id = s.organizacion_id
  where s.estado in ('publicada', 'cerrada')
    and privado.org_publica(s.organizacion_id)
),
unidades as (
  select
    sp.id,
    sp.titulo,
    sp.organizacion,
    sp.zona,
    sp.ejemplo,
    coalesce(sum(sa.unidades_pagadas), 0)::bigint as recibido,
    coalesce(sum(sa.unidades_listas), 0)::bigint as comprado,
    coalesce(sum(sa.unidades_entregadas), 0)::bigint as entregado
  from solicitudes_publicas sp
  left join public.solicitud_articulos sa on sa.solicitud_id = sp.id
  group by sp.id, sp.titulo, sp.organizacion, sp.zona, sp.ejemplo
),
resumen as (
  select
    coalesce(sum(recibido), 0)::bigint as recibido,
    coalesce(sum(comprado), 0)::bigint as comprado,
    coalesce(sum(entregado), 0)::bigint as entregado
  from unidades
),
zonas as (
  select
    zona,
    sum(recibido)::bigint as recibido,
    sum(comprado)::bigint as comprado,
    sum(entregado)::bigint as entregado
  from unidades
  group by zona
),
usos as (
  select
    p.id,
    concat('AGORA-', lpad(p.num_ref::text, 7, '0')) as ticket,
    p.monto_centavos,
    p.pagado_en,
    u.id as solicitud_id,
    u.titulo as solicitud,
    u.organizacion,
    u.zona,
    pe.id as pedido_id,
    e.id as entrega_id,
    e.entregada_en,
    e.confirmada_en,
    case
      when e.id is null then 'pendiente'
      when e.confirmada_en is not null then 'confirmada'
      when e.entregada_en is not null then 'evidencia_recibida'
      else 'pendiente'
    end as estado_entrega
  from public.pagos p
  join unidades u on u.id = p.solicitud_id
  left join public.pedidos pe on pe.pago_id = p.id
  left join public.tareas t on t.pedido_id = pe.id
  left join public.entregas e on e.tarea_id = t.id
  where p.estado = 'pagado'
    and p.pagado_en is not null
)
select jsonb_build_object(
  'evento', jsonb_build_object(
    'nombre', 'HackatónMX · Ágora',
    'recibido', resumen.recibido,
    'comprado', resumen.comprado,
    'entregado', resumen.entregado
  ),
  'resumen', jsonb_build_object(
    'recibido', resumen.recibido,
    'comprado', resumen.comprado,
    'entregado', resumen.entregado
  ),
  'solicitudes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'titulo', titulo,
      'organizacion', organizacion,
      'zona', zona,
      'ejemplo', ejemplo,
      'recibido', recibido,
      'comprado', comprado,
      'entregado', entregado
    ) order by titulo)
    from unidades
  ), '[]'::jsonb),
  'zonas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', zona,
      'recibido', recibido,
      'comprado', comprado,
      'entregado', entregado
    ) order by zona)
    from zonas
  ), '[]'::jsonb),
  'usos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'ticket', ticket,
      'monto_centavos', monto_centavos,
      'pagado_en', pagado_en,
      'solicitud_id', solicitud_id,
      'solicitud', solicitud,
      'organizacion', organizacion,
      'zona', zona,
      'ejemplo', (select ejemplo from unidades where id = solicitud_id),
      'entrega', jsonb_build_object(
        'id', entrega_id,
        'pedido_id', pedido_id,
        'estado', estado_entrega,
        'entregada_en', entregada_en,
        'confirmada_en', confirmada_en,
        'foto_publica', false,
        'constancia', case
          when estado_entrega = 'confirmada' then 'Entrega confirmada por la organización'
          when estado_entrega = 'evidencia_recibida' then 'Evidencia recibida; falta confirmar'
          else 'Entrega todavía no vinculada'
        end
      )
    ) order by pagado_en desc, ticket desc)
    from usos
  ), '[]'::jsonb),
  'actualizado_en', now()
)
from resumen;
$$;

revoke all on function public.panel_publico() from public, anon, authenticated;
grant execute on function public.panel_publico() to anon, authenticated;
