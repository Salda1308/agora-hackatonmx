import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { paths } from '../lib/router'

/** Only attempts from this tab; tokens are never put in navigation URLs. */
export function Following() {
  const attempts: { id: string; reference: string }[] = []
  try {
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index)
      if (
        key?.startsWith('agora-attempt-') &&
        sessionStorage.getItem(key) === 'pending'
      ) {
        attempts.push({
          id: key.slice('agora-attempt-'.length),
          reference: 'por confirmar',
        })
        continue
      }
      if (!key?.startsWith('agora-payment-')) continue
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
        if (saved?.pagoId)
          attempts.push({
            id: key.slice('agora-payment-'.length),
            reference: saved.numRef,
          })
      } catch {
        /* Ignore incomplete local records. */
      }
    }
  } catch {
    /* The rest of the app works with storage disabled. */
  }
  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span className="brand brand--ink">Ágora</span>
          <ThemeToggle />
        </div>
        <h1 className="page-title">
          Lo que <span className="highlight highlight--lime">sigues</span>
        </h1>
        {attempts.length ? (
          <>
            <p>
              Intentos de pago de esta pestaña. Abre uno para consultar su
              confirmación.
            </p>
            <div className="stack">
              {attempts.map((attempt) => (
                <Card key={attempt.id} href={paths.request(attempt.id)}>
                  Consultar pago · referencia {attempt.reference}
                </Card>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="Aún no tienes donaciones aquí"
            description="Cuando inicies un pago, podrás volver a consultarlo desde esta pestaña."
            action={
              <Button href={paths.directory}>Explorar solicitudes</Button>
            }
          />
        )}
      </div>
    </main>
  )
}
