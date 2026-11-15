import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type PanelCounters = {
  recibido: number
  comprado: number
  entregado: number
}

export type PanelEvent = PanelCounters & {
  nombre: string
}

export type PanelRequest = PanelCounters & {
  id: string
  titulo: string
  organizacion: string
  zona: string
  ejemplo: boolean
}

export type PanelZone = PanelCounters & {
  nombre: string
}

export type PanelDelivery = {
  id: string | null
  pedido_id: string | null
  estado: 'pendiente' | 'evidencia_recibida' | 'confirmada'
  entregada_en: string | null
  confirmada_en: string | null
  foto_publica: false
  constancia: string
}

export type PanelUsage = {
  id: string
  ticket: string
  monto_centavos: number
  pagado_en: string
  solicitud_id: string
  solicitud: string
  organizacion: string
  zona: string
  ejemplo: boolean
  entrega: PanelDelivery
}

export type PanelData = {
  evento: PanelEvent
  resumen: PanelCounters
  solicitudes: PanelRequest[]
  zonas: PanelZone[]
  usos: PanelUsage[]
  actualizado_en: string
}

export function usePanelPublico() {
  const [panel, setPanel] = useState<PanelData | null>(null)
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
      const { data, error: failure } = await client.rpc('panel_publico')
      if (!active || current !== generation) return
      if (failure || !data) {
        setError('No pudimos cargar el panel público. Vuelve a intentar.')
      } else {
        setError('')
        setPanel(data as PanelData)
      }
      setLoading(false)
    }

    void load()
    const channel = client
      .channel(`public-panel-${revision}`, {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitud_articulos' },
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
  }, [revision])

  return {
    panel,
    loading,
    error,
    live,
    retry: () => {
      setLoading(true)
      setRevision((value) => value + 1)
    },
  }
}
