import { supabase } from '../../lib/supabase'
import type { FilaCatalogo } from './csv'

function cliente() {
  if (!supabase) throw new Error('El servicio no está configurado.')
  return supabase
}

export interface MiTienda {
  id: string
  nombre: string
  verificada: boolean
  suspendida: boolean
}

export interface Pedido {
  id: string
  estado: 'preparando' | 'listo' | 'recogido' | 'entregado'
  codigo_recogida: string | null
  creado_en: string
  listo_en: string | null
  solicitud_titulo: string
  organizacion_nombre: string
  total_centavos: number
  articulos: { nombre: string; unidades: number; precio_centavos: number }[]
}

export interface Articulo {
  id: string
  nombre: string
  unidad: string
  precio_centavos: number
  activo: boolean
}

export async function cargarMiTienda(id: string): Promise<MiTienda> {
  const { data, error } = await cliente()
    .from('organizaciones')
    .select('id, nombre, verificada, suspendida')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as MiTienda
}

export async function cargarPedidos(): Promise<Pedido[]> {
  const { data, error } = await cliente().rpc('pedidos_de_mi_tienda')
  if (error) throw error
  return ((data ?? []) as Pedido[]).map((p) => ({ ...p, total_centavos: Number(p.total_centavos) }))
}

export async function marcarListo(pedidoId: string): Promise<string> {
  const { data, error } = await cliente().rpc('marcar_pedido_listo', { p_pedido: pedidoId })
  if (error) {
    const conocidos = ['El pedido no está pagado', 'La tienda está suspendida', 'Pedido no encontrado o ya estaba listo']
    throw new Error(conocidos.find((m) => error.message.includes(m)) ?? 'No se pudo marcar. Vuelve a intentar.')
  }
  return data as string
}

export async function cargarCatalogo(tiendaId: string): Promise<Articulo[]> {
  const { data, error } = await cliente()
    .from('catalogo_articulos')
    .select('id, nombre, unidad, precio_centavos, activo')
    .eq('tienda_id', tiendaId)
    .order('nombre')
  if (error) throw error
  return (data ?? []) as Articulo[]
}

export async function agregarArticulos(tiendaId: string, filas: FilaCatalogo[]) {
  if (filas.length === 0) return
  const { error } = await cliente()
    .from('catalogo_articulos')
    .insert(filas.map((f) => ({ tienda_id: tiendaId, ...f })))
  if (error) throw new Error('No se pudo guardar. Revisa los datos.')
}

export async function actualizarArticulo(
  id: string,
  cambios: Partial<Pick<Articulo, 'precio_centavos' | 'unidad' | 'activo'>>,
) {
  const { error } = await cliente().from('catalogo_articulos').update(cambios).eq('id', id)
  if (error) throw new Error('No se pudo guardar. Vuelve a intentar.')
}

/** Actualiza por nombre (precio y unidad, y lo reactiva) y agrega los nuevos. */
export async function importarCatalogo(tiendaId: string, filas: FilaCatalogo[], existentes: Articulo[]) {
  const porNombre = new Map(existentes.map((a) => [a.nombre.toLocaleLowerCase('es-MX'), a]))
  const nuevos: FilaCatalogo[] = []
  let actualizados = 0
  for (const f of filas) {
    const previo = porNombre.get(f.nombre.toLocaleLowerCase('es-MX'))
    if (!previo) {
      nuevos.push(f)
    } else if (previo.precio_centavos !== f.precio_centavos || previo.unidad !== f.unidad || !previo.activo) {
      await actualizarArticulo(previo.id, { precio_centavos: f.precio_centavos, unidad: f.unidad, activo: true })
      actualizados++
    }
  }
  await agregarArticulos(tiendaId, nuevos)
  return { nuevos: nuevos.length, actualizados }
}
