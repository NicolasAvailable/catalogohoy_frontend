// Checkout → upgrade con prorrateo y cambio de período (change-plan preview).
// Backend falso; los montos del preview son los que devolvió Stripe real
// (invoices.createPreview, sin cobro) el 2026-11-09 para subs reales.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4200';
const results = [];

const PLANS = [
  { id: 'gratis', name: 'Gratis', description: '', price: 0, max_products: 15, max_catalogs: 1, is_free: true, position: 0 },
  { id: 'basico', name: 'Básico', description: '', price: 11.99, max_products: 100, max_catalogs: 1, is_free: false, position: 1 },
  { id: 'pro', name: 'Pro', description: '', price: 19.99, max_products: 500, max_catalogs: 1, is_free: false, position: 2 },
  { id: 'avanzado', name: 'Avanzado', description: '', price: 34.99, max_products: 0, max_catalogs: 2, is_free: false, position: 3 },
];

// Previews reales de Stripe (montos en centavos de la moneda de la sub).
const PREVIEWS = {
  'basico:avanzado:annual':  { currency: 'mxn', amountDue: 410550, credit: 19827, charges: 430377, currentPeriod: 'monthly', newPeriod: 'annual', periodChanged: true },
  'basico:avanzado:monthly': { currency: 'mxn', amountDue: 38033, credit: 19827, charges: 57860, currentPeriod: 'monthly', newPeriod: 'monthly', periodChanged: false },
  'basico:basico:annual':    { currency: 'mxn', amountDue: 127656, credit: 19824, charges: 147480, currentPeriod: 'monthly', newPeriod: 'annual', periodChanged: true },
  'pro:avanzado:annual':     { currency: 'ars', amountDue: 30560446, credit: 1980254, charges: 32540700, currentPeriod: 'monthly', newPeriod: 'annual', periodChanged: true },
};

