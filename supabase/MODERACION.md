# Moderación (equipo, con service_role)

Sin panel en el fin de semana. Moderación verifica a una fundación o tienda solo al darla de alta y puede suspenderla. Ningún cliente (`anon`, `authenticated`) puede escribir `verificada`, `verificada_en` ni `suspendida`: no tienen GRANT de esas columnas.

Correr en el SQL Editor del proyecto o con `psql` como `postgres` (o un backend con la llave service_role). Registrar cada acción en `acciones_moderacion`.

## Aprobar o rechazar una solicitud

Desde T22 (migración `20261114220000_registro_por_rol.sql`) fundaciones, tiendas y repartidores se registran solos: la cuenta confirma su correo y llama a `public.solicitar_alta(...)`, que deja una fila `pendiente` en `public.solicitudes_alta` (sin acceso para `anon` ni `authenticated`). El servidor ya rechazó lo obvio (cuentas demo, correos desechables, teléfonos, RFC o nombres repetidos, acortadores, límites de envíos); el equipo revisa lo demás antes de aprobar: que el enlace exista y sea de la organización, que el teléfono conteste y que el nombre corresponda.

`aprobar_alta` y `rechazar_alta` solo las puede ejecutar `service_role` (o `postgres` en el SQL Editor). Ambas fallan si la solicitud ya no está pendiente y escriben en `acciones_moderacion`.

Ver pendientes (la más antigua primero) con el correo de la cuenta:

```sql
select s.id, s.rol, s.org_nombre, s.org_categoria, s.nombre_contacto, s.telefono, s.ciudad,
       s.rfc, s.enlace, s.org_descripcion, u.email, s.creada_en,
       (select count(*) from public.solicitudes_alta r
        where r.usuario_id = s.usuario_id and r.estado = 'rechazada') as rechazos_previos
from public.solicitudes_alta s
join auth.users u on u.id = s.usuario_id
where s.estado = 'pendiente'
order by s.creada_en;
```

Aprobar (una transacción: fundación y tienda reciben organización verificada con slug único; el repartidor solo perfil y empieza con el tope de voluntario nuevo de `privado.limite_repartidor`):

```sql
select public.aprobar_alta('<solicitud_id>', '<quien>');
```

Rechazar (el motivo lo ve la persona en la app; con 3 rechazos ya no puede volver a solicitar):

```sql
select public.rechazar_alta('<solicitud_id>', 'No pudimos verificar el enlace de la fundación', '<quien>');
```

### Tienda aprobada: habilitar el cobro (paso aparte)

Aprobar una tienda NO la deja cobrar: `crear-cobro` necesita su fila en `public.tiendas_cobro`, y esa la crea el equipo cuando la tienda ya entregó su cuenta de pey. Hasta entonces sus solicitudes no pueden cobrarse.

1. Guardar las credenciales de pey de la tienda como secreto del runtime de funciones (por ejemplo `PEY_TIENDA_ABARROTES_MARY`), con el formato descrito en `supabase/functions/crear-cobro/README.md`. Nunca en la base ni en el repositorio.
2. Crear la fila con el RFC que ya validó la solicitud:

```sql
begin;
insert into public.tiendas_cobro (organizacion_id, titular_nombre, rfc, clabe_ultimos4, credencial_ref)
select p.organizacion_id, '<titular de la cuenta>', s.rfc, '<4 dígitos o null>', 'PEY_TIENDA_ABARROTES_MARY'
from public.solicitudes_alta s
join public.perfiles p on p.id = s.usuario_id
where s.id = '<solicitud_id>' and s.estado = 'aprobada' and s.rol = 'tienda';
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
select '<quien>', 'habilitar_cobro', 'organizaciones', p.organizacion_id, 'Cuenta pey revisada'
from public.solicitudes_alta s join public.perfiles p on p.id = s.usuario_id
where s.id = '<solicitud_id>';
commit;
```

`public.alta_repartidor` ya no se puede llamar desde la app; el repartidor entra solo por solicitud aprobada.

## Dar de alta y verificar a mano

Solo para casos especiales (las cuentas demo o una alta que no pasó por la app).

```sql
begin;
-- 1. Organización (fundación con categoría; tienda sin categoría).
insert into public.organizaciones (tipo, categoria, nombre, slug, descripcion, verificada, verificada_en)
values ('fundacion', 'albergue', 'Albergue Ejemplo', 'albergue-ejemplo', 'Qué hace', true, now())
returning id;  -- usar este id abajo

-- 2. Perfil del usuario de Auth ya registrado (el rol sale solo de aquí).
insert into public.perfiles (id, rol, organizacion_id, nombre_visible)
values ('<auth.users.id>', 'fundacion', '<organizacion_id>', 'Nombre visible');

-- 3. Registro.
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'verificar', 'organizaciones', '<organizacion_id>', 'Documentos revisados');
commit;
```

Verificar una organización existente:

```sql
update public.organizaciones set verificada = true, verificada_en = now() where id = '<organizacion_id>';
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'verificar', 'organizaciones', '<organizacion_id>', '<motivo>');
```

## Suspender y reactivar

```sql
update public.organizaciones set suspendida = true where id = '<organizacion_id>';
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'suspender', 'organizaciones', '<organizacion_id>', '<motivo>');
-- Reactivar: suspendida = false y registrar accion = 'reactivar'.
```

Efecto de suspender:
- Fundación: deja de publicar (`privado.org_verificada`) y sus solicitudes, publicaciones y jornadas salen del directorio público (`privado.org_publica`).
- Tienda: ninguna solicitud nueva puede publicarse con ella (trigger `privado.al_cambiar_estado_solicitud`). Las solicitudes ya publicadas siguen visibles; cerrarlas o cancelarlas es decisión de moderación (`update public.solicitudes set estado = 'cancelada' where tienda_id = ...`).

## Publicar (lo hace la fundación)

`public.publicar_solicitud(p_tienda_id, p_titulo, p_articulos, p_descripcion)` (migración `20261114130000_publicar_solicitud.sql`) crea y publica en una transacción, con RLS de la fundación. `p_articulos` es `[{"articulo_id": "...", "cantidad": 3}]`. Rechaza: fundación sin verificar o suspendida, lista vacía, artículos de otra tienda o inactivos, tienda sin verificar o suspendida. El precio queda congelado al publicar.
