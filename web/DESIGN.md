# Sistema de diseño de Ágora

Guía corta para las tareas de frontend. Web móvil primero: una columna de hasta 480 px, centrada en escritorio.

## Dónde está
- `src/styles/tokens.css`: color, tipografía, radios, espacios, sombras y movimiento. Modo claro por defecto; oscuro con `prefers-color-scheme` o con `data-theme="dark"` en `<html>` (el botón de tema lo fija y lo guarda).
- `src/styles/components.css`: estilos de los componentes base (prefijo `ui-`).
- `src/styles/screens.css`: estilos de las pantallas ancla.
- `src/components/ui/`: componentes base.
- `public/coco.svg`: Coco, la mascota, en SVG. También es el favicon.
- Galería en vivo: `#/sistema`.

## Reglas
- Usa los tokens semánticos (`--color-primary`, `--color-text`, `--space-4`, `--radius-lg`...), no los `--palette-*` ni valores sueltos.
- Superficies neutras dominantes: crema en claro, tinta casi negra en oscuro. Un acento protagonista por pantalla: rojo Coco en la acción principal y la mascota. Amarillo y lima en trazos, pasos y estados pequeños; azul disponible como variante, sin añadirlo por defecto a las pantallas.
- No combinar grandes tarjetas rojas, amarillas y lima en la misma vista. Los tonos de `Card` se conservan para usos puntuales y para la galería. Estadísticas, categorías y metadatos usan superficies neutras.
- Estados de unidad: `--color-status-pending`, `--color-status-paid`, `--color-status-ready`, `--color-status-delivered`.
- Tipografía: Nunito Variable (SIL OFL 1.1, paquete `@fontsource-variable/nunito`). Titulares en peso 900, escala contenida y un trazo discreto para resaltar (`.highlight`). Texto secundario con contraste, sin bajar opacidad.
- Área táctil mínima de 48 px (`--tap-min`).
- Todo dato de ejemplo se marca en pantalla con `<SampleBadge />` y vive en `src/data/sample.ts`.
- Coco acompaña inicio, estados vacíos y confirmaciones. Los textos no sugieren que Ágora sea un producto oficial de pey ni de CoDi.

## Pulido D3 y base para Capacitor

- Inicio sigue la dirección posterior del usuario: cabecera compacta, primer plano de Coco y zona roja con un titular breve y un CTA. Después aparecen dos solicitudes destacadas y una publicación de ejemplo. Se retiran estadísticas y explicación larga. El retrato es una derivación del SVG original con los mismos trazos/colores de cabeza y cara, sin los fragmentos del cuerpo que estorbaban al recorte.
- Todos los nombres de tokens, componentes y variantes de D1 se mantienen; la paleta base y el asset de Coco no cambian. Los ajustes son de uso de color, escala, sombras y semánticos de superficie/foco.
- Las barras y aros de las pantallas usan `tone="ink"` para dar protagonismo al avance por contraste. Lima acompaña completos y entregas. El detalle incluye la barra global de unidades y el avance por artículo; el pago de ejemplo continúa deshabilitado.
- El dock público tiene tres destinos: Inicio, Solicitudes y Siguiendo. Se retiró el corazón que abría arbitrariamente una solicitud. La página activa usa texto claro y un indicador. `Dock` mantiene la API de D1 con `action` ahora opcional para otros flujos. El contenido tiene espacio inferior y `scroll-padding` para poder desplazarse por encima del dock.
- `.app` protege safe-area superior y lateral; dock y espacio inferior contemplan `safe-area-inset-bottom`. Conservar `viewport-fit=cover`. El wrapper nativo deberá exponer estos valores; verificar también en dispositivos reales al integrar Capacitor.
- Filtros seleccionables, botones y enlaces de navegación tienen al menos 48 px. Los chips informativos no son controles y pueden ser más pequeños. Las categorías desplazan horizontalmente dentro de su propia fila, sin overflow de página.
- Foco visible en ambos temas, incluido el dock oscuro. Estados hover solo añaden contraste/contorno; el deshabilitado es neutro y no responde al hover. Un `Button` con `href` y `aria-disabled="true"` retira el destino y no navega ni recibe foco por Tab.
- Al cambiar de tema, texto y fondo cambian juntos, sin un fundido del fondo que pueda dejar texto claro sobre un fondo todavía claro (o al revés). Las microinteracciones conservan transformaciones breves.
- Mantener superficies con un solo borde sutil, sombras reservadas para dock/hover y Coco con movimiento breve una vez al entrar o confirmar; vacíos y pago pendiente sin bucles. Con `prefers-reduced-motion: reduce`, imágenes estáticas y controles sin transformaciones. La galería conserva ejemplos de todas las variantes de color con muestras pequeñas.
- La galería `#/sistema` solo está disponible en desarrollo y no aparece en el dock. El build público muestra página no encontrada en esa ruta.
- Las solicitudes usan ilustraciones locales de insumos, título/organización y un avance global. El desglose por artículo vive en el detalle. `src/lib/request-visuals.ts` selecciona los assets por categoría sin cambiar el esquema de los datos.
- Los detalles gráficos de marca son pequeños: rayos de Coco y subrayado amarillo en destacados. Las ilustraciones siguen su paleta y trazos; no son fotografías ni evidencia de entrega.
- La revisión de esta pasada aplica Apple Design, descargada al worktree bajo `.ai/skills/apple-design/`; criterios y referencias en `.ai/tasks/D3/apple-design-review.md`.

