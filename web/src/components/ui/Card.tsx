import type { HTMLAttributes, ReactNode } from 'react'

export type Tone = 'surface' | 'red' | 'yellow' | 'lime' | 'blue' | 'ink'

type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: Tone
  /** Si se pasa, la tarjeta completa es un enlace. */
  href?: string
  padding?: 'md' | 'lg'
  children: ReactNode
}

/** Tarjeta de esquinas muy redondeadas sobre color plano. */
export function Card({ tone = 'surface', href, padding = 'md', className, children, ...rest }: CardProps) {
  const classes = ['ui-card', `ui-card--${tone}`, `ui-card--pad-${padding}`, href ? 'ui-card--link' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
