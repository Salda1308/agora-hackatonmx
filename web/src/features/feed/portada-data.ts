import type { Category, PublicRequest } from '../requests/data'
import type { FeedItem } from './api'
import { categoryFrom, extraNumber, storeName } from './presentation.ts'

/** Causa normalizada para la portada; sale de `useRequests` o, si no hay, del feed. */
export type Cause = {
  id: string
  title: string
  org: string
  category: Category
  total: number
  paid: number
  sample: boolean
  store: string
}

export const PORTADA_CATEGORIES: Category[] = ['Alimentos', 'Agua', 'Higiene', 'Escolar', 'Herramientas']

export function causeFromRequest(request: PublicRequest): Cause {
  return {
    id: request.id, title: request.title, org: request.org, category: request.category,
    total: request.items.reduce((n, item) => n + item.total, 0),
    paid: request.items.reduce((n, item) => n + item.paid, 0),
    sample: request.sample, store: request.store ?? '',
  }
}

export function causeFromFeed(item: FeedItem): Cause {
  return {
    id: item.id, title: item.titulo ?? '', org: item.organizacion_nombre,
    category: categoryFrom(`${item.titulo ?? ''} ${item.texto ?? ''} ${item.extra.categoria ?? ''}`),
    total: extraNumber(item, 'unidades_totales'), paid: extraNumber(item, 'unidades_pagadas'),
    sample: item.extra.ejemplo === true, store: storeName(item),
  }
}

/** Solicitudes publicadas si ya cargaron; si no, las causas que trae el feed. */
export function portadaCauses(requests: PublicRequest[], feed: FeedItem[]): Cause[] {
  const published = requests.filter(request => request.state === 'publicada')
  return published.length ? published.map(causeFromRequest) : feed.filter(item => item.tipo === 'solicitud').map(causeFromFeed)
}

export const missing = (cause: Cause) => Math.max(0, cause.total - cause.paid)
export const isOpen = (cause: Cause) => missing(cause) > 0

/** La causa a la que le faltan más unidades; si ninguna está abierta, la primera. */
export function pickFeatured(causes: Cause[]): Cause | null {
  return [...causes].filter(isOpen).sort((a, b) => missing(b) - missing(a))[0] ?? causes[0] ?? null
}

/** Causas abiertas por categoría, en el orden fijo de la portada. */
export function categoryCounts(causes: Cause[]): { category: Category; count: number }[] {
  return PORTADA_CATEGORIES.map(category => ({ category, count: causes.filter(c => isOpen(c) && c.category === category).length }))
}

export type UrgentSort = 'faltan' | 'casi'

/** Causas abiertas: "faltan" ordena por unidades por cubrir; "casi" por avance más alto. */
export function urgentCauses(causes: Cause[], sort: UrgentSort, category: Category | null, limit = 4): Cause[] {
  const progress = (cause: Cause) => cause.total ? cause.paid / cause.total : 0
  return causes.filter(c => isOpen(c) && (!category || c.category === category))
    .sort((a, b) => sort === 'faltan' ? missing(b) - missing(a) || progress(a) - progress(b) : progress(b) - progress(a) || missing(a) - missing(b))
    .slice(0, limit)
}

/** Datos de la pastilla de prueba social; nada se inventa: todo sale de lo cargado. */
export function communityStats(causes: Cause[], feed: FeedItem[]) {
  return {
    unitsPaid: causes.filter(isOpen).reduce((n, c) => n + c.paid, 0),
    openCauses: causes.filter(isOpen).length,
    organizations: new Set(feed.map(item => item.organizacion_id)).size,
    sample: causes.some(c => c.sample) || feed.some(item => item.extra.ejemplo === true),
  }
}
