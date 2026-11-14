-- Modelo de datos de Ágora (tarea 02).
-- Montos en centavos de peso (enteros). $0.01 = 1.
-- Los contadores de unidades, los pagos y los pedidos solo los escribe el backend
-- (service_role); ver la migración de políticas.

create schema if not exists privado;

-- Tipos -------------------------------------------------------------------

create type public.organizacion_tipo as enum ('fundacion', 'tienda', 'empresa');
create type public.fundacion_categoria as enum ('albergue', 'asilo', 'refugio_animales', 'colectivo_busqueda');
create type public.usuario_rol as enum ('fundacion', 'tienda', 'repartidor');
create type public.medio_tipo as enum ('imagen', 'video');
create type public.solicitud_estado as enum ('borrador', 'publicada', 'cerrada', 'cancelada');
create type public.pago_metodo as enum ('qr', 'push', 'link');
create type public.pago_estado as enum ('creado', 'pagado', 'fallido', 'expirado');
create type public.pedido_estado as enum ('preparando', 'listo', 'recogido', 'entregado');
create type public.tarea_modalidad as enum ('repartidor', 'fundacion_recoge');
create type public.tarea_estado as enum ('abierta', 'asignada', 'recogida', 'entregada', 'cancelada');
create type public.inscripcion_estado as enum ('pendiente', 'confirmada', 'rechazada', 'asistio', 'no_asistio');
create type public.reporte_estado as enum ('abierto', 'atendido', 'descartado');

-- Organizaciones y usuarios ----------------------------------------------

create table public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  tipo public.organizacion_tipo not null,
  categoria public.fundacion_categoria,
  nombre text not null check (length(nombre) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descripcion text,
  -- Solo se llena si la organización puede mostrar su dirección (asilos, albergues).
  direccion_publica text,
  latitud double precision check (latitud between -90 and 90),
  longitud double precision check (longitud between -180 and 180),
  logo_url text,
  -- Los campos de moderación no los puede escribir el cliente (ver políticas).
  verificada boolean not null default false,
  verificada_en timestamptz,
  suspendida boolean not null default false,
  es_ejemplo boolean not null default false,
  creada_en timestamptz not null default now(),
  -- Solo las fundaciones tienen categoría.
  constraint organizaciones_categoria_check check ((tipo = 'fundacion') = (categoria is not null))
);

comment on column public.organizaciones.es_ejemplo is 'Dato de ejemplo; la interfaz lo marca como tal.';

-- Una fila por usuario de Auth. El rol y la organización los asigna moderación.
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.usuario_rol not null,
  organizacion_id uuid references public.organizaciones (id) on delete set null,
  nombre_visible text check (length(nombre_visible) <= 120),
  creado_en timestamptz not null default now(),
  constraint perfiles_organizacion_check check (rol = 'repartidor' or organizacion_id is not null)
);

create index perfiles_organizacion_idx on public.perfiles (organizacion_id);

-- Titular de cobro de cada tienda. Las credenciales de pey NO se guardan aquí:
-- credencial_ref es el nombre del secreto en la configuración del backend.
create table public.tiendas_cobro (
  organizacion_id uuid primary key references public.organizaciones (id) on delete cascade,
  titular_nombre text not null,
  rfc text not null check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  clabe_ultimos4 text check (clabe_ultimos4 ~ '^[0-9]{4}$'),
  credencial_ref text not null,
  actualizado_en timestamptz not null default now()
);

-- Moderación: administración interna del equipo (service_role). Registro de acciones.
create table public.acciones_moderacion (
  id uuid primary key default gen_random_uuid(),
  moderador text not null,
  accion text not null,
  objetivo_tabla text not null,
  objetivo_id uuid not null,
  motivo text,
  creada_en timestamptz not null default now()
);

-- Catálogo por tienda ----------------------------------------------------

create table public.catalogo_articulos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.organizaciones (id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 200),
  descripcion text,
  unidad text not null default 'pieza',
  precio_centavos integer not null check (precio_centavos > 0),
  vigente_desde date not null default current_date,
  vigente_hasta date,
  activo boolean not null default true,
  es_ejemplo boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint catalogo_vigencia_check check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create index catalogo_tienda_idx on public.catalogo_articulos (tienda_id);

