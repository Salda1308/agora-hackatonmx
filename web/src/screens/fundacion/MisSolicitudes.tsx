import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip, SampleBadge } from '../../components/ui/Chip'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/Progress'
import { IconPlus } from '../../components/ui/icons'
import { categoryFor } from '../../features/requests/data'
import { requestVisual } from '../../lib/request-visuals'
import { paths } from '../../lib/router'
import { cargarMiOrganizacion, cargarMisSolicitudes, formatoPesos } from './api'
import type { EstadoSolicitud, MiOrganizacion, MiSolicitud } from './api'
import { Marco } from './Marco'
import { NuevaSolicitud } from './NuevaSolicitud'
import { Recepciones } from './Recepciones'

const ESTADOS: Record<EstadoSolicitud, { texto: string; tono: 'lime' | 'surface' | 'outline' }> = {
  publicada: { texto: 'Publicada', tono: 'lime' },
  borrador: { texto: 'Borrador', tono: 'outline' },
  cerrada: { texto: 'Completa', tono: 'surface' },
  cancelada: { texto: 'Cancelada', tono: 'outline' },
}

export function MisSolicitudes({ organizacionId, nueva }: { organizacionId: string; nueva: boolean }) {
  const [org, setOrg] = useState<MiOrganizacion | null>(null)
  const [solicitudes, setSolicitudes] = useState<MiSolicitud[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    Promise.all([cargarMiOrganizacion(organizacionId), cargarMisSolicitudes(organizacionId)])
      .then(([o, s]) => {
        if (!vigente) return
        setOrg(o)
        setSolicitudes(s)
        setError(false)
      })
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [organizacionId, intento])

  const puedePublicar = org ? org.verificada && !org.suspendida : false
  // Al publicar se recarga la lista al cerrar el modal.
  const [publico, setPublico] = useState(false)
  // Desde la lista se abre sin cambiar de ruta; #/fundacion/publicar entra con el modal abierto.
  const [abierta, setAbierta] = useState(nueva)
  const cerrarNueva = () => {
    setAbierta(false)
    if (window.location.hash === paths.fundacionPublicar) window.location.hash = paths.fundacion
    if (publico) {
      setPublico(false)
      setIntento((n) => n + 1)
    }
  }

  return (
    <Marco>
      <div>
        <h1 className="page-title">Mis solicitudes</h1>
        {org ? <p className="page-lead">{org.nombre}</p> : null}
      </div>

      <Recepciones />

      {org && !puedePublicar ? (
        <Card className="fund-aviso">
          <Chip tone="yellow">{org.suspendida ? 'Suspendida' : 'En revisión'}</Chip>
          <strong>{org.suspendida ? 'Tu fundación está suspendida' : 'Verificación pendiente'}</strong>
          <p>Podrás publicar cuando el equipo de Ágora la active.</p>
        </Card>
      ) : null}

      {puedePublicar ? (
        <Button size="lg" block onClick={() => setAbierta(true)} icon={<IconPlus />}>
          Nueva solicitud
        </Button>
      ) : null}

      {error ? (
        <EmptyState
          title="No se pudieron cargar"
          action={<Button variant="ink" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>}
        />
      ) : solicitudes === null ? (
        <CocoLoading title="Cargando solicitudes…" size={88} />
      ) : solicitudes.length === 0 ? (
        <EmptyState
          title="Aún no pides nada"
          description="Elige artículos del catálogo de una tienda y publícalos."
          pose="saludando"
          action={puedePublicar ? <Button onClick={() => setAbierta(true)} icon={<IconPlus />}>Nueva solicitud</Button> : undefined}
        />
      ) : (
        <ul className="stack fund-list">
          {solicitudes.map((s) => {
            const total = s.solicitud_articulos.reduce((n, a) => n + a.cantidad, 0)
            const pagadas = s.solicitud_articulos.reduce((n, a) => n + a.unidades_pagadas, 0)
            const monto = s.solicitud_articulos.reduce((n, a) => n + a.cantidad * a.precio_centavos, 0)
            const estado = ESTADOS[s.estado]
            const visible = s.estado === 'publicada' || s.estado === 'cerrada'
            const categoria = categoryFor(s.solicitud_articulos.map((a) => a.nombre).join(' '))
            return (
              <li key={s.id}>
                <Card href={visible ? paths.request(s.id) : undefined} className="fund-item fund-item--media">
                  <img className="fund-item__img" src={requestVisual(categoria)} alt="" width={72} height={72} loading="lazy" />
                  <div className="fund-item__body">
                    <div className="fund-item__head">
                      <h2 className="fund-item__title">{s.titulo}</h2>
                      <Chip tone={estado.tono}>{estado.texto}</Chip>
                    </div>
                    {s.es_ejemplo ? <SampleBadge /> : null}
                    <p className="fund-muted">
                      {categoria} · {s.tienda?.nombre ?? 'Tienda'} · {formatoPesos(monto)}
                    </p>
                    <ProgressBar value={pagadas} max={Math.max(total, 1)} label="Unidades pagadas" detail={`${pagadas} de ${total}`} tone="ink" size="sm" />
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {abierta ? (
        <NuevaSolicitud organizacionId={organizacionId} onClose={cerrarNueva} onPublicada={() => setPublico(true)} />
      ) : null}
    </Marco>
  )
}
