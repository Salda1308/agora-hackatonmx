import type { ProfileRole } from './roles.ts'

/*
 * Validaciones de la cuenta y de la solicitud de alta (T23). Repiten las reglas
 * del contrato de T22 para avisar antes de enviar; el servidor es la autoridad.
 */

export const PASSWORD_MIN = 10

export const categoriasFundacion = [
  { valor: 'albergue', etiqueta: 'Albergue' },
  { valor: 'asilo', etiqueta: 'Asilo' },
  { valor: 'refugio_animales', etiqueta: 'Refugio de animales' },
  { valor: 'colectivo_busqueda', etiqueta: 'Colectivo de búsqueda' },
] as const

export type CategoriaFundacion = (typeof categoriasFundacion)[number]['valor']

export const LIMITES = {
  nombreContacto: 120,
  telefono: 10,
  ciudad: 80,
  orgNombre: 120,
  descripcionMin: 40,
  descripcionMax: 1000,
  enlace: 300,
  correo: 254,
} as const

// Mismas listas que `solicitar_alta` (T22).
const acortadores = [
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 's.id', 't.ly', 'lnkd.in',
]

const correosDesechables = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'guerrillamail.net', 'mailnesia.com',
  'moakt.com', 'tempmail.net', 'emailondeck.com', 'mintemail.com',
]

const RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/
const URL_EN_TEXTO = /(https?:|www\.|[a-z0-9-]\.(com|net|org|mx|io|ly|co|me|info|xyz|app|site|link|gl|cc|to)\b)/i
// Forma de enlace que acepta el servidor: https, host con punto, sin espacios.
const ENLACE = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?([/?#]\S*)?$/i

/** Recorta y junta espacios repetidos (incluidos saltos de línea). */
export function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

function enDominio(host: string, lista: readonly string[]) {
  const h = host.toLowerCase().replace(/\.$/, '')
  return lista.some((d) => h === d || h.endsWith(`.${d}`))
}

export function validarCorreo(correo: string): string | null {
  const valor = correo.trim().toLowerCase()
  if (!valor) return 'Escribe tu correo.'
  if (valor.length > LIMITES.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'Revisa el formato del correo.'
  if (enDominio(valor.split('@')[1], correosDesechables)) return 'Usa un correo permanente; los correos temporales no se aceptan.'
  return null
}

export type FuerzaContrasena = 'corta' | 'debil' | 'buena' | 'fuerte'

export function fuerzaContrasena(contrasena: string): FuerzaContrasena {
  if (contrasena.length < PASSWORD_MIN) return 'corta'
  const puntos = [
    /[a-z]/.test(contrasena) && /[A-Z]/.test(contrasena),
    /[0-9]/.test(contrasena),
    /[^A-Za-z0-9]/.test(contrasena),
    contrasena.length >= 14,
  ].filter(Boolean).length
  return puntos <= 1 ? 'debil' : puntos === 2 ? 'buena' : 'fuerte'
}

export function validarContrasena(contrasena: string): string | null {
  if (contrasena.length < PASSWORD_MIN) return `Usa al menos ${PASSWORD_MIN} caracteres.`
  if (contrasena.length > 72) return 'Usa como máximo 72 caracteres.'
  return null
}

/** Teléfono mexicano de 10 dígitos; acepta +52, espacios y guiones. */
export function normalizarTelefono(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3)
  else if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2)
  return /^[0-9]{10}$/.test(digitos) ? digitos : null
}

export function normalizarRfc(rfc: string): string {
  return rfc.replace(/[\s-]/g, '').toUpperCase()
}

export function validarEnlace(enlace: string): string | null {
  const valor = enlace.trim()
  if (valor.length > LIMITES.enlace) return `Usa un enlace de máximo ${LIMITES.enlace} caracteres.`
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return 'Escribe el enlace completo, empezando con https://'
  }
  if (url.protocol !== 'https:') return 'El enlace debe empezar con https://'
  if (url.username || url.password || !ENLACE.test(valor)) return 'Revisa el enlace: sin espacios y con un dominio completo.'
  if (enDominio(url.hostname, acortadores)) return 'Usa el enlace completo, sin acortadores.'
  return null
}

