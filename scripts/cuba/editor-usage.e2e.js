// Panel interno → Uso del editor (métricas de adopción del editor de diseño).
// Backend falso: RPC catalog_editor_usage_admin devuelve USAGE_JSON (snapshot
// leído de prod en solo lectura, NO se commitea: trae nombres de tiendas) o,
// si no se pasa, datos de ejemplo.
//
//   npx nx serve internal --port 6200
//   USAGE_JSON=/tmp/usage.json CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/editor-usage.e2e.js
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
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29 + i);
    return { day: d.toISOString().slice(0, 10), stores: [0, 0, 1, 0, 2, 0, 1][i % 7] };
  });
  const stores = [
    { tenant_id: 101, name: 'Tienda Uno', slug: 'tienda-uno', plan: 'Gratis', is_free: true, theme: 'claro', font: 'Inter', bg_type: 'fill', button_style: 'solid', saved_at: today.toISOString() },
    { tenant_id: 102, name: 'Tienda Dos', slug: 'tienda-dos', plan: 'Pro', is_free: false, theme: 'atardecer', font: 'Poppins', bg_type: 'gradient', button_style: 'outline', saved_at: today.toISOString() },
    { tenant_id: 103, name: 'Tienda Tres', slug: 'tienda-tres', plan: 'Gratis', is_free: true, theme: null, font: 'Inter', bg_type: 'image', button_style: 'solid', saved_at: today.toISOString() },
  ];
  return {
    total_stores: 4457, paid_stores: 150, using: 3, using_paid: 1, with_theme: 2, last_7_days: 3, daily, stores,
    options: [
      { option: 'theme', value: 'claro', stores: 1 }, { option: 'theme', value: 'atardecer', stores: 1 }, { option: 'theme', value: '(sin dato)', stores: 1 },
      { option: 'font', value: 'Inter', stores: 2 }, { option: 'font', value: 'Poppins', stores: 1 },
      { option: 'bgType', value: 'fill', stores: 1 }, { option: 'bgType', value: 'gradient', stores: 1 }, { option: 'bgType', value: 'image', stores: 1 },
      { option: 'buttonStyle', value: 'solid', stores: 2 }, { option: 'buttonStyle', value: 'outline', stores: 1 },
      { option: 'productLayout', value: 'grid2', stores: 3 }, { option: 'categoryStyle', value: 'tabs', stores: 3 },
    ],
  };
}
const USAGE = process.env.USAGE_JSON ? JSON.parse(fs.readFileSync(process.env.USAGE_JSON, 'utf8')) : sample();
const adminEmail = (fs.readFileSync(path.join(__dirname, '../../apps/internal/src/app/modules/auth/auth.constants.ts'), 'utf8').match(/'([^']+@[^']+)'/) || [])[1];

async function step(name, fn) {
  try { await fn(); results.push(`✅ ${name}`); } catch (e) { results.push(`❌ ${name}: ${e.message.split('\n')[0]}`); }
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });

async function internalPage(browser, viewport) {
  const page = await (await browser.newContext({ viewport, locale: 'es-ES', deviceScaleFactor: 2, timezoneId: 'America/Caracas' })).newPage();
  const user = { id: '00000000-0000-0000-0000-0000000000ad', aud: 'authenticated', role: 'authenticated', email: adminEmail, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: 'x.eyJzdWIiOiIwIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 36000, user };
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  await page.route(/^https:\/\/[^/]*(supabase\.co|api\.catalogohoy\.com|posthog|sentry)/, (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (p === '/rest/v1/rpc/catalog_editor_usage_admin') return route.fulfill({ json: USAGE });
    if (p.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await internalPage(browser, { width: 1440, height: 1000 });

  await step('Sidebar → "Uso del editor" muestra los KPIs', async () => {
    await page.goto(`${INTERNAL}/`);
    await page.getByText('Uso del editor', { exact: true }).first().click();
    await page.getByTestId('kpi-using').waitFor();
    const using = (await page.getByTestId('kpi-using').locator('strong').textContent()).trim();
    if (using !== String(USAGE.using)) throw new Error(`usan = ${using}`);
    const theme = (await page.getByTestId('kpi-theme').locator('strong').textContent()).trim();
    if (theme !== String(USAGE.with_theme)) throw new Error(`con tema = ${theme}`);
    await page.waitForTimeout(500);
    await shot(page, '01-uso-editor', true);
  });

  await step('Gráfica por día: 30 barras y tooltip al pasar el mouse', async () => {
    const bars = page.locator('.eu-bar-slot');
    if ((await bars.count()) !== 30) throw new Error(`${await bars.count()} barras`);
    const idx = USAGE.daily.findLastIndex((p) => p.stores > 0);
    await bars.nth(idx).hover();
    const tip = (await bars.nth(idx).locator('.eu-tip').innerText()).replace(/\s+/g, ' ');
    if (!tip.includes(`${USAGE.daily[idx].stores} tienda`)) throw new Error(tip);
    const [, , d] = USAGE.daily[idx].day.slice(0, 10).split('-');
    if (!tip.includes(` ${Number(d)} `)) throw new Error(`día corrido por zona horaria: ${tip} vs ${USAGE.daily[idx].day}`);
    await shot(page, '02-tooltip-dia');
  });

  await step('Temas: nombres legibles y "Sin tema"', async () => {
    const txt = await page.getByTestId('group-theme').innerText();
    if (!/Claro/.test(txt) || !/Sin tema/.test(txt)) throw new Error(txt);
  });

  await step('Filtro "Con tema" y "Plan pago" en la tabla', async () => {
    await page.locator('.eu-chip', { hasText: 'Con tema' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.eu-table tbody tr').length === n, USAGE.with_theme, { timeout: 5000 }).catch(() => {});
    const n = await page.locator('.eu-table tbody tr').count();
    if (n !== USAGE.with_theme) throw new Error(`con tema = ${n}`);
    await page.locator('.eu-chip', { hasText: 'Plan pago' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.eu-table tbody tr').length === n, Math.max(1, USAGE.using_paid), { timeout: 5000 }).catch(() => {});
    const p = await page.locator('.eu-table tbody tr').count();
    if (p !== Math.max(1, USAGE.using_paid)) throw new Error(`pago = ${p}`);
    await page.locator('.eu-table').scrollIntoViewIfNeeded();
    await shot(page, '03-filtro-pago');
    await page.locator('.eu-chip', { hasText: 'Todas' }).click();
  });

  const mobile = await internalPage(browser, { width: 390, height: 844 });
  await step('Móvil: sin scroll horizontal de página', async () => {
    await mobile.goto(`${INTERNAL}/editor-usage`);
    await mobile.getByTestId('kpi-using').waitFor();
    await mobile.waitForTimeout(400);
    await shot(mobile, '04-movil', true);
    if (await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error('scroll horizontal');
  });

  await browser.close();
  console.log(results.join('\n'));
  console.log(`Capturas en ${OUT}`);
  if (results.some((r) => r.startsWith('❌'))) process.exit(1);
})();
