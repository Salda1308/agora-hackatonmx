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

Desde T25 (migración `20261115010000_imagen_solicitud.sql`) acepta un quinto parámetro opcional, `p_imagen`: la ruta que devuelve la Edge Function `t17-imagen` (`<organizacion_id>/<uuid>.jpg` en el bucket privado `publicaciones`, sin EXIF). Se guarda en `solicitudes.imagen_ruta`. El disparador `privado.validar_imagen_solicitud` rechaza (42501, "La imagen no pertenece a tu organización") rutas de otra carpeta, URLs libres y objetos que no existen. La política de storage "T25 imagen de solicitud visible" deja leer la imagen a quien puede ver la solicitud; `feed_publico` la devuelve en `medios`.

## Retirar la imagen de una solicitud

La solicitud sigue publicada y vuelve a mostrar la ilustración de su categoría. Correr como `postgres` y registrar la acción en `acciones_moderacion`:

```sql
-- 1. Ver la ruta.
select id, titulo, organizacion_id, imagen_ruta from public.solicitudes where id = '<solicitud_id>';
-- 2. Quitar el enlace: desde aquí ni el feed ni la política de storage la sirven.
update public.solicitudes set imagen_ruta = null where id = '<solicitud_id>';
```

Después borrar el archivo `publicaciones/<ruta>` desde Storage en el panel (o con la API de storage y `service_role`). No borrar la fila de `storage.objects` con SQL: deja el archivo huérfano. Las URLs firmadas ya entregadas caducan en una hora.

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

## Derechos ARCO (acceso, rectificación, cancelación y oposición)

Procedimiento interno para atender las solicitudes que llegan al correo ARCO del aviso de privacidad (`web/public/privacidad.html`, sección 7). El correo y el domicilio del responsable están por confirmar en ese aviso; esta sección no los inventa. Los plazos de respuesta de abajo (20 días hábiles para responder, 15 más para ejecutar) vienen de la ley anterior y quedan por confirmar con la revisión legal contra la LFPDPPP vigente (DOF 2025-03-20). Todo esto es operativo, no asesoría legal.

Correr como `postgres` o `service_role`. Registrar cada paso en `acciones_moderacion` (ver el final de la sección).

### 1. Verificar a la persona y ubicar la cuenta

Antes de entregar o tocar nada, confirmar que quien escribe es la titular: la solicitud debe llegar desde el correo de la cuenta, o pedir un dato que solo ella conozca (ciudad y fecha aproximada del alta). Pedir identificación solo si no queda otra forma, y no guardarla. No pedir ni guardar más datos de los que ya existen.

```sql
select id, email, created_at, email_confirmed_at from auth.users where email = '<correo>';
```

Usar ese `id` como `<uid>` en todo lo demás. Una persona que solo se inscribió a una jornada o pagó una donación puede no tener cuenta: ver el punto 2, partes C y D.

### 2. Acceso: reunir todo lo que se tiene de la persona

```sql
-- A. Perfil, solicitud de alta y organización asociada.
select * from public.perfiles where id = '<uid>';
select * from public.solicitudes_alta where usuario_id = '<uid>';
select o.id, o.tipo, o.nombre, o.slug, t.titular_nombre, t.rfc, t.clabe_ultimos4
from public.perfiles p
join public.organizaciones o on o.id = p.organizacion_id
left join public.tiendas_cobro t on t.organizacion_id = o.id
where p.id = '<uid>';

-- B. Actividad social.
select id, tipo, objetivo_id, texto, oculto, borrado_en, creado_en from public.comentarios where usuario_id = '<uid>';
select tipo, objetivo_id from public.me_gusta where usuario_id = '<uid>';
select comentario_id, motivo, estado from public.reportes_comentario where usuario_id = '<uid>';
select * from public.usuarios_bloqueados where usuario_id = '<uid>';

-- C. Reparto (si fue repartidor): tareas, eventos y fotos de entrega.
select t.id as tarea_id, t.estado, t.creada_en, e.id as entrega_id, e.foto_path, e.entregada_en, e.confirmada_en
from public.tareas t
left join public.entregas e on e.tarea_id = t.id
where t.repartidor_id = '<uid>';
select tarea_id, tipo, actor_rol, creado_en from public.eventos_tarea where actor_id = '<uid>';

-- D. Inscripciones a jornadas: no tienen enlace a la cuenta, se buscan por el texto que la persona dio.
select i.id, j.titulo, i.nombre_contacto, i.contacto, i.asistentes, i.estado, i.creada_en
from public.inscripciones_jornada i
join public.jornadas j on j.id = i.jornada_id
where i.contacto ilike '%<correo o teléfono>%' or i.nombre_contacto ilike '%<nombre>%';

-- E. Archivos en Storage a su nombre (fotos de entrega).
select bucket_id, name, created_at from storage.objects
where bucket_id = 'entregas' and owner = '<uid>';
```

Entregar la información en un archivo legible (texto o CSV) por el mismo correo, sin datos de terceras personas: los comentarios de otras cuentas, los datos de quien recibió una entrega y las fotos donde salgan otras personas no se incluyen. Los pagos no llevan datos de quien pagó (se descartaron los datos bancarios y el teléfono de cobro no se guarda), así que no hay nada que buscar por persona en `pagos` ni en `privado.limites_cobro`.

