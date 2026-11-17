// E2E: filtro al exportar productos (Todos / Solo con stock / Solo agotados).
// Valida que cada opción descarga un Excel con las filas correctas según la
// columna "agotado", que con stock + agotados = todos, y el CSV filtrado.
// Uso: node scripts/e2e-export-filter.mjs <baseUrl>
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-export-filter';
mkdirSync(SHOTS, { recursive: true });
const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[e2e] ${m}`);

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'nicaso3006@gmail.com', password: 'nicolas' }),
});
const session = await res.json();
if (!session.access_token) throw new Error('login fallo');

async function openPicker(page) {
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=productos — Pág.', { timeout: 30000 });
  await page.locator('button:has-text("Exportar/Importar"):visible').first().click();
  await page.waitForSelector('text=Exportar / Importar productos', { timeout: 10000 });
  await page.locator('button:has(h3:has-text("Exportar")):visible').first().click();
  await page.waitForSelector('text=Productos a exportar', { timeout: 10000 });
}

async function download(page, filter, fmt = 'Microsoft Excel', shotPrefix = null) {
  await page.locator(`[data-testid="export-filter-${filter}"]`).click();
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await page.locator(`button:has(h3:has-text("${fmt}")):visible`).first().click();
  await page.waitForSelector('[data-testid="export-loading"]', { timeout: 5000 });
  if (shotPrefix) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/${shotPrefix}-cargando.png` });
  }
  const d = await dl;
  await page.waitForSelector('[data-testid="export-done"]', { timeout: 10000 });
  await page.waitForSelector('text=¡Productos exportados exitosamente!');
  if (shotPrefix) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${shotPrefix}-exito.png` });
  }
  const file = join(mkdtempSync(join(tmpdir(), 'exp-')), d.suggestedFilename());
  await d.saveAs(file);
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  await page.locator('button:has-text("Exportar otros"):visible').first().click();
  await page.waitForSelector('text=Productos a exportar', { timeout: 5000 });
  return rows;
}

// La cuenta demo (tenant 6) no tiene agotados: marcamos uno temporalmente
// como agotado y lo restauramos al final.
const REST = `${SUPA}/rest/v1/products`;
const H = { apikey: APIKEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
const pick = await (await fetch(`${REST}?tenant_id=eq.6&is_sold_out=eq.false&select=id,name&order=id.asc&limit=1`, { headers: H })).json();
const temp = pick[0];
if (!temp) throw new Error('no encontré producto para marcar agotado');
async function setSoldOut(v) {
  const r = await fetch(`${REST}?id=eq.${temp.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ is_sold_out: v }) });
  const j = await r.json();
  if (!r.ok || !j.length) throw new Error(`no pude cambiar is_sold_out: ${JSON.stringify(j)}`);
}
await setSoldOut(true);
log(`marcado temporalmente como agotado: #${temp.id} ${temp.name}`);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session),
  ]);
  const page = await ctx.newPage();
  await openPicker(page);
  await page.screenshot({ path: `${SHOTS}/01-filtro-todos.png` });

  const all = await download(page, 'all');
  const soldOut = await download(page, 'sold-out', 'Microsoft Excel', '02-agotados');
  const inStock = await download(page, 'in-stock');
  log(`todos=${all.length} agotados=${soldOut.length} con stock=${inStock.length}`);

  const expSold = all.filter((r) => r.agotado === 'Sí').length;
  if (!soldOut.some((r) => r.nombre === temp.name)) log('ojo: no vi el producto marcado por nombre');
  if (soldOut.length !== expSold) throw new Error(`agotados ${soldOut.length} != ${expSold}`);
  if (soldOut.some((r) => r.agotado !== 'Sí')) throw new Error('hay no agotados en "Solo agotados"');
  if (inStock.some((r) => r.agotado !== 'No')) throw new Error('hay agotados en "Solo con stock"');
  if (soldOut.length + inStock.length !== all.length) throw new Error('la suma no cuadra');
  log('Excel filtrado OK ✅');

  const csvSold = await download(page, 'sold-out', 'CSV', '03-csv');
  if (csvSold.length !== soldOut.length) throw new Error(`CSV agotados ${csvSold.length}`);
  log('CSV filtrado OK ✅');

  // Móvil
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  await m.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session),
  ]);
  const mp = await m.newPage();
  await openPicker(mp);
  await mp.locator('[data-testid="export-filter-sold-out"]').click();
  await mp.waitForTimeout(500);
  if ((await mp.locator('[data-testid="export-filter-sold-out"]').getAttribute('aria-checked')) !== 'true')
    throw new Error('en móvil no quedó seleccionado "Solo agotados"');
  await mp.screenshot({ path: `${SHOTS}/05-movil.png` });
  const mdl = mp.waitForEvent('download', { timeout: 60000 });
  await mp.locator('button:has(h3:has-text("Microsoft Excel")):visible').first().click();
  await mp.waitForSelector('[data-testid="export-loading"]', { timeout: 5000 });
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: `${SHOTS}/06-movil-cargando.png` });
  await mdl;
  await mp.waitForSelector('[data-testid="export-done"]', { timeout: 10000 });
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: `${SHOTS}/07-movil-exito.png` });
  log('móvil OK ✅');
} finally {
  await browser.close();
  await setSoldOut(false);
  log(`restaurado #${temp.id}`);
}
