// T18: recorrido de jornadas contra un Vite local y un stack Supabase local con seed.sql.
// Una persona se inscribe, la fundación acepta y confirma asistencia, y la constancia
// aparece solo después. Además, dos empresas al último cupo: solo una lo obtiene.
// PLAYWRIGHT_MODULE puede apuntar a una instalación existente de Playwright.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.T18_WEB_URL || 'http://127.0.0.1:5188'
const api = process.env.T18_SUPABASE_URL || 'http://127.0.0.1:56721'
const key = process.env.T18_SUPABASE_PUBLISHABLE_KEY
for (const u of [base, api])
  if (!['127.0.0.1', 'localhost'].includes(new URL(u).hostname)) throw new Error('Se requiere URL local')
if (!key) throw new Error('Falta T18_SUPABASE_PUBLISHABLE_KEY')

const rpc = (name, body) =>
  fetch(`${api}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
const errors = []
const nombre = `Empresa Prueba ${Date.now()}`
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))

  // Visitante: lista, detalle e inscripción.
  await page.goto(`${base}/#/jornadas`)
  await page.getByRole('link', { name: /Tarde de lectura con abuelos/ }).click()
  await page.getByLabel('Nombre (persona o empresa)').fill(nombre)
  await page.getByLabel('Correo o teléfono').fill('prueba@ejemplo.test')
  await page.getByLabel('Asistentes').fill('3')
  await page.getByRole('button', { name: 'Inscribirme' }).click()
  await page.getByRole('link', { name: 'Ver mi inscripción' }).click()
  await page.getByText('En revisión').waitFor()
  const folioUrl = page.url()
  assert.equal(await page.getByLabel('Constancia de voluntariado').count(), 0, 'sin confirmación no hay constancia')

  // La lista pública no expone nombres.
  const lista = await fetch(`${api}/rest/v1/inscripciones_jornada?select=nombre_contacto`, { headers: { apikey: key } })
  assert.ok(lista.status === 401 || lista.status === 403 || (await lista.json()).length === 0, 'la lista no es pública')

  // Fundación demo: acepta y confirma asistencia.
  await page.goto(`${base}/#/fundacion/jornadas`)
  await page.locator('.session-controls__summary').click()
  await page.getByRole('group', { name: 'Entrar con un rol demo' }).getByRole('button', { name: 'Fundación' }).click()
  await page.getByRole('heading', { name: 'Mis solicitudes' }).waitFor()
  await page.getByRole('link', { name: 'Jornadas' }).click()
  const fila = page.locator('.jor-row', { hasText: nombre })
  await fila.getByRole('button', { name: 'Aceptar' }).click()
  await fila.getByText('Aceptada').waitFor()
  await fila.getByRole('button', { name: 'Asistió', exact: true }).click()
  await fila.getByRole('link', { name: 'Ver constancia para compartir' }).waitFor()

  // De vuelta al folio: ahora sí hay constancia.
  await page.goto(folioUrl)
  await page.getByLabel('Constancia de voluntariado').getByText(nombre).waitFor()
  await page.getByText('Sin valor de canje', { exact: false }).waitFor()
  await context.close()

  // Dos empresas al mismo tiempo por el último cupo de "Limpieza del albergue" (3 cupos, 2 ocupados).
  const jornada = 'f1800000-0000-0000-0000-000000000002'
  const [a, b] = await Promise.all(
    ['Empresa A', 'Empresa B'].map((n) =>
      rpc('inscribirse_jornada', { p_jornada: jornada, p_nombre_contacto: n, p_contacto: 'x@ejemplo.test', p_asistentes: 1 }),
    ),
  )
  const ok = [a, b].filter((r) => r.ok).length
  assert.equal(ok, 1, `solo una empresa obtiene el último cupo (${a.status}, ${b.status})`)
  assert.deepEqual(errors, [])
  console.log('T18 jornadas: recorrido OK')
} finally {
  await browser.close()
}
