import type { Category } from '../data/sample'

/** Ilustraciones de insumos; no son fotografías ni evidencia de una organización. */
const VISUALS: Record<Category, string> = {
  Agua: '/illustrations/agua.svg',
  Higiene: '/illustrations/higiene.svg',
  Alimentos: '/illustrations/alimentos.svg',
  Herramientas: '/illustrations/herramientas.svg',
  Escolar: '/illustrations/escolar.svg',
}

export function requestVisual(category: Category) {
  return VISUALS[category]
}
