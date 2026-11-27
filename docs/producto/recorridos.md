# Ágora: quién la usa y cómo es su recorrido

Cinco personas imaginadas, cada una con el recorrido que hoy puede hacer en la app: qué paso da, en qué pantalla y qué ve cuando algo está vacío, falla o hay que esperar.

Ágora es un proyecto independiente. No es un producto oficial de pey ni de CoDi y no está afiliado a ellos.

Estado del documento: borrador del 26 de noviembre de 2026. Describe la app tal como está hoy. Se revisó leyendo la app, sin ejecutar cobros ni usar servicios alojados, así que "la app muestra" significa que el texto está en la app, no que se probó en producción.

## Qué partes cambiarán

El equipo decidió el 26 de noviembre de 2026 varios cambios que todavía no están construidos. Mientras no lo estén, los recorridos siguen mostrando lo que existe. Cada paso afectado lleva una nota "Cambia con" o "Se elimina con" y el número del ticket de trabajo del equipo (AGO-xx). Lo que aún no existe se marca como "brecha" y no se describe.

| Cambio decidido | Ticket | Qué parte de este documento toca |
| --- | --- | --- |
| Se elimina al repartidor. La fundación recoge su pedido en la tienda | AGO-75 | La persona 4 y el recorrido 4 desaparecen. Cambian el paso de recepción de la fundación y el de recogida de la tienda |
| Quien dona debe tener una cuenta | AGO-77 | La persona 1 y el recorrido 1 (pagar, comprobante y "Siguiendo") |
| La tienda marca "listo" solo cuando se cumple la meta; la solicitud tiene fecha límite | AGO-76 | Publicar (fundación) y preparar el pedido (tienda) |
| La tienda declara cuánto stock tiene y cada solicitud puede pedir solo una parte | AGO-78 | Catálogo de la tienda |
| La tienda se registra en dos pasos: primero la cuenta, luego el negocio | AGO-79 | Alta de la tienda |
| Moderación y administración se separan; moderación atiende PQR (peticiones, quejas y reclamos) | AGO-35, AGO-82, AGO-83 | Persona 5 y recorrido 5 |

## Cómo leer las tablas

- Una ruta es la dirección interna de una pantalla. Empieza con `#/`, por ejemplo `#/solicitudes`.
- Una ventana es un recuadro que se abre sobre la pantalla actual. No tiene ruta propia.
- Los textos entre comillas son los que la persona ve en la app.
- Las personas no son personas reales. Se imaginaron a partir de roles. No hay nombres, edades, contactos ni testimonios. Lo que saben, el aparato que usan y lo que les preocupa son suposiciones para conversar con el equipo y con las organizaciones, no resultados de entrevistas.

## Las cinco personas

| Persona | Qué quiere lograr | Qué sabe y qué necesita entender | Aparato y contexto | Qué le preocupa |
| --- | --- | --- | --- | --- |
| 1. Quien dona (hoy sin cuenta; tendrá cuenta con AGO-77) | Cubrir unas unidades de una causa y saber qué pasó con su ayuda | Usa la banca móvil, pero puede no conocer CoDi ni la diferencia entre pagar, preparar y entregar | Su teléfono. Abre un enlace y cambia entre el navegador y el banco | Que le cobren dos veces, que la causa no sea confiable, perder el comprobante |
| 2. Persona de la fundación | Pedir cosas concretas, compartir la solicitud y confirmar lo que recibió | Conoce lo que necesita su organización; no necesariamente entiende catálogo, verificación o estados digitales | Teléfono durante la operación y computadora para escribir | Publicar algo incorrecto, no poder activar su cuenta, confirmar una entrega que no recibió |
| 3. Persona de la tienda | Mantener sus precios, preparar lo que ya se pagó y entregarlo a quien corresponde | Conoce su inventario y sus precios; necesita distinguir una solicitud de un pedido ya pagado | Teléfono o computadora en el mostrador, con interrupciones | Preparar algo sin pago, tener un precio viejo, entregar a la persona equivocada |
| 4. Repartidor voluntario (se elimina con AGO-75) | Elegir una tarea posible, recoger, entregar y que se reconozca su ayuda | Usa mapas y cámara; no conoce las reglas iniciales ni los códigos | Teléfono, conexión variable, en movimiento | Hacer un viaje inútil, no poder subir la foto, que la entrega no cuente |
| 5. Persona del equipo que modera (cambia con AGO-35 y AGO-82) | Revisar altas y reportes, resolver problemas y dejar registro | Entiende los criterios para verificar; se supone poca experiencia con herramientas técnicas | Computadora, trabajo por lotes y atención a incidentes | Aprobar algo que no debía, exponer información, ejecutar una acción equivocada |

