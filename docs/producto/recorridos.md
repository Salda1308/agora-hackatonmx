# Ágora: quién la usa y cómo es su recorrido

Cinco personas imaginadas (quien dona, fundación, tienda, moderación y administración), cada una con el recorrido que hoy puede hacer en la app: qué paso da, en qué pantalla y qué ve cuando algo está vacío, falla o hay que esperar. Donde el equipo ya acordó un cambio, el paso lo dice.

Ágora es un proyecto independiente. No es un producto oficial de pey ni de CoDi y no está afiliado a ellos.

Estado del documento: borrador del 26 de noviembre de 2026. Describe la app tal como está hoy y marca lo que el equipo acordó cambiar. Se revisó leyendo la app, sin ejecutar cobros ni usar servicios alojados, así que "la app muestra" significa que el texto está en la app, no que se probó en producción.

## Qué partes cambiarán

El equipo acordó el 26 de noviembre de 2026 varios cambios que todavía no están construidos. Mientras no lo estén, los recorridos siguen mostrando lo que existe. Cada paso afectado lleva una nota "Cambia con" o "Se elimina con" y el número del ticket de trabajo del equipo (AGO-xx). Lo que aún no existe se marca como "brecha" y no se describe.

| Cambio acordado | Ticket | Qué parte de este documento toca |
| --- | --- | --- |
| Se retira el rol de repartidor. La fundación recoge su pedido en la tienda con un código que ve en su panel; la tienda lo teclea y se cierra la entrega. No hay foto de entrega ni segundo código | AGO-75 | Se elimina el recorrido del repartidor (queda un anexo). Cambian la recepción de la fundación y la recogida de la tienda |
| Quien dona debe tener una cuenta con correo confirmado | AGO-77 | Quien dona: pagar, comprobante y "Siguiendo". También la inscripción a jornadas |
| La fundación pone una fecha límite. La tienda marca "listo" solo cuando se cumple la meta o vence la fecha. Con pagos hechos, solo moderación puede cancelar. Sin reembolsos desde la plataforma | AGO-76 | Publicar (fundación) y preparar el pedido (tienda) |
| La tienda declara cuánto stock tiene y cada solicitud puede pedir solo una parte | AGO-78 | Catálogo de la tienda y publicar una solicitud |
| La tienda se registra en dos pasos: primero la cuenta, luego el negocio | AGO-79 | Alta de la tienda |
| Límite de fotos y borrado de los archivos por plazos | AGO-81 | Publicar con imagen (los plazos están por confirmar con la revisión legal, AGO-45) |
| Moderación y administración se separan; moderación atiende PQR (peticiones, quejas y reclamos) | AGO-35, AGO-82, AGO-83 | Moderación y administración |

Los porcentajes y plazos exactos (cuánto del stock puede pedir una solicitud, hasta cuántos días dura la fecha límite) los fija el equipo y todavía no están definidos.

## Cómo leer las tablas

- Una ruta es la dirección interna de una pantalla. Empieza con `#/`, por ejemplo `#/solicitudes`.
- Una ventana es un recuadro que se abre sobre la pantalla actual. No tiene ruta propia.
- Los textos entre comillas son los que la persona ve en la app.
- Las personas no son personas reales. Se imaginaron a partir de roles. No hay nombres, edades, contactos ni testimonios. Lo que saben, el aparato que usan y lo que les preocupa son suposiciones para conversar con el equipo y con las organizaciones, no resultados de entrevistas.

## Las cinco personas

