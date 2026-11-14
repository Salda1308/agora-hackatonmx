import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'agora-theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/** Tema actual. Sin elección guardada sigue al sistema; al alternar se fija en data-theme. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.dataset.theme
    if (current === 'light' || current === 'dark') return current
    return storedTheme() ?? systemTheme()
  })

  useEffect(() => {
    if (storedTheme()) document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // Sin almacenamiento: el cambio vale solo en esta visita.
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
