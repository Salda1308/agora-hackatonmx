import { IconBack } from './icons'

type StepperProps = {
  /** Paso actual, empieza en 1. */
  current: number
  total: number
  title?: string
  onBack?: () => void
  onSkip?: () => void
}

/** Barra de pasos para flujos guiados: "Paso 1 de 3" con segmentos. */
export function Stepper({ current, total, title, onBack, onSkip }: StepperProps) {
  return (
    <div className="ui-stepper">
      <div className="ui-stepper__row">
        {onBack ? (
          <button type="button" className="ui-icon-button" onClick={onBack} aria-label="Paso anterior">
            <IconBack />
          </button>
        ) : (
          <span className="ui-stepper__spacer" />
        )}
        {onSkip ? (
          <button type="button" className="ui-stepper__skip" onClick={onSkip}>
            Omitir
          </button>
        ) : null}
      </div>
      <ol className="ui-stepper__bar" aria-label={`Paso ${current} de ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={`ui-stepper__seg${i < current ? ' ui-stepper__seg--done' : ''}`}
            aria-current={i + 1 === current ? 'step' : undefined}
          >
            <span className="visually-hidden">Paso {i + 1}</span>
          </li>
        ))}
      </ol>
      <p className="ui-stepper__label">
        Paso {current} de {total}
        {title ? <span className="ui-stepper__title"> · {title}</span> : null}
      </p>
    </div>
  )
}
