import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { paths } from '../../lib/router'
import { requestTotals, type PublicRequest } from './data'

export function RequestMap({ requests }: { requests: PublicRequest[] }) {
  const [tileError, setTileError] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const located = requests.filter(
    (r) =>
      r.latitude !== null &&
      r.longitude !== null &&
      Number.isFinite(r.latitude) &&
      Number.isFinite(r.longitude),
  )
  useEffect(() => {
    if (!container.current) return
    const markerColor = getComputedStyle(container.current)
      .getPropertyValue('--color-primary')
      .trim()
    const map = L.map(container.current, { scrollWheelZoom: false }).setView(
      [23.6, -102.5],
      5,
    )
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    })
      .on('tileerror', () => setTileError(true))
      .addTo(map)
    const points: L.LatLngTuple[] = []
    requests.forEach((request) => {
      if (
        request.latitude === null ||
        request.longitude === null ||
        !Number.isFinite(request.latitude) ||
        !Number.isFinite(request.longitude)
      )
        return
      const point: L.LatLngTuple = [request.latitude, request.longitude]
      points.push(point)
      const popup = document.createElement('div')
      const link = document.createElement('a')
      link.href = paths.request(request.id)
      link.textContent = `${request.sample ? 'Ejemplo · ' : ''}${request.title}`
      const text = document.createElement('p')
      const totals = requestTotals(request)
      text.textContent = `${request.org} · ${totals.paid}/${totals.total} unidades pagadas`
      popup.append(link, text)
      L.circleMarker(point, {
        radius: 10,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.85,
      })
        .bindPopup(popup)
        .addTo(map)
    })
    if (points.length)
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 13 })
    return () => {
      map.remove()
    }
  }, [requests])
  return (
    <section aria-label="Mapa de solicitudes verificadas">
      <div
        ref={container}
        className="request-map"
        aria-label="Mapa interactivo; las mismas solicitudes están en la lista"
      />
      <p className="result-count">
        {tileError &&
          'No pudimos cargar el fondo del mapa. Puedes usar la lista. '}
        {located.length} con ubicación pública. Las demás siguen disponibles en
        la lista.
      </p>
    </section>
  )
}
