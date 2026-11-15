import type { HTMLAttributes } from 'react'

export function WaveSection({ className = '', children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-wave-section ${className}`} {...props}>{children}
    <svg className="ui-wave-section__edge" viewBox="0 0 800 24" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0H800V12Q700 36 600 12T400 12T200 12T0 12Z" fill="currentColor" />
    </svg>
  </section>
}
