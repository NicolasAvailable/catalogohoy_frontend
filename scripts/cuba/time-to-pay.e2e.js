// Panel interno → Métricas de negocio → "¿A los cuántos días pagan?" + "Cada cuánto pagan"
// (CAT-107 / CAT-108). Backend falso: la edge fn admin-time-to-pay devuelve TTP_JSON
// (snapshot de prod calculado en solo lectura, solo agregados) o datos de ejemplo.
//
//   npx nx serve internal --port 6200
//   TTP_JSON=/tmp/ttp.json CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/time-to-pay.e2e.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const INTERNAL = process.env.INTERNAL || 'http://localhost:6200';
const REF = 'yvkurjivijnhliofmfmj';
const results = [];

function sample() {
  const today = new Date();
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29 + i);
    const signups = 15 + (i % 7) * 2;
    const paid = i % 3 === 0 ? 2 : 1;
    return { day: d.toISOString().slice(0, 10), signups, paid, avgDays: i % 3 === 0 ? 1.5 : 0 };
  });
  return {
    days: 30,
    window: { signups: series.reduce((a, d) => a + d.signups, 0), paid: series.reduce((a, d) => a + d.paid, 0), avgDays: 2.4, medianDays: 0, paidWithin7: 38 },
    allTime: {
      payers: 265, avgDays: 6.8, medianDays: 0, sameDayPct: 53.2, within7Pct: 80.8,
      buckets: [{ bucket: '0', count: 141 }, { bucket: '1-3', count: 51 }, { bucket: '4-7', count: 22 }, { bucket: '8-14', count: 21 }, { bucket: '15-30', count: 14 }, { bucket: '31+', count: 16 }],
      bySource: { stripe: 138, manual: 95, iap: 32 },
    },
    series,
    months: [
      { month: '2026-10', signups: 2000, paid: 200, sameDay: 110, within7: 165, avgDays: 5, medianDays: 0,
        buckets: [{ bucket: '0', count: 110 }, { bucket: '1-3', count: 38 }, { bucket: '4-7', count: 17 }, { bucket: '8-14', count: 15 }, { bucket: '15-30', count: 10 }, { bucket: '31+', count: 10 }] },
      { month: '2026-06', signups: 700, paid: 65, sameDay: 31, within7: 49, avgDays: 9, medianDays: 1,
        buckets: [{ bucket: '0', count: 31 }, { bucket: '1-3', count: 13 }, { bucket: '4-7', count: 5 }, { bucket: '8-14', count: 6 }, { bucket: '15-30', count: 4 }, { bucket: '31+', count: 6 }] },
    ],
    frequency: [
      { source: 'stripe', cycle: 'monthly', count: 55 }, { source: 'manual', cycle: 'monthly', count: 40 },
      { source: 'app_store', cycle: 'monthly', count: 21 }, { source: 'play_store', cycle: 'monthly', count: 6 },
      { source: 'stripe', cycle: 'annual', count: 6 }, { source: 'manual', cycle: 'quarterly', count: 8 },
      { source: 'app_store', cycle: 'annual', count: 2 },
    ],
  };
}
const TTP = process.env.TTP_JSON ? JSON.parse(fs.readFileSync(process.env.TTP_JSON, 'utf8')) : sample();
const adminEmail = (fs.readFileSync(path.join(__dirname, '../../apps/internal/src/app/modules/auth/auth.constants.ts'), 'utf8').match(/'([^']+@[^']+)'/) || [])[1];

const REVENUE = {
  asOf: new Date().toISOString(), monthStart: new Date().toISOString(), mrrUsd: 2100, arrUsd: 25200, collectedThisMonthUsd: 980,
  stripeFeesThisMonthUsd: 40, newSubsThisMonth: 20,
  stripe: { mrrUsd: 1300, activeCount: 61, collectedThisMonthUsd: 700, newThisMonth: 12, skippedNonUsd: 0 },
  manual: { mrrUsd: 800, activeCount: 77, collectedThisMonthUsd: 280, newThisMonth: 8, missingAmount: 0 },
  topPayers: [], demoExcluded: 6,
};

// Registros por día del mismo snapshot (para que el tablero de arriba también tenga datos).
const CONVERSION = {
  days: TTP.days,
  signups: TTP.window.signups,
  converted: TTP.window.paid,
  series: TTP.series.map((d) => ({ day: d.day, signups: d.signups, converted: d.paid })),
};

async function step(name, fn) {
  try { await fn(); results.push(`✅ ${name}`); } catch (e) { results.push(`❌ ${name}: ${e.message.split('\n')[0]}`); }
}
const fmt = (paid, signups) => `${paid.toLocaleString('es-ES')} / ${signups.toLocaleString('es-ES')}`;
async function waitKpi(page, want) {
  let got = '';
  for (let i = 0; i < 30; i++) {
    got = (await page.getByTestId('ttp-paid').innerText()).replace(/\s+/g, ' ').trim();
    if (got === want || got.replace(/\./g, '') === want.replace(/\./g, '')) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`KPI = ${got}, esperaba ${want}`);
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });

