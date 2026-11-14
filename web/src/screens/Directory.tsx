import { lazy, Suspense, useState } from 'react'
import { RequestCard } from '../components/RequestCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { CocoLoading } from '../components/ui/CocoLoading'
import { EmptyState } from '../components/ui/EmptyState'
import { IconSearch } from '../components/ui/icons'

import '../features/requests/donation.css'
import { useRequests, CATEGORIES, type Category } from '../features/requests/data'

const RequestMap = lazy(() => import('../features/requests/RequestMap').then(module => ({ default: module.RequestMap })))

export function Directory() {
  const { requests, loading, error, retry } = useRequests()
  const [category, setCategory] = useState<Category | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = requests.filter(
    (r) =>
      (!category || r.category === category) &&
      (!q || `${r.title} ${r.org} ${r.city}`.toLowerCase().includes(q)),
  )

  const reset = () => {
    setCategory(null)
    setQuery('')
  }

  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span>Solicitudes verificadas</span>
          <ThemeToggle />
        </div>
        <div className="directory-heading">
          <h1 className="page-title">Encuentra una causa</h1>
          <img src="/illustrations/coco-rays.svg" alt="" width="32" height="40" />
        </div>
        <p className="page-lead">Elige dónde sumar, unidad por unidad.</p>

        <label className="search">
          <IconSearch />
          <span className="visually-hidden">Buscar solicitudes</span>
          <input
            type="search"
            placeholder="Buscar por organización o ciudad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="chip-row" role="group" aria-label="Filtrar por categoría">
          <Chip selected={category === null} onClick={() => setCategory(null)}>
            Todas
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>

        <p className="result-count" aria-live="polite">
          {results.length === 1 ? '1 solicitud' : `${results.length} solicitudes`}
        </p>

        {!loading && !error && results.length > 0 && <Suspense fallback={<CocoLoading title="Cargando mapa…" size={80} />}><RequestMap requests={results} /></Suspense>}

        {loading ? <CocoLoading title="Buscando solicitudes…" size={96} /> : error ? <div role="alert"><p>{error}</p><Button onClick={retry}>Reintentar</Button></div> : results.length > 0 ? (
          <div className="stack">
            {results.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Por aquí no hay nada todavía"
            description="Nadie ha pedido algo con ese filtro. Prueba otra categoría o vuelve más tarde."
            action={
              <Button variant="ink" onClick={reset}>
                Ver todas
              </Button>
            }
          />
        )}
      </div>
    </main>
  )
}
