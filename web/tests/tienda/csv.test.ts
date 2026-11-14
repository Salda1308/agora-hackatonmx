import assert from 'node:assert/strict'
import { test } from 'node:test'
import { leerCsv, precioACentavos } from '../../src/screens/tienda/csv.ts'

test('precios en pesos a centavos', () => {
  assert.equal(precioACentavos('28.90'), 2890)
  assert.equal(precioACentavos('$1,250.00'), 125000)
  assert.equal(precioACentavos('28,90'), 2890)
  assert.equal(precioACentavos('15'), 1500)
  assert.equal(precioACentavos('0'), null)
  assert.equal(precioACentavos('-3'), null)
  assert.equal(precioACentavos('abc'), null)
})

test('lee CSV con encabezado, comillas, punto y coma y errores', () => {
  const r = leerCsv('nombre,precio,unidad\n"Leche, 1 L",28.50,pieza\nArroz,32\n,10\nJabón,gratis\nArroz,40\n')
  assert.deepEqual(r.filas, [
    { nombre: 'Leche, 1 L', precio_centavos: 2850, unidad: 'pieza' },
    { nombre: 'Arroz', precio_centavos: 3200, unidad: 'pieza' },
  ])
  assert.equal(r.errores.length, 3)
  assert.deepEqual(leerCsv('Pañales;289,00;paquete').filas,
    [{ nombre: 'Pañales', precio_centavos: 28900, unidad: 'paquete' }])
})