| Persona | Qué quiere lograr | Qué sabe y qué necesita entender | Aparato y contexto | Qué le preocupa |
| --- | --- | --- | --- | --- |
| 1. Quien dona (hoy sin cuenta; tendrá cuenta con AGO-77) | Cubrir unas unidades de una causa y saber qué pasó con su ayuda | Usa la banca móvil, pero puede no conocer CoDi ni la diferencia entre pagar, preparar y entregar | Su teléfono. Abre un enlace y cambia entre el navegador y el banco | Que le cobren dos veces, que la causa no sea confiable, perder el comprobante, que le pidan crear una cuenta antes de ayudar |
| 2. Persona de la fundación | Pedir cosas concretas con una fecha límite, compartir la solicitud y recoger el pedido cuando esté listo | Conoce lo que necesita su organización; no necesariamente entiende catálogo, verificación o estados digitales | Teléfono durante la operación y computadora para escribir | Publicar algo incorrecto, no poder activar su cuenta, no poder ir por el pedido, que el código no funcione en el mostrador |
| 3. Persona de la tienda | Mantener sus precios y su stock, preparar lo que ya se pagó y entregarlo a la fundación que corresponde | Conoce su inventario y sus precios; necesita distinguir una solicitud de un pedido ya pagado y saber cuándo puede marcar "listo" | Teléfono o computadora en el mostrador, con interrupciones | Preparar algo sin pago, tener un precio o un stock viejo, que una solicitud le pida más de lo que puede dar, entregar a la persona equivocada |
| 4. Persona del equipo que modera (cambia con AGO-35 y AGO-82) | Validar altas, atender PQR y reportes, resolver problemas y dejar registro | Entiende los criterios para verificar; se supone poca experiencia con herramientas técnicas | Computadora, trabajo por lotes y atención a incidentes | Aprobar algo que no debía, exponer datos de contacto, ejecutar una acción equivocada |
| 5. Persona de administración (1 o 2 personas del equipo; sin pantalla en la app hasta AGO-83) | Ver informes, repartir trabajo entre moderadores, habilitar el cobro de las tiendas y cuidar lo técnico | Entiende el sistema completo; se supone que no es especialista en seguridad ni en bases de datos | Computadora, con procedimientos escritos | Habilitar un cobro por error, dar acceso de más, perder el hilo de lo que hizo cada moderador, que la plataforma se pause sin que nadie lo note |

Quien visita Ágora sin cuenta no tiene ficha propia: hace los primeros pasos del recorrido 1. Puede mirar solicitudes, el feed y el panel público, y reportar una publicación, pero no donar. El rol de repartidor voluntario existe hoy y se retira (ver el anexo).

## Recorrido 1. Quien dona: descubrir, donar y consultar

Hoy no necesita cuenta. Con AGO-77 empezará creando una cuenta y confirmando su correo. Los pasos 1 a 3 los puede hacer cualquiera sin cuenta; donar exige cuenta.

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Entender la causa | `#/` (Inicio) | Ve una portada con Coco (la mascota de Ágora), una causa destacada, categorías y causas abiertas, y debajo las novedades. Espera: "Buscando novedades…" y "Buscando causas abiertas…". Vacío: "La comunidad está por encontrarse" o "No hay causas abiertas por ahora." Falla: un aviso con el botón "Reintentar" |
| 2. Explorar solicitudes | `#/solicitudes` (Directorio) | Filtra y abre una tarjeta. Espera: "Buscando solicitudes…". Vacío: "Por aquí no hay nada todavía". Falla: aviso y "Reintentar" |
| 3. Revisar qué se necesita, la tienda y el avance | `#/solicitudes/:id` (Detalle de la solicitud) | Ve la descripción, las unidades, la tienda y el seguimiento, y elige cuántas unidades pagar. Espera: "Cargando solicitud…". Si no existe: "No encontramos esa solicitud". Falla: aviso y reintento. La barra de avance es del conjunto, no es el comprobante de una persona |
| 4. Elegir unidades y forma de pago | Misma ruta, formulario de donación | Elige entre código QR, solicitud al banco o enlace CoDi. El pago ocurre en el banco, fuera de Ágora. El botón se bloquea mientras se envía para no cobrar dos veces. Si hay un error claro, puede corregir. Si el resultado es incierto, la app conserva el intento y pide no repetirlo. En el piloto cada cobro tiene un tope de $200. **Cambia con AGO-77:** pedirá sesión con correo confirmado antes de pagar. **Cambia con AGO-76:** la solicitud tendrá fecha límite y se cerrará sola al cumplir la meta. Por ahora no hay reembolsos desde la plataforma (los términos están por revisar con asesoría legal) |
| 5. Esperar la confirmación | Misma ruta, estado del pago | Espera: "Consultando tu pago…" y "La confirmación puede tardar unos segundos." La app vuelve a consultar sola. Si no logra consultar: "No pudimos consultar la confirmación. Conserva esta pantalla; volveremos a consultar." Si se vence: "El cobro expiró sin confirmación." Si se confirma, aparece "¡Tu ayuda ya sumó!" con el comprobante. Volver del banco no basta para dar el pago por confirmado. **Cambia con AGO-77:** el comprobante quedará ligado a la cuenta, con folio en pantalla. Quien dona no recibirá un correo ni un mensaje de pago: si cierra la pantalla, lo recupera al volver a entrar |
| 6. Recuperar el comprobante | `#/siguiendo` (Siguiendo) | "Mis comprobantes" muestra los pagos hechos desde esta pestaña del navegador. Espera: "Consultando comprobante…". Pendiente: "Pago pendiente de confirmación." Falla: "No pudimos consultar este comprobante." Vacío: una invitación a explorar solicitudes. **Cambia con AGO-77:** pasará a una pantalla "mis donaciones" ligada a la cuenta (brecha: todavía no existe) |

