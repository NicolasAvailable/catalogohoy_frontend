// E2E: exportar productos a Excel AUTOGESTIONADO desde el hub
// Exportar/Importar (antes el tile pedía la exportación por WhatsApp).
//
// Valida: click en Exportar → se DESCARGA un .xlsx real → el archivo parsea,
// tiene TODOS los productos (mismo total que muestra el listado), las
// columnas del import (nombre/precio/sku/...) y datos correctos de un
// producto conocido → round-trip re-importable.
//
// Uso: node scripts/e2e-export-excel.mjs <baseUrl>
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-export-excel';

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

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token',
    JSON.stringify(session),
  ]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=productos — Pág.', { timeout: 30000 });

  // Total real según el footer del listado ("128 productos — Pág. 1 de 13").
  const footer = await page.locator('text=productos — Pág.').first().textContent();
  const total = Number(footer?.match(/(\d+)\s+productos/)?.[1] ?? 0);
  log(`total según el listado: ${total}`);
  if (!total) throw new Error('no pude leer el total de productos');

  // Abrir el hub y verificar que el tile YA NO menciona WhatsApp.
  await page.locator('button:has-text("Exportar/Importar"):visible').first().click();
  await page.waitForSelector('text=Exportar / Importar productos', { timeout: 10000 });
  const modalText = await page.locator('[role="dialog"], .p-dialog').first().textContent();
  if (/WhatsApp y te enviamos|Solicitar por WhatsApp/i.test(modalText ?? '')) {
    throw new Error('el tile de exportar sigue mencionando WhatsApp');
  }
  if (!modalText?.includes('Descargar Excel')) {
    throw new Error('no aparece el botón Descargar Excel');
  }
  await page.screenshot({ path: `${SHOTS}/1-hub-sin-whatsapp.png` });
  log('hub: sin WhatsApp, con "Descargar Excel" ✅');

  // Click en Exportar → capturar la DESCARGA real.
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  await page.locator('button:has(h3:has-text("Exportar")):visible').first().click();
  const download = await downloadPromise;
  const dir = mkdtempSync(join(tmpdir(), 'export-'));
  const file = join(dir, download.suggestedFilename());
  await download.saveAs(file);
  log(`descargado: ${download.suggestedFilename()}`);
  if (!/^productos_\d{4}-\d{2}-\d{2}\.xlsx$/.test(download.suggestedFilename())) {
    throw new Error(`nombre de archivo inesperado: ${download.suggestedFilename()}`);
  }
  await page.waitForSelector(`text=Se descargó el Excel con tus ${total} productos`, { timeout: 10000 });
  log('toast con el conteo ✅');
  await page.screenshot({ path: `${SHOTS}/2-descarga-toast.png` });

  // Parsear el archivo y validar contenido.
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  log(`filas en el Excel: ${rows.length} | hoja: ${wb.SheetNames[0]}`);
  if (rows.length !== total) {
    throw new Error(`el Excel tiene ${rows.length} filas pero el listado dice ${total}`);
  }
  const headers = Object.keys(rows[0]);
  for (const h of ['nombre', 'precio', 'sku', 'descripcion', 'categorias']) {
    if (!headers.includes(h)) throw new Error(`falta la columna "${h}" (round-trip del import)`);
  }
  const camiseta = rows.find((r) => r.sku === 'SKU-001');
  if (!camiseta || !String(camiseta.nombre).includes('Oversize')) {
    throw new Error('SKU-001 (Camiseta Oversize) no está o no coincide');
  }
  log(`spot-check SKU-001: "${camiseta.nombre}" precio ${camiseta.precio} ✅`);

  log('✅ TEST OK: export autogestionado, archivo completo y re-importable');
  process.exitCode = 0;
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