### 3. Rectificación

```sql
-- Nombre público que aparece en comentarios.
update public.perfiles set nombre_visible = '<nombre corregido>' where id = '<uid>';

-- Datos de la solicitud de alta (solo con service_role; el cliente no puede editarla después de enviarla).
update public.solicitudes_alta
set nombre_contacto = '<nombre>', telefono = '<10 dígitos>', ciudad = '<ciudad>'
where id = '<solicitud_alta_id>';

-- Inscripción a jornada.
update public.inscripciones_jornada set nombre_contacto = '<nombre>', contacto = '<contacto>' where id = '<inscripcion_id>';
```

El correo se cambia desde el panel de Auth (Authentication, Users), no con SQL. Si el dato corregido es el de una organización (nombre, descripción, dirección), es información de la organización y se corrige con el flujo de "Dar de alta y verificar a mano".

### 4. Cancelación (borrar la cuenta y sus datos)

Antes de borrar, revisar lo que debe conservarse por obligación o interés legítimo y decirlo en la respuesta: los pagos y pedidos se conservan sin datos personales (ya no llevan a la persona), y los registros de `acciones_moderacion` también. Si es la única cuenta de una organización, decidir con moderación qué pasa con la organización (la cancelación de la cuenta no la borra).

Orden obligatorio, porque lo que se borra al final deja de ser localizable:

```sql
-- 1. Fotos de entrega: anotar las rutas ANTES de borrar la cuenta.
select e.foto_path from public.entregas e
join public.tareas t on t.id = e.tarea_id
where t.repartidor_id = '<uid>' and e.foto_path is not null;
```

2. Borrar esos archivos del bucket `entregas` con la API de Storage y `service_role` (o desde el panel de Storage). No borrar filas de `storage.objects` con SQL: deja el archivo huérfano.

```sql
-- 3. Inscripciones a jornadas (no se borran solas porque no tienen enlace a la cuenta).
delete from public.inscripciones_jornada
where id in ('<inscripcion_id>', '<inscripcion_id>');

-- 4. Anotar la acción (el id borrado queda como evidencia, sin datos personales).
insert into public.acciones_moderacion (moderador, accion, objetivo_tabla, objetivo_id, motivo)
values ('<quien>', 'arco_cancelacion', 'auth.users', '<uid>', 'Solicitud ARCO de cancelación, folio <folio>');

-- 5. Borrar la cuenta. Es en cascada: perfiles, solicitudes_alta, comentarios, me_gusta,
--    reportes_comentario y usuarios_bloqueados desaparecen; tareas.repartidor_id y
--    eventos_tarea.actor_id quedan en null.
delete from auth.users where id = '<uid>';
```

Notas:

- Si la cuenta estaba bloqueada (`usuarios_bloqueados`), el bloqueo se pierde con el borrado y la persona podría crear otra cuenta. Si hay motivos de seguridad para recordarlo, anotarlo en `acciones_moderacion` antes de borrar y decidirlo con moderación.
- `privado.eventos_me_gusta` guarda solo el id y la hora para el límite de me gusta, se purga en cada acción y no tiene enlace a la cuenta: borrar a mano si quedaron filas (`delete from privado.eventos_me_gusta where usuario_id = '<uid>';`).
- Los comentarios de otras personas que respondan o mencionen a la cuenta no se tocan.

### 5. Oposición y revocación del consentimiento

Si la persona se opone a un uso concreto (por ejemplo, que se le muestre en comentarios) o revoca su consentimiento sin pedir el borrado:

```sql
-- Dejar de mostrar su nombre y sus comentarios sin borrar la cuenta.
update public.perfiles set nombre_visible = null where id = '<uid>';
update public.comentarios set oculto = true, oculto_en = now() where usuario_id = '<uid>';

-- Impedir que comente, dé me gusta o reporte (reversible).
insert into public.usuarios_bloqueados (usuario_id, motivo, bloqueado_por)
values ('<uid>', 'Oposición ARCO, folio <folio>', '<quien>');
```

Si la revocación impide seguir prestando el servicio (por ejemplo, una repartidora que ya no quiere que se guarde su teléfono), se explica en la respuesta y se pasa al punto 4.

### 6. Responder, plazos y registro

- Acusar recibo de la solicitud el mismo día y asignar un folio.
- Responder dentro del plazo (20 días hábiles, por confirmar) con el resultado: qué se entregó, rectificó, canceló o por qué no procede.
- Ejecutar lo procedente dentro de los 15 días hábiles siguientes a la respuesta (por confirmar).
- Fotos de entrega: conservarlas el tiempo que defina el aviso (propuesta: 12 meses, por confirmar) y borrarlas después con la misma regla de Storage del punto 4. Las solicitudes de alta rechazadas y las inscripciones a jornadas, igual (propuesta: 12 meses, por confirmar).
- Guardar en `acciones_moderacion` una fila por solicitud con folio, derecho ejercido y resultado. No copiar los datos personales entregados en el motivo.
- No guardar la identificación recibida: verla, confirmar y borrar el correo.
