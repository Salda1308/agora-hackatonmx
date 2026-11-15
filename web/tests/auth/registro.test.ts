import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import {
  formularioVacio, fuerzaContrasena, normalizarTelefono, validarContrasena, validarCorreo, validarEnlace, validarSolicitud,
} from '../../src/auth/alta-validacion.ts'
import { createAltaApi, mensajeServidor, parseMiSolicitud } from '../../src/auth/alta-api.ts'
import { createCuentaApi, mensajeEntrada, urlDeRegreso } from '../../src/auth/cuenta.ts'
import { errorDeRetorno, esConfirmacionDeAlta } from '../../src/auth/registro-routes.ts'
import { createSessionStore } from '../../src/auth/session-store.ts'
import { parseHash } from '../../src/lib/router.ts'

const fundacion = {
  ...formularioVacio,
  orgNombre: '  Albergue   Esperanza ',
  orgCategoria: 'albergue',
  orgDescripcion: 'Damos techo y comida a 40 personas migrantes cada noche en Tijuana.',
  enlace: 'https://www.facebook.com/albergue.esperanza',
  ciudad: 'Tijuana',
  nombreContacto: 'Ana López',
  telefono: '+52 664 123 4567',
}

test('correo: formato y dominios desechables', () => {
  assert.equal(validarCorreo('ana@ejemplo.mx'), null)
  assert.match(validarCorreo('') ?? '', /Escribe/)
  assert.match(validarCorreo('ana@') ?? '', /formato/)
  assert.match(validarCorreo('ana@mailinator.com') ?? '', /permanente/)
  assert.match(validarCorreo('ana@sub.yopmail.com') ?? '', /permanente/)
})

test('contraseña: mínimo 10 e indicador simple', () => {
  assert.match(validarContrasena('corta123') ?? '', /10/)
  assert.equal(validarContrasena('diezcaract'), null)
  assert.equal(fuerzaContrasena('abc'), 'corta')
  assert.equal(fuerzaContrasena('abcdefghij'), 'debil')
  assert.equal(fuerzaContrasena('abcdefghi1'), 'debil')
  assert.equal(fuerzaContrasena('Abcdefghi1'), 'buena')
  assert.equal(fuerzaContrasena('Abcdefghi1!'), 'fuerte')
})

test('teléfono mexicano de 10 dígitos normalizado', () => {
  assert.equal(normalizarTelefono('664 123 4567'), '6641234567')
  assert.equal(normalizarTelefono('+52 (664) 123-4567'), '6641234567')
  assert.equal(normalizarTelefono('+521 664 123 4567'), '6641234567')
  assert.equal(normalizarTelefono('123'), null)
  assert.equal(normalizarTelefono('66412345678'), null)
})

test('enlace: solo https y sin acortadores', () => {
  assert.equal(validarEnlace('https://instagram.com/tienda'), null)
  assert.match(validarEnlace('http://instagram.com/tienda') ?? '', /https/)
  assert.match(validarEnlace('instagram.com/tienda') ?? '', /https/)
  assert.match(validarEnlace('https://bit.ly/abc') ?? '', /acortadores/)
  assert.match(validarEnlace('https://www.tinyurl.com/abc') ?? '', /acortadores/)
  assert.match(validarEnlace('https://user:pw@ejemplo.mx') ?? '', /Revisa/)
  assert.match(validarEnlace('https://lnkd.in/abc') ?? '', /acortadores/)
  assert.match(validarEnlace('https://ejemplo.mx/mi pagina') ?? '', /espacios/)
  assert.match(validarEnlace('https://localhost/x') ?? '', /dominio/)
})

test('fundación: datos completos generan los argumentos del contrato', () => {
  const { errores, args } = validarSolicitud('fundacion', fundacion)
  assert.deepEqual(errores, {})
  assert.deepEqual(args, {
    p_rol: 'fundacion',
    p_nombre_contacto: 'Ana López',
    p_telefono: '6641234567',
    p_ciudad: 'Tijuana',
    p_org_nombre: 'Albergue Esperanza',
    p_org_categoria: 'albergue',
    p_org_descripcion: fundacion.orgDescripcion,
    p_rfc: null,
    p_enlace: 'https://www.facebook.com/albergue.esperanza',
  })
})

