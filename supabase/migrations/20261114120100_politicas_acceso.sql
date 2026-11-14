-- Reglas de acceso de Ágora (tarea 02).
-- Principios:
--   * Lectura pública de lo publicado por organizaciones verificadas, no suspendidas
--     y que no son colectivos de búsqueda.
--   * Escritura por rol, limitada por columnas con GRANT y por fila con RLS.
--   * El cliente nunca escribe pagos, contadores de unidades, pedidos ni campos de
--     moderación: eso lo hace el backend con service_role.
-- Supabase da todos los privilegios a anon y authenticated sobre las tablas nuevas de
-- public; aquí se quitan y se dan solo los necesarios. Las tablas que se agreguen en
-- otras tareas deben repetir este patrón.

-- Funciones de apoyo (esquema privado, no expuesto por la API) -------------

create function privado.mi_organizacion()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organizacion_id from public.perfiles where id = (select auth.uid());
$$;

create function privado.mi_rol()
returns public.usuario_rol
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.perfiles where id = (select auth.uid());
$$;

-- Verificada por moderación y no suspendida: puede publicar.
create function privado.org_verificada(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizaciones
    where id = p_org and verificada and not suspendida
  );
$$;

-- Visible al público: verificada, no suspendida y no es colectivo de búsqueda.
create function privado.org_publica(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizaciones
    where id = p_org and verificada and not suspendida
      and categoria is distinct from 'colectivo_busqueda'
  );
$$;

create function privado.solicitud_de_mi_org(p_solicitud uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.solicitudes
    where id = p_solicitud and organizacion_id = privado.mi_organizacion()
  );
$$;

create function privado.solicitud_en_borrador_de_mi_org(p_solicitud uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.solicitudes
    where id = p_solicitud and estado = 'borrador'
      and organizacion_id = privado.mi_organizacion()
  );
$$;

create function privado.solicitud_publica(p_solicitud uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.solicitudes
    where id = p_solicitud and estado in ('publicada', 'cerrada')
      and privado.org_publica(organizacion_id)
  );
$$;

create function privado.publicacion_visible(p_publicacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publicaciones
    where id = p_publicacion and not retirada and privado.org_publica(organizacion_id)
  );
$$;

create function privado.publicacion_de_mi_org(p_publicacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publicaciones
    where id = p_publicacion and organizacion_id = privado.mi_organizacion()
  );
$$;

create function privado.jornada_de_mi_org(p_jornada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jornadas
    where id = p_jornada and organizacion_id = privado.mi_organizacion()
  );
$$;

create function privado.jornada_publica(p_jornada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jornadas
    where id = p_jornada and privado.org_publica(organizacion_id)
  );
$$;

create function privado.pedido_visible_para_mi(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos p
    join public.solicitudes s on s.id = p.solicitud_id
    where p.id = p_pedido
      and (p.tienda_id = privado.mi_organizacion() or s.organizacion_id = privado.mi_organizacion())
  );
$$;

create function privado.tarea_visible_para_mi(p_tarea uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tareas t
    where t.id = p_tarea
      and (t.repartidor_id = (select auth.uid()) or privado.pedido_visible_para_mi(t.pedido_id))
  );
$$;

revoke all on all functions in schema privado from public;
grant usage on schema privado to anon, authenticated;
grant execute on all functions in schema privado to anon, authenticated;

-- Privilegios por tabla y columna -----------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Lectura
grant select on
  public.organizaciones,
  public.catalogo_articulos,
  public.solicitudes,
  public.solicitud_articulos,
  public.publicaciones,
  public.publicacion_medios,
  public.jornadas,
  public.entregas
to anon, authenticated;

grant select on
  public.perfiles,
  public.pagos,
  public.pago_articulos,
  public.pedidos,
  public.pedido_articulos,
  public.tareas,
  public.inscripciones_jornada
to authenticated;

-- Escritura (solo las columnas que el rol puede tocar)
grant update (nombre_visible) on public.perfiles to authenticated;

