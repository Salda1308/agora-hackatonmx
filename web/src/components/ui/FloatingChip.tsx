import type { ReactNode } from 'react'

export function FloatingChip({ children }: { children: ReactNode }) {
  return <span className="ui-floating-chip">{children}</span>
}