Dónde termina hoy: con un comprobante del pago y el seguimiento público de la solicitud. El comprobante no prueba por sí solo que la entrega ocurrió. Con la cuenta, quien dona también podrá comentar, inscribirse a jornadas y enviar una PQR; esas pantallas no se describen aquí porque no son parte del circuito de donar.

## Recorrido 2. Fundación: obtener acceso, publicar y recibir

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Crear cuenta, confirmar el correo y pedir el alta | `#/crear-cuenta`, `#/entrar`, `#/registro/fundacion` y `#/registro` | Confirma su correo y pide el alta. Una persona del equipo la revisa; no hay un plazo prometido. Según el diseño acordado, el alta se pide desde una cuenta con correo confirmado. Espera: "Buscando tu solicitud…". Si aún no hay solicitud, puede elegir su rol. Mientras se revisa, la app lo dice. Si se rechaza, muestra el motivo. Falla: "No pudimos ver tu solicitud" con opción de reintentar. A veces: "Tu acceso aún se está activando. Espera unos segundos y vuelve a intentar." |
| 2. Entrar a sus solicitudes | `#/fundacion` (Mis solicitudes) | Sin permiso: "Solo para fundaciones". Espera: "Cargando solicitudes…". Falla: "No se pudieron cargar" y "Reintentar". Vacío: "Aún no pides nada". Si la organización aún no está verificada o está suspendida, la app explica que podrá publicar cuando el equipo la active |
| 3. Elegir una tienda | `#/fundacion/publicar`, o la ventana "Nueva solicitud" desde la lista (paso 1) | Espera: "Cargando tiendas…". Vacío: "Sin tiendas por ahora" y "Aún no hay tiendas verificadas." Falla: "No se pudo cargar el catálogo". Con una sola tienda puede saltarse la elección |
| 4. Elegir artículos y cantidades | Misma ventana (paso 2) | Los artículos y sus precios salen del catálogo de la tienda; la fundación no escribe precios. Espera: "Cargando catálogo…". Vacío: "Catálogo vacío" y "Esta tienda aún no tiene artículos." No puede seguir sin una selección válida |
| 5. Revisar y publicar | Misma ventana (paso 3) | Escribe título y descripción, agrega una imagen si quiere y revisa el resumen. Una imagen inválida o un error al publicar aparecen junto al formulario. Mientras se envía no se puede duplicar. Éxito: "¡Publicada!" y regresa a la lista. **Cambia con AGO-76:** al publicar pondrá una fecha límite, sin pasar de un máximo que fijará el equipo (brecha: hoy no hay ese campo) y podrá cancelar solo si no hay pagos ni reservas (brecha: hoy la lista solo muestra el estado "Cancelada"). Después de la primera donación no podrá editar el título ni la descripción. **Cambia con AGO-78:** cada artículo podrá pedirse hasta un porcentaje del stock que declaró la tienda, y cada solicitud tendrá una sola tienda (brecha: hoy no hay stock). **Cambia con AGO-81:** habrá un máximo de fotos por publicación y por organización al día, y se les quitarán los metadatos |
| 6. Compartir y cuidar su página | `#/solicitudes/:id` (Detalle de la solicitud) y `#/fundacion/organizacion` (Mi página) | En el detalle ve el avance. En "Mi página" gestiona los datos de su organización y sus publicaciones. Una solicitud que no aparece en el público no significa que haya fallado la publicación: se revisa en su estado |
| 7. Confirmar lo recibido | `#/fundacion`, sección Recepciones | Revisa los artículos y la foto, escribe el código que muestra quien entrega y pulsa "Confirmar recibido". Espera: "Confirmando…". Si el código es incorrecto, ve cuántos intentos le quedan; tras varios errores se bloquea y el equipo lo revisa. Éxito: "Recibida". Si no hay entregas, si está cargando o si falla la lectura, la sección no aparece. **Se elimina con AGO-75:** desaparecen esta confirmación aparte, el código del repartidor y la foto de entrega. En su lugar (brecha: esa pantalla no existe todavía): cuando el pedido esté listo, la fundación verá en su panel el código de recogida, una persona de la fundación lo mostrará en la tienda y la tienda lo escribirá. Varios intentos fallidos bloquean el código. La confirmación de la tienda es la prueba de la entrega |

