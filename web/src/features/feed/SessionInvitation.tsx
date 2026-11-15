import { Button } from '../../components/ui/Button'
import { parseHash } from '../../lib/router'

/** La ruta de T23 se usa en cuanto está integrada, sin crear otro flujo de acceso. */
export function SessionInvitation({ onClose }: { onClose: () => void }) {
  const login = ['#/entrar', '#/ingresar', '#/login'].find(path => parseHash(path).name !== 'not-found')
  return <div className="feed-invitation">
    <strong>Tu voz también suma</strong>
    <p>Entra con tu cuenta y confirma tu correo para dar me gusta y comentar.</p>
    {login ? <Button href={login} onClick={onClose}>Entrar</Button> : <>
      <p>El acceso está en el panel de sesión, arriba de la página.</p>
      <Button variant="outline" onClick={() => {
        onClose()
        requestAnimationFrame(() => {
          const details = document.querySelector<HTMLDetailsElement>('.session-controls details')
          if (details) { details.open = true; details.querySelector('summary')?.focus(); details.scrollIntoView({ block: 'center' }) }
        })
      }}>Ir al acceso de cuenta</Button>
    </>}
  </div>
}
