// E2E: descargar un reporte en Excel (CAT-106).
//
// Valida: en el detalle del reporte aparece el botón "Excel" (escritorio y
// móvil) → al hacer click se DESCARGA un .xlsx real → el archivo parsea, trae
// la hoja Resumen + una hoja por cada métrica activa con datos, y los totales
// coinciden con el snapshot guardado del reporte. Solo lee: no escribe nada.
//
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-report-excel.mjs [baseUrl] [shotsDir]
//      REPORT_ID=123 para un reporte concreto (si no, usa el más reciente).
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.argv[3] ?? '/tmp/e2e-report-excel';
const { E2E_EMAIL, E2E_PASSWORD, REPORT_ID } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[e2e] ${m}`);
const fail = (m) => {
  throw new Error(`❌ ${m}`);
};

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
const session = await res.json();
if (!session.access_token) fail('login falló');

// Reporte a probar (lectura con el token del usuario, respeta RLS).
const q = REPORT_ID
  ? `id=eq.${REPORT_ID}`
  : 'deleted_at=is.null&order=created_at.desc&limit=1';
const rep = await fetch(
  `${SUPA}/rest/v1/reports?select=id,title,tenant_id,metrics_config,snapshot&${q}`,
  { headers: { apikey: APIKEY, Authorization: `Bearer ${session.access_token}` } }
).then((r) => r.json());
const report = rep?.[0];
if (!report) fail('no encontré ningún reporte para esta cuenta');
log(`reporte #${report.id} "${report.title}" (tenant ${report.tenant_id})`);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    locale: 'es-ES',
  });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token',
    JSON.stringify(session),
  ]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

  // 1) Detalle en escritorio con el botón Excel.
  await page.goto(`${BASE}/admin/reports/${report.id}`, { waitUntil: 'domcontentloaded' });
  const excelBtn = page.locator('button:has-text("Excel"):visible').first();
  await excelBtn.waitFor({ timeout: 40000 });
  await page.locator('button:has-text("Descargar PDF"):visible').first().waitFor();
  await page.waitForTimeout(1500); // gráficos
  await page.screenshot({ path: join(SHOTS, '1-detalle-escritorio.png') });
  log('botón Excel visible junto a Descargar PDF ✅');

  // 2) Click → descarga real.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    excelBtn.click(),
  ]);
  const name = download.suggestedFilename();
  if (!name.endsWith('.xlsx')) fail(`archivo inesperado: ${name}`);
  const file = join(SHOTS, name);
  await download.saveAs(file);
  log(`descargado: ${name} ✅`);

  // 3) Contenido del archivo vs. snapshot guardado.
  const wb = XLSX.readFile(file);
  const sheets = Object.fromEntries(
    wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })])
  );
  log(`hojas: ${wb.SheetNames.join(' · ')}`);
  if (!sheets['Resumen']) fail('falta la hoja Resumen');

  const m = report.metrics_config ?? {};
  const s = report.snapshot ?? {};
  const value = (label) =>
    sheets['Resumen'].find((r) => String(r[0]).startsWith(label))?.[1];
  const close = (a, b) => Math.abs(Number(a) - Number(b)) < 0.01;

  if (m.orders && !close(value('Órdenes'), s.orders?.total)) {
    fail(`Órdenes no coincide: ${value('Órdenes')} vs ${s.orders?.total}`);
  }
  if (m.sales && !close(value('Ventas ('), Math.round(Number(s.sales?.total) * 100) / 100)) {
    fail(`Ventas no coincide: ${value('Ventas (')} vs ${s.sales?.total}`);
  }
  const expected = [
    ['topProducts', 'Productos', s.topProducts?.length],
    ['topCustomers', 'Clientes', s.topCustomers?.length],
    ['paymentMethods', 'Métodos de pago', s.paymentMethods?.length],
    ['channels', 'Canales', s.channels?.length],
    ['weekdays', 'Días de la semana', s.weekdays?.length],
  ];
  for (const [key, sheet, n] of expected) {
    if (m[key] && n > 0) {
      if (!sheets[sheet]) fail(`falta la hoja ${sheet}`);
      if (key !== 'weekdays' && sheets[sheet].length - 1 !== n) {
        fail(`${sheet}: ${sheets[sheet].length - 1} filas vs ${n} en el reporte`);
      }
    }
  }
  if (m.topProducts && s.topProducts?.[0]) {
    const row = sheets['Productos'][1];
    if (row[0] !== s.topProducts[0].name || !close(row[1], s.topProducts[0].quantity)) {
      fail('el producto #1 no coincide con el reporte');
    }
  }
  log('totales y filas coinciden con el reporte ✅');

  // 4) Vista del Excel descargado (evidencia legible).
  const html = wb.SheetNames.map(
    (n) => `<h2>${n}</h2>${XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}`
  ).join('');
  const view = await ctx.newPage();
  await view.setViewportSize({ width: 1100, height: 900 });
  await view.setContent(`<html><head><style>
    body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a}
    h1{font-size:20px} h2{font-size:15px;margin:22px 0 6px;color:#4338ca}
    table{border-collapse:collapse;font-size:13px} td{border:1px solid #cbd5e1;padding:4px 10px}
    tr:first-child td{background:#f1f5f9}
  </style></head><body><h1>Contenido de ${name}</h1>${html}</body></html>`);
  await view.screenshot({ path: join(SHOTS, '2-contenido-excel.png'), fullPage: true });

  // 5) Móvil: el botón también está y no rompe el encabezado.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('button:has-text("Excel"):visible').first().waitFor({ timeout: 40000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(SHOTS, '3-detalle-movil.png') });
  log('móvil: botón Excel visible ✅');

  log(`OK — capturas en ${SHOTS}`);
} finally {
  await browser.close();
}