Con las decisiones nuevas, la administración (la persona que cuida lo técnico, fuera de la app) queda como una función aparte de moderación. Todavía no tiene ficha propia.

## Recorrido 1. Quien dona: descubrir, donar y consultar

Hoy no necesita cuenta. Con AGO-77 empezará creando una cuenta y confirmando su correo.

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Entender la causa | `#/` (Inicio) | Ve una portada con Coco (la mascota de Ágora), una causa destacada, categorías y causas abiertas, y debajo las novedades. Espera: "Buscando novedades…" y "Buscando causas abiertas…". Vacío: "La comunidad está por encontrarse" o "No hay causas abiertas por ahora." Falla: un aviso con el botón "Reintentar" |
| 2. Explorar solicitudes | `#/solicitudes` (Directorio) | Filtra y abre una tarjeta. Espera: "Buscando solicitudes…". Vacío: "Por aquí no hay nada todavía". Falla: aviso y "Reintentar" |
| 3. Revisar qué se necesita, la tienda y el avance | `#/solicitudes/:id` (Detalle de la solicitud) | Ve la descripción, las unidades, la tienda y el seguimiento, y elige cuántas unidades pagar. Espera: "Cargando solicitud…". Si no existe: "No encontramos esa solicitud". Falla: aviso y reintento. La barra de avance es del conjunto, no es el comprobante de una persona |
| 4. Elegir unidades y forma de pago | Misma ruta, formulario de donación | Elige entre código QR, solicitud al banco o enlace CoDi. El pago ocurre en el banco, fuera de Ágora. El botón se bloquea mientras se envía para no cobrar dos veces. Si hay un error claro, puede corregir. Si el resultado es incierto, la app conserva el intento y pide no repetirlo. En el piloto cada cobro tiene un tope de $200. **Cambia con AGO-77:** pedirá sesión antes de pagar. **Cambia con AGO-76:** la solicitud tendrá fecha límite y se cerrará sola al cumplir la meta |
| 5. Esperar la confirmación | Misma ruta, estado del pago | Espera: "Consultando tu pago…" y "La confirmación puede tardar unos segundos." La app vuelve a consultar sola. Si no logra consultar: "No pudimos consultar la confirmación. Conserva esta pantalla; volveremos a consultar." Si se vence: "El cobro expiró sin confirmación." Si se confirma, aparece "¡Tu ayuda ya sumó!" con el comprobante. Volver del banco no basta para dar el pago por confirmado. **Cambia con AGO-77:** el comprobante quedará ligado a la cuenta |
| 6. Recuperar el comprobante | `#/siguiendo` (Siguiendo) | "Mis comprobantes" muestra los pagos hechos desde esta pestaña del navegador. Espera: "Consultando comprobante…". Pendiente: "Pago pendiente de confirmación." Falla: "No pudimos consultar este comprobante." Vacío: una invitación a explorar solicitudes. **Cambia con AGO-77:** pasará a una pantalla "mis donaciones" ligada a la cuenta (brecha: todavía no existe) |

Dónde termina hoy: con un comprobante del pago y el seguimiento público de la solicitud. El comprobante no prueba por sí solo que la entrega ocurrió.

