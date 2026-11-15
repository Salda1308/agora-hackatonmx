import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { validarCorreo } from '../../auth/alta-validacion'
import { errorDeRetorno, registroPaths } from '../../auth/registro-routes'
import { roleLabels, roleNavigation } from '../../auth/roles'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Marco } from '../fundacion/Marco'
import { CampoContrasena, Campo, EnlacesCuenta, EstadoSesion } from './comun'

export function Entrar() {
  return <EstadoSesion><FormularioEntrar /></EstadoSesion>
}

function FormularioEntrar() {
  const { user, role, status, signIn, signOut } = useSession()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)

  if (user && status === 'ready' && role && !enviando) {
    const destino = role === 'comprador' ? registroPaths.registro : `#${roleNavigation[role][0].path}`
    return (
      <Marco>
        <EmptyState pose="saludando" title="Ya entraste"
          description={role === 'comprador' ? 'Sigue con tu solicitud de alta.' : `Tu cuenta es de ${roleLabels[role].toLowerCase()}.`}
          action={<div className="wrap-row">
            <Button variant="ink" href={destino}>{role === 'comprador' ? 'Ir a mi solicitud' : 'Ir a mi panel'}</Button>
            <Button variant="ghost" onClick={() => void signOut().catch(() => {})}>Cerrar sesión</Button>
          </div>} />
      </Marco>
    )
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enCurso.current) return
    const siguientes = {
      correo: validarCorreo(correo) ?? undefined,
      contrasena: contrasena ? undefined : 'Escribe tu contraseña.',
    }
    setErrores(siguientes)
    setFallo(null)
    if (siguientes.correo || siguientes.contrasena) return
    enCurso.current = true
    setEnviando(true)
    try {
      const perfil = await signIn(correo, contrasena)
      window.location.hash = perfil ? `#${roleNavigation[perfil.rol][0].path}` : registroPaths.registro
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No pudimos entrar. Vuelve a intentar.')
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  const retorno = errorDeRetorno(window.location.hash)
  return (
    <Marco>
      <div>
        <h1 className="page-title">Entrar</h1>
        <p className="page-lead">Para fundaciones, tiendas y repartidores. Para donar no necesitas cuenta.</p>
      </div>
      {retorno ? <p className="reg-error" role="alert">{retorno}</p> : null}
      <Card>
        <form className="reg-form" noValidate onSubmit={(e) => void enviar(e)} aria-busy={enviando}>
          <Campo etiqueta="Correo" error={errores.correo}>
            {(props) => <input {...props} type="email" inputMode="email" autoComplete="email" value={correo}
              onChange={(e) => setCorreo(e.target.value)} maxLength={254} required />}
          </Campo>
          <CampoContrasena valor={contrasena} onCambio={setContrasena} error={errores.contrasena} autoComplete="current-password" />
          <Button type="submit" size="lg" block disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Button>
          {fallo ? <p className="reg-error" role="alert">{fallo}</p> : null}
        </form>
      </Card>
      <EnlacesCuenta actual="entrar" />
    </Marco>
  )
}
