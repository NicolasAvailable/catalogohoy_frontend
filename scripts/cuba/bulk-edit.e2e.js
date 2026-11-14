// Paso a paso de "Edición masiva" (CAT-76) contra el dev server local con backend falso.
// Uso: CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-bulk node scripts/cuba/bulk-edit.e2e.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-bulk');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let n = 0;

const base = (id, name, over = {}) => ({
  id, name, description: '', price: 10, price_promotional: null, auth_user_id: 'u', photos: [],
  stock: 5, sku: null, production_cost: null, product_categories: [], created_at: '2026-01-01',
  position: id, is_wholesale: false, wholesale_tiers: [], is_sold_out: false, is_hidden: false,
  is_sized: false, sizes: [], is_variant: false, variants: [], addons: [], ...over,
});

const products = [
  base(1, 'Casco integral LS2', { price: 85, price_promotional: 79, stock: 12, sku: 'CAS-LS2', production_cost: 50 }),
  base(2, 'Barra posa pie', {
    price: 18, stock: null, sku: 'BPP', is_variant: true,
    variants: [
      { id: 'v-jag', name: 'JAGUAR', price: 18, originalPrice: 0, sku: 'BPP-JAG', photos: ['a.jpg'], stock: 4, sizes: [], isHidden: false },
      { id: 'v-cg', name: 'CG-150 H', price: 20, originalPrice: 24, sku: 'BPP-CG', photos: [], stock: 7, sizes: [], isHidden: false },
    ],
  }),
  base(3, 'Chaqueta de cordura', {
    price: 60, stock: null, is_sized: true,
    sizes: [{ name: 'S', stock: 2, sku: 'CH-S' }, { name: 'M', stock: 5, sku: 'CH-M' }, { name: 'L', stock: 0, sku: 'CH-L' }],
  }),
  ...Array.from({ length: 45 }, (_, i) =>
    base(10 + i, `Repuesto ${String(i + 1).padStart(2, '0')}`, { price: 5 + i, stock: i % 4 === 0 ? null : 10 + i, sku: `REP-${i + 1}` })
  ),
];

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:4200' });
  const page = await ctx.newPage();
  const patches = [];
  const db = { products: JSON.parse(JSON.stringify(products)) };
  await setupMock(page, {
    routes: {
      '/rest/v1/products': (route, req, url, _db, single) => {
        const id = Number(url.searchParams.get('id')?.replace('eq.', ''));
        if (req.method() === 'PATCH') {
          const body = JSON.parse(req.postData());
          patches.push({ id, body });
          const row = db.products.find((p) => p.id === id);
          if (body.sku === 'DUPLICADO') {
            return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_unique_per_tenant"' } });
          }
          Object.assign(row, body);
          return route.fulfill({ json: single ? row : [row] });
        }
        if (id) {
          const row = db.products.find((p) => p.id === id);
          return route.fulfill({ json: single ? row : [row] });
        }
        const range = req.headers()['range'];
        if (range && !range.startsWith('0-')) return route.fulfill({ json: [] });
        return route.fulfill({ json: db.products });
      },
    },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const shot = async (name) => { n++; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f }); return f; };
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); console.error(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); console.error(`❌ ${name}: ${e.message}`); await shot('fallo'); }
  };
  const grid = () => page.getByTestId('bulk-grid');
  const cell = (r, col) => page.locator(`tr[data-row="${r}"] td[data-col="${col}"]`);
  const cellText = async (r, col) => (await cell(r, col).innerText()).replace('∞', '').trim();
  const expectEq = (got, want, what) => { if (got !== want) throw new Error(`${what}: "${got}" (esperaba "${want}")`); };
  // La vista pinta en el siguiente frame: reintenta hasta 3 s.
  const expectCell = async (r, col, want, what) => {
    let got;
    for (let i = 0; i < 30; i++) { got = await cellText(r, col).catch(() => null); if (got === want) return; await page.waitForTimeout(100); }
    throw new Error(`${what}: "${got}" (esperaba "${want}")`);
  };
  const expectClass = async (loc, cls, what, present = true) => {
    for (let i = 0; i < 30; i++) { const c = (await loc.getAttribute('class')) ?? ''; if (c.includes(cls) === present) return; await page.waitForTimeout(100); }
    throw new Error(what);
  };
  const modified = async () => (await page.getByTestId('bulk-modified-count').innerText()).trim();
  const paste = async (text) => {
    await grid().evaluate((el, t) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', t);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
  };

  await page.goto('http://localhost:4200/admin/products');
  await page.getByTestId('open-bulk-edit').waitFor({ timeout: 30000 });

  await step('El botón "Edición masiva" está entre Exportar/Importar y Crear producto', async () => {
    const labels = await page.locator('header ui-button:visible').allInnerTexts();
    const i = labels.findIndex((l) => l.includes('Edición masiva'));
    if (!(labels[i - 1] ?? '').includes('Importar') || !(labels[i + 1] ?? '').includes('Crear producto')) {
      throw new Error(`orden: ${labels.join(' | ')}`);
    }
    await shot('listado-boton');
  });

  await step('Abre la grilla con productos, variantes y tallas', async () => {
    await page.getByTestId('open-bulk-edit').click();
    await cell(0, 'name').waitFor({ timeout: 10000 });
    await expectCell(0, 'name', 'Casco integral LS2', 'fila 1');
    await expectCell(2, 'option', 'JAGUAR', 'variante');
    await expectCell(5, 'option', 'Talla · S', 'talla');
    expectEq(await modified(), 'Filas modificadas: 0', 'contador');
    await shot('grilla');
  });

  await step('Escribir en una celda la cambia y suma "filas modificadas"', async () => {
    await cell(0, 'price').click();
    await page.keyboard.type('90');
    await page.keyboard.press('Enter');
    await expectCell(0, 'price', '90', 'precio');
    await expectClass(cell(0, 'price'), 'dirty', 'no quedó marcada');
    await page.getByTestId('bulk-modified-count').filter({ hasText: 'Filas modificadas: 1' }).waitFor({ timeout: 3000 });
    // Enter bajó a la fila siguiente.
    await expectClass(cell(1, 'price'), 'cursor', 'Enter no bajó');
  });

  await step('Pegar un bloque de Excel (stock de 2 variantes + SKU)', async () => {
    await cell(2, 'stock').click();
    await paste('15\tBPP-JAG-2\n9\tBPP-CG-2\n');
    await expectCell(2, 'stock', '15', 'stock JAGUAR');
    await expectCell(3, 'stock', '9', 'stock CG-150');
    await expectCell(3, 'sku', 'BPP-CG-2', 'sku CG-150');
    await shot('pegado');
  });

  await step('Ctrl+C / Ctrl+V reales del teclado (portapapeles del sistema)', async () => {
    await cell(6, 'stock').click(); // talla M = 5
    await page.keyboard.press('Control+C');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expectEq(clip, '5', 'portapapeles');
    await cell(7, 'stock').click(); // talla L = 0
    await page.keyboard.press('Control+V');
    await expectCell(7, 'stock', '5', 'talla L');
  });

  await step('Un valor pegado en un rango lo llena entero', async () => {
    await cell(8, 'price').click();
    await page.keyboard.down('Shift');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Shift');
    await paste('12.50');
    for (let r = 8; r <= 12; r++) await expectCell(r, 'price', '12.50', `precio fila ${r + 1}`);
  });

  await step('Arrastrar el cuadrito azul rellena hacia abajo', async () => {
    await cell(13, 'productionCost').click();
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await cell(13, 'productionCost').click();
    const handle = cell(13, 'productionCost').getByTestId('bulk-fill-handle');
    await handle.waitFor({ timeout: 3000 });
    const hb = await handle.boundingBox();
    const tb = await cell(17, 'productionCost').boundingBox();
    await page.mouse.move(hb.x + 4, hb.y + 4);
    await page.mouse.down();
    await page.mouse.move(tb.x + 20, tb.y + 10, { steps: 8 });
    await shot('rellenar-arrastrando');
    await page.mouse.up();
    for (let r = 14; r <= 17; r++) await expectCell(r, 'productionCost', '3', `costo fila ${r + 1}`);
  });

  await step('Seleccionar arrastrando el mouse + Ctrl+D (rellenar abajo)', async () => {
    // La fila 22 está fuera de la vista: arrastrar al borde inferior hace
    // scroll solo, como en Excel.
    const a = await cell(18, 'sku').boundingBox();
    const box = await grid().boundingBox();
    await page.mouse.move(a.x + 10, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(a.x + 10, box.y + box.height - 4, { steps: 6 });
    await page.waitForTimeout(500);
    const b = await cell(21, 'sku').boundingBox();
    await page.mouse.move(b.x + 10, b.y + 10, { steps: 4 });
    await page.mouse.up();
    await expectClass(cell(21, 'sku'), 'in-range', 'no seleccionó arrastrando');
    await shot('seleccion-arrastrando');
    await page.keyboard.press('Control+D');
    const top = await cellText(18, 'sku');
    for (let r = 19; r <= 21; r++) await expectCell(r, 'sku', top, `sku fila ${r + 1}`);
    await shot('ctrl-d');
  });

  await step('Ctrl+Z deshace y Ctrl+Y rehace', async () => {
    await page.keyboard.press('Control+Z');
    await expectCell(19, 'sku', 'REP-12', 'deshacer');
    await page.keyboard.press('Control+Y');
    await expectCell(19, 'sku', 'REP-11', 'rehacer');
  });

  await step('Ocultar una variante con el interruptor y marcar agotado con espacio', async () => {
    await cell(3, 'visible').locator('.bulk-toggle').click();
    await page.waitForTimeout(150);
    await expectClass(cell(3, 'visible').locator('.bulk-toggle'), 'bulk-toggle--on', 'sigue visible', false);
    await cell(0, 'soldOut').click({ position: { x: 6, y: 6 } });
    await expectClass(cell(0, 'soldOut'), 'cursor', 'no seleccionó Agotado');
    await page.keyboard.press(' ');
    await expectClass(cell(0, 'soldOut').locator('.bulk-toggle'), 'bulk-toggle--on', 'no quedó agotado');
  });

  await step('Celdas que no aplican no se editan (precio promocional en variante)', async () => {
    await cell(2, 'pricePromotional').click();
    await page.keyboard.type('5');
    if (await page.getByTestId('bulk-editor').count()) throw new Error('abrió el editor');
    await expectCell(2, 'pricePromotional', '', 'celda gris');
  });

  await step('Un valor inválido queda en rojo y no deja guardar', async () => {
    await cell(1, 'price').dblclick();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('abc');
    await page.keyboard.press('Tab');
    await expectClass(cell(1, 'price'), 'error', 'no quedó en rojo');
    await page.getByTestId('bulk-save').click();
    await page.getByText('Corrige las celdas en rojo antes de guardar').waitFor({ timeout: 4000 });
    if (patches.length) throw new Error('guardó con error');
    await shot('error-validacion');
    await cell(1, 'price').click();
    await page.keyboard.type('19,90');
    await page.keyboard.press('Enter');
  });

  await step('Buscar filtra por nombre/variante y "solo modificadas"', async () => {
    await page.getByTestId('bulk-search').fill('cg-150');
    await page.waitForTimeout(150);
    expectEq(await page.locator('tr.bulk-row').count(), 3, 'filas de Barra posa pie');
    await page.getByTestId('bulk-search').fill('');
    await page.getByText('Solo filas modificadas').click();
    await page.waitForTimeout(150);
    await shot('solo-modificadas');
    await page.getByText('Solo filas modificadas').click();
  });

  await step('Guardar manda solo lo modificado y aplica sobre el JSON actual', async () => {
    // Simula una venta mientras se editaba: JAGUAR baja de 4 a 3 y CG-150 cambió de foto.
    db.products[1].variants[1].photos = ['nueva.jpg'];
    await shot('antes-de-guardar');
    await page.getByTestId('bulk-save').click();
    await page.getByText(/productos guardados/).waitFor({ timeout: 8000 });
    const p1 = patches.find((p) => p.id === 1).body;
    expectEq(JSON.stringify(p1), JSON.stringify({ price: 90, is_sold_out: true }), 'parche producto 1');
    const p2 = patches.find((p) => p.id === 2).body;
    expectEq(JSON.stringify(Object.keys(p2).sort()), JSON.stringify(['price', 'variants']), 'campos producto 2');
    expectEq(p2.price, 19.9, 'precio 19,90');
    expectEq(p2.variants[0].stock, 15, 'stock JAGUAR');
    expectEq(p2.variants[1].isHidden, true, 'CG oculta');
    expectEq(p2.variants[1].photos[0], 'nueva.jpg', 'no pisó la foto nueva');
    const p3 = patches.find((p) => p.id === 3).body;
    expectEq(JSON.stringify(p3.sizes.map((s) => s.stock)), JSON.stringify([2, 5, 5]), 'tallas');
    expectEq(await modified(), 'Filas modificadas: 0', 'contador tras guardar');
    await shot('guardado');
  });

  await step('Un error al guardar marca la fila y conserva el cambio', async () => {
    await cell(0, 'sku').click();
    await page.keyboard.type('DUPLICADO');
    await page.keyboard.press('Enter');
    await page.getByTestId('bulk-save').click();
    await page.getByTestId('bulk-save-errors').waitFor({ timeout: 8000 });
    await expectCell(0, 'sku', 'DUPLICADO', 'cambio conservado');
    const title = await page.locator('tr[data-row="0"] th.bulk-rownum').getAttribute('title');
    if (!/SKU/.test(title ?? '')) throw new Error(`motivo: ${title}`);
    await shot('error-guardar');
  });

  await step('Scroll largo: solo dibuja las filas visibles y navega con Ctrl+Fin', async () => {
    await cell(0, 'name').click();
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(200);
    const last = await page.locator('tr.bulk-row').last().getAttribute('data-row');
    expectEq(last, String(products.length + 2 + 3 - 1), 'última fila');
    const drawn = await page.locator('tr.bulk-row').count();
    if (drawn > 45) throw new Error(`dibujó ${drawn} filas`);
    await shot('final-de-la-grilla');
  });

  if (errors.length) results.push(`❌ errores JS: ${errors.join(' | ')}`);
  console.log(results.join('\n'));
  fs.writeFileSync(path.join(OUT, 'resultados.txt'), results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('❌')) ? 1 : 0);
})();