## Componentes base
| Componente | Uso |
|---|---|
| `Button` | Botón píldora. Variantes `primary`, `accent`, `lime`, `ink`, `outline`, `ghost`; tamaños `md` y `lg`; `block`; con `href` se pinta como enlace. |
| `Card` | Tarjeta redondeada. Tonos `surface`, `red`, `yellow`, `lime`, `blue`, `ink`; con `href` es enlace. |
| `Chip`, `SampleBadge` | Etiqueta píldora; seleccionable con `onClick` y `selected`. `SampleBadge` marca datos de ejemplo. |
| `ProgressBar`, `ProgressRing` | Barra y aro de avance accesibles (`role="progressbar"`). |
| `Stepper` | Barra de pasos "Paso 1 de 3" con atrás y omitir opcionales. |
| `Dock` | Navegación inferior flotante (barra superior en escritorio). Acción central opcional; en público, `SiteDock` con cinco destinos (ver D7). |
| `EmptyState` | Estado vacío con Coco. |
| `Modal` | Diálogo accesible sobre `<dialog>.showModal()`: foco atrapado y devuelto al cerrar, Escape, cierre al tocar fuera y botón Cerrar. Hoja inferior en móvil, centrado en escritorio. Props `open`, `onClose`, `title`, `description`, `footer`, `className`. Los formularios usan `FormModal`. |
| `FormModal`, `Field`, `describe` | Formulario en `Modal` (D8). Se monta solo abierto (cada apertura empieza limpia); pie fijo con un botón primario `lg` de 48 px que envía `formId` o llama `onSubmit`, deshabilitado mientras envía (sin doble envío); no cierra mientras envía; Escape, tocar fuera o Cerrar con cambios sin guardar piden confirmar ("Seguir editando" o "Descartar"). `Field` pone etiqueta, ayuda y error junto al control; `describe` (en `describe.ts`) enlaza ayuda y error con `aria-describedby`. Grupos con `fieldset.fm-group`, filas con `.fm-row`, avisos generales con `.fm-alert`. |
| `FloatingChip` | Etiqueta blanca que flota sobre una imagen (categoría de la causa). |
| `OrganizationAvatar` | Logo circular de la organización; si no hay logo seguro (http/https o ruta local) o falla, muestra iniciales. |
| `WaveSection` | Sección de color con borde inferior en onda (SVG con `currentColor`). |
| `Coco` | La mascota como imagen. `pose` elige saludando, pulgar-arriba, caja-suministros, volando-garrafon o triste; `animation` admite none, enter, greet, celebrate, settle y fly. Alt vacío la hace decorativa. `variant="portrait"` usa el recorte de cabeza; el default `full` conserva D1. |