## Recorrido 2. Fundación: obtener acceso, publicar y recibir

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Crear cuenta, confirmar el correo y pedir el alta | `#/crear-cuenta`, `#/entrar`, `#/registro/fundacion` y `#/registro` | Confirma su correo y pide el alta. Una persona del equipo la revisa; no hay un plazo prometido. Espera: "Buscando tu solicitud…". Si aún no hay solicitud, puede elegir su rol. Mientras se revisa, la app lo dice. Si se rechaza, muestra el motivo. Falla: "No pudimos ver tu solicitud" con opción de reintentar. A veces: "Tu acceso aún se está activando. Espera unos segundos y vuelve a intentar." |
| 2. Entrar a sus solicitudes | `#/fundacion` (Mis solicitudes) | Sin permiso: "Solo para fundaciones". Espera: "Cargando solicitudes…". Falla: "No se pudieron cargar" y "Reintentar". Vacío: "Aún no pides nada". Si la organización aún no está verificada o está suspendida, la app explica que podrá publicar cuando el equipo la active |
| 3. Elegir una tienda | `#/fundacion/publicar`, o la ventana "Nueva solicitud" desde la lista (paso 1) | Espera: "Cargando tiendas…". Vacío: "Sin tiendas por ahora" y "Aún no hay tiendas verificadas." Falla: "No se pudo cargar el catálogo". Con una sola tienda puede saltarse la elección |
| 4. Elegir artículos y cantidades | Misma ventana (paso 2) | Los artículos y sus precios salen del catálogo de la tienda; la fundación no escribe precios. Espera: "Cargando catálogo…". Vacío: "Catálogo vacío" y "Esta tienda aún no tiene artículos." No puede seguir sin una selección válida |
| 5. Revisar y publicar | Misma ventana (paso 3) | Escribe título y descripción, agrega una imagen si quiere y revisa el resumen. Una imagen inválida o un error al publicar aparecen junto al formulario. Mientras se envía no se puede duplicar. Éxito: "¡Publicada!" y regresa a la lista. **Cambia con AGO-76:** al publicar pondrá una fecha límite de hasta 20 días (brecha: hoy no hay ese campo) y podrá cancelar solo si no hay pagos (brecha: hoy la lista solo muestra el estado "Cancelada") |
| 6. Compartir y cuidar su página | `#/solicitudes/:id` (Detalle de la solicitud) y `#/fundacion/organizacion` (Mi página) | En el detalle ve el avance. En "Mi página" gestiona los datos de su organización y sus publicaciones. Una solicitud que no aparece en el público no significa que haya fallado la publicación: se revisa en su estado |
| 7. Confirmar lo recibido | `#/fundacion`, sección Recepciones | Revisa los artículos y la foto, escribe el código que muestra quien entrega y pulsa "Confirmar recibido". Espera: "Confirmando…". Si el código es incorrecto, ve cuántos intentos le quedan; tras varios errores se bloquea y el equipo lo revisa. Éxito: "Recibida". Si no hay entregas, si está cargando o si falla la lectura, la sección no aparece. **Se elimina o cambia con AGO-75:** desaparecen el código del repartidor y la foto de entrega. La fundación vería en su panel el código de recogida y lo llevaría a la tienda (brecha: esa pantalla no existe todavía) |

Dónde termina hoy: con la recepción confirmada por la fundación. Con AGO-75 el cierre pasaría a la tienda, al escribir el código de recogida.

