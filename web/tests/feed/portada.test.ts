import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FeedItem } from '../../src/features/feed/api.ts'
import { categoryCounts, communityStats, pickFeatured, portadaCauses, urgentCauses, type Cause } from '../../src/features/feed/portada-data.ts'
import type { PublicRequest } from '../../src/features/requests/data.ts'

const cause = (id: string, category: Cause['category'], total: number, paid: number, sample = false): Cause =>
  ({ id, title: id, org: 'Org', category, total, paid, sample, store: '' })
const agua = cause('agua', 'Agua', 50, 32)
const arroz = cause('arroz', 'Alimentos', 80, 16)
const cuadernos = cause('cuadernos', 'Escolar', 40, 40)
const jabon = cause('jabon', 'Higiene', 10, 9)

const request = (id: string, state: string, names: string[], total: number, paid: number): PublicRequest => ({
  id, sample: true, store: 'Tienda', orgSlug: 'o', org: 'Org', orgType: '', city: '', title: id, category: 'Agua', recurring: false,
  updated: '', state, description: null, latitude: null, longitude: null,
  items: names.map((name, i) => ({ id: `${id}-${i}`, name, unitPrice: 10, total, paid, ready: 0, delivered: 0 })),
})
const feedItem = (tipo: FeedItem['tipo'], id: string, org: string, extra: Record<string, unknown> = {}): FeedItem => ({
  tipo, id, creado_en: '2026-11-15T00:00:00Z', organizacion_id: org, organizacion_nombre: org, organizacion_slug: org,
  organizacion_logo: null, titulo: 'Agua limpia', texto: null, medios: [], extra, me_gusta: 0, comentarios: 0, yo_di_me_gusta: false,
})

test('la causa destacada es la abierta a la que le faltan más unidades', () => {
  assert.equal(pickFeatured([agua, arroz, cuadernos])?.id, 'arroz')
  assert.equal(pickFeatured([cuadernos])?.id, 'cuadernos', 'sin abiertas, la primera')
  assert.equal(pickFeatured([]), null)
})

test('los conteos por categoría solo cuentan causas abiertas', () => {
  const counts = Object.fromEntries(categoryCounts([agua, arroz, cuadernos, jabon, cause('agua2', 'Agua', 5, 0)]).map(c => [c.category, c.count]))
  assert.deepEqual(counts, { Alimentos: 1, Agua: 2, Higiene: 1, Escolar: 0, Herramientas: 0 })
})

test('más urgentes: orden, filtro por categoría y límite', () => {
  const all = [agua, arroz, cuadernos, jabon]
  assert.deepEqual(urgentCauses(all, 'faltan', null).map(c => c.id), ['arroz', 'agua', 'jabon'])
  assert.deepEqual(urgentCauses(all, 'casi', null).map(c => c.id), ['jabon', 'agua', 'arroz'])
  assert.deepEqual(urgentCauses(all, 'faltan', 'Agua').map(c => c.id), ['agua'])
  assert.equal(urgentCauses(all, 'faltan', null, 2).length, 2)
})

test('las causas salen de las solicitudes publicadas o, si no hay, del feed', () => {
  const fromRequests = portadaCauses([request('a', 'publicada', ['Garrafón'], 50, 32), request('b', 'cerrada', ['Arroz'], 5, 5)], [])
  assert.deepEqual(fromRequests.map(c => [c.id, c.total, c.paid, c.store]), [['a', 50, 32, 'Tienda']])
  const fromFeed = portadaCauses([], [feedItem('solicitud', 's', 'org', { unidades_totales: 50, unidades_pagadas: 32, ejemplo: true }), feedItem('publicacion', 'p', 'org')])
  assert.deepEqual(fromFeed.map(c => [c.id, c.category, c.total, c.paid, c.sample]), [['s', 'Agua', 50, 32, true]])
})

test('la prueba social suma lo cargado sin inventar', () => {
  const stats = communityStats([agua, arroz, cuadernos], [feedItem('publicacion', 'p', 'org-1'), feedItem('jornada', 'j', 'org-2'), feedItem('publicacion', 'q', 'org-1')])
  assert.deepEqual(stats, { unitsPaid: 48, openCauses: 2, organizations: 2, sample: false })
  assert.equal(communityStats([cause('x', 'Agua', 1, 0, true)], []).sample, true)
})
