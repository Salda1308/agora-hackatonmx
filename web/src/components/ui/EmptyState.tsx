import type { ReactNode } from 'react'
import { Coco, type CocoPose } from './Coco'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  pose?: CocoPose
}

/** Estado vacío acompañado por Coco. */
export function EmptyState({ title, description, action, pose = 'triste' }: EmptyStateProps) {
  return (
    <div className="ui-empty" role="status">
      <Coco size={132} pose={pose} animation={pose === 'volando-garrafon' ? 'fly' : 'settle'} className="ui-empty__coco" />
      <h3 className="ui-empty__title">{title}</h3>
      {description ? <p className="ui-empty__text">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  )
}
