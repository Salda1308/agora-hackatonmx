import type { Category } from '../requests/data'
import type { FeedItem } from './api'

export function categoryFrom(value: unknown): Category {
  const text = typeof value === 'string' ? value : ''
  if (/agua|garraf[oó]n/i.test(text)) return 'Agua'
  if (/higiene|pa[ñn]al|jab[oó]n|toall/i.test(text)) return 'Higiene'
  if (/herramienta|pala|guante/i.test(text)) return 'Herramientas'
  if (/escolar|cuaderno|l[aá]piz/i.test(text)) return 'Escolar'
  return 'Alimentos'
}
export function extraText(item: FeedItem, key: string): string {
  return typeof item.extra[key] === 'string' ? item.extra[key] as string : ''
}
export function extraNumber(item: FeedItem, key: string): number {
  const value = Number(item.extra[key])
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
export function formatDate(value: string, withTime = false): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha por confirmar' : new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function storeName(item: FeedItem): string {
  const store = item.extra.tienda
  return store && typeof store === 'object' && 'nombre' in store && typeof store.nombre === 'string' ? store.nombre : ''
}
