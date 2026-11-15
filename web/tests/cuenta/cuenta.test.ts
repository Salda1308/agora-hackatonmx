import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paths, parseHash } from '../../src/lib/router.ts'
import { atajosCuenta, nivelRepartidor, vistaCuenta } from '../../src/screens/cuenta/vista.ts'

test('#/cuenta es una ruta propia y no una ruta de rol', () => {
  assert.equal(paths.cuenta, '#/cuenta')
  assert.deepEqual(parseHash('#/cuenta'), { name: 'cuenta' })
  assert.notEqual(parseHash('#/cuentas').name, 'cuenta')
})

test('qué vista de cuenta ve cada sesión', () => {
  const base = { status: 'ready' as const, hasUser: true, organizationId: null }
  assert.equal(vistaCuenta({ ...base, status: 'loading', hasUser: false, role: null }), 'cargando')
  assert.equal(vistaCuenta({ ...base, status: 'error', hasUser: false, role: null }), 'error')
  assert.equal(vistaCuenta({ ...base, hasUser: false, role: 'comprador' }), 'invitado')
  assert.equal(vistaCuenta({ ...base, role: 'comprador' }), 'sin-perfil')
  assert.equal(vistaCuenta({ ...base, role: null }), 'sin-perfil')
  assert.equal(vistaCuenta({ ...base, role: 'fundacion', organizationId: 'org-1' }), 'fundacion')
  assert.equal(vistaCuenta({ ...base, role: 'tienda', organizationId: 'org-2' }), 'tienda')
  assert.equal(vistaCuenta({ ...base, role: 'repartidor' }), 'repartidor')
  // Fundación o tienda sin organización no muestran datos de otra.
  assert.equal(vistaCuenta({ ...base, role: 'fundacion' }), 'sin-perfil')
  assert.equal(vistaCuenta({ ...base, role: 'tienda' }), 'sin-perfil')
})

test('atajos de cada rol apuntan a rutas que existen', () => {
  for (const vista of ['fundacion', 'tienda', 'repartidor', 'invitado', 'sin-perfil'] as const) {
    const atajos = atajosCuenta(vista)
    assert.ok(atajos.length > 0, vista)
    for (const { href } of atajos) assert.notEqual(parseHash(href).name, 'not-found', `${vista}: ${href}`)
  }
  assert.ok(atajosCuenta('fundacion').some((a) => a.href === paths.fundacionPublicar))
  assert.ok(atajosCuenta('tienda').some((a) => a.href === '#/tienda/catalogo'))
  assert.ok(atajosCuenta('invitado').every((a) => !a.href.startsWith('#/tienda') && !a.href.startsWith('#/fundacion')))
  assert.deepEqual(atajosCuenta('cargando'), [])
})

test('nivel del repartidor: límite de $500 hasta 3 entregas', () => {
  assert.deepEqual(nivelRepartidor(0, 50000), { nuevo: true, hechas: 0, faltan: 3, titulo: 'Voluntario nuevo' })
  assert.deepEqual(nivelRepartidor(2, 50000), { nuevo: true, hechas: 2, faltan: 1, titulo: 'Voluntario nuevo' })
  assert.deepEqual(nivelRepartidor(5, null), { nuevo: false, hechas: 5, faltan: 0, titulo: 'Voluntario confiable' })
  assert.equal(nivelRepartidor(-1, 50000).hechas, 0)
})