-- Solicitudes ------------------------------------------------------------

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  tienda_id uuid not null references public.organizaciones (id),
  titulo text not null check (length(titulo) between 1 and 200),
  descripcion text,
  estado public.solicitud_estado not null default 'borrador',
  recurrente boolean not null default false,
  periodicidad text,
  -- Solicitud de la que se repite (pedidos recurrentes).
  origen_id uuid references public.solicitudes (id) on delete set null,
  publicada_en timestamptz,
  es_ejemplo boolean not null default false,
  creada_en timestamptz not null default now()
);

create index solicitudes_organizacion_idx on public.solicitudes (organizacion_id);
create index solicitudes_tienda_idx on public.solicitudes (tienda_id);

-- Artículos de una solicitud con sus unidades por estado.
-- El precio y el nombre se copian del catálogo al agregar: la solicitud conserva
-- el precio con el que se publicó.
create table public.solicitud_articulos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  articulo_id uuid not null references public.catalogo_articulos (id),
  nombre text not null,
  precio_centavos integer not null check (precio_centavos > 0),
  cantidad integer not null check (cantidad > 0),
  unidades_pagadas integer not null default 0,
  unidades_listas integer not null default 0,
  unidades_entregadas integer not null default 0,
  constraint solicitud_articulos_unico unique (solicitud_id, articulo_id),
  constraint solicitud_articulos_unidades_check check (
    unidades_entregadas >= 0
    and unidades_entregadas <= unidades_listas
    and unidades_listas <= unidades_pagadas
    and unidades_pagadas <= cantidad
  )
);

create index solicitud_articulos_articulo_idx on public.solicitud_articulos (articulo_id);

-- Copia nombre y precio del catálogo y exige que el artículo sea de la tienda de la solicitud.
create function privado.copiar_precio_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_articulo public.catalogo_articulos;
  v_tienda uuid;
begin
  select * into v_articulo from public.catalogo_articulos where id = new.articulo_id;
  select tienda_id into v_tienda from public.solicitudes where id = new.solicitud_id;
  if v_articulo.id is null or v_articulo.tienda_id <> v_tienda or not v_articulo.activo then
    raise exception 'El artículo no está activo en el catálogo de la tienda de la solicitud';
  end if;
  new.nombre := v_articulo.nombre;
  new.precio_centavos := v_articulo.precio_centavos;
  return new;
end;
$$;

create trigger solicitud_articulos_copiar_precio
  before insert or update of articulo_id on public.solicitud_articulos
  for each row execute function privado.copiar_precio_catalogo();

-- Pagos ------------------------------------------------------------------

-- numRef de pey: entero de máximo 7 dígitos. Una secuencia sin ciclo lo genera sin
-- colisiones (hasta 9,999,999 cobros); la restricción única lo garantiza.
create sequence public.pagos_num_ref_seq as integer minvalue 1 maxvalue 9999999 no cycle;

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  num_ref integer not null default nextval('public.pagos_num_ref_seq')
    check (num_ref between 1 and 9999999),
  solicitud_id uuid not null references public.solicitudes (id),
  tienda_id uuid not null references public.organizaciones (id),
  monto_centavos integer not null check (monto_centavos > 0),
  metodo public.pago_metodo not null,
  estado public.pago_estado not null default 'creado',
  -- Identificador de la transacción en pey; único para que un webhook repetido no cuente dos veces.
  pey_transaccion_id text,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  constraint pagos_num_ref_unico unique (num_ref),
  constraint pagos_pagado_check check ((estado = 'pagado') = (pagado_en is not null))
);

alter sequence public.pagos_num_ref_seq owned by public.pagos.num_ref;

create unique index pagos_pey_transaccion_unico on public.pagos (pey_transaccion_id)
  where pey_transaccion_id is not null;
create index pagos_solicitud_idx on public.pagos (solicitud_id);
create index pagos_tienda_idx on public.pagos (tienda_id);

-- Unidades que cubre cada pago, por artículo de la solicitud.
create table public.pago_articulos (
  pago_id uuid not null references public.pagos (id) on delete cascade,
  solicitud_articulo_id uuid not null references public.solicitud_articulos (id),
  unidades integer not null check (unidades > 0),
  primary key (pago_id, solicitud_articulo_id)
);

create index pago_articulos_articulo_idx on public.pago_articulos (solicitud_articulo_id);

-- Pedidos, tareas y entregas ---------------------------------------------