test('fundación: descripción mínima, categoría, enlace obligatorio y RFC opcional válido', () => {
  const { errores, args } = validarSolicitud('fundacion', {
    ...fundacion, orgDescripcion: 'Muy corta', orgCategoria: 'otra', enlace: '', rfc: 'XYZ',
  })
  assert.equal(args, null)
  assert.match(errores.orgDescripcion ?? '', /40/)
  assert.match(errores.orgCategoria ?? '', /categoría/)
  assert.match(errores.enlace ?? '', /enlace/)
  assert.match(errores.rfc ?? '', /RFC/)
  assert.equal(validarSolicitud('fundacion', { ...fundacion, rfc: 'aes-180101-ab1' }).args?.p_rfc, 'AES180101AB1')
})

test('tienda: RFC obligatorio con patrón, enlace opcional', () => {
  const tienda = { ...formularioVacio, orgNombre: 'Abarrotes Lupita', ciudad: 'Puebla', nombreContacto: 'Lupe', telefono: '2221234567' }
  assert.match(validarSolicitud('tienda', tienda).errores.rfc ?? '', /RFC/)
  const { args } = validarSolicitud('tienda', { ...tienda, rfc: 'LUPA800101XY9' })
  assert.equal(args?.p_rfc, 'LUPA800101XY9')
  assert.equal(args?.p_enlace, null)
  assert.equal(args?.p_org_categoria, null)
  assert.equal(args?.p_org_descripcion, null)
})

test('repartidor: sin datos de organización aunque el formulario los traiga', () => {
  const { args } = validarSolicitud('repartidor', {
    ...fundacion, rfc: 'AES180101AB1',
  })
  assert.deepEqual(args, {
    p_rol: 'repartidor', p_nombre_contacto: 'Ana López', p_telefono: '6641234567', p_ciudad: 'Tijuana',
    p_org_nombre: null, p_org_categoria: null, p_org_descripcion: null, p_rfc: null, p_enlace: null,
  })
  assert.match(validarSolicitud('repartidor', { ...formularioVacio }).errores.nombreContacto ?? '', /nombre/)
})

test('nombres sin URLs ni caracteres de control', () => {
  assert.match(validarSolicitud('fundacion', { ...fundacion, orgNombre: 'Visita www.fraude.com' }).errores.orgNombre ?? '', /enlaces/)
  assert.match(validarSolicitud('repartidor', { ...fundacion, nombreContacto: 'Ana https://x' }).errores.nombreContacto ?? '', /enlaces/)
  assert.match(validarSolicitud('repartidor', { ...fundacion, nombreContacto: 'Ana\u0007' }).errores.nombreContacto ?? '', /especiales/)
})

test('rutas hash nuevas sin afectar las existentes', () => {
  assert.deepEqual(parseHash('#/entrar'), { name: 'entrar' })
  assert.deepEqual(parseHash('#/crear-cuenta'), { name: 'crear-cuenta' })
  assert.deepEqual(parseHash('#/registro'), { name: 'registro' })
  assert.deepEqual(parseHash('#/registro/tienda'), { name: 'registro-rol', rol: 'tienda' })
  assert.deepEqual(parseHash('#/registro/comprador'), { name: 'not-found' })
  assert.deepEqual(parseHash('#access_token=x&type=signup'), { name: 'auth-callback' })
  assert.deepEqual(parseHash('#error=access_denied&error_code=otp_expired'), { name: 'auth-callback' })
  assert.deepEqual(parseHash('#/repartidor'), { name: 'role', role: 'repartidor', page: 'tareas' })
  assert.deepEqual(parseHash('#/fundacion'), { name: 'fundacion' })
})

test('retorno del enlace de confirmación', () => {
  assert.equal(esConfirmacionDeAlta('#access_token=a&refresh_token=b&type=signup'), true)
  assert.equal(esConfirmacionDeAlta('#access_token=a&type=recovery'), false)
  assert.equal(esConfirmacionDeAlta('#/registro'), false)
  assert.match(errorDeRetorno('#error=access_denied&error_code=otp_expired') ?? '', /venció/)
  assert.equal(errorDeRetorno('#/entrar'), null)
  assert.equal(urlDeRegreso({ origin: 'https://agora.mx', pathname: '/app/' }), 'https://agora.mx/app/')
})

