import type { ProfileRole } from './roles.ts'

/* Rutas hash de inicio de sesión y registro por rol (T23). */

export type RegistroRoute =
  | { name: 'entrar' }
  | { name: 'crear-cuenta' }
  | { name: 'registro' }
  | { name: 'registro-rol'; rol: ProfileRole }
  | { name: 'auth-callback' }

export const registroPaths = {
  entrar: '#/entrar',
  crearCuenta: '#/crear-cuenta',
  registro: '#/registro',
  registroRol: (rol: ProfileRole) => `#/registro/${rol}`,
}

export function parseRegistroPath(path: string): RegistroRoute | null {
  if (path === '/entrar') return { name: 'entrar' }
  if (path === '/crear-cuenta') return { name: 'crear-cuenta' }
  if (path === '/registro') return { name: 'registro' }
  const rol = /^\/registro\/(fundacion|tienda|repartidor)$/.exec(path)
  if (rol) return { name: 'registro-rol', rol: rol[1] as ProfileRole }
  // Regreso del enlace de confirmación: supabase-js lee y limpia el hash.
  if (/^(access_token|error|error_code)=/.test(path)) return { name: 'auth-callback' }
  return null
}

/** El hash de llegada trae una confirmación de alta de cuenta. */
export function esConfirmacionDeAlta(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.has('access_token') && ['signup', 'email'].includes(params.get('type') ?? '')
}

/** Mensaje legible si el enlace de confirmación falló (vencido o ya usado). */
export function errorDeRetorno(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('error') && !params.has('error_code')) return null
  if (params.get('error_code') === 'otp_expired') {
    return 'El enlace venció o ya se usó. Si ya confirmaste tu correo, entra; si no, pide otro correo de confirmación.'
  }
  return 'No pudimos confirmar tu correo con ese enlace. Intenta entrar o pide otro correo de confirmación.'
}
