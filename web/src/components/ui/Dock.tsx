import type { ReactNode } from 'react'

export type DockItem = {
  key: string
  label: string
  href: string
  icon: ReactNode
}

type DockProps = {
  /** Ítems a la izquierda y derecha de la acción central (2 y 2 recomendado). */
  start: DockItem[]
  end: DockItem[]
  action: DockItem
  activeKey: string
  label?: string
}

/** Navegación inferior flotante y oscura, con acción central destacada. */
export function Dock({ start, end, action, activeKey, label = 'Navegación principal' }: DockProps) {
  const renderItem = (item: DockItem) => {
    const active = item.key === activeKey
    return (
      <li key={item.key}>
        <a
          href={item.href}
          className={`ui-dock__item${active ? ' ui-dock__item--active' : ''}`}
          aria-current={active ? 'page' : undefined}
        >
          {item.icon}
          <span className="ui-dock__label">{item.label}</span>
        </a>
      </li>
    )
  }

  return (
    <nav className="ui-dock" aria-label={label}>
      <ul className="ui-dock__list">
        {start.map(renderItem)}
        <li className="ui-dock__action-slot">
          <a
            href={action.href}
            className={`ui-dock__action${action.key === activeKey ? ' ui-dock__action--active' : ''}`}
            aria-current={action.key === activeKey ? 'page' : undefined}
          >
            {action.icon}
            <span className="ui-dock__label">{action.label}</span>
          </a>
        </li>
        {end.map(renderItem)}
      </ul>
    </nav>
  )
}