## Recorrido 3. Tienda: habilitarse, mantener el catálogo y entregar

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Pedir el alta y ver su acceso | `#/crear-cuenta`, `#/registro/tienda` y `#/registro` | Mismo camino de correo y revisión que la fundación, con el formulario de tienda. La espera, la falta de solicitud y los errores se muestran en la pantalla de registro. Aprobar el alta no activa por sí solo el cobro: es un paso aparte del equipo. **Cambia con AGO-79:** el registro será en dos pasos, cuenta y luego negocio. **Cambia con AGO-35:** moderación validará el cobro y administración lo habilitará (brecha: esas pantallas no existen todavía) |
| 2. Cargar o mantener el catálogo | `#/tienda/catalogo` (Catálogo) | Agrega artículos, cambia precios, oculta o muestra, e importa un CSV (un archivo de tabla en texto). Espera: "Cargando catálogo…". Vacío: "Tu catálogo está vacío". Falla: "No se pudo cargar" y reintento. Los formularios señalan errores de nombre o precio. La importación avisa qué filas tienen error y no se importan. Al cambiar un precio, la app avisa que las solicitudes ya publicadas conservan el precio anterior. **Cambia con AGO-78:** el catálogo tendrá una columna de stock (brecha: todavía no existe) |
| 3. Ver qué está pagado | `#/tienda` (Pedidos) | Agrupa "Por preparar" y "Listos", con unidades y total pagado. Espera: "Cargando pedidos…". Vacío: "Sin pedidos por ahora" y "Cuando alguien pague, el pedido aparece aquí." Falla al cargar: reintento. Si la tienda está suspendida, la app avisa que no recibirá pedidos nuevos |
| 4. Preparar y marcar listo | Misma ruta, Pedidos | Pulsa "Marcar listo" sobre lo que preparó. Espera: "Marcando…", con las acciones bloqueadas. Si falla, el error aparece en ese pedido. Una necesidad que aún no se pagó no cuenta como pedido para preparar. **Cambia con AGO-76:** la opción "ya tengo listo el pedido" aparecerá solo cuando se cumpla la meta de la solicitud. Si la fecha vence sin meta, la tienda prepara solo lo pagado |
| 5. Entregar a la persona correcta | Misma ruta, ventana de recogida | Hoy escribe el código que le muestra el voluntario. Si aún no hay voluntario: "Esperando a que un voluntario tome la recogida." Un código incorrecto gasta intentos; tras varios errores se bloquea y el equipo lo revisa. El pedido pasa a "Recogido" y después puede mostrar "Entregado". **Cambia con AGO-75:** el código lo mostrará la fundación y, al escribirlo la tienda, se cierra la entrega |
| 6. Revisar su página y su cuenta | `#/tienda/organizacion` (Mi tienda) y `#/cuenta` (Cuenta) | "Mi tienda" es la página pública de la tienda. "Cuenta" resume pedidos y catálogo según los permisos. Mientras lee, muestra indicadores de carga. Si una parte no se puede leer, esa parte se omite, así que la ausencia de algo no prueba que no exista |

Dónde termina hoy: con la recogida confirmada. El estado "Entregado" depende de la recepción posterior. Con AGO-75, la recogida confirmada cierra la entrega.

## Recorrido 4. Repartidor voluntario: tomar, recoger y entregar

**Se elimina con AGO-75.** Esto es lo que existe hoy y desaparece cuando se quite el rol. Según la propuesta, el trabajo de este recorrido pasa a la fundación (recoger en la tienda con un código) y a la tienda (escribir ese código para cerrar la entrega). Se retiran la foto de entrega y el segundo código.

| Paso | Pantalla | Qué ocurre y qué ve en cada situación |
| --- | --- | --- |
| 1. Pedir acceso | `#/registro/repartidor` y `#/repartidor` | Una cuenta sin perfil ve "Hazte repartidor" y "Solicitar acceso". Sin acceso: "Solo para voluntarios". El alta la revisa una persona del equipo; no es inmediata. Falla: aviso con reintento. **Se elimina con AGO-75** |
| 2. Elegir una tarea disponible | `#/repartidor` (Tareas) | Ve tienda, destino, artículos y monto. Un voluntario nuevo tiene un límite hasta completar 3 entregas. Espera: "Cargando entregas…". Vacío: "Sin tareas por ahora" y "Buscar de nuevo". Falla: "No se pudieron cargar" y reintento. Al tomar una tarea: "Tomando…". **Se elimina con AGO-75** |
| 3. Ir a la tienda y mostrar el código | Misma ruta, tarea activa | Ve "Por recoger", la dirección si existe y un enlace al mapa si hay coordenadas. Muestra su código a la tienda y espera su confirmación. Puede soltar la tarea antes de recoger. **Pasa a la fundación con AGO-75** |
| 4. Registrar la entrega con foto | Misma ruta, ventana "Registrar entrega" | Abre la cámara o un archivo, revisa la vista previa y marca entregado. La instrucción es: "Sin rostros, documentos ni placas. Solo lo que entregas." Sin foto no puede enviar. Espera: "Enviando…". Los errores salen en la ventana. **Se elimina con AGO-75** |
| 5. Obtener la confirmación de quien recibe | Misma ruta | Muestra un segundo código y espera: "Esperando su confirmación…". La fundación lo escribe en su sección de recepciones. **Se elimina con AGO-75** |
| 6. Ver historial o reconocimiento | `#/repartidor/entregas` y `#/repartidor/reconocimiento` | Ambas rutas muestran "Tu espacio está listo" y "Las herramientas de esta sección estarán disponibles pronto." Hoy no hay historial ni constancia que describir. **Se eliminan con AGO-75** |

