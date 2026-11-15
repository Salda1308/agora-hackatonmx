import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { fuerzaContrasena } from '../../auth/alta-validacion'
import { registroPaths } from '../../auth/registro-routes'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { paths } from '../../lib/router'
import { Marco } from '../fundacion/Marco'

/** Etiqueta, control, pista y error de un campo, con los atributos ARIA enlazados. */
export function Campo({ etiqueta, pista, error, children }: {
  etiqueta: string
  pista?: ReactNode
  error?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const descritoPor = [pista ? `${id}-pista` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="reg-field">
      <label htmlFor={id}>{etiqueta}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': descritoPor })}
      {pista ? <span id={`${id}-pista`} className="reg-field__hint">{pista}</span> : null}
      {error ? <p id={`${id}-error`} className="reg-field__error">{error}</p> : null}
    </div>
  )
}

/** Contraseña con botón para mostrarla. */
export function CampoContrasena({ valor, onCambio, error, autoComplete, pista, conMedidor = false }: {
  valor: string
  onCambio: (valor: string) => void
  error?: string
  autoComplete: 'current-password' | 'new-password'
  pista?: string
  conMedidor?: boolean
}) {
  const [ver, setVer] = useState(false)
  return (
    <Campo etiqueta="Contraseña" error={error} pista={pista}>
      {(props) => (
        <>
          <div className="reg-password">
            <input {...props} type={ver ? 'text' : 'password'} value={valor} autoComplete={autoComplete}
              onChange={(e) => onCambio(e.target.value)} maxLength={72} required />
            <Button variant="ghost" aria-pressed={ver} onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Mostrar'}</Button>
          </div>
          {conMedidor ? <Medidor contrasena={valor} /> : null}
        </>
      )}
    </Campo>
  )
}

const niveles = {
  corta: { nivel: 0, texto: 'Usa al menos 10 caracteres.' },
  debil: { nivel: 1, texto: 'Seguridad baja: agrega números, símbolos o más letras.' },
  buena: { nivel: 2, texto: 'Seguridad media.' },
  fuerte: { nivel: 3, texto: 'Seguridad alta.' },
} as const

function Medidor({ contrasena }: { contrasena: string }) {
  const { nivel, texto } = niveles[fuerzaContrasena(contrasena)]
  return (
    <div className="reg-meter-wrap">
      <div className="reg-meter" data-nivel={nivel} aria-hidden="true"><span /><span /><span /></div>
      <span className="reg-field__hint" aria-live="polite">{contrasena ? texto : 'Mínimo 10 caracteres.'}</span>
    </div>
  )
}

/** Sesión no disponible o con error: mismos estados que las áreas de rol. */
export function EstadoSesion({ children }: { children: ReactNode }) {
  const { authEnabled, status, error, retry, signOut } = useSession()
  if (!authEnabled) {
    return (
      <Marco>
        <EmptyState title="El acceso no está disponible" description="Por ahora puedes donar sin cuenta."
          action={<Button variant="ink" href={paths.home}>Ir al inicio</Button>} />
      </Marco>
    )
  }
  if (status === 'error') {
    return (
      <Marco>
        <EmptyState title="No pudimos cargar tu sesión" description={error ?? undefined}
          action={<div className="wrap-row">
            <Button variant="ink" onClick={() => void retry()}>Reintentar</Button>
            <Button variant="ghost" onClick={() => void signOut().catch(() => {})}>Salir</Button>
          </div>} />
      </Marco>
    )
  }
  return children
}

export function EnlacesCuenta({ actual }: { actual: 'entrar' | 'crear-cuenta' }) {
  return (
    <div className="reg-links">
      {actual === 'entrar'
        ? <a href={registroPaths.crearCuenta}>¿No tienes cuenta? Crear cuenta</a>
        : <a href={registroPaths.entrar}>¿Ya tienes cuenta? Entrar</a>}
      <a href={paths.home}>Solo quiero donar, no necesito cuenta</a>
    </div>
  )
}