-- Lo que la tienda prepara de una solicitud (solo lo pagado).
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id),
  tienda_id uuid not null references public.organizaciones (id),
  estado public.pedido_estado not null default 'preparando',
  codigo_recogida text unique,
  listo_en timestamptz,
  creado_en timestamptz not null default now()
);

create index pedidos_solicitud_idx on public.pedidos (solicitud_id);
create index pedidos_tienda_idx on public.pedidos (tienda_id);

create table public.pedido_articulos (
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  solicitud_articulo_id uuid not null references public.solicitud_articulos (id),
  unidades integer not null check (unidades > 0),
  primary key (pedido_id, solicitud_articulo_id)
);

create index pedido_articulos_articulo_idx on public.pedido_articulos (solicitud_articulo_id);

-- Tarea de recoger y entregar un pedido (repartidor o la propia fundación).
create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  modalidad public.tarea_modalidad not null default 'repartidor',
  repartidor_id uuid references auth.users (id) on delete set null,
  estado public.tarea_estado not null default 'abierta',
  creada_en timestamptz not null default now(),
  constraint tareas_asignada_check check (estado in ('abierta', 'cancelada') or repartidor_id is not null or modalidad = 'fundacion_recoge')
);

create index tareas_pedido_idx on public.tareas (pedido_id);
create index tareas_repartidor_idx on public.tareas (repartidor_id);

create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null unique references public.tareas (id) on delete cascade,
  foto_path text,
  entregada_en timestamptz,
  -- La confirmación con código la hace el backend.
  confirmada_en timestamptz,
  creada_en timestamptz not null default now()
);

-- Páginas: publicaciones con medios --------------------------------------

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  texto text check (length(texto) <= 5000),
  -- Moderación posterior: solo service_role puede retirar.
  retirada boolean not null default false,
  es_ejemplo boolean not null default false,
  creada_en timestamptz not null default now()
);

create index publicaciones_organizacion_idx on public.publicaciones (organizacion_id);

create table public.publicacion_medios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  tipo public.medio_tipo not null,
  -- Ruta en Storage (imagen) o enlace incrustado (video, en el fin de semana).
  url text not null,
  orden smallint not null default 0
);

create index publicacion_medios_publicacion_idx on public.publicacion_medios (publicacion_id);

create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  motivo text not null check (length(motivo) between 1 and 1000),
  estado public.reporte_estado not null default 'abierto',
  creado_en timestamptz not null default now()
);

create index reportes_publicacion_idx on public.reportes (publicacion_id);

-- Jornadas de voluntariado -----------------------------------------------

create table public.jornadas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 200),
  descripcion text,
  requisitos text,
  ubicacion text,
  inicia_en timestamptz not null,
  termina_en timestamptz not null,
  cupos integer not null check (cupos > 0),
  permite_menores boolean not null default false,
  es_ejemplo boolean not null default false,
  creada_en timestamptz not null default now(),
  constraint jornadas_horario_check check (termina_en > inicia_en)
);

create index jornadas_organizacion_idx on public.jornadas (organizacion_id);

-- La lista de inscritos no es pública.
create table public.inscripciones_jornada (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas (id) on delete cascade,
  empresa_id uuid references public.organizaciones (id) on delete set null,
  nombre_contacto text not null check (length(nombre_contacto) between 1 and 200),
  contacto text not null check (length(contacto) between 3 and 200),
  asistentes integer not null check (asistentes between 1 and 500),
  estado public.inscripcion_estado not null default 'pendiente',
  creada_en timestamptz not null default now()
);

create index inscripciones_jornada_idx on public.inscripciones_jornada (jornada_id);

-- No se pasa del cupo: bloquea la jornada y suma los asistentes no rechazados.
create function privado.validar_cupo_jornada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cupos integer;
  v_ocupados integer;
begin
  if new.estado in ('rechazada', 'no_asistio') then
    return new;
  end if;
  select cupos into v_cupos from public.jornadas where id = new.jornada_id for update;
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

create trigger inscripciones_validar_cupo
  before insert or update of asistentes, estado, jornada_id on public.inscripciones_jornada
  for each row execute function privado.validar_cupo_jornada();

-- Barra en vivo: los cambios de unidades se emiten por Realtime (respeta RLS).
alter publication supabase_realtime add table public.solicitud_articulos;
