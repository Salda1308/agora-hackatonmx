import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import { createSessionStore } from '../../src/auth/session-store.ts'
import { demoCredentials, isDemoEnabled } from '../../src/auth/demo.ts'
import { hasRole, parseProfile, roleNavigation } from '../../src/auth/roles.ts'
import { parseHash } from '../../src/lib/router.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))
const sessionFor = (id: string) => ({ user: { id, user_metadata: { rol: 'fundacion' } } }) as Session
const profileFor = (id: string, rol = 'fundacion') => ({
  id, rol, organizacion_id: rol === 'repartidor' ? null : `org-${id}`, nombre_visible: 'Demo',
})

function fixture() {
  let authListener: (event: string, session: Session | null) => void = () => {}
  let session: Session | null = null
  let loginCalls = 0
  let signOutError: Error | null = null
  let loginError: Error | null = null
  let unsubscribed = 0
  let loginGate: Promise<void> | null = null
  let signOutGate: Promise<void> | null = null
  let readSession = async () => ({ data: { session }, error: null as Error | null })
  let readProfile = async (id: string) => ({ data: profileFor(id) as unknown, error: null as Error | null })
  const client = {
    auth: {
      onAuthStateChange(listener: typeof authListener) {
        authListener = listener
        return { data: { subscription: { unsubscribe() { ++unsubscribed } } } }
      },
      getSession: () => readSession(),
      async signInWithPassword({ email }: { email: string }) {
        ++loginCalls
        const next = sessionFor(email.split('@')[0])
        if (!loginError) { session = next; authListener('SIGNED_IN', next) }
        if (loginGate) await loginGate
        return { data: { session: next }, error: loginError }
      },
      async signOut() {
        if (!signOutError) { session = null; authListener('SIGNED_OUT', null) }
        if (signOutGate) await signOutGate
        return { error: signOutError }
      },
    },
    from(table: string) {
      assert.equal(table, 'perfiles')
      return { select: () => ({ eq(column: string, id: string) {
        assert.equal(column, 'id')
        return { maybeSingle: () => readProfile(id) }
      } }) }
    },
  } as unknown as Parameters<typeof createSessionStore>[0]
  return {
    client,
    emit(next: Session | null) { session = next; authListener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next) },
    profile(reader: typeof readProfile) { readProfile = reader },
    restore(reader: typeof readSession) { readSession = reader },
    setLoginError() { loginError = new Error('Auth error') },
    setSignOutError() { signOutError = new Error('Auth error') },
    holdLogin(gate: Promise<void>) { loginGate = gate },
    holdSignOut(gate: Promise<void>) { signOutGate = gate },
    get loginCalls() { return loginCalls },
    get unsubscribed() { return unsubscribed },
  }
}

test('demo requiere activación explícita y un endpoint loopback', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(isDemoEnabled('true', `http://${host}:55321`), true)
  }
  for (const flag of [undefined, true, 'false', 'TRUE']) {
    assert.equal(isDemoEnabled(flag, 'http://localhost:55321'), false)
  }
  for (const url of ['invalid', 'https://project.supabase.co', 'https://localhost.evil.test',
    'https://localhost@evil.test', 'file://localhost/path', 'http://user@localhost']) {
    assert.equal(isDemoEnabled('true', url), false)
  }
  assert.throws(() => demoCredentials('tienda', false))
})

test('perfil y guardas fallan cerrado, sin elevar privilegios de comprador', () => {
  assert.equal(parseProfile(null, 'buyer'), null)
  for (const row of [undefined, {}, profileFor('other'), profileFor('buyer', 'admin'),
    { ...profileFor('buyer'), organizacion_id: null }]) {
    assert.throws(() => parseProfile(row, 'buyer'))
  }
  assert.equal(hasRole(null, ['fundacion']), false)
  assert.equal(hasRole('comprador', ['fundacion', 'tienda']), false)
  assert.equal(hasRole('fundacion', ['fundacion']), true)
  assert.deepEqual(roleNavigation.comprador.map((entry) => entry.id), ['home', 'directory', 'following'])
})

test('restaura visitante como comprador y elimina suscripción al desmontar', async () => {
  const f = fixture()
  const store = createSessionStore(f.client)
  const stop = store.start()
  await tick()
  assert.equal(store.getSnapshot().role, 'comprador')
  assert.equal(store.getSnapshot().session, null)
  stop()
  assert.equal(f.unsubscribed, 1)
})

test('roles y organización provienen de perfiles; comprador autenticado no necesita perfil', async () => {
  for (const role of ['fundacion', 'tienda', 'repartidor', 'comprador']) {
    const f = fixture()
    f.profile(async (id) => ({ data: role === 'comprador' ? null : profileFor(id, role), error: null }))
    f.restore(async () => ({ data: { session: sessionFor(role) }, error: null }))
    const store = createSessionStore(f.client)
    const stop = store.start()
    await tick()
    assert.equal(store.getSnapshot().status, 'ready')
    assert.equal(store.getSnapshot().role, role)
    assert.equal(store.getSnapshot().organizationId,
      ['comprador', 'repartidor'].includes(role) ? null : `org-${role}`)
    stop()
  }
})

test('error de perfil conserva permisos cerrados y retry recupera la sesión', async () => {
  const f = fixture()
  f.profile(async () => ({ data: null, error: new Error('network') }))
  f.restore(async () => ({ data: { session: sessionFor('one') }, error: null }))
  const store = createSessionStore(f.client)
  const stop = store.start()
  await tick()
  assert.equal(store.getSnapshot().status, 'error')
  assert.equal(store.getSnapshot().role, null)
  f.profile(async (id) => ({ data: profileFor(id), error: null }))
  await store.retry()
  assert.equal(store.getSnapshot().role, 'fundacion')
  stop()
})

