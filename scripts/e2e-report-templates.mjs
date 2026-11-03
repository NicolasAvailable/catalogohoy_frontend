// E2E / demo: recorrido de plantillas de reportes contra la app local.
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-report-templates.mjs [baseUrl] [shotsDir]
//      HEADED=1 para ver el navegador (más lento, para mostrarlo).
// La migración aún no está en prod: report_templates / template_id y las
// métricas nuevas se simulan con page.route (sin escribir nada en la BD).
// Las métricas nuevas usan valores reales calculados por SQL para sep-2026.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.argv[3] ?? '/tmp/e2e-report-templates';
const HEADED = !!process.env.HEADED;
const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(SHOTS, { recursive: true });
const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[e2e] ${m}`);

const EXTRA = {
  6: {"profit":{"cost":25,"profit":73,"revenue":98,"hasCosts":true,"commission":0},"channels":[{"total":82,"channel":"public","ordersCount":7},{"total":30,"channel":"manual","ordersCount":1},{"total":12,"channel":"pos","ordersCount":1}],"shipping":{"methods":[{"name":"Recoger en el local","type":"pickup","ordersCount":7},{"name":"Sin método de entrega","type":null,"ordersCount":2}],"totalFees":0},"weekdays":[{"total":18,"weekday":1,"ordersCount":2},{"total":66,"weekday":3,"ordersCount":4},{"total":28,"weekday":5,"ordersCount":2},{"total":12,"weekday":6,"ordersCount":1}],"customers":{"new":6,"total":6,"returning":0},"discounts":{"codes":[],"total":0,"ordersCount":0},"comparison":{"sales":30,"orders":2,"avgTicket":15,"previousEnd":"2026-09-01T00:00:00+00:00","previousStart":"2026-08-02T00:00:00.001+00:00"}},
};

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
const session = await res.json();
if (!session.access_token) throw new Error('login fallo');

const templates = [];
const fakeReports = [];
let nextId = 990001;
const isObj = (req) => (req.headers()['accept'] ?? '').includes('pgrst.object');

const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 400 : 0 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
  'sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session),
]);

await ctx.route(`${SUPA}/rest/v1/report_templates*`, async (route) => {
  const req = route.request();
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData());
    const row = { id: nextId++, created_at: new Date().toISOString(), ...body };
    templates.unshift(row);
    return route.fulfill({ json: isObj(req) ? row : [row] });
  }
  return route.fulfill({ json: templates });
});

await ctx.route(`${SUPA}/rest/v1/reports*`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData());
    const row = {
      id: nextId++, public_token: crypto.randomUUID(),
      created_at: new Date(Date.now() + fakeReports.length * 1000).toISOString(),
      deleted_at: null, ...body,
    };
    fakeReports.unshift(row);
    return route.fulfill({ json: isObj(req) ? row : [row] });
  }
  const idEq = url.searchParams.get('id');
  if (idEq) {
    const fake = fakeReports.find((r) => `eq.${r.id}` === idEq);
    if (fake) return route.fulfill({ json: isObj(req) ? fake : [fake] });
  }
  const real = await route.fetch();
  if (idEq) return route.fulfill({ response: real });
  const rows = await real.json();
  return route.fulfill({ response: real, json: [...fakeReports, ...rows.map((r) => ({ template_id: null, ...r }))] });
});

await ctx.route(`${SUPA}/rest/v1/rpc/build_report_snapshot*`, async (route) => {
  const body = JSON.parse(route.request().postData());
  log(`snapshot tenant=${body.p_tenant_id} ${body.p_period_start} → ${body.p_period_end}`);
  const real = await route.fetch();
  const snap = await real.json();
  return route.fulfill({ response: real, json: { ...snap, ...(EXTRA[body.p_tenant_id] ?? EXTRA[6]) } });
});

// "Generado este mes" real; lo dejamos en 0 para que el límite no tape los botones.
await ctx.route(`${SUPA}/rest/v1/rpc/count_reports_this_month*`, (route) => route.fulfill({ json: 0 }));

const page = await ctx.newPage();
const shot = (n, full = false) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });

await page.goto(`${BASE}/admin/reports`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Crear reporte', { timeout: 60000 });
await page.waitForTimeout(2500);

await page.locator('ui-button:has-text("Crear reporte") button').first().click();
await page.waitForSelector('text=Nuevo reporte');
const title = page.locator('ui-input-text input').first();
await title.fill('Reporte de ventas');
await page.locator('button.preset:has-text("Mes pasado")').click();
for (const label of ['Ganancia estimada', 'Clientes nuevos vs. recurrentes', 'Canales de venta', 'Entregas', 'Mejores días de la semana']) {
  await page.locator(`li:has(strong:text-is("${label}")) .p-toggleswitch`).click();
}
await page.locator('li:has(strong:text-is("Guardar como plantilla")) .p-toggleswitch').click();
await page.waitForTimeout(400);
await shot('1-crear-reporte', true);
log('form listo');

await page.locator('ui-button:has-text("Generar reporte") button').click();
await page.waitForURL(/admin\/reports\/\d+/, { timeout: 30000 });
await page.waitForSelector('text=Comparación con el periodo anterior', { timeout: 30000 });
await page.waitForTimeout(2500);
await shot('2-reporte-generado', true);
log('reporte generado');

await page.goto(`${BASE}/admin/reports`);
await page.waitForSelector('text=Generar ahora', { timeout: 30000 });
await page.waitForTimeout(1500);
await shot('3-lista-con-plantilla');

await page.locator('ui-button:has-text("Generar ahora") button').first().click();
await page.waitForURL(/admin\/reports\/\d+/, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/admin/reports`);
await page.waitForSelector('text=Generar ahora', { timeout: 30000 });
await page.locator('.template-card').first().click();
await page.waitForSelector('text=Historial de');
await page.waitForTimeout(800);
await shot('4-historial-plantilla');
log(`ok — capturas en ${SHOTS}`);
if (HEADED) await page.waitForTimeout(4000);
await browser.close();
