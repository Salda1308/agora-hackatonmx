import type { ReactNode } from 'react'

/** Pantalla base del área de fundación. */
export function Marco({ children }: { children: ReactNode }) {
  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span className="brand brand--ink">Ágora</span>
        </div>
        {children}
      </div>
    </main>
  )
}