test('una restauración tardía no reemplaza un cierre de sesión más reciente', async () => {
  const f = fixture()
  const restore = deferred<{ data: { session: Session | null }; error: Error | null }>()
  f.restore(() => restore.promise)
  const store = createSessionStore(f.client)
  const stop = store.start()
  f.emit(null)
  await tick()
  restore.resolve({ data: { session: sessionFor('old') }, error: null })
  await tick()
  assert.equal(store.getSnapshot().role, 'comprador')
  assert.equal(store.getSnapshot().session, null)
  stop()
})

test('cambiar de cuenta revoca el rol anterior y descarta consultas fuera de orden', async () => {
  const f = fixture()
  const oldProfile = deferred<{ data: unknown; error: Error | null }>()
  f.profile((id) => id === 'old' ? oldProfile.promise : Promise.resolve({ data: profileFor(id, 'tienda'), error: null }))
  const store = createSessionStore(f.client)
  const stop = store.start()
  f.emit(sessionFor('old'))
  await tick()
  f.emit(sessionFor('new'))
  assert.equal(store.getSnapshot().role, null)
  await tick()
  oldProfile.resolve({ data: profileFor('old'), error: null })
  await tick()
  assert.equal(store.getSnapshot().role, 'tienda')
  assert.equal(store.getSnapshot().organizationId, 'org-new')
  stop()
})

test('un perfil pendiente no reaparece después de cerrar sesión', async () => {
  const f = fixture()
  const pending = deferred<{ data: unknown; error: Error | null }>()
  f.profile(() => pending.promise)
  const store = createSessionStore(f.client)
  const stop = store.start()
  f.emit(sessionFor('old'))
  await tick()
  await store.signOut()
  pending.resolve({ data: profileFor('old'), error: null })
  await tick()
  assert.equal(store.getSnapshot().role, 'comprador')
  stop()
})

test('soporta montaje, limpieza y nuevo montaje de StrictMode', async () => {
  const f = fixture()
  const oldRead = deferred<{ data: { session: Session | null }; error: Error | null }>()
  f.restore(() => oldRead.promise)
  const store = createSessionStore(f.client)
  store.start()()
  f.restore(async () => ({ data: { session: null }, error: null }))
  const stop = store.start()
  await tick()
  oldRead.resolve({ data: { session: sessionFor('old') }, error: null })
  await tick()
  assert.equal(store.getSnapshot().role, 'comprador')
  stop()
  assert.equal(f.unsubscribed, 2)
})

test('demo desactivada no llama Auth; activada usa login y permite salir', async () => {
  const f = fixture()
  const disabled = createSessionStore(f.client)
  await assert.rejects(disabled.signInDemo('tienda'))
  assert.equal(f.loginCalls, 0)
  const store = createSessionStore(f.client, true)
  f.profile(async (id) => ({ data: profileFor(id, 'tienda'), error: null }))
  const stop = store.start()
  await store.signInDemo('tienda')
  assert.equal(store.getSnapshot().role, 'tienda')
  await store.signOut()
  assert.equal(store.getSnapshot().role, 'comprador')
  stop()
})

test('fallas al entrar o salir dejan permisos cerrados y un error visible', async () => {
  const f = fixture()
  const store = createSessionStore(f.client, true)
  const stop = store.start()
  await store.signInDemo('fundacion')
  f.setLoginError()
  await assert.rejects(store.signInDemo('tienda'))
  assert.equal(store.getSnapshot().status, 'error')
  assert.equal(store.getSnapshot().role, null)
  f.setSignOutError()
  await assert.rejects(store.signOut())
  assert.equal(store.getSnapshot().role, null)
  stop()
})

test('una operación de Auth tardía respeta eventos más recientes de otra pestaña', async () => {
  const f = fixture()
  const store = createSessionStore(f.client, true)
  const stop = store.start()
  await tick()
  const loginGate = deferred<void>()
  f.holdLogin(loginGate.promise)
  const login = store.signInDemo('fundacion')
  f.emit(null)
  loginGate.resolve()
  await login
  assert.equal(store.getSnapshot().role, 'comprador')
  assert.equal(store.getSnapshot().session, null)
  const signOutGate = deferred<void>()
  f.holdSignOut(signOutGate.promise)
  const logout = store.signOut()
  f.emit(sessionFor('new'))
  signOutGate.resolve()
  await logout
  assert.equal(store.getSnapshot().session?.user.id, 'new')
  stop()
})

test('sin backend mantiene la web pública y no permite entrar con privilegios', async () => {
  const store = createSessionStore(null)
  const stop = store.start()
  assert.equal(store.getSnapshot().role, 'comprador')
  assert.equal(store.getSnapshot().session, null)
  await assert.rejects(store.signInDemo('fundacion'))
  await store.retry()
  await store.signOut()
  assert.equal(store.getSnapshot().role, 'comprador')
  stop()
})

test('todos los destinos del dock resuelven a su ruta pública o protegida', () => {
  for (const role of ['fundacion', 'tienda', 'repartidor'] as const) {
    for (const entry of roleNavigation[role]) {
      assert.deepEqual(parseHash(`#${entry.path}`), { name: 'role', role, page: entry.id })
    }
  }
  for (const entry of roleNavigation.comprador) {
    assert.deepEqual(parseHash(`#${entry.path}`), { name: entry.id })
  }
  assert.deepEqual(parseHash('#/fundacion/no-existe'), { name: 'not-found' })
})
