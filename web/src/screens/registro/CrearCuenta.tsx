import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { validarContrasena, validarCorreo } from '../../auth/alta-validacion'
import { urlDeRegreso } from '../../auth/cuenta'
import { registroPaths } from '../../auth/registro-routes'
import { useSession } from '../../auth/useSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { LegalLinks } from '../../components/LegalLinks'
import { Coco } from '../../components/ui/Coco'
import { EmptyState } from '../../components/ui/EmptyState'
import { Marco } from '../fundacion/Marco'
import { CampoContrasena, Campo, EnlacesCuenta, EstadoSesion } from './comun'
import { cuenta } from './datos'

const ESPERA_REENVIO_S = 60

export function CrearCuenta() {
  return <EstadoSesion><FormularioCrear /></EstadoSesion>
}

function FormularioCrear() {
  const { user, status } = useSession()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [errores, setErrores] = useState<{ correo?: string; contrasena?: string }>({})
  const [fallo, setFallo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const enCurso = useRef(false)

  if (enviadoA) return <RevisaTuCorreo correo={enviadoA} />
  if (user && status === 'ready' && !enviando) {
    return (
      <Marco>
        <EmptyState pose="saludando" title="Ya tienes sesión" description="Sigue con tu solicitud de alta."
          action={<Button variant="ink" href={registroPaths.registro}>Ir a mi solicitud</Button>} />
      </Marco>
    )
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enCurso.current) return
    const siguientes = {
      correo: validarCorreo(correo) ?? undefined,
      contrasena: validarContrasena(contrasena) ?? undefined,
    }
    setErrores(siguientes)
    setFallo(null)
    if (siguientes.correo || siguientes.contrasena) return
    enCurso.current = true
    setEnviando(true)
    try {
      const { confirmar } = await cuenta.crearCuenta(correo, contrasena, urlDeRegreso(window.location))
      if (confirmar) setEnviadoA(correo.trim().toLowerCase())
      else window.location.hash = registroPaths.registro
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No pudimos crear la cuenta. Vuelve a intentar.')
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <Marco>
      <div>
        <h1 className="page-title">Crear cuenta</h1>
        <p className="page-lead">Para registrar tu fundación, tu tienda o sumarte como repartidor. El equipo revisa cada solicitud.</p>
      </div>
      <Card>
        <form className="reg-form" noValidate onSubmit={(e) => void enviar(e)} aria-busy={enviando}>
          <Campo etiqueta="Correo" error={errores.correo} pista="Te enviaremos un enlace para confirmarlo.">
            {(props) => <input {...props} type="email" inputMode="email" autoComplete="email" value={correo}
              onChange={(e) => setCorreo(e.target.value)} maxLength={254} required />}
          </Campo>
          <CampoContrasena valor={contrasena} onCambio={setContrasena} error={errores.contrasena}
            autoComplete="new-password" conMedidor />
          <LegalLinks className="reg-muted" lead="Al crear tu cuenta, lees y aceptas el" />
          <Button type="submit" size="lg" block disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear cuenta'}
          </Button>
          {fallo ? <p className="reg-error" role="alert">{fallo}</p> : null}
        </form>
      </Card>
      <EnlacesCuenta actual="crear-cuenta" />
    </Marco>
  )
}

function RevisaTuCorreo({ correo }: { correo: string }) {
  const [espera, setEspera] = useState(ESPERA_REENVIO_S)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (espera <= 0) return
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [espera])

  const reenviar = async () => {
    setEnviando(true)
    setAviso(null)
    try {
      await cuenta.reenviarConfirmacion(correo, urlDeRegreso(window.location))
      setAviso({ tipo: 'ok', texto: 'Listo. Si el correo es válido, te llegará otro enlace.' })
      setEspera(ESPERA_REENVIO_S)
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No pudimos reenviar el correo.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Marco>
      <div className="reg-stack reg-hero" role="status">
        <Coco size={120} pose="pulgar-arriba" animation="celebrate" />
        <h1 className="page-title">Revisa tu correo</h1>
        <p className="page-lead">
          Si <strong>{correo}</strong> es válido, te enviamos un enlace para confirmar tu cuenta. Ábrelo en este dispositivo para seguir con tu solicitud.
        </p>
      </div>
      <div className="reg-note">
        <p><strong>¿No llega?</strong></p>
        <p className="reg-muted">Busca en spam o promociones. Puede tardar unos minutos.</p>
      </div>
      <div className="reg-stack">
        <Button variant="ink" size="lg" block href={registroPaths.entrar}>Ya confirmé, entrar</Button>
        <Button variant="outline" block disabled={enviando || espera > 0} onClick={() => void reenviar()}>
          {espera > 0 ? `Reenviar correo en ${espera} s` : enviando ? 'Reenviando…' : 'Reenviar correo'}
        </Button>
        {aviso ? <p className={aviso.tipo === 'error' ? 'reg-error' : 'reg-muted'} role={aviso.tipo === 'error' ? 'alert' : 'status'}>{aviso.texto}</p> : null}
      </div>
    </Marco>
  )
}
