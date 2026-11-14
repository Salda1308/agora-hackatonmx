import type { ReactNode } from 'react'
import type { Tone } from './Card'

type ChipProps = {
  children: ReactNode
  tone?: Tone | 'outline'
  icon?: ReactNode
  /** Con `onClick` el chip se vuelve un botón seleccionable (aria-pressed). */
  selected?: boolean
  onClick?: () => void
}

/** Etiqueta en forma de píldora; seleccionable si recibe onClick. */
export function Chip({ children, tone = 'surface', icon, selected, onClick }: ChipProps) {
  const classes = ['ui-chip', `ui-chip--${tone}`, selected ? 'ui-chip--selected' : ''].filter(Boolean).join(' ')
  const content = (
    <>
      {icon ? <span className="ui-chip__icon">{icon}</span> : null}
      {children}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={`${classes} ui-chip--interactive`} aria-pressed={!!selected} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <span className={classes}>{content}</span>
}

/** Marca visible para datos de ejemplo (regla del plan: todo dato de ejemplo se marca). */
export function SampleBadge({ label = 'Datos de ejemplo' }: { label?: string }) {
  return (
    <span className="ui-chip ui-chip--sample" role="note">
      <span aria-hidden="true">●</span> {label}
    </span>
  )
}
