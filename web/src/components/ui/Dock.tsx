import type { ReactNode } from 'react'

export type DockItem = {
  key: string
  label: string
  href: string
  icon: ReactNode
}

type DockProps = {
  /** Destinos de navegación. La acción central es opcional. */
  start: DockItem[]
  end: DockItem[]
  action?: DockItem
  activeKey: string
  label?: string
  /** Acciones a la derecha de la barra en escritorio (búsqueda, CTA). En móvil no se muestran. */
  actions?: ReactNode
}

/** Navegación flotante; admite una acción central explícita si el flujo la necesita. */
export function Dock({ start, end, action, activeKey, label = 'Navegación principal', actions }: DockProps) {
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
      <a className="ui-dock__brand" href="#/" aria-label="Ágora, inicio">
        <img src="/coco-portrait.svg" alt="" width="40" height="44" />ágora<span className="brand-dot">.</span>
      </a>
      <ul className="ui-dock__list">
        {start.map(renderItem)}
        {action ? <li className="ui-dock__action-slot">
          <a
            href={action.href}
            className={`ui-dock__action${action.key === activeKey ? ' ui-dock__action--active' : ''}`}
            aria-current={action.key === activeKey ? 'page' : undefined}
          >
            {action.icon}
            <span className="ui-dock__label">{action.label}</span>
          </a>
        </li> : null}
        {end.map(renderItem)}
      </ul>
      {actions ? <div className="ui-dock__actions">{actions}</div> : null}
    </nav>
  )
}
