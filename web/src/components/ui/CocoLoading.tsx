import { Coco } from './Coco'

type CocoLoadingProps = {
  title?: string
  description?: string
  size?: number
}

/** Estado de carga compacto. La pose completa evita sumar un sprite pesado al inicio. */
export function CocoLoading({
  title = 'Coco va en camino…',
  description,
  size = 112,
}: CocoLoadingProps) {
  return (
    <div className="coco-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="coco-loading__scene" aria-hidden="true">
        <span className="coco-loading__cloud coco-loading__cloud--one" />
        <span className="coco-loading__cloud coco-loading__cloud--two" />
        <span className="coco-loading__trail coco-loading__trail--one" />
        <span className="coco-loading__trail coco-loading__trail--two" />
        <Coco size={size} pose="volando-garrafon" animation="fly" />
      </div>
      <div className="coco-loading__copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  )
}
