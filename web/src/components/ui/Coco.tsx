type CocoProps = {
  size?: number
  /** Texto alternativo; vacío si Coco es decorativa junto a un texto que ya explica. */
  alt?: string
  className?: string
}

/** Coco, la mascota. El asset vive en public/coco.svg para reusarlo fuera de React. */
export function Coco({ size = 160, alt = '', className }: CocoProps) {
  return (
    <img
      src="/coco.svg"
      width={size}
      height={Math.round(size * 1.1)}
      alt={alt}
      className={['ui-coco', className ?? ''].filter(Boolean).join(' ')}
      draggable={false}
    />
  )
}