test('alta-api: llama al contrato y muestra solo errores legibles', async () => {
  const llamadas: Array<[string, unknown]> = []
  let respuesta: { data: unknown; error: { message: string; code: string } | null } = { data: 'uuid-1', error: null }
  const api = createAltaApi({ rpc: async (fn: string, args?: unknown) => { llamadas.push([fn, args]); return respuesta } } as never)
  const { args } = validarSolicitud('fundacion', fundacion)
  assert.equal(await api.solicitarAlta(args!), 'uuid-1')
  assert.deepEqual(llamadas[0], ['solicitar_alta', args])

  respuesta = { data: null, error: { code: 'P0001', message: 'Ya tienes una solicitud pendiente.' } }
  await assert.rejects(api.solicitarAlta(args!), /Ya tienes una solicitud pendiente\./)
  respuesta = { data: null, error: { code: '42501', message: 'Llegaste al máximo de solicitudes rechazadas.' } }
  await assert.rejects(api.solicitarAlta(args!), /máximo de solicitudes/)
  respuesta = { data: null, error: { code: '42501', message: 'permission denied for function solicitar_alta' } }
  await assert.rejects(api.solicitarAlta(args!), /Confirma tu correo/)
  respuesta = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "x"' } }
  await assert.rejects(api.solicitarAlta(args!), /ya están registrados/)
  respuesta = { data: null, error: { code: '23505', message: 'Ese teléfono ya está registrado' } }
  await assert.rejects(api.solicitarAlta(args!), /^Error: Ese teléfono ya está registrado$/)
  respuesta = { data: null, error: { code: '42501', message: 'Confirma tu correo primero' } }
  await assert.rejects(api.solicitarAlta(args!), /^Error: Confirma tu correo primero$/)
  respuesta = { data: null, error: { code: 'XX000', message: 'internal' } }
  await assert.rejects(api.solicitarAlta(args!), /No se pudo enviar/)
  assert.equal(mensajeServidor({ code: 'P0001', message: 'column "x" does not exist' }), 'No se pudo enviar la solicitud. Vuelve a intentar.')

  respuesta = { data: [], error: null }
  assert.equal(await api.miSolicitudAlta(), null)
  respuesta = { data: [{ id: 's1', rol: 'tienda', estado: 'rechazada', motivo: 'RFC no coincide', org_nombre: 'Lupita', creada_en: '2026-11-15T10:00:00Z', resuelta_en: null }], error: null }
  assert.deepEqual(await api.miSolicitudAlta(), {
    id: 's1', rol: 'tienda', estado: 'rechazada', motivo: 'RFC no coincide', org_nombre: 'Lupita',
    creada_en: '2026-11-15T10:00:00Z', resuelta_en: null,
  })
  assert.throws(() => parseMiSolicitud([{ id: 's1', rol: 'admin', estado: 'aprobada' }]), /inválida/)
  await assert.rejects(createAltaApi(null).miSolicitudAlta(), /no está disponible/)
})

