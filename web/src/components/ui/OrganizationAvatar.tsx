import { useState } from 'react'

export function OrganizationAvatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  const safe = src && (/^https?:\/\//.test(src) || /^\/(?!\/)/.test(src))
  return <span className="ui-org-avatar" aria-hidden="true">
    {safe && failed !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} />
      : name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
  </span>
}