grant update (nombre, descripcion, direccion_publica, latitud, longitud, logo_url)
  on public.organizaciones to authenticated;

grant insert (tienda_id, nombre, descripcion, unidad, precio_centavos, vigente_desde, vigente_hasta, activo),
      update (nombre, descripcion, unidad, precio_centavos, vigente_desde, vigente_hasta, activo)
  on public.catalogo_articulos to authenticated;

grant insert (organizacion_id, tienda_id, titulo, descripcion, estado, recurrente, periodicidad, origen_id),
      update (titulo, descripcion, estado, recurrente, periodicidad)
  on public.solicitudes to authenticated;

grant insert (solicitud_id, articulo_id, cantidad),
      update (cantidad),
      delete
  on public.solicitud_articulos to authenticated;

grant update (estado) on public.pedidos to authenticated;

grant update (repartidor_id, estado) on public.tareas to authenticated;

grant update (foto_path, entregada_en) on public.entregas to authenticated;

grant insert (organizacion_id, texto), delete on public.publicaciones to authenticated;

grant insert (publicacion_id, tipo, url, orden), delete on public.publicacion_medios to authenticated;

grant insert (publicacion_id, motivo) on public.reportes to anon, authenticated;

grant insert (organizacion_id, titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos, permite_menores),
      update (titulo, descripcion, requisitos, ubicacion, inicia_en, termina_en, cupos, permite_menores),
      delete
  on public.jornadas to authenticated;

grant insert (jornada_id, empresa_id, nombre_contacto, contacto, asistentes)
  on public.inscripciones_jornada to anon, authenticated;
grant update (estado) on public.inscripciones_jornada to authenticated;

-- tiendas_cobro y acciones_moderacion: sin privilegios para anon ni authenticated.

-- RLS ---------------------------------------------------------------------

alter table public.organizaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.tiendas_cobro enable row level security;
alter table public.acciones_moderacion enable row level security;
alter table public.catalogo_articulos enable row level security;
alter table public.solicitudes enable row level security;
alter table public.solicitud_articulos enable row level security;
alter table public.pagos enable row level security;
alter table public.pago_articulos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_articulos enable row level security;
alter table public.tareas enable row level security;
alter table public.entregas enable row level security;
alter table public.publicaciones enable row level security;
alter table public.publicacion_medios enable row level security;
alter table public.reportes enable row level security;
alter table public.jornadas enable row level security;
alter table public.inscripciones_jornada enable row level security;

-- Organizaciones
create policy "organizaciones: lectura pública de verificadas"
  on public.organizaciones for select to anon, authenticated
  using (verificada and not suspendida and categoria is distinct from 'colectivo_busqueda');

create policy "organizaciones: miembros leen la propia"
  on public.organizaciones for select to authenticated
  using (id = privado.mi_organizacion());

create policy "organizaciones: miembros editan la propia"
  on public.organizaciones for update to authenticated
  using (id = privado.mi_organizacion())
  with check (id = privado.mi_organizacion());

-- Perfiles
create policy "perfiles: cada quien lee el suyo"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "perfiles: cada quien edita su nombre"
  on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Catálogo
create policy "catalogo: lectura pública de tiendas verificadas"
  on public.catalogo_articulos for select to anon, authenticated
  using (activo and privado.org_publica(tienda_id));

create policy "catalogo: la tienda lee el suyo"
  on public.catalogo_articulos for select to authenticated
  using (tienda_id = privado.mi_organizacion());

create policy "catalogo: la tienda agrega al suyo"
  on public.catalogo_articulos for insert to authenticated
  with check (privado.mi_rol() = 'tienda' and tienda_id = privado.mi_organizacion());

create policy "catalogo: la tienda edita el suyo"
  on public.catalogo_articulos for update to authenticated
  using (privado.mi_rol() = 'tienda' and tienda_id = privado.mi_organizacion())
  with check (tienda_id = privado.mi_organizacion());

-- Solicitudes
create policy "solicitudes: lectura pública de publicadas"
  on public.solicitudes for select to anon, authenticated
  using (estado in ('publicada', 'cerrada') and privado.org_publica(organizacion_id));

