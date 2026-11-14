// Lectura de catálogo en CSV, sin dependencias. Columnas: nombre, precio, unidad (opcional).
// La primera fila se toma como encabezado si su precio no es un número.
// Precio en pesos ("28.90", "$1,250.00"); se guarda en centavos.

export interface FilaCatalogo {
  nombre: string
  precio_centavos: number
  unidad: string
}

export interface ResultadoCsv {
  filas: FilaCatalogo[]
  errores: string[]
}

function separar(linea: string, sep: string): string[] {
  const campos: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (c === '"') comillas = false
      else actual += c
    } else if (c === '"') comillas = true
    else if (c === sep) {
      campos.push(actual)
      actual = ''
    } else actual += c
  }
  campos.push(actual)
  return campos.map((c) => c.trim())
}

export function precioACentavos(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  const centavos = Math.round(Number(limpio) * 100)
  return centavos > 0 && centavos <= 100_000_000 ? centavos : null
}

export function leerCsv(texto: string): ResultadoCsv {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const sep = lineas[0] && lineas[0].split(';').length > lineas[0].split(',').length ? ';' : ','
  const filas: FilaCatalogo[] = []
  const errores: string[] = []
  const vistos = new Set<string>()
  lineas.forEach((linea, i) => {
    const [nombre = '', precio = '', unidad = ''] = separar(linea, sep)
    const centavos = precioACentavos(precio)
    if (i === 0 && centavos === null) return // encabezado
    if (!nombre || nombre.length > 200) {
      errores.push(`Fila ${i + 1}: falta el nombre`)
      return
    }
    if (centavos === null) {
      errores.push(`Fila ${i + 1}: precio inválido`)
      return
    }
    const clave = nombre.toLocaleLowerCase('es-MX')
    if (vistos.has(clave)) {
      errores.push(`Fila ${i + 1}: «${nombre}» repetido`)
      return
    }
    vistos.add(clave)
    filas.push({ nombre, precio_centavos: centavos, unidad: unidad || 'pieza' })
  })
  return { filas, errores }
}
