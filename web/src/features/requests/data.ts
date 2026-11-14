import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
export type Category =
  'Agua' | 'Higiene' | 'Alimentos' | 'Herramientas' | 'Escolar'
export const CATEGORIES: Category[] = [
  'Agua',
  'Higiene',
  'Alimentos',
  'Herramientas',
  'Escolar',
]

export type PublicRequest = {
  id: string
  sample: boolean
  org: string
  orgType: string
  city: string
  title: string
  category: Category
  recurring: boolean
  updated: string
  state: string
  description: string | null
  latitude: number | null
  longitude: number | null
  items: {
    id: string
    name: string
    unitPrice: number
    total: number
    paid: number
    ready: number
    delivered: number
  }[]
}
export const formatMXN = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    value,
  )
export function requestTotals(request: Pick<PublicRequest, 'items'>) {
  return request.items.reduce(
    (sum, item) => ({
      total: sum.total + item.total,
      paid: sum.paid + item.paid,
      ready: sum.ready + item.ready,
      delivered: sum.delivered + item.delivered,
      amountPaid: sum.amountPaid + item.paid * item.unitPrice,
      amountTotal: sum.amountTotal + item.total * item.unitPrice,
    }),
    {
      total: 0,
      paid: 0,
      ready: 0,
      delivered: 0,
      amountPaid: 0,
      amountTotal: 0,
    },
  )
}
function categoryFor(names: string): Category {
  if (/agua|garraf[oó]n/i.test(names)) return 'Agua'
  if (/pa[ñn]al|jab[oó]n|higiene|toall/i.test(names)) return 'Higiene'
  if (/pala|guante|herramienta/i.test(names)) return 'Herramientas'
  if (/cuaderno|escolar|l[aá]piz/i.test(names)) return 'Escolar'
  return 'Alimentos'
}
export function useRequests(id?: string) {
  const [requests, setRequests] = useState<PublicRequest[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabase ? '' : 'El servicio no está configurado.')
  const [revision, setRevision] = useState(0)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    let generation = 0
    const load = async () => {
      const current = ++generation
      let query = client
        .from('solicitudes')
        .select(
          `id,titulo,descripcion,estado,recurrente,publicada_en,es_ejemplo,
        organizaciones!solicitudes_organizacion_id_fkey(nombre,categoria,direccion_publica,latitud,longitud,es_ejemplo),
        solicitud_articulos(id,nombre,precio_centavos,cantidad,unidades_pagadas,unidades_listas,unidades_entregadas)`,
        )
        .in('estado', ['publicada', 'cerrada'])
        .order('publicada_en', { ascending: false })
      if (id) query = query.eq('id', id)
      const { data, error: failure } = await query
      if (!active || current !== generation) return
      if (failure)
        setError('No pudimos cargar las solicitudes. Vuelve a intentar.')
      else {
        setError('')
        setRequests(
          (data ?? []).flatMap((row) => {
            const org = Array.isArray(row.organizaciones)
              ? row.organizaciones[0]
              : row.organizaciones
            if (!org || org.categoria === 'colectivo_busqueda') return []
            return [
              {
                id: row.id,
                title: row.titulo,
                description: row.descripcion,
                state: row.estado,
                sample: row.es_ejemplo || org.es_ejemplo,
                org: org.nombre,
                orgType: org.categoria ?? '',
                city: org.direccion_publica || 'Ubicación no publicada',
                latitude: org.latitud,
                longitude: org.longitud,
                category: categoryFor(
                  row.solicitud_articulos.map((item) => item.nombre).join(' '),
                ),
                recurring: row.recurrente,
                updated: 'con datos de la organización',
                items: row.solicitud_articulos.map((item) => ({
                  id: item.id,
                  name: item.nombre,
                  unitPrice: item.precio_centavos / 100,
                  total: item.cantidad,
                  paid: item.unidades_pagadas,
                  ready: item.unidades_listas,
                  delivered: item.unidades_entregadas,
                })),
              },
            ]
          }),
        )
      }
      setLoading(false)
    }
    void load()
    const channel = client
      .channel(`public-requests-${id ?? 'all'}-${revision}`, {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitud_articulos',
          ...(id ? { filter: `solicitud_id=eq.${id}` } : {}),
        },
        () => {
          void load()
        },
      )
      .subscribe((status) => {
        if (active) {
          setLive(status === 'SUBSCRIBED')
          if (status === 'SUBSCRIBED') void load()
        }
      })
    // Reconcile missed events after reconnecting or returning from the bank app.
    const refresh = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', refresh)
    const interval = window.setInterval(() => {
      void load()
    }, 15000)
    return () => {
      active = false
      void client.removeChannel(channel)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [id, revision])
  return {
    requests,
    loading,
    error,
    live,
    retry: () => {
      setLoading(true)
      setRevision((value) => value + 1)
    },
  }
}