create policy "solicitudes: la fundación lee las suyas"
  on public.solicitudes for select to authenticated
  using (organizacion_id = privado.mi_organizacion());

create policy "solicitudes: la tienda lee las que le tocan"
  on public.solicitudes for select to authenticated
  using (tienda_id = privado.mi_organizacion() and estado <> 'borrador');

-- Publicar exige estar verificada; el borrador no.
create policy "solicitudes: la fundación crea las suyas"
  on public.solicitudes for insert to authenticated
  with check (
    privado.mi_rol() = 'fundacion'
    and organizacion_id = privado.mi_organizacion()
    and (estado = 'borrador' or privado.org_verificada(organizacion_id))
  );

create policy "solicitudes: la fundación edita las suyas"
  on public.solicitudes for update to authenticated
  using (privado.mi_rol() = 'fundacion' and organizacion_id = privado.mi_organizacion())
  with check (
    organizacion_id = privado.mi_organizacion()
    and (estado = 'borrador' or privado.org_verificada(organizacion_id))
  );

-- Artículos de solicitud (los contadores no tienen GRANT de escritura)
create policy "solicitud_articulos: lectura pública de solicitudes publicadas"
  on public.solicitud_articulos for select to anon, authenticated
  using (privado.solicitud_publica(solicitud_id));

create policy "solicitud_articulos: la fundación lee los suyos"
  on public.solicitud_articulos for select to authenticated
  using (privado.solicitud_de_mi_org(solicitud_id));

create policy "solicitud_articulos: la fundación agrega en borrador"
  on public.solicitud_articulos for insert to authenticated
  with check (privado.solicitud_en_borrador_de_mi_org(solicitud_id));

create policy "solicitud_articulos: la fundación edita en borrador"
  on public.solicitud_articulos for update to authenticated
  using (privado.solicitud_en_borrador_de_mi_org(solicitud_id))
  with check (privado.solicitud_en_borrador_de_mi_org(solicitud_id));

create policy "solicitud_articulos: la fundación quita en borrador"
  on public.solicitud_articulos for delete to authenticated
  using (privado.solicitud_en_borrador_de_mi_org(solicitud_id));

-- Pagos: solo lectura para la tienda que cobra y la fundación de la solicitud.
create policy "pagos: la tienda y la fundación leen los suyos"
  on public.pagos for select to authenticated
  using (tienda_id = privado.mi_organizacion() or privado.solicitud_de_mi_org(solicitud_id));

create policy "pago_articulos: según el pago"
  on public.pago_articulos for select to authenticated
  using (exists (select 1 from public.pagos p where p.id = pago_id));

-- Pedidos: la tienda los ve y marca listo; la fundación los ve.
create policy "pedidos: tienda y fundación leen los suyos"
  on public.pedidos for select to authenticated
  using (privado.pedido_visible_para_mi(id));

create policy "pedidos: la tienda marca listo"
  on public.pedidos for update to authenticated
  using (privado.mi_rol() = 'tienda' and tienda_id = privado.mi_organizacion() and estado = 'preparando')
  with check (tienda_id = privado.mi_organizacion() and estado in ('preparando', 'listo'));

create policy "pedido_articulos: según el pedido"
  on public.pedido_articulos for select to authenticated
  using (privado.pedido_visible_para_mi(pedido_id));

-- Tareas: repartidores ven las abiertas y las suyas, y toman una abierta.
create policy "tareas: repartidores ven las abiertas"
  on public.tareas for select to authenticated
  using (privado.mi_rol() = 'repartidor' and estado = 'abierta' and modalidad = 'repartidor');

create policy "tareas: participantes ven las suyas"
  on public.tareas for select to authenticated
  using (privado.tarea_visible_para_mi(id));

create policy "tareas: el repartidor toma una abierta"
  on public.tareas for update to authenticated
  using (privado.mi_rol() = 'repartidor' and estado = 'abierta' and repartidor_id is null and modalidad = 'repartidor')
  with check (repartidor_id = (select auth.uid()) and estado = 'asignada');