test('crear cuenta: sin metadata de rol y sin revelar si el correo existe', async () => {
  const llamadas: unknown[] = []
  let respuesta: { data: { session: unknown }; error: { code?: string; status?: number; message?: string } | null } = { data: { session: null }, error: null }
  const api = createCuentaApi({ auth: {
    signUp: async (args: unknown) => { llamadas.push(args); return respuesta },
    resend: async (args: unknown) => { llamadas.push(args); return { error: null } },
  } } as never)

  assert.deepEqual(await api.crearCuenta(' Ana@Ejemplo.MX ', 'contrasena-larga', 'https://agora.mx/'), { confirmar: true })
  assert.deepEqual(llamadas[0], { email: 'ana@ejemplo.mx', password: 'contrasena-larga', options: { emailRedirectTo: 'https://agora.mx/' } })

  respuesta = { data: { session: null }, error: { code: 'user_already_exists', status: 422 } }
  assert.deepEqual(await api.crearCuenta('ana@ejemplo.mx', 'contrasena-larga'), { confirmar: true })
  respuesta = { data: { session: null }, error: { code: 'weak_password', status: 422 } }
  await assert.rejects(api.crearCuenta('ana@ejemplo.mx', 'contrasena-larga'), /fácil de adivinar/)
  respuesta = { data: { session: null }, error: { code: 'over_email_send_rate_limit', status: 429 } }
  await assert.rejects(api.crearCuenta('ana@ejemplo.mx', 'contrasena-larga'), /Demasiados intentos/)
  respuesta = { data: { session: {} }, error: null }
  assert.deepEqual(await api.crearCuenta('ana@ejemplo.mx', 'contrasena-larga'), { confirmar: false })

  await api.reenviarConfirmacion('ana@ejemplo.mx', 'https://agora.mx/')
  assert.deepEqual(llamadas.at(-1), { type: 'signup', email: 'ana@ejemplo.mx', options: { emailRedirectTo: 'https://agora.mx/' } })

  // El mismo mensaje para correo inexistente, contraseña errónea o correo sin confirmar.
  const a = mensajeEntrada({ code: 'invalid_credentials', status: 400 })
  assert.equal(mensajeEntrada({ code: 'email_not_confirmed', status: 400 }), a)
  assert.doesNotMatch(a, /no existe|no registrado/i)
})

// Cliente Auth mínimo para el store: una cuenta con contraseña conocida.
function authFake(perfiles: Record<string, unknown>) {
  let listener: (event: string, session: Session | null) => void = () => {}
  let session: Session | null = null
  const client = {
    auth: {
      onAuthStateChange(fn: typeof listener) { listener = fn; return { data: { subscription: { unsubscribe() {} } } } },
      getSession: async () => ({ data: { session }, error: null }),
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        if (password !== 'contrasena-correcta') return { data: { session: null }, error: { code: 'invalid_credentials', status: 400 } }
        session = { user: { id: email.split('@')[0], email } } as Session
        listener('SIGNED_IN', session)
        return { data: { session }, error: null }
      },
      async signOut() { session = null; listener('SIGNED_OUT', null); return { error: null } },
    },
    from() {
      return { select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: perfiles[id] ?? null, error: null }) }) }) }
    },
  }
  return client as unknown as Parameters<typeof createSessionStore>[0]
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

test('signIn real: con perfil entra a su rol; sin perfil queda como cuenta sin rol', async () => {
  const store = createSessionStore(authFake({
    tienda1: { id: 'tienda1', rol: 'tienda', organizacion_id: 'org-1', nombre_visible: 'Lupita' },
  }), false)
  const stop = store.start()
  await tick()

  const perfil = await store.signIn(' Tienda1@ejemplo.mx ', 'contrasena-correcta')
  assert.equal(perfil?.rol, 'tienda')
  await tick()
  assert.equal(store.getSnapshot().role, 'tienda')

  await store.signOut()
  assert.equal(await store.signIn('nueva@ejemplo.mx', 'contrasena-correcta'), null)
  await tick()
  const estado = store.getSnapshot()
  assert.equal(estado.status, 'ready')
  assert.equal(estado.role, 'comprador')
  assert.equal(estado.profile, null)
  assert.equal(estado.session?.user.id, 'nueva')
  stop()
})

test('signIn real: credenciales erróneas no rompen la sesión ni el estado', async () => {
  const store = createSessionStore(authFake({}), false)
  const stop = store.start()
  await tick()
  await assert.rejects(store.signIn('ana@ejemplo.mx', 'mala'), /Revisa tu correo y contraseña/)
  const estado = store.getSnapshot()
  assert.equal(estado.status, 'ready')
  assert.equal(estado.session, null)
  assert.equal(estado.error, null)
  await assert.rejects(createSessionStore(null).signIn('a@b.mx', 'x'), /no está disponible/)
  // La demo sigue igual: requiere activación explícita.
  await assert.rejects(store.signInDemo('tienda'), /desactivado/)
  stop()
})
