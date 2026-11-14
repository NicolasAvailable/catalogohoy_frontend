// Productos → Exportar/Importar → Excel: columna "agotado" (CAT-114).
// Backend falso con los productos REALES de la cuenta demo (AutoRepuestos
// Rodriguez, tenant 1997), sacados de prod en solo lectura a un JSON:
//   PRODUCTS_JSON=/ruta/demo-products.json (filas de `products` + product_categories)
// Además agrega 3 productos de prueba (tallas agotadas, variantes agotadas y
// marcado a mano) para cubrir los casos que la demo no tiene.
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4200';
const results = [];
const step = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const demo = process.env.PRODUCTS_JSON ? JSON.parse(fs.readFileSync(process.env.PRODUCTS_JSON, 'utf8')) : [];
const base = { tenant_id: 1, description: '', price: 10, price_promotional: null, photos: [], sku: null, production_cost: null, is_wholesale: false, wholesale_tiers: [], is_sold_out: false, is_hidden: false, is_sized: false, sizes: [], is_variant: false, variants: [], addons: [], product_categories: [], created_at: '2026-11-14T00:00:00Z' };
const extra = [
  { ...base, id: 900001, position: 9001, name: 'PRUEBA tallas agotadas', stock: null, is_sized: true, sizes: [{ name: 'S', sku: null, stock: 0 }, { name: 'M', sku: null, stock: 0 }] },
  { ...base, id: 900002, position: 9002, name: 'PRUEBA variantes con tallas agotadas', stock: null, is_variant: true, variants: [{ id: 'v1', name: 'Rojo', price: 10, sizes: [{ name: 'S', stock: 0 }], photos: [] }, { id: 'v2', name: 'Azul', price: 10, sizes: [{ name: 'M', stock: 0 }], photos: [] }] },
  { ...base, id: 900003, position: 9003, name: 'PRUEBA marcado agotado a mano', stock: 5, is_sold_out: true },
  { ...base, id: 900004, position: 9004, name: 'PRUEBA tallas con stock', stock: null, is_sized: true, sizes: [{ name: 'S', sku: null, stock: 0 }, { name: 'M', sku: null, stock: 3 }] },
];
const PRODUCTS = [...demo.map((p) => ({ ...p, tenant_id: 1 })), ...extra];

// Regla esperada, calculada aparte del código de la app.
function expectedSoldOut(p) {
  if (p.is_sold_out) return true;
  const sum = (sz) => (sz.some((s) => s.stock === null || s.stock === '') ? null : sz.reduce((a, s) => a + Number(s.stock || 0), 0));
  let total;
  const vs = p.is_variant ? p.variants || [] : [];
  if (p.is_sized && p.sizes?.length) total = sum(p.sizes);
  else if (vs.length && vs.every((v) => v.sizes?.length)) { total = 0; for (const v of vs) { const t = sum(v.sizes); if (t === null) { total = null; break; } total += t; } }
  else if (vs.length && vs.every((v) => !v.sizes?.length && v.stock != null && v.stock !== '')) total = vs.reduce((a, v) => a + Number(v.stock || 0), 0);
  else total = p.stock === null || p.stock === '' ? null : Number(p.stock);
  return total !== null && total <= 0;
}