-- Entregas: historial público de las confirmadas; el repartidor sube la foto.
create policy "entregas: lectura pública de confirmadas"
  on public.entregas for select to anon, authenticated
  using (confirmada_en is not null);

create policy "entregas: participantes leen las suyas"
  on public.entregas for select to authenticated
  using (privado.tarea_visible_para_mi(tarea_id));

create policy "entregas: el repartidor sube evidencia"
  on public.entregas for update to authenticated
  using (confirmada_en is null and exists (
    select 1 from public.tareas t where t.id = tarea_id and t.repartidor_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.tareas t where t.id = tarea_id and t.repartidor_id = (select auth.uid())
  ));

-- Publicaciones: solo organizaciones verificadas publican en su página.
create policy "publicaciones: lectura pública"
  on public.publicaciones for select to anon, authenticated
  using (not retirada and privado.org_publica(organizacion_id));

create policy "publicaciones: miembros leen las propias"
  on public.publicaciones for select to authenticated
  using (organizacion_id = privado.mi_organizacion());

create policy "publicaciones: miembros de verificadas publican"
  on public.publicaciones for insert to authenticated
  with check (organizacion_id = privado.mi_organizacion() and privado.org_publica(organizacion_id));

create policy "publicaciones: miembros borran las propias"
  on public.publicaciones for delete to authenticated
  using (organizacion_id = privado.mi_organizacion());

create policy "publicacion_medios: lectura pública"
  on public.publicacion_medios for select to anon, authenticated
  using (privado.publicacion_visible(publicacion_id));

create policy "publicacion_medios: miembros leen los propios"
  on public.publicacion_medios for select to authenticated
  using (privado.publicacion_de_mi_org(publicacion_id));

create policy "publicacion_medios: miembros agregan a las propias"
  on public.publicacion_medios for insert to authenticated
  with check (privado.publicacion_de_mi_org(publicacion_id));

create policy "publicacion_medios: miembros borran los propios"
  on public.publicacion_medios for delete to authenticated
  using (privado.publicacion_de_mi_org(publicacion_id));

-- Reportes: cualquiera reporta una publicación visible; solo moderación los lee.
create policy "reportes: cualquiera reporta"
  on public.reportes for insert to anon, authenticated
  with check (privado.publicacion_visible(publicacion_id));

-- Jornadas
create policy "jornadas: lectura pública"
  on public.jornadas for select to anon, authenticated
  using (privado.org_publica(organizacion_id));

create policy "jornadas: la fundación lee las suyas"
  on public.jornadas for select to authenticated
  using (organizacion_id = privado.mi_organizacion());

create policy "jornadas: fundaciones verificadas crean"
  on public.jornadas for insert to authenticated
  with check (
    privado.mi_rol() = 'fundacion'
    and organizacion_id = privado.mi_organizacion()
    and privado.org_publica(organizacion_id)
  );

create policy "jornadas: la fundación edita las suyas"
  on public.jornadas for update to authenticated
  using (privado.mi_rol() = 'fundacion' and organizacion_id = privado.mi_organizacion())
  with check (organizacion_id = privado.mi_organizacion());

create policy "jornadas: la fundación borra las suyas"
  on public.jornadas for delete to authenticated
  using (privado.mi_rol() = 'fundacion' and organizacion_id = privado.mi_organizacion());

-- Inscripciones: cualquiera se inscribe a una jornada pública; la lista solo la ve la fundación.
create policy "inscripciones: cualquiera se inscribe"
  on public.inscripciones_jornada for insert to anon, authenticated
  with check (privado.jornada_publica(jornada_id));

create policy "inscripciones: la fundación ve las de sus jornadas"
  on public.inscripciones_jornada for select to authenticated
  using (privado.jornada_de_mi_org(jornada_id));

create policy "inscripciones: la fundación confirma asistencia"
  on public.inscripciones_jornada for update to authenticated
  using (privado.jornada_de_mi_org(jornada_id))
  with check (privado.jornada_de_mi_org(jornada_id));
