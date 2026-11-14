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
