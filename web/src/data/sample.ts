/*
 * DATOS DE EJEMPLO para las pantallas ancla de D1.
 * Organizaciones, montos y avances son ficticios y la interfaz los marca como tales.
 * Se reemplazan por datos reales cuando exista el backend (tareas 02, 05 y 06).
 */

export const SAMPLE_DATA_NOTICE = 'Datos de ejemplo: organizaciones y montos ficticios.'

export type Category = 'Agua' | 'Higiene' | 'Alimentos' | 'Herramientas' | 'Escolar'

export const CATEGORIES: Category[] = ['Agua', 'Higiene', 'Alimentos', 'Herramientas', 'Escolar']

export type RequestItem = {
  name: string
  /** Precio fijo por unidad, en pesos. */
  unitPrice: number
  total: number
  /** Unidades por estado; pagadas incluye las listas y entregadas. */
  paid: number
  ready: number
  delivered: number
}

export type SampleRequest = {
  id: string
  sample: true
  org: string
  orgType: string
  city: string
  title: string
  category: Category
  recurring: boolean
  updated: string
  items: RequestItem[]
}

export const SAMPLE_REQUESTS: SampleRequest[] = [
  {
    id: 'agua-casa-hogar',
    sample: true,
    org: 'Casa Hogar Ejemplo A',
    orgType: 'Casa hogar',
    city: 'Ciudad de México',
    title: 'Agua potable para el mes',
    category: 'Agua',
    recurring: true,
    updated: 'hace 3 min',
    items: [
      { name: 'Garrafón de 20 L', unitPrice: 45, total: 40, paid: 27, ready: 12, delivered: 8 },
      { name: 'Paquete de vasos', unitPrice: 30, total: 10, paid: 4, ready: 0, delivered: 0 },
    ],
  },
  {
    id: 'panales-estancia',
    sample: true,
    org: 'Estancia Infantil Ejemplo B',
    orgType: 'Estancia infantil',
    city: 'Puebla',
    title: 'Pañales y toallitas',
    category: 'Higiene',
    recurring: true,
    updated: 'hace 1 h',
    items: [
      { name: 'Paquete de pañales etapa 3', unitPrice: 210, total: 30, paid: 21, ready: 21, delivered: 15 },
      { name: 'Toallitas húmedas', unitPrice: 55, total: 30, paid: 30, ready: 30, delivered: 30 },
    ],
  },
  {
    id: 'despensa-comedor',
    sample: true,
    org: 'Comedor Comunitario Ejemplo C',
    orgType: 'Comedor comunitario',
    city: 'Oaxaca',
    title: 'Despensa para 60 comidas',
    category: 'Alimentos',
    recurring: false,
    updated: 'hace 20 min',
    items: [
      { name: 'Arroz 1 kg', unitPrice: 32, total: 25, paid: 9, ready: 0, delivered: 0 },
      { name: 'Frijol 1 kg', unitPrice: 38, total: 25, paid: 6, ready: 0, delivered: 0 },
      { name: 'Aceite 1 L', unitPrice: 48, total: 12, paid: 2, ready: 0, delivered: 0 },
    ],
  },
  {
    id: 'palas-brigada',
    sample: true,
    org: 'Brigada Vecinal Ejemplo D',
    orgType: 'Colectivo vecinal',
    city: 'Monterrey',
    title: 'Herramienta para limpiar el arroyo',
    category: 'Herramientas',
    recurring: false,
    updated: 'ayer',
    items: [
      { name: 'Pala recta', unitPrice: 189, total: 8, paid: 1, ready: 0, delivered: 0 },
      { name: 'Par de guantes', unitPrice: 65, total: 16, paid: 3, ready: 0, delivered: 0 },
    ],
  },
]

export function requestTotals(req: SampleRequest) {
  return req.items.reduce(
    (acc, it) => ({
      total: acc.total + it.total,
      paid: acc.paid + it.paid,
      ready: acc.ready + it.ready,
      delivered: acc.delivered + it.delivered,
      amountPaid: acc.amountPaid + it.paid * it.unitPrice,
      amountTotal: acc.amountTotal + it.total * it.unitPrice,
    }),
    { total: 0, paid: 0, ready: 0, delivered: 0, amountPaid: 0, amountTotal: 0 },
  )
}

export function findSampleRequest(id: string) {
  return SAMPLE_REQUESTS.find((r) => r.id === id)
}

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const formatMXN = (n: number) => mxn.format(n)