## Rutas de ejemplo (hash)
`#/` inicio, `#/solicitudes` directorio, `#/solicitudes/:id` detalle, `#/siguiendo` estado vacío, `#/sistema` galería de desarrollo. El ruteo de `src/lib/router.ts` es mínimo y se puede cambiar por un router completo sin tocar los componentes.

## Sesión y roles (R1)

`src/auth/SessionControls.tsx` añade un panel desplegable neutro para la demo local,
con cuatro roles, `SampleBadge`, estados de carga/error y salida. Está desactivado
por defecto; instrucciones en `src/auth/README.md`. `RoleDock` adapta el dock de D3
sin cambiar su API: la navegación pública conserva sus tres destinos y Fundación
añade Publicar como acción. `roles.ts` define los destinos; `RoleScreen` deja
marcadores protegidos para las próximas tareas. Sin backend configurado, la web
pública sigue disponible y no se ofrecen accesos demo.

## Pulido D6

- El bloque rojo del inicio se une al retrato de Coco con una curva superior amplia. El contenido de la portada conserva espacio inferior para que el dock flotante no tape el CTA en móviles estrechos.
- `CocoLoading` usa la pose `volando-garrafon.webp` existente, una animación CSS de flotación y una estela de nubes. Se mantiene una sola imagen de 34.6 KB porque separar las alas del raster produce bordes visibles. En movimiento reducido queda estática y no se agregan dependencias.
- La confirmación de pago abre `PaymentConfirmationModal`, con foco atrapado, Escape, cierre explícito, monto, organización y unidades del comprobante. Después muestra un estado centrado con `ReceiptSummary`, `Ver mis comprobantes` y `Donar más unidades`.
- `#/siguiendo` presenta los comprobantes guardados en `sessionStorage` y consulta los tokens de seguimiento existentes. No cambia funciones ni inventa datos cuando el comprobante aún no está disponible.

## Rediseño D7: red social de causas

- Inicio es un feed cronológico (`src/features/feed/`): historias, causas y jornadas de organizaciones verificadas, cada una con su tarjeta (`FeedCard`), avatar y nombre que enlazan a la página de la organización, foto grande, me gusta y comentarios. Filtros Todo, Historias, Causas y Voluntariado; paginación "Ver más". Cabecera ligera con una sección en onda donde Coco carga la caja de suministros e invita a ayudar; en escritorio queda como columna lateral fija y el feed a la derecha.
- Datos: `src/features/feed/api.ts` usa el contrato final de T24 (`feed_publico`, `alternar_me_gusta`, `comentar`, `comentarios_de`, `borrar_comentario`, `reportar_comentario`). Si el backend todavía no tiene `feed_publico` (PGRST202 o 42883), arma el feed con las consultas existentes y oculta me gusta y comentarios ("pronto"). Los errores 42501, 22023, 54000 y P0002 muestran el mensaje del servidor, que ya viene en español; cualquier otro se cambia por un texto genérico.
- Comentarios en `CommentsSheet` (usa `Modal`). Sin sesión invita a entrar; con correo sin confirmar lo pide; el autor o la organización dueña pueden eliminar y los demás reportar con motivo.
- Solicitudes = causas en curso: sin mapa (se retiró `RequestMap`; `leaflet` queda en package.json sin uso hasta decidir), tarjetas `cause-card` con ilustración grande, chip flotante de categoría, organización, tienda, avance y un CTA. En escritorio, rejilla de hasta tres columnas.
- Detalle de solicitud: portada con la ilustración sobre fondo amarillo suave, descripción, tienda y un CTA "Elegir unidades para donar" que lleva al formulario de donación existente, que no cambia.
- Navegación: `SiteDock` con Inicio, Solicitudes, Voluntariado, Siguiendo y Cuenta (Cuenta apunta al área actual del rol, o a Siguiendo para quien compra). Dentro de las áreas de rol se conserva `RoleDock` para su navegación interna.
- Tokens: `--radius-lg` 32 px y `--radius-xl` 40 px (tarjetas más redondeadas); crema base un poco más cálida (`--palette-cream-100`). Nombres sin cambios. Estilos nuevos en `src/styles/social.css` y `src/components/ui/modal.css`; `--color-photo-ground` es el fondo crema de las imágenes en ambos temas.
- Las ilustraciones de insumos se marcan como "Ilustración de insumos" para no confundirlas con fotos de entrega.

