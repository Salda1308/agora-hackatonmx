# Moderación (equipo, con service_role)

Sin panel en el fin de semana. Moderación verifica a una fundación o tienda solo al darla de alta y puede suspenderla. Ningún cliente (`anon`, `authenticated`) puede escribir `verificada`, `verificada_en` ni `suspendida`: no tienen GRANT de esas columnas.

Correr en el SQL Editor del proyecto o con `psql` como `postgres` (o un backend con la llave service_role). Registrar cada acción en `acciones_moderacion`.

## Dar de alta y verificar

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

## Moderar comentarios y bloquear usuarios

Migración `20261114230000_feed_social.sql` (T24). Los clientes solo comentan, dan me gusta, reportan y borran por RPC; las tablas `comentarios`, `me_gusta`, `reportes_comentario` y `usuarios_bloqueados` no tienen privilegios para `anon` ni `authenticated`. Correr lo de abajo en el SQL Editor o con `psql` como `postgres` y registrar cada acción en `acciones_moderacion`.

Reglas automáticas (en servidor): texto de 1 a 500 caracteres sin controles, enlaces, correos ni teléfonos; nada de repetir el mismo texto en 10 minutos; máximo 5 comentarios en 10 minutos y 30 en 24 horas; máximo 60 me gusta o quitar en 10 minutos; solo cuentas con correo confirmado; un reporte por cuenta y comentario. Con 3 reportes de cuentas distintas el comentario queda `oculto = true` y deja de mostrarse, pero se conserva para revisión. Las cuentas `@demo.agora.test` pueden participar con los mismos límites.

Ver comentarios reportados u ocultos:

```sql
select c.id, c.tipo, c.objetivo_id, c.usuario_id, u.email, c.texto, c.oculto, c.borrado_en,
       count(r.*) as reportes, string_agg(r.motivo, ' | ') as motivos
from public.comentarios c
join auth.users u on u.id = c.usuario_id
left join public.reportes_comentario r on r.comentario_id = c.id
group by c.id, u.email
having count(r.*) > 0 or c.oculto
order by c.oculto desc, reportes desc;
```

Ocultar, restaurar o borrar un comentario:

```sql
update public.comentarios set oculto = true, oculto_en = now() where id = '<comentario_id>';
-- Restaurar uno ocultado por error (los reportes quedan atendidos para que no vuelva a ocultarse solo por ellos).
update public.comentarios set oculto = false, oculto_en = null where id = '<comentario_id>';
update public.reportes_comentario set estado = 'descartado' where comentario_id = '<comentario_id>';
-- Borrado lógico (lo mismo que hace public.borrar_comentario con service_role).
update public.comentarios set borrado_en = now() where id = '<comentario_id>';
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'ocultar_comentario', 'comentarios', '<comentario_id>', '<motivo>');
```

Nota: un comentario restaurado con 3 o más reportes no se vuelve a ocultar solo, porque el ocultado automático solo ocurre al llegar un reporte nuevo de otra cuenta.

Bloquear y desbloquear una cuenta (no puede comentar, dar me gusta ni reportar; sus comentarios dejan de mostrarse mientras siga bloqueada):

```sql
insert into public.usuarios_bloqueados (usuario_id, motivo, bloqueado_por)
values ('<auth.users.id>', '<motivo>', '<quien>');
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'bloquear_usuario', 'usuarios_bloqueados', '<auth.users.id>', '<motivo>');

-- Desbloquear: sus comentarios vuelven a verse.
delete from public.usuarios_bloqueados where usuario_id = '<auth.users.id>';
```

Buscar la cuenta por correo: `select id from auth.users where email = '<correo>';`. La interfaz nunca muestra el correo: el autor aparece con `perfiles.nombre_visible` o como "Vecino XXXX".