let ttpCalls = [];
async function internalPage(browser, viewport) {
  const page = await (await browser.newContext({ viewport, locale: 'es-ES', deviceScaleFactor: 2, timezoneId: 'America/Caracas' })).newPage();
  const user = { id: '00000000-0000-0000-0000-0000000000ad', aud: 'authenticated', role: 'authenticated', email: adminEmail, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: 'x.eyJzdWIiOiIwIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 36000, user };
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  await page.route(/^https:\/\/[^/]*(supabase\.co|api\.catalogohoy\.com|posthog|sentry)/, (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (p === '/functions/v1/admin-time-to-pay') { ttpCalls.push(req.postData()); return route.fulfill({ json: TTP, headers: { 'access-control-allow-origin': '*' } }); }
    if (p === '/functions/v1/admin-revenue-metrics') return route.fulfill({ json: REVENUE, headers: { 'access-control-allow-origin': '*' } });
    // El resto del tablero: objetos vacíos (null rompe platform_orders_stats_admin).
    if (p === '/rest/v1/rpc/signup_conversion_daily_admin') return route.fulfill({ json: CONVERSION });
    if (p === '/rest/v1/rpc/platform_orders_stats_admin') return route.fulfill({ json: {} });
    if (p.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await internalPage(browser, { width: 1440, height: 1000 });

  await step('Sidebar → Métricas de negocio carga la sección de días hasta pagar', async () => {
    await page.goto(`${INTERNAL}/`);
    await page.getByText('Métricas de negocio', { exact: true }).first().click();
    await page.getByTestId('time-to-pay').waitFor({ timeout: 15000 });
    if (!ttpCalls.length || !String(ttpCalls[0]).includes('"days":30')) throw new Error(`body edge fn = ${ttpCalls[0]}`);
  });

  await step('KPIs "Todo": últimos 12 meses, mismo día y 1ª semana', async () => {
    const txt = (await page.getByTestId('time-to-pay').innerText()).replace(/\s+/g, ' ');
    const ms = TTP.months || [];
    const signups = ms.reduce((a, m) => a + m.signups, 0), paid = ms.reduce((a, m) => a + m.paid, 0);
    const same = ms.reduce((a, m) => a + m.sameDay, 0), w7 = ms.reduce((a, m) => a + m.within7, 0);
    if (!/últimos 12 meses/i.test(txt)) throw new Error('falta etiqueta Últimos 12 meses');
    await waitKpi(page, fmt(paid, signups));
    for (const v of [`${Math.round((100 * same) / paid)}%`, `${Math.round((100 * w7) / paid)}%`]) if (!txt.includes(v)) throw new Error(`falta ${v}`);
    await page.getByTestId('time-to-pay').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.getByTestId('time-to-pay').screenshot({ path: path.join(OUT, '01-dias-hasta-pagar.png') });
  });

  await step('Chip de mes (octubre) cambia los KPIs a ese mes', async () => {
    const mo = TTP.months.find((m) => m.month === '2026-10');
    await page.getByTestId('ttp-months').getByRole('button', { name: /^Oct/ }).click();
    await waitKpi(page, fmt(mo.paid, mo.signups));
    const txt = await page.getByTestId('time-to-pay').innerText();
    if (!/octubre de 2026/i.test(txt)) throw new Error('falta etiqueta octubre de 2026');
    if (!txt.includes(`${Math.round((100 * mo.sameDay) / mo.paid)}%`)) throw new Error('mismo día oct');
    await page.getByTestId('time-to-pay').screenshot({ path: path.join(OUT, '02-octubre.png') });
  });

  await step('Tabla mes por mes: todas las filas y clic en junio selecciona junio', async () => {
    const rows = page.getByTestId('ttp-month-table').locator('tbody tr');
    if ((await rows.count()) !== TTP.months.length) throw new Error(`filas ${await rows.count()}`);
    const jun = TTP.months.find((m) => m.month === '2026-06');
    await rows.filter({ hasText: /junio/i }).click();
    await waitKpi(page, fmt(jun.paid, jun.signups));
    await page.getByTestId('ttp-months').getByRole('button', { name: 'Todo' }).click();
  });

  await step('Distribución: 6 tramos y suman el total de pagadores', async () => {
    const sum = TTP.allTime.buckets.reduce((a, b) => a + b.count, 0);
    if (sum !== TTP.allTime.payers) throw new Error(`suma ${sum} != ${TTP.allTime.payers}`);
    const msum = TTP.months.reduce((a, m) => a + m.paid, 0);
    if (msum !== TTP.allTime.payers) throw new Error(`meses ${msum} != ${TTP.allTime.payers}`);
    const txt = await page.getByTestId('time-to-pay').innerText();
    for (const l of ['Mismo día', '1 a 3 días', '4 a 7 días', '8 a 14 días', '15 a 30 días', 'Más de 30']) if (!txt.includes(l)) throw new Error(`falta ${l}`);
  });

  await step('Frecuencia de pago: mensual / trimestral / anual con totales', async () => {
    const txt = (await page.getByTestId('payment-frequency').innerText()).replace(/\s+/g, ' ');
    const monthly = TTP.frequency.filter((f) => f.cycle === 'monthly').reduce((a, f) => a + f.count, 0);
    if (!txt.includes('Mensual')) throw new Error('falta Mensual');
    if (!new RegExp(`Mensual ${monthly}\\b`).test(txt)) throw new Error(`mensual != ${monthly}: ${txt.slice(0, 120)}`);
    if (!txt.includes('Anual')) throw new Error('falta Anual');
  });

  await step('Página completa', async () => { await shot(page, '03-metricas-completo', true); });

  const mobile = await internalPage(browser, { width: 390, height: 844 });
  await step('Móvil: sin scroll horizontal de página', async () => {
    await mobile.goto(`${INTERNAL}/business-metrics`);
    await mobile.getByTestId('time-to-pay').waitFor({ timeout: 15000 });
    await mobile.getByTestId('time-to-pay').scrollIntoViewIfNeeded();
    await mobile.waitForTimeout(400);
    await mobile.getByTestId('time-to-pay').screenshot({ path: path.join(OUT, '04-movil.png') });
    if (await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error('scroll horizontal');
  });

  await browser.close();
  console.log(results.join('\n'));
  console.log(`Capturas en ${OUT}`);
  if (results.some((r) => r.startsWith('❌'))) process.exit(1);
})();