## D8: cuenta por rol y formularios en modal
- `#/cuenta` es una ruta propia (no de rol). Cada vista sale de `vistaCuenta` (función pura en `screens/cuenta/vista.ts`): invitado, sin perfil (comprador demo o alta pendiente o rechazada de T23), fundación, tienda y repartidor. Solo muestra lo que el rol ya puede leer; si una lectura falla, la sección se omite.
- Fundación: nombre, categoría, verificada o suspendida, publicaciones del feed, solicitudes por estado y jornadas próximas con inscripciones por revisar. Tienda: estado, pedidos recientes y catálogo visible u oculto (el estado de cobro de `tiendas_cobro` no es legible y no se muestra). Repartidor: límite de $500 hasta 3 entregas, entregas hechas y tarea actual. Invitado: comprobantes del dispositivo, invitación a `#/registro` y acceso demo con `SampleBadge`.
- Dock: los roles conservan `RoleDock` con Cuenta al final; comprador e invitado usan `SiteDock`, cuya Cuenta lleva a `#/cuenta`. En escritorio la cuenta es una columna de 760 px.
- Formularios en `FormModal`: publicar y editar post, nueva jornada, nueva solicitud (tres pasos con `Stepper`; `#/fundacion/publicar` abre el modal sobre la lista), artículo nuevo, cambiar precio, importar CSV, entrega con foto y código de recogida.
- Listas: tarjetas con la ilustración de la categoría (`requestVisual(categoryFor(...))`), chips de estado, vacíos con Coco y acciones visibles. Las solicitudes no tienen imagen propia: agregarla requiere migración.

## Pase D9: armonía pública

- Cabecera del Inicio: `CocoSpotlight` (`src/features/feed/CocoSpotlight.tsx`) reemplaza la sección en onda. Coco saluda y presenta una causa real del feed (la que tiene más unidades por cubrir) en una burbuja con título, organización, avance y el CTA "Donar unidades"; si el feed no trae causas, ofrece "Ver causas en curso". Debajo, dos atajos de 48 px: Todas las causas y Voluntariado. `WaveSection` se conserva en `ui/` aunque Inicio ya no la usa.
- Un solo acento protagonista por pantalla: en Inicio es el CTA rojo de la burbuja; la nota "De cerca" queda con un único enlace.
- Detalle: la portada usa `--color-surface-2` con borde (ya no amarillo) para separarse del fondo en 768 px; en escritorio es un cuadro de hasta 440 px a la izquierda del encabezado. "Qué falta" ocupa una sola columna. Las leyendas de la donación alinean con el título y el estado "Pago en seguimiento" centra todos sus textos.
- Organización: las necesidades abiertas muestran la ilustración de su categoría (`requestVisual`). En gestión y escritorio, las publicaciones suben junto a necesidades y formulario.
- Globales (compatibles con D8): en escritorio la barra de sesión demo se alinea al ancho del contenido y a la derecha, y el `.brand` de la `topbar` se oculta porque la marca ya vive en el dock; `SampleBadge` no se estira en rejillas (`justify-self: start`); `.page-title + .page-lead` lleva `--space-2` de separación; en oscuro, `--color-section-warm` es un amarillo translúcido (antes se veía marrón).
- Registro y sus formularios: máximo 640 px en escritorio.
- Hallazgos en pantallas de rol, para D8: `.ai/tasks/D9/hallazgos-roles.md`.
