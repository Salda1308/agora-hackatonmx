import type { ReactNode } from 'react'

/** Íconos de trazo redondeado, 24x24, heredan currentColor. */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconHome() {
  return (
    <Svg>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </Svg>
  )
}

export function IconList() {
  return (
    <Svg>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </Svg>
  )
}

export function IconPlus() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconHeart() {
  return (
    <Svg>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </Svg>
  )
}

export function IconSwatch() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h8" />
    </Svg>
  )
}

export function IconBack() {
  return (
    <Svg>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}

export function IconSearch() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Svg>
  )
}

export function IconCheck() {
  return (
    <Svg>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconPin() {
  return (
    <Svg>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  )
}

export function IconSun() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Svg>
  )
}

export function IconMoon() {
  return (
    <Svg>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Svg>
  )
}

export function IconBox() {
  return (
    <Svg>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </Svg>
  )
}

export function IconBookmark() {
  return (
    <Svg>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />
    </Svg>
  )
}