const PLANS = [{ id: 'pro', name: 'Pro', description: '', price: 19.99, max_products: 500, max_catalogs: 1, is_free: false, position: 2 }];
const tenantRow = { id: 1, name: 'AutoRepuestos Rodriguez (demo)', slug: 'catalogohoy', country_code: 'VE', plan_id: 'pro', plans: PLANS[0], plan_expires_at: new Date(Date.now() + 200 * 86400000).toISOString(), plan_expired: false };

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-ES', acceptDownloads: true });
  const page = await ctx.newPage();
  await setupMock(page, {
    routes: {
      '/rest/v1/users_tenants': (route, req, url, db, single) => { const r = { tenant_id: 1, is_default: true, role: 'owner', tenants: tenantRow }; return route.fulfill({ json: single ? r : [r] }); },
      '/rest/v1/rpc/get_my_profile_with_tenants': (route) => route.fulfill({ json: { user: { id: 6475, name: 'Demo', email: 'demo@catalogohoy.com' }, tenants: [{ ...tenantRow, role: 'owner', is_default: true }] } }),
      '/rest/v1/plans': (route) => route.fulfill({ json: PLANS }),
      '/rest/v1/tenants': (route, req, url, db, single) => route.fulfill({ json: single ? tenantRow : [tenantRow] }),
      '/rest/v1/products': (route, req, url) => {
        const sel = url.searchParams.get('select') || '';
        if (req.method() === 'HEAD' || sel === 'id') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${PRODUCTS.length}`, 'access-control-expose-headers': 'content-range' }, json: [] });
        const range = req.headers()['range'];
        let rows = PRODUCTS;
        let from = Number(url.searchParams.get('offset') || 0);
        let to = url.searchParams.get('limit') ? from + Number(url.searchParams.get('limit')) - 1 : rows.length - 1;
        if (range) [from, to] = range.split('-').map(Number);
        rows = rows.slice(from, to + 1);
        return route.fulfill({ json: rows, headers: { 'content-range': `${from}-${from + rows.length - 1}/${PRODUCTS.length}`, 'access-control-expose-headers': 'content-range' } });
      },
    },
  });

  await page.goto(`${BASE}/admin/products?slug=catalogohoy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '1-lista-productos.png') });
  step('Abre la lista de productos de la demo', await page.getByText(/BUJIA|SOPORTE|KIT/i).first().isVisible().catch(() => false));

  await page.getByRole('button', { name: /Exportar\/Importar/i }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('heading', { name: 'Exportar', exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '2-elegir-formato.png') });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('button', { hasText: /Microsoft Excel/ }).filter({ visible: true }).first().click(),
  ]);
  const file = path.join(OUT, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '3-descargado.png') });
  step('Descarga el Excel', fs.existsSync(file), download.suggestedFilename());

  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const header = Object.keys(rows[0] || {});
  step('Trae la columna "agotado" al lado de "stock"', header[header.indexOf('stock') + 1] === 'agotado', header.join(', '));
  step(`Exporta todos los productos (${PRODUCTS.length})`, rows.length === PRODUCTS.length, `${rows.length} filas`);

  const bad = [];
  rows.forEach((r, i) => { const exp = expectedSoldOut(PRODUCTS[i]) ? 'Sí' : 'No'; if (r.agotado !== exp || r.nombre !== PRODUCTS[i].name) bad.push(`${r.nombre}: ${r.agotado} (esperado ${exp})`); });
  const soldOut = rows.filter((r) => r.agotado === 'Sí');
  step('Cada fila marca Sí/No correcto', bad.length === 0, bad.length ? bad.slice(0, 5).join(' | ') : `${soldOut.length} agotados, ${rows.length - soldOut.length} con stock`);

  // Re-import: el mismo archivo se vuelve a leer sin errores (agotado se ignora).
  const reimport = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  step('Valores "agotado" solo Sí/No', reimport.every((r) => r.agotado === 'Sí' || r.agotado === 'No'));

  // "Filtro en Excel": tabla con solo los agotados, para la evidencia.
  const cols = ['nombre', 'stock', 'agotado', 'tallas', 'variantes'];
  const html = `<html><body style="font-family:Calibri,Arial;margin:16px"><h3>${download.suggestedFilename()} — filtro agotado = Sí (${soldOut.length} de ${rows.length})</h3>
    <table style="border-collapse:collapse;font-size:13px">${['<tr>' + cols.map((c) => `<th style="border:1px solid #bbb;background:#e8f0e8;padding:4px 8px;text-align:left">${c}</th>`).join('') + '</tr>', ...soldOut.map((r) => '<tr>' + cols.map((c) => `<td style="border:1px solid #ddd;padding:4px 8px;max-width:420px">${String(r[c]).slice(0, 90)}</td>`).join('') + '</tr>')].join('')}</table></body></html>`;
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 780, height: 200 });
  await sheet.setContent(html);
  await sheet.screenshot({ path: path.join(OUT, '4-excel-filtro-agotados.png'), fullPage: true });

  fs.writeFileSync(path.join(OUT, 'resultados.json'), JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