Dónde termina hoy: con la recepción confirmada por la fundación. Con AGO-75 el cierre pasa a la tienda, al escribir el código de recogida de la fundación.

## Recorrido 3. Tienda: habilitarse, mantener el catálogo y entregar

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Pedir el alta y ver su acceso | `#/crear-cuenta`, `#/registro/tienda` y `#/registro` | Mismo camino de correo y revisión que la fundación, con el formulario de tienda. La espera, la falta de solicitud y los errores se muestran en la pantalla de registro. Aprobar el alta no activa por sí solo el cobro: es un paso aparte del equipo. **Cambia con AGO-79:** el registro será en dos pasos, cuenta y luego negocio, con los datos fiscales y de cobro aparte de los datos públicos. **Cambia con AGO-35:** moderación validará el cobro y administración lo habilitará (brecha: esas pantallas no existen todavía) |
| 2. Cargar o mantener el catálogo | `#/tienda/catalogo` (Catálogo) | Agrega artículos, cambia precios, oculta o muestra, e importa un CSV (un archivo de tabla en texto). Espera: "Cargando catálogo…". Vacío: "Tu catálogo está vacío". Falla: "No se pudo cargar" y reintento. Los formularios señalan errores de nombre o precio. La importación avisa qué filas tienen error y no se importan. Al cambiar un precio, la app avisa que las solicitudes ya publicadas conservan el precio anterior. **Cambia con AGO-78:** el catálogo, y el archivo CSV, tendrán una columna de stock declarado. Cada solicitud podrá pedir como máximo un porcentaje de ese stock, restando lo ya pedido en solicitudes abiertas (brecha: todavía no existe) |
| 3. Ver qué está pagado | `#/tienda` (Pedidos) | Agrupa "Por preparar" y "Listos", con unidades y total pagado. Espera: "Cargando pedidos…". Vacío: "Sin pedidos por ahora" y "Cuando alguien pague, el pedido aparece aquí." Falla al cargar: reintento. Si la tienda está suspendida, la app avisa que no recibirá pedidos nuevos |
| 4. Preparar y marcar listo | Misma ruta, Pedidos | Pulsa "Marcar listo" sobre lo que preparó. Espera: "Marcando…", con las acciones bloqueadas. Si falla, el error aparece en ese pedido. Una necesidad que aún no se pagó no cuenta como pedido para preparar. **Cambia con AGO-76:** la opción "ya tengo listo el pedido" aparecerá solo cuando se cumpla la meta de la solicitud o venza la fecha límite. Si la fecha vence sin meta, la tienda prepara solo lo pagado. Con AGO-78 confirmará además que tiene todo lo pedido |
| 5. Entregar a la persona correcta | Misma ruta, ventana de recogida | Hoy escribe el código que le muestra el voluntario. Si aún no hay voluntario: "Esperando a que un voluntario tome la recogida." Un código incorrecto gasta intentos; tras varios errores se bloquea y el equipo lo revisa. El pedido pasa a "Recogido" y después puede mostrar "Entregado". **Cambia con AGO-75:** el código lo mostrará una persona de la fundación y, al escribirlo la tienda, se cierra la entrega, sin foto ni segundo código |
| 6. Revisar su página y su cuenta | `#/tienda/organizacion` (Mi tienda) y `#/cuenta` (Cuenta) | "Mi tienda" es la página pública de la tienda. "Cuenta" resume pedidos y catálogo según los permisos. Mientras lee, muestra indicadores de carga. Si una parte no se puede leer, esa parte se omite, así que la ausencia de algo no prueba que no exista |

Dónde termina hoy: con la recogida confirmada. El estado "Entregado" depende de la recepción posterior de la fundación. Con AGO-75, la recogida confirmada cierra la entrega.

## Recorrido 4. Moderación: revisar y resolver

Este recorrido es parcial: hoy no existe una pantalla de moderación en la app. El equipo revisa fuera de la app. Se describe hasta donde llega la app y el resto se marca como brecha, sin imaginar una pantalla.

Según el diseño acordado, moderación valida las altas de fundaciones y tiendas, atiende PQR y reportes de fallos, retira contenido, bloquea cuentas, suspende o invalida organizaciones y da de baja cuentas, siempre con un motivo. Solo puede ver los datos de contacto de otras personas en lo necesario, y cada consulta queda registrada. No habilita el cobro de una tienda: moderación lo valida y administración lo habilita (recorrido 5). Cada acción de moderación y administración queda registrada con la cuenta y el motivo.

