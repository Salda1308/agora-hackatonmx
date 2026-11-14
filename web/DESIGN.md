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
- Colores: rojo Coco (acción principal), amarillo pico (acento y resaltados), lima (completo o entregado), azul (secundario), tinta (dock y bloques oscuros), crema (fondo claro).
- Estados de unidad: `--color-status-pending`, `--color-status-paid`, `--color-status-ready`, `--color-status-delivered`.
- Tipografía: Nunito Variable (SIL OFL 1.1, paquete `@fontsource-variable/nunito`). Titulares en peso 900 con una o dos palabras resaltadas (`.highlight`).
- Área táctil mínima de 48 px (`--tap-min`).
- Todo dato de ejemplo se marca en pantalla con `<SampleBadge />` y vive en `src/data/sample.ts`.
- Coco acompaña inicio, estados vacíos y confirmaciones. Los textos no sugieren que Ágora sea un producto oficial de pey ni de CoDi.

## Componentes base
| Componente | Uso |
|---|---|
| `Button` | Botón píldora. Variantes `primary`, `accent`, `lime`, `ink`, `outline`, `ghost`; tamaños `md` y `lg`; `block`; con `href` se pinta como enlace. |
| `Card` | Tarjeta redondeada. Tonos `surface`, `red`, `yellow`, `lime`, `blue`, `ink`; con `href` es enlace. |
| `Chip`, `SampleBadge` | Etiqueta píldora; seleccionable con `onClick` y `selected`. `SampleBadge` marca datos de ejemplo. |
| `ProgressBar`, `ProgressRing` | Barra y aro de avance accesibles (`role="progressbar"`). |
| `Stepper` | Barra de pasos "Paso 1 de 3" con atrás y omitir opcionales. |
| `Dock` | Navegación inferior flotante con acción central. Un dock por rol. |
| `EmptyState` | Estado vacío con Coco. |
| `Coco` | La mascota como imagen. |

## Rutas de ejemplo (hash)
`#/` inicio, `#/solicitudes` directorio, `#/solicitudes/:id` detalle, `#/siguiendo` estado vacío, `#/sistema` galería. El ruteo de `src/lib/router.ts` es mínimo y se puede cambiar por un router completo sin tocar los componentes.