function validarTexto(valor: string, min: number, max: number, nombre: string, permitirUrl = false): string | null {
  if (!valor) return `Escribe ${nombre}.`
  if (CONTROL.test(valor)) return 'Quita los caracteres especiales.'
  if (valor.length < min) return `Escribe al menos ${min} caracteres.`
  if (valor.length > max) return `Usa como máximo ${max} caracteres.`
  if (!permitirUrl && URL_EN_TEXTO.test(valor)) return 'No incluyas enlaces en este campo.'
  return null
}

export interface FormularioAlta {
  nombreContacto: string
  telefono: string
  ciudad: string
  orgNombre: string
  orgCategoria: string
  orgDescripcion: string
  rfc: string
  enlace: string
}

export type CampoAlta = keyof FormularioAlta

export const formularioVacio: FormularioAlta = {
  nombreContacto: '', telefono: '', ciudad: '', orgNombre: '', orgCategoria: '', orgDescripcion: '', rfc: '', enlace: '',
}

/** Argumentos de `public.solicitar_alta`, ya normalizados. */
export interface SolicitudAltaArgs {
  p_rol: ProfileRole
  p_nombre_contacto: string
  p_telefono: string
  p_ciudad: string
  p_org_nombre: string | null
  p_org_categoria: string | null
  p_org_descripcion: string | null
  p_rfc: string | null
  p_enlace: string | null
}

export function camposDeRol(rol: ProfileRole): CampoAlta[] {
  if (rol === 'repartidor') return ['nombreContacto', 'telefono', 'ciudad']
  if (rol === 'tienda') return ['orgNombre', 'ciudad', 'rfc', 'nombreContacto', 'telefono', 'enlace']
  return ['orgNombre', 'orgCategoria', 'orgDescripcion', 'enlace', 'ciudad', 'nombreContacto', 'telefono', 'rfc']
}

export function validarSolicitud(rol: ProfileRole, form: FormularioAlta): {
  errores: Partial<Record<CampoAlta, string>>
  args: SolicitudAltaArgs | null
} {
  const errores: Partial<Record<CampoAlta, string>> = {}
  const nombreContacto = limpiar(form.nombreContacto)
  const ciudad = limpiar(form.ciudad)
  const orgNombre = limpiar(form.orgNombre)
  const orgDescripcion = limpiar(form.orgDescripcion)
  const rfc = normalizarRfc(form.rfc)
  const enlace = form.enlace.trim()
  const telefono = normalizarTelefono(form.telefono)
  const esOrg = rol !== 'repartidor'

  const set = (campo: CampoAlta, error: string | null) => { if (error) errores[campo] = error }
  set('nombreContacto', validarTexto(nombreContacto, 2, LIMITES.nombreContacto, rol === 'repartidor' ? 'tu nombre' : 'el nombre de contacto'))
  set('telefono', telefono ? null : 'Escribe un teléfono de 10 dígitos.')
  set('ciudad', validarTexto(ciudad, 2, LIMITES.ciudad, 'la ciudad'))

  if (esOrg) {
    set('orgNombre', validarTexto(orgNombre, 3, LIMITES.orgNombre, rol === 'tienda' ? 'el nombre de la tienda' : 'el nombre de la organización'))
    if (rfc) set('rfc', RFC.test(rfc) ? null : 'Revisa el RFC: 3 o 4 letras, 6 dígitos de fecha y 3 caracteres.')
    else if (rol === 'tienda') set('rfc', 'Escribe el RFC de la tienda.')
    if (enlace) set('enlace', validarEnlace(enlace))
    else if (rol === 'fundacion') set('enlace', 'Agrega un enlace donde podamos verificarlos (sitio o red social).')
  }
  if (rol === 'fundacion') {
    set('orgCategoria', categoriasFundacion.some((c) => c.valor === form.orgCategoria) ? null : 'Elige una categoría.')
    set('orgDescripcion', validarTexto(orgDescripcion, LIMITES.descripcionMin, LIMITES.descripcionMax, 'una descripción', true))
  }

  if (Object.keys(errores).length > 0 || !telefono) return { errores, args: null }
  return {
    errores,
    args: {
      p_rol: rol,
      p_nombre_contacto: nombreContacto,
      p_telefono: telefono,
      p_ciudad: ciudad,
      p_org_nombre: esOrg ? orgNombre : null,
      p_org_categoria: rol === 'fundacion' ? form.orgCategoria : null,
      p_org_descripcion: rol === 'fundacion' ? orgDescripcion : null,
      p_rfc: esOrg && rfc ? rfc : null,
      p_enlace: esOrg && enlace ? enlace : null,
    },
  }
}