| Paso | Pantalla o brecha | Qué ve y qué pasa en cada situación |
| --- | --- | --- |
| 1. Revisar lo que el público ve de una organización | `#/organizaciones/:slug` (página de la organización) y `#/solicitudes/:id` (Detalle de la solicitud) | Ve lo mismo que cualquier visitante, sin controles de moderación. Estas pantallas tienen carga, error y "no encontrado". No sustituyen revisar una solicitud de alta pendiente, que puede no tener todavía una página pública |
| 2. Revisar altas pendientes y decidir | Brecha: sin pantalla hoy | El equipo decide fuera de la app. No hay bandeja, aviso de "sin pendientes", indicador de espera ni error de revisión dentro de Ágora. La persona que pidió el alta sí ve el resultado en la pantalla de registro. **Cambia con AGO-35:** habrá una pantalla con la lista de pendientes, aprobar y rechazar con motivo |
| 3. Suspender o invalidar una organización y validar el cobro de una tienda | Brecha: sin pantalla hoy | Aprobar una tienda no activa su cobro. Dentro de Ágora no hay mensajes de éxito, error ni progreso para estas acciones. La organización suspendida sí ve el aviso en sus pantallas. **Cambia con AGO-35:** habrá una pantalla de moderación con registro |
| 4. Recibir reportes, PQR y resolver bloqueos | Los reportes se envían desde la página de una organización y desde los comentarios del Inicio; resolverlos es una brecha | Quien reporta una publicación no ve una cola ni un plazo de atención. Los bloqueos por código se avisan en las pantallas de tienda y fundación, pero no hay pantalla para que moderación los resuelva. **Cambia con AGO-82:** las PQR y los reportes de fallos, que podrán enviar quienes tengan cuenta, llegarán a un espacio de moderación con estado y registro |
| 5. Verificar el resultado | La pantalla de registro, para quien pidió el alta | La persona ve si su solicitud está pendiente, aprobada o rechazada. Moderación no tiene hoy un historial dentro de la app |

## Recorrido 5. Administración: informes, equipo y parte técnica

Este recorrido no tiene pantalla hoy: es una función de una o dos personas del equipo, fuera de la app hasta que llegue el tablero de administración (AGO-83, después del 12 de diciembre de 2026). Se describe según lo acordado, sin imaginar una pantalla.

| Paso | Pantalla o brecha | Qué hace y qué pasa en cada situación |
| --- | --- | --- |
| 1. Ver informes y repartir trabajo | Brecha: sin pantalla hoy | Ve informes y asigna tareas a moderadores. Qué contiene un informe todavía no está definido. **Cambia con AGO-83:** habrá un tablero de administración |
| 2. Dar de alta o de baja a moderadores | Brecha: sin pantalla hoy | Solo administración. Cuando alguien sale del equipo, se le quita el acceso |
| 3. Habilitar el cobro de una tienda | Brecha: sin pantalla hoy | Moderación valida y administración habilita. Hoy es un paso del equipo aparte de aprobar la tienda. **Cambia con AGO-35** |
| 4. Cuidar lo técnico y que la plataforma siga activa | Brecha: sin pantalla hoy | Hace lo técnico que moderación no puede hacer. El equipo revisa a diario si algo falló y visita la plataforma cada pocos días para que no se pause. Si la base de datos se pausa, la web no carga datos |
| 5. Dejar registro | Registro interno, sin pantalla | Cada acción queda con la cuenta que la hizo y el motivo |

## Anexo. Lo que se retira: repartidor voluntario

El rol de repartidor voluntario existe hoy y se retira con AGO-75. No se describen sus pasos porque ninguna de sus pantallas se conserva. Su trabajo pasa así:

- Elegir una tarea y recoger en la tienda: lo hace la fundación, que ve su pedido listo y su código de recogida.
- Mostrar el código en el mostrador y cerrar la entrega: una persona de la fundación muestra el código y la tienda lo escribe.
- Foto de entrega, segundo código, historial y reconocimiento del repartidor: se retiran.
- Las jornadas de voluntariado de empresas son otra función y se mantienen; la inscripción usará la misma cuenta de quien dona.

## Lo que este documento no hace

- No describe cuentas, contactos ni datos de personas reales: las personas son imaginadas.
- No promete plazos, ni una fecha para los cambios marcados.
- No es una certificación de accesibilidad. Revisar si Ágora es fácil de leer y de usar para todas las personas es un trabajo aparte.
