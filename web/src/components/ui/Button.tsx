import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'accent' | 'ink' | 'lime' | 'outline' | 'ghost'
export type ButtonSize = 'md' | 'lg'

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: ReactNode
  children: ReactNode
}

type AsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type AsLink = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/** Botón píldora. Con `href` se pinta como enlace con la misma forma. */
export function Button(props: AsButton | AsLink) {
  const { variant = 'primary', size = 'md', block, icon, children, className, ...rest } = props
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    block ? 'ui-button--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </>
  )

  if (typeof rest.href === 'string') {
    const linkProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>
    const disabled = linkProps['aria-disabled'] === true || linkProps['aria-disabled'] === 'true'
    return (
      <a
        className={classes}
        {...linkProps}
        href={disabled ? undefined : linkProps.href}
        role={linkProps.role ?? (disabled ? 'link' : undefined)}
        tabIndex={disabled ? -1 : linkProps.tabIndex}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault()
            return
          }
          linkProps.onClick?.(event)
        }}
      >
        {content}
      </a>
    )
  }
  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={buttonProps.type ?? 'button'} className={classes} {...buttonProps}>
      {content}
    </button>
  )
}
