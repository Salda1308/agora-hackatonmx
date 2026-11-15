import type { RegistroRoute } from '../../auth/registro-routes'
import { errorDeRetorno } from '../../auth/registro-routes'
import { CocoLoading } from '../../components/ui/CocoLoading'
import { Marco } from '../fundacion/Marco'
import { CrearCuenta } from './CrearCuenta'
import { Entrar } from './Entrar'
import { MiRegistro } from './MiRegistro'
import { SolicitudForm } from './SolicitudForm'
import './registro.css'

/**
 * Inicio de sesión y registro por rol (T23). Se carga aparte (lazy). El rol sale
 * solo de public.perfiles; las funciones de T22 validan y deciden cada alta.
 */
export default function RegistroArea({ route }: { route: RegistroRoute }) {
  switch (route.name) {
    case 'entrar':
      return <Entrar />
    case 'crear-cuenta':
      return <CrearCuenta />
    case 'registro':
      return <MiRegistro />
    case 'registro-rol':
      return <SolicitudForm rol={route.rol} />
    case 'auth-callback':
      // Con error, el hash se queda y Entrar lo explica; con éxito supabase-js lo limpia.
      return errorDeRetorno(window.location.hash) ? <Entrar /> : <Marco><CocoLoading title="Confirmando tu cuenta…" size={88} /></Marco>
  }
}