async function run(browser, { name, current, country, target, period, pay = false, expect, credits = 0 }) {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 }, locale: 'es-ES' })).newPage();
  const calls = [];
  const plan = PLANS.find((p) => p.id === current);
  const expires = new Date(Date.now() + 25 * 86400000).toISOString();
  const tenantRow = {
    id: 1, name: 'Tienda Demo', slug: 'catalogohoy', country_code: country, plan_id: current,
    plans: plan, plan_started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    plan_expires_at: current === 'gratis' ? null : expires, plan_expired: false,
    stripe_subscription_id: current === 'gratis' ? null : 'sub_demo', stripe_subscription_status: current === 'gratis' ? null : 'active',
    locked_plan_price: null, trial_used_at: '2026-01-01T00:00:00Z', extra_catalogs: 0, referral_credit_usd: 0,
  };
  await setupMock(page, {
    routes: {
      '/rest/v1/plans': (route) => route.fulfill({ json: PLANS }),
      '/rest/v1/tenants': (route, req, url, db, single) => route.fulfill({ json: single ? tenantRow : [tenantRow] }),
      '/rest/v1/tenant_currency_config': (route, req, url, db, single) => route.fulfill({ json: single ? null : [] }),
      '/functions/v1/change-plan': (route, req) => {
        const body = JSON.parse(req.postData() || '{}');
        calls.push({ fn: 'change-plan', body });
        if (body.preview) {
          const p = PREVIEWS[`${current}:${body.planId}:${body.billingPeriod}`];
          if (!p) return route.fulfill({ status: 400, json: { success: false, error: 'not_an_upgrade' } });
          return route.fulfill({ json: { success: true, preview: true, currentPlanId: current, ...p } });
        }
        return route.fulfill({ json: { success: true, subscriptionId: 'sub_demo' } });
      },
      '/functions/v1/create-checkout-session': (route, req) => {
        calls.push({ fn: 'create-checkout-session', body: JSON.parse(req.postData() || '{}') });
        return route.fulfill({ json: { url: `${BASE}/__stripe_checkout_mock`, currency: 'mxn' } });
      },
    },
  });
  await page.route(`${BASE}/__stripe_checkout_mock`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Stripe Checkout (mock)</h1>' }));

  let ok = true; let detail = '';
  try {
    await page.goto(`${BASE}/admin/plans/checkout/${target}?period=${period}&slug=catalogohoy`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.summary-total__amount', { timeout: 20000 });
    // Una carga completa limpia los query params (App los pasa a localStorage),
    // así que el período se elige en la pantalla, como haría el cliente.
    if (period === 'annual') await page.getByRole('button', { name: /Anual/ }).first().click();
    for (let i = 0; i < credits / 100; i++) await page.getByTestId('credits-inc').click();
    await page.waitForTimeout(1500);
    const total = (await page.locator('.summary-total__amount').innerText()).trim();
    detail = `total=${total}`;
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    if (expect && !total.includes(expect)) { ok = false; detail += ` (esperaba ${expect})`; }
    if (pay) {
      await page.locator('.terms-label').click();
      await page.locator('.pay-btn').click();
      await page.waitForTimeout(2500);
      detail += ` → ${new URL(page.url()).pathname}`;
      await page.screenshot({ path: path.join(OUT, `${name}-despues-de-pagar.png`), fullPage: false });
    }
  } catch (e) { ok = false; detail += ` ERROR ${e.message}`; }
  detail += ` | llamadas: ${calls.map((c) => `${c.fn}${c.body.preview ? '(preview)' : ''}[${c.body.planId}/${c.body.billingPeriod}${c.body.credits ? `/créditos=${c.body.credits}` : ''}]`).join(', ')}`;
  results.push(`${ok ? '✅' : '❌'} ${name}: ${detail}`);
  await page.context().close();
}

// Catálogo adicional: sin cupos, la compra falla en Stripe → se ve el motivo
// real (antes: "Edge Function returned a non-2xx status code").
async function catalogSlots(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 }, locale: 'es-ES' })).newPage();
  const basico = PLANS.find((p) => p.id === 'basico');
  const tenantRow = { id: 1, name: 'Tienda Demo', slug: 'catalogohoy', country_code: 'MX', plan_id: 'basico', plans: basico,
    plan_expires_at: new Date(Date.now() + 200 * 86400000).toISOString(), plan_expired: false, stripe_subscription_id: 'sub_demo',
    stripe_subscription_status: 'active', extra_catalogs: 0 };
  const calls = [];
  await setupMock(page, {
    routes: {
      '/rest/v1/plans': (route) => route.fulfill({ json: PLANS }),
      '/rest/v1/tenants': (route, req, url, db, single) => route.fulfill({ json: single ? tenantRow : [tenantRow] }),
      '/rest/v1/users_tenants': (route, req, url, db, single) => {
        // Conteo de catálogos propios (head + count=exact): 1 → sin cupos libres.
        const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '0-0/1' };
        if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: cors, body: '' });
        if ((url.searchParams.get('select') || '').includes('extra_catalogs')) return route.fulfill({ json: [{ tenants: { extra_catalogs: 0 } }] });
        const row = { tenant_id: 1, is_default: true, role: 'owner', tenants: { id: 1, name: 'Tienda Demo', slug: 'catalogohoy' } };
        return route.fulfill({ json: single ? row : [row] });
      },
      '/functions/v1/update-catalog-slots': (route, req) => {
        calls.push(JSON.parse(req.postData() || '{}'));
        return route.fulfill({ status: 402, json: { success: false, error: 'No pudimos cobrar con tu tarjeta: Your card has insufficient funds.' } });
      },
    },
  });
  let ok = true; let detail = '';
  try {
    await page.goto(`${BASE}/admin/new-catalog`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.create-catalog__button--violet', { timeout: 20000 });
    await page.locator('.create-catalog__button--violet').click();
    await page.waitForSelector('.slots-error', { timeout: 10000 });
    detail = (await page.locator('.slots-error').innerText()).trim();
    if (detail.includes('non-2xx')) ok = false;
  } catch (e) { ok = false; detail = `ERROR ${e.message}`; }
  await page.screenshot({ path: path.join(OUT, '10-catalogo-adicional-error-claro.png'), fullPage: false });
  results.push(`${ok ? '✅' : '❌'} 10-catalogo-adicional-error-claro: "${detail}" | llamadas: ${JSON.stringify(calls)}`);
  await page.context().close();
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  await run(browser, { name: '01-basico-mensual-a-avanzado-anual', current: 'basico', country: 'MX', target: 'avanzado', period: 'annual', expect: '4.105,50' });
  await run(browser, { name: '02-basico-mensual-a-avanzado-mensual', current: 'basico', country: 'MX', target: 'avanzado', period: 'monthly', expect: '380,33' });
  await run(browser, { name: '03-basico-mensual-a-basico-anual', current: 'basico', country: 'MX', target: 'basico', period: 'annual', expect: '1.276,56' });
  await run(browser, { name: '04-pro-mensual-a-avanzado-anual', current: 'pro', country: 'AR', target: 'avanzado', period: 'annual', expect: '305.604,46' });
  await run(browser, { name: '05-pagar-upgrade', current: 'basico', country: 'MX', target: 'avanzado', period: 'annual', pay: true });
  await run(browser, { name: '06-gratis-a-avanzado-anual-link-de-pago', current: 'gratis', country: 'MX', target: 'avanzado', period: 'annual', pay: true });
  await run(browser, { name: '07-url-trimestral-cae-a-mensual', current: 'gratis', country: 'MX', target: 'pro', period: 'quarterly' });
  // 500 créditos = $9.03 USD (−5%) → 185,11 MXN (mismo redondeo que el server); con el upgrade: 4.105,50 + 185,12
  await run(browser, { name: '08-upgrade-con-500-creditos', current: 'basico', country: 'MX', target: 'avanzado', period: 'annual', credits: 500, pay: true, expect: '4.290,61' });
  await run(browser, { name: '09-gratis-a-avanzado-con-500-creditos', current: 'gratis', country: 'MX', target: 'avanzado', period: 'annual', credits: 500, pay: true, expect: '4.488,88' });
  await catalogSlots(browser);
  await browser.close();
  console.log(results.join('\n'));
})();