## Recorrido 5. Moderación: revisar y resolver

Este recorrido es parcial: hoy no existe una pantalla de moderación en la app. El equipo revisa fuera de la app. Se describe hasta donde llega la app y el resto se marca como brecha, sin imaginar una pantalla.

Con las decisiones nuevas, la función se separa en dos. Moderación valida tiendas y fundaciones, atiende PQR y reportes, y puede suspender una organización (AGO-35 y AGO-82). Administración, fuera de la app, habilita el cobro de las tiendas y da de alta y de baja a moderadores (AGO-35 y AGO-83, este último después del 12 de diciembre de 2026). Falta decidir si moderación puede ver datos de contacto.

| Paso | Pantalla o brecha | Qué ve y qué pasa en cada situación |
| --- | --- | --- |
| 1. Revisar lo que el público ve de una organización | `#/organizaciones/:slug` (página de la organización) y `#/solicitudes/:id` (Detalle de la solicitud) | Ve lo mismo que cualquier visitante, sin controles de moderación. Estas pantallas tienen carga, error y "no encontrado". No sustituyen revisar una solicitud de alta pendiente, que puede no tener todavía una página pública |
| 2. Revisar altas pendientes y decidir | Brecha: sin pantalla hoy | El equipo decide fuera de la app. No hay bandeja, aviso de "sin pendientes", indicador de espera ni error de revisión dentro de Ágora. La persona que pidió el alta sí ve el resultado en `#/registro`. **Cambia con AGO-35:** habrá una pantalla con la lista de pendientes, aprobar y rechazar con motivo |
| 3. Habilitar el cobro o suspender una organización | Brecha: sin pantalla hoy | Habilitar el cobro es distinto de aprobar la tienda. Dentro de Ágora no hay mensajes de éxito, error ni progreso para estas acciones. La organización suspendida sí ve el aviso en sus pantallas. **Cambia con AGO-35 y AGO-83:** moderación valida y administración habilita, con registro |
| 4. Recibir reportes, PQR y resolver bloqueos | Los reportes se envían desde la página de una organización y desde los comentarios del Inicio; resolverlos es una brecha | Quien reporta una publicación no ve una cola ni un plazo de atención. Los bloqueos por código se avisan en las pantallas de tienda y fundación, pero no hay pantalla para que moderación los resuelva. **Cambia con AGO-82:** las PQR y los reportes de fallos llegarán a un espacio de moderación con estado y registro. Los bloqueos por código se reducen con AGO-75 |
| 5. Verificar el resultado | `#/registro` (pantalla de registro) para quien pidió el alta | La persona ve si su solicitud está pendiente, aprobada o rechazada. Moderación no tiene hoy un historial dentro de la app |

## Lo que este documento no hace

- No describe cuentas, contactos ni datos de personas reales: las personas son imaginadas.
- No promete plazos, ni una fecha para los cambios marcados.
- No es una certificación de accesibilidad. Revisar si Ágora es fácil de leer y de usar para todas las personas es un trabajo aparte.
