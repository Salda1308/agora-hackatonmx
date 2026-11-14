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
- Mantener superficies con un solo borde sutil, sombras reservadas para dock/hover y Coco sin animación continua en estados vacíos. La galería conserva ejemplos de todas las variantes de color con muestras pequeñas.
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
| `Dock` | Navegación inferior flotante. Acción central opcional; en público, tres destinos sin acción arbitraria. |
| `EmptyState` | Estado vacío con Coco. |
| `Coco` | La mascota como imagen. `variant="portrait"` usa el recorte de cabeza; el default `full` conserva D1. |

## Rutas de ejemplo (hash)
`#/` inicio, `#/solicitudes` directorio, `#/solicitudes/:id` detalle, `#/siguiendo` estado vacío, `#/sistema` galería de desarrollo. El ruteo de `src/lib/router.ts` es mínimo y se puede cambiar por un router completo sin tocar los componentes.
