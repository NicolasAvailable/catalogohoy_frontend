// Video demo de "Edición masiva" (CAT-76) con una cuenta REAL, contra la app local.
// Lee los productos reales; el GUARDADO se simula (no escribe nada en la base).
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/demo-bulk-edit-video.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const OUT = process.argv[3] ?? '/tmp/demo-bulk-edit';
const { E2E_EMAIL, E2E_PASSWORD, MOCK, CHROME_PATH } = process.env;
if (!MOCK && (!E2E_EMAIL || !E2E_PASSWORD)) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(OUT, { recursive: true });
const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[demo] ${m}`);

// MOCK=1: ensayo sin cuenta real (backend falso de scripts/cuba/mock.js).
const res = MOCK ? null : await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
});
const session = MOCK ? null : await res.json();
if (!MOCK && !session.access_token) throw new Error('login falló');

const W = 1440;
const H = 900;
const browser = await chromium.launch({
  headless: !process.env.HEADED,
  ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  locale: 'es-ES',
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
if (!MOCK) {
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session),
  ]);
}
// Cursor visible + subtítulos en el video.
await ctx.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:999999;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:width .1s,height .1s';
    document.body.appendChild(dot);
    addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { dot.style.width = dot.style.height = '12px'; }, true);
    addEventListener('mouseup', () => { dot.style.width = dot.style.height = '18px'; }, true);
    const cap = document.createElement('div');
    cap.id = '__caption';
    cap.style.cssText = 'position:fixed;z-index:999998;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(17,24,39,.88);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:10px 18px;border-radius:12px;max-width:80%;text-align:center;display:none';
    document.body.appendChild(cap);
  });
});

// El guardado NO toca producción: se responde como si se hubiera guardado.
const saved = [];
await ctx.route(`${SUPA}/rest/v1/products*`, async (route) => {
  const req = route.request();
  if (req.method() === 'PATCH') {
    const id = new URL(req.url()).searchParams.get('id');
    saved.push({ id, body: JSON.parse(req.postData()) });
    return route.fulfill({ status: 200, json: [] });
  }
  return route.continue();
});
await ctx.route(`${SUPA}/rest/v1/rpc/log_activity*`, (route) => route.fulfill({ json: null }));

const page = await ctx.newPage();
if (MOCK) {
  const { createRequire } = await import('node:module');
  const { setupMock } = createRequire(import.meta.url)('./cuba/mock.js');
  const prods = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1, name: `Producto de prueba ${i + 1}`, description: '', price: 10 + i, price_promotional: null,
    auth_user_id: 'u', photos: [], stock: 5 + i, sku: `SKU-${i + 1}`, production_cost: null,
    product_categories: [], created_at: '2026-01-01', position: i, is_hidden: false, is_sold_out: false,
    is_sized: false, sizes: [], is_variant: false, variants: [], addons: [], is_wholesale: false, wholesale_tiers: [],
  }));
  await setupMock(page, {
    routes: {
      '/rest/v1/products': (route, req) =>
        req.method() === 'PATCH' ? route.fulfill({ json: [] }) : route.fulfill({ json: prods }),
    },
  });
}
const caption = async (text, ms = 2200) => {
  await page.evaluate((t) => {
    const c = document.getElementById('__caption');
    if (!c) return;
    c.textContent = t;
    c.style.display = t ? 'block' : 'none';
  }, text);
  if (ms) await page.waitForTimeout(ms);
};
const pause = (ms = 700) => page.waitForTimeout(ms);
const center = async (loc) => {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const moveTo = async (loc) => {
  const p = await center(loc);
  await page.mouse.move(p.x, p.y, { steps: 18 });
  return p;
};
const clickOn = async (loc) => {
  await moveTo(loc);
  await pause(200);
  await page.mouse.down();
  await page.mouse.up();
};
const typeSlow = (t) => page.keyboard.type(t, { delay: 140 });
const cell = (r, col) => page.locator(`tr[data-row="${r}"] td[data-col="${col}"]`);
const editable = async (r, col) => {
  const c = cell(r, col);
  if (!(await c.count())) return false;
  const cls = (await c.getAttribute('class')) ?? '';
  return !cls.includes('bulk-cell--na') && !cls.includes('bulk-cell--readonly');
};
/** Primera fila >= from donde la columna se puede editar. */
const findRow = async (col, from = 0) => {
  for (let r = from; r < from + 40; r++) if (await editable(r, col)) return r;
  throw new Error(`sin fila editable para ${col}`);
};

log('abriendo productos');
await page.goto(`${BASE}/admin/products`);
await page.getByTestId('open-bulk-edit').waitFor({ timeout: 60000 });
await pause(1500);
await caption('En Productos hay un botón nuevo: "Edición masiva"');
await moveTo(page.getByTestId('open-bulk-edit'));
await pause(900);
await clickOn(page.getByTestId('open-bulk-edit'));
await cell(0, 'name').waitFor({ timeout: 60000 });
await pause(1200);
await caption('Todos los productos, con sus variantes y tallas, en una tabla tipo Excel', 3200);

// 1. Escribir en una celda
const rPrice = await findRow('price');
await caption('Clic en una celda y escribes: el cambio queda marcado en amarillo');
await clickOn(cell(rPrice, 'price'));
const oldPrice = (await cell(rPrice, 'price').innerText()).trim();
const newPrice = String(Math.round((Number(oldPrice) || 10) * 1.1 * 100) / 100);
await pause(400);
await typeSlow(newPrice);
await pause(500);
await page.keyboard.press('Enter');
await pause(1200);
await caption('Arriba se cuentan las "Filas modificadas"', 2200);

// 2. Moverse con el teclado
await caption('Te mueves con las flechas, Tab y Enter, como en Excel');
for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
  await page.keyboard.press(k);
  await pause(380);
}

// 3. Copiar una celda y pegarla en varias
const rStock = await findRow('stock', rPrice);
await caption('Copias una celda (Ctrl+C), seleccionas varias y pegas (Ctrl+V)');
await clickOn(cell(rStock, 'stock'));
await pause(400);
await page.keyboard.press('ControlOrMeta+C');
await pause(700);
const rStock2 = await findRow('stock', rStock + 1);
await clickOn(cell(rStock2, 'stock'));
await page.keyboard.down('Shift');
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await pause(300); }
await page.keyboard.up('Shift');
await pause(600);
await page.keyboard.press('ControlOrMeta+V');
await pause(1800);

// 4. Rellenar arrastrando
const rCost = await findRow('productionCost', rStock2 + 1);
await caption('Arrastras el cuadrito azul para rellenar hacia abajo');
await clickOn(cell(rCost, 'productionCost'));
await typeSlow('5');
await page.keyboard.press('Enter');
await pause(300);
await clickOn(cell(rCost, 'productionCost'));
const handle = cell(rCost, 'productionCost').getByTestId('bulk-fill-handle');
await handle.waitFor();
const hp = await moveTo(handle);
await pause(400);
await page.mouse.down();
const target = await center(cell(rCost + 4, 'productionCost'));
await page.mouse.move(hp.x, target.y, { steps: 30 });
await pause(500);
await page.mouse.up();
await pause(1800);

// 5. Seleccionar arrastrando + Ctrl+D
const rSku = await findRow('sku', rCost);
await caption('También seleccionas arrastrando el mouse y rellenas con Ctrl+D');
const a = await moveTo(cell(rSku, 'price'));
await page.mouse.down();
const b = await center(cell(rSku + 3, 'price'));
await page.mouse.move(b.x, b.y, { steps: 25 });
await page.mouse.up();
await pause(700);
await page.keyboard.press('ControlOrMeta+D');
await pause(1500);
await caption('¿Te equivocaste? Ctrl+Z deshace');
await page.keyboard.press('ControlOrMeta+Z');
await pause(1600);
void a;

// 6. Interruptores
const rVis = await findRow('visible', rSku + 4);
await caption('Ocultas o muestras productos y variantes con un clic');
await clickOn(cell(rVis, 'visible').locator('.bulk-toggle'));
await pause(1500);

// 7. Validación
await caption('Si escribes algo inválido, la celda se pone en rojo y no te deja guardar');
await clickOn(cell(rPrice + 1 <= rVis ? (await findRow('price', rPrice + 1)) : rPrice, 'price'));
await typeSlow('abc');
await page.keyboard.press('Enter');
await pause(1500);
await page.keyboard.press('ArrowUp');
await typeSlow('12');
await page.keyboard.press('Enter');
await pause(1200);

// 8. Buscar y ver solo lo modificado
await caption('Puedes buscar por nombre, variante o SKU');
const search = page.getByTestId('bulk-search');
await clickOn(search);
const firstName = (await cell(rPrice, 'name').innerText()).trim().split(/\s+/)[0] ?? '';
await typeSlow(firstName.slice(0, 6));
await pause(1800);
await search.fill('');
await pause(600);
await caption('Y ver solo las filas que modificaste antes de guardar');
await clickOn(page.getByText('Solo filas modificadas'));
await pause(2500);

// 9. Guardar
await caption('Guardar cambios guarda todo de una vez (en este video el guardado es simulado)');
await clickOn(page.getByTestId('bulk-save'));
await pause(3000);
await caption('Listo ✅', 2000);
await caption('', 500);

log(`guardado simulado: ${saved.length} productos`);
const video = page.video();
await ctx.close();
await browser.close();
const src = await video.path();
const dest = join(OUT, 'edicion-masiva-demo.webm');
renameSync(src, dest);
log(`video: ${dest}`);
log(readdirSync(OUT).join(', '));
