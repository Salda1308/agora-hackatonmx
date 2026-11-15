import type { SupabaseClient } from '@supabase/supabase-js'

/*
 * Crear cuenta y reenviar la confirmación (T23). No guarda rol ni datos de
 * organización en metadata de Auth: el rol sale solo de public.perfiles.
 * Los mensajes no revelan si un correo ya tiene cuenta.
 */

type AuthError = { message?: string; code?: string; status?: number; name?: string }
type CuentaClient = Pick<SupabaseClient, 'auth'>

const sinConexion = 'No hay conexión con el servidor. Vuelve a intentar.'
const demasiados = 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'

function esRed(error: AuthError) {
  return error.name === 'AuthRetryableFetchError' || error.status === 0
}

function esLimite(error: AuthError) {
  return error.status === 429 || String(error.code ?? '').startsWith('over_')
}

export function mensajeEntrada(error: AuthError): string {
  if (esRed(error)) return sinConexion
  if (esLimite(error)) return demasiados
  return 'No pudimos entrar. Revisa tu correo y contraseña; si acabas de crear tu cuenta, primero confirma tu correo.'
}

export function mensajeRegistro(error: AuthError): string | null {
  if (esRed(error)) return sinConexion
  if (esLimite(error)) return demasiados
  if (error.code === 'weak_password') return 'La contraseña es muy fácil de adivinar. Usa una más larga o combina letras, números y símbolos.'
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return 'Revisa el formato del correo.'
  if (error.code === 'signup_disabled') return 'El registro está cerrado por ahora.'
  // user_already_exists y similares: responder igual que un alta nueva.
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return null
  return 'No pudimos crear la cuenta. Vuelve a intentar.'
}

/** A dónde vuelve el enlace de confirmación: la raíz de la app en este mismo sitio. */
export function urlDeRegreso(location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}`
}

export function createCuentaApi(client: CuentaClient | null) {
  function cliente() {
    if (!client) throw new Error('El acceso no está disponible por ahora.')
    return client
  }
  return {
    /** Devuelve `confirmar: true` si hay que revisar el correo antes de entrar. */
    async crearCuenta(email: string, password: string, redirectTo?: string): Promise<{ confirmar: boolean }> {
      const { data, error } = await cliente().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
      if (error) {
        const mensaje = mensajeRegistro(error)
        if (mensaje) throw new Error(mensaje)
        return { confirmar: true }
      }
      return { confirmar: !data.session }
    },
    async reenviarConfirmacion(email: string, redirectTo?: string) {
      const { error } = await cliente().auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
      if (error) throw new Error(esLimite(error) ? demasiados : esRed(error) ? sinConexion : 'No pudimos reenviar el correo. Vuelve a intentar.')
    },
  }
}
