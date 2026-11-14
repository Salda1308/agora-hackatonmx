import { useState } from 'react'
import { RequestCard } from '../components/RequestCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Chip, SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { IconSearch } from '../components/ui/icons'
import { CATEGORIES, SAMPLE_REQUESTS, type Category } from '../data/sample'

export function Directory() {
  const [category, setCategory] = useState<Category | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = SAMPLE_REQUESTS.filter(
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
          <SampleBadge />
          <ThemeToggle />
        </div>
        <h1 className="page-title">
          Lo que se <span className="highlight highlight--red">necesita</span>
        </h1>
        <p className="page-lead">Solicitudes de organizaciones verificadas. Cada barra avanza con cada unidad pagada.</p>

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

        {results.length > 0 ? (
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
