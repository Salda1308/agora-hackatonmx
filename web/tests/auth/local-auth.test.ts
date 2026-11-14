// Opt-in: solo contra un stack local con seed.sql, nunca contra un proyecto remoto.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { demoAccounts, isDemoEnabled } from '../../src/auth/demo.ts'
import { createSessionStore } from '../../src/auth/session-store.ts'

const url = process.env.R1_SUPABASE_URL ?? 'http://127.0.0.1:55321'
const key = process.env.R1_SUPABASE_PUBLISHABLE_KEY

async function ready(store: ReturnType<typeof createSessionStore>) {
  if (store.getSnapshot().status !== 'loading') return
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Sesión no resuelta')) }, 5000)
    const unsubscribe = store.subscribe(() => {
      if (store.getSnapshot().status !== 'loading') {
        clearTimeout(timeout)
        unsubscribe()
        resolve()
      }
    })
  })
}

test('Auth local: cuatro roles, persistencia, refresh, cambio de cuenta y salida', { skip: !key }, async () => {
  assert.ok(isDemoEnabled('true', url), 'solo se permiten endpoints loopback')
  const saved = new Map<string, string>()
  const options = {
    auth: {
      autoRefreshToken: false, detectSessionInUrl: false,
      storage: {
        getItem: (name: string) => saved.get(name) ?? null,
        setItem: (name: string, value: string) => { saved.set(name, value) },
        removeItem: (name: string) => { saved.delete(name) },
      },
    },
  }
  const client = createClient(url, key!, options)
  const store = createSessionStore(client, true)
  const stop = store.start()
  try {
    await ready(store)
    assert.equal(store.getSnapshot().role, 'comprador')
    for (const account of demoAccounts) {
      await store.signInDemo(account.role)
      const state = store.getSnapshot()
      assert.equal(state.status, 'ready')
      assert.equal(state.role, account.role)
      assert.equal(state.session?.user.email, account.email)
      assert.equal(state.organizationId, ['comprador', 'repartidor'].includes(account.role)
        ? null : `f2000000-0000-0000-0000-00000000000${account.role === 'fundacion' ? '1' : '2'}`)
      const refreshed = await client.auth.refreshSession()
      assert.equal(refreshed.error, null)
      await ready(store)
      assert.equal(store.getSnapshot().role, account.role)
    }
    const restoredClient = createClient(url, key!, options)
    const restored = createSessionStore(restoredClient, true)
    const stopRestored = restored.start()
    try {
      await ready(restored)
      assert.equal(restored.getSnapshot().role, 'repartidor')
      assert.equal(restored.getSnapshot().session?.user.id, store.getSnapshot().session?.user.id)
    } finally { stopRestored() }
    await store.signOut()
    assert.equal(store.getSnapshot().role, 'comprador')
    assert.equal(store.getSnapshot().session, null)
    assert.equal((await client.auth.getSession()).data.session, null)
  } finally {
    stop()
    await client.auth.signOut({ scope: 'local' })
  }
})
