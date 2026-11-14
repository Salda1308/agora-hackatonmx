// Run against an isolated local Vite instance. Payment endpoints are ALWAYS mocked.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation; no project dependency required.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.T05_WEB_URL || 'http://127.0.0.1:5175'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Local test URL required')
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})
const requestId = 'f5200000-0000-0000-0000-000000000001'
const articleId = 'f5300000-0000-0000-0000-000000000001'
const paymentId = 'f5400000-0000-0000-0000-000000000001'
const errors = []
try {
  for (const method of ['qr', 'push', 'link']) {
    const context = await browser.newContext({
      viewport: { width: method === 'link' ? 1280 : 390, height: 844 },
      colorScheme: method === 'push' ? 'dark' : 'light',
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    let calls = 0,
      confirmed = false
    await page.route('**/functions/v1/crear-cobro', async (route) => {
      calls++
      const input = route.request().postDataJSON()
      assert.equal(input.metodo, method)
      assert.deepEqual(input.articulos, [
        { solicitudArticuloId: articleId, unidades: 1 },
      ])
      assert.equal('amount' in input, false)
      if (method === 'push') assert.equal(input.phoneNumber, '5512345678')
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          pagoId: paymentId,
          numRef: '51',
          montoCentavos: 1,
          seguimientoToken: 'mock-token',
          ...(method === 'qr'
            ? { qrString: 'mock-codi-payload', qrImage: null }
            : method === 'link'
              ? { url: 'https://app.mipey.mx/checkout/payment-link/mock' }
              : {}),
        }),
      })
    })
    await page.route('**/functions/v1/estado-pago', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          estado: confirmed ? 'pagado' : 'creado',
          comprobante: confirmed
            ? {
                folio: 'AGORA-0000051',
                montoCentavos: 1,
                pagadoEn: '2026-11-14T18:00:00Z',
                peyTransactionId: 'MOCK-TRACKING',
                articulos: [
                  {
                    solicitudArticuloId: articleId,
                    nombre: 'Garrafón de agua — prueba',
                    unidades: 1,
                  },
                ],
              }
            : null,
        }),
      }),
    )
    await page.goto(`${base}/#/solicitudes`)
    await page
      .getByRole('heading', { name: 'Agua para el albergue — ejemplo' })
      .waitFor()
    assert.equal(await page.locator('.request-card').count(), 2)
    await page
      .getByRole('heading', { name: 'Agua para el albergue — ejemplo' })
      .click()
    await page.getByRole('spinbutton').fill('1')
    await page
      .getByRole('radio', {
        name:
          method === 'qr'
            ? /QR ·/
            : method === 'push'
              ? /Aviso CoDi/
              : /Link ·/,
      })
      .check()
    if (method === 'push')
      await page.getByRole('textbox', { name: /Celular/ }).fill('5512345678')
    await page
      .getByRole('button', { name: 'Pagar $0.01', exact: true })
      .dblclick()
    await page.getByRole('heading', { name: 'Tu intento de pago' }).waitFor()
    assert.equal(calls, 1)
    if (method === 'qr') {
      const qr = page.getByRole('img', { name: 'QR de CoDi para pagar' })
      await qr.waitFor()
      assert.match(await qr.getAttribute('src'), /^data:image\/png;base64,/)
    }
    if (method === 'link')
      assert.equal(
        await page
          .getByRole('link', { name: 'Ir a pagar con CoDi' })
          .getAttribute('href'),
        'https://app.mipey.mx/checkout/payment-link/mock',
      )
    const stored = await page.evaluate(() => JSON.stringify(sessionStorage))
    assert.equal(stored.includes('5512345678'), false)
    assert.equal(stored.includes('phoneNumber'), false)
    confirmed = true
    await page.getByText('¡Tu ayuda ya sumó!').waitFor()
    await page.getByText('AGORA-0000051', { exact: true }).waitFor()
    assert.equal(
      await page.getByRole('img', { name: 'QR de CoDi para pagar' }).count(),
      0,
    )
    await page.reload()
    await page.getByText('AGORA-0000051', { exact: true }).waitFor()
    assert.equal(calls, 1)
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    )
    await page.getByRole('link', { name: 'Siguiendo', exact: true }).click()
    await page
      .getByRole('link', { name: 'Consultar pago · referencia 51' })
      .waitFor()
    console.log(
      `PASS ${method}: selection, single POST, pending, receipt, restoration, no phone persistence, responsive`,
    )
    await context.close()
  }
  // An uncertain charge must survive reload and must never submit a second POST.
  const context = await browser.newContext({
    viewport: { width: 320, height: 740 },
  })
  const page = await context.newPage()
  let calls = 0
  await page.route('**/functions/v1/crear-cobro', (route) => {
    calls++
    return route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        pagoId: paymentId,
        montoCentavos: 1,
        numRef: '52',
        error: { mensaje: 'Cobro incierto' },
      }),
    })
  })
  await page.goto(`${base}/#/solicitudes/${requestId}`)
  await page.getByRole('spinbutton').fill('1')
  await page.getByRole('button', { name: 'Pagar $0.01', exact: true }).click()
  await page.getByText('Cobro incierto', { exact: true }).waitFor()
  await page.reload()
  await page.getByText(`ID de pago: ${paymentId}`).waitFor()
  assert.equal(calls, 1)
  assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0)
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  )
  console.log(
    'PASS 202: no automatic retries, pagoId survives reload, 320px without overflow',
  )
  await context.close()
  for (const failure of ['503', 'malformed', 'offline']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    let attempts = 0
    await page.route('**/functions/v1/crear-cobro', (route) => {
      attempts++
      if (failure === 'offline') return route.abort('failed')
      return route.fulfill({
        status: failure === '503' ? 503 : 201,
        contentType: 'application/json',
        body:
          failure === '503'
            ? JSON.stringify({ error: { mensaje: 'No disponible' } })
            : '{invalid',
      })
    })
    await page.goto(`${base}/#/solicitudes/${requestId}`)
    await page.getByRole('spinbutton').fill('1')
    await page.getByRole('button', { name: 'Pagar $0.01', exact: true }).click()
    await page.getByRole('heading', { name: 'Tu intento de pago' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Tu intento de pago' }).waitFor()
    assert.equal(attempts, 1)
    assert.equal(await page.getByRole('button', { name: /Pagar/ }).count(), 0)
    console.log(
      `PASS ${failure}: uncertain attempt survives reload, no duplicate charge`,
    )
    await context.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
