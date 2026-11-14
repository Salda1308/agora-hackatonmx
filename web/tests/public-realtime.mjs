// Opt-in: updates and restores only the T05 example article in its isolated stack.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.T05_WEB_URL || 'http://127.0.0.1:5175'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Local URL required')
const article = 'f5300000-0000-0000-0000-000000000001'
const sql = (query) =>
  execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_hackatonmx-t05',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      query,
    ],
    { encoding: 'utf8' },
  ).trim()
const original = Number(
  sql(
    `select unidades_pagadas from public.solicitud_articulos where id='${article}'`,
  ),
)
assert.equal(
  original,
  0,
  'Expected pristine T05 seed; do not run over other test data',
)
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
})
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  let loads = 0
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) loads++
  })
  await page.goto(`${base}/#/solicitudes/f5200000-0000-0000-0000-000000000001`)
  await page.getByText('Actualizado en vivo', { exact: true }).waitFor()
  assert.equal(
    await page
      .locator('.detail-hero [role=progressbar]')
      .first()
      .getAttribute('aria-valuenow'),
    '0',
  )
  sql(
    `update public.solicitud_articulos set unidades_pagadas=1 where id='${article}'`,
  )
  await page.waitForFunction(
    () =>
      document
        .querySelector('.detail-hero [role=progressbar]')
        ?.getAttribute('aria-valuenow') === '1',
    null,
    { timeout: 5000 },
  )
  assert.equal(loads, 1, 'Progress must change without reloading')
  assert.equal(
    await page
      .getByRole('heading', { name: 'Pago confirmado', exact: true })
      .count(),
    0,
    'Aggregate progress never confirms an individual payment',
  )
  console.log(
    'PASS actual anonymous Realtime -> React progress, no reload, no false individual confirmation',
  )
} finally {
  sql(
    `update public.solicitud_articulos set unidades_pagadas=${original} where id='${article}'`,
  )
  await browser.close()
}
