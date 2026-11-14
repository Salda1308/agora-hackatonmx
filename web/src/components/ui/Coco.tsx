import './coco-motion.css'

export type CocoPose = 'saludando' | 'pulgar-arriba' | 'caja-suministros' | 'volando-garrafon' | 'triste'
type CocoProps = {
  size?: number
  /** Conserva los SVG existentes cuando no se especifica pose. */
  variant?: 'full' | 'portrait'
  pose?: CocoPose
  animation?: 'none' | 'enter' | 'greet' | 'celebrate' | 'settle' | 'fly'
  /** Vacío cuando el texto contiguo ya explica el estado. */
  alt?: string
  className?: string
}

export function Coco({ size = 160, variant = 'full', pose, animation = 'none', alt = '', className }: CocoProps) {
  return (
    <img
      src={pose ? `/coco/${pose}.webp` : variant === 'portrait' ? '/coco-portrait.svg' : '/coco.svg'}
      width={size}
      height={pose ? size : Math.round(size * 1.1)}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={['ui-coco', pose ? `coco-pose coco-pose--${pose}` : '', `coco-motion--${animation}`, className ?? ''].filter(Boolean).join(' ')}
      decoding="async"
      draggable={false}
    />
  )
}
