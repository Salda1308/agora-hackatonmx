import { useId } from 'react'

type ProgressTone = 'primary' | 'accent' | 'lime' | 'blue' | 'ink'

function percentOf(value: number, max: number) {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)))
}

type ProgressBarProps = {
  value: number
  max: number
  label: string
  /** Texto a la derecha; por defecto "value de max". */
  detail?: string
  tone?: ProgressTone
  size?: 'sm' | 'md'
  hideLabel?: boolean
}

/** Barra de avance horizontal, accesible como progressbar. */
export function ProgressBar({ value, max, label, detail, tone = 'primary', size = 'md', hideLabel }: ProgressBarProps) {
  const id = useId()
  const pct = percentOf(value, max)
  return (
    <div className={`ui-progress ui-progress--${size}`}>
      <div className={hideLabel ? 'visually-hidden' : 'ui-progress__head'}>
        <span id={id} className="ui-progress__label">
          {label}
        </span>
        <span className="ui-progress__detail">{detail ?? `${value} de ${max}`}</span>
      </div>
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} de ${max} (${pct}%)`}
      >
        <div className={`ui-progress__fill ui-progress__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

type ProgressRingProps = {
  value: number
  max: number
  label: string
  size?: number
  stroke?: number
  tone?: ProgressTone
  /** Texto pequeño bajo la cifra. */
  caption?: string
}

/** Aro de avance con la cifra grande al centro. */
export function ProgressRing({ value, max, label, size = 120, stroke = 12, tone = 'primary', caption }: ProgressRingProps) {
  const pct = percentOf(value, max)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      className="ui-ring"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${pct}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ui-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className={`ui-ring__fill ui-ring__fill--${tone}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ui-ring__center" aria-hidden="true">
        <span className="ui-ring__value" style={{ fontSize: size * 0.26 }}>
          {pct}%
        </span>
        {caption ? <span className="ui-ring__caption">{caption}</span> : null}
      </div>
    </div>
  )
}
