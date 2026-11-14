import { useTheme } from '../lib/theme'
import { IconMoon, IconSun } from './ui/icons'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const toDark = theme !== 'dark'
  return (
    <button
      type="button"
      className="ui-icon-button"
      onClick={toggle}
      aria-label={toDark ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      {toDark ? <IconMoon /> : <IconSun />}
    </button>
  )
}
