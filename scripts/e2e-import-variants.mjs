// E2E: importar VARIANTES, tallas y adicionales desde Excel (CAT-116).
//
// Valida: plantilla con ejemplos + hoja "Como llenar" → subir un Excel con
// variantes/tallas/adicionales → el preview muestra "N variantes · N
// adicionales" → importar → lo que se ESCRIBE en la base:
//   · producto existente: variantes reemplazadas, pero la que ya existía
//     conserva su id y sus FOTOS; la que no está en el Excel se quita; el
//     adicional existente conserva su foto.
//   · producto nuevo: se crea con variantes y adicionales.
//   · talla única → producto con tallas.
//   · más variantes que las del plan → esa fila falla con un mensaje claro.
//
// NO toca la base real: sesión falsa y TODO Supabase se simula con page.route
// (las escrituras se capturan y se validan).
//
// Uso: node scripts/e2e-import-variants.mjs <baseUrl>   (MOBILE=1 → iPhone)
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-import-variants';
const MOBILE = !!process.env.MOBILE;
const P = MOBILE ? 'movil-' : '';
mkdirSync(SHOTS, { recursive: true });
const log = (m) => console.log(`[e2e] ${m}`);
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

// ── Sesión falsa ──────────────────────────────────────────────────────────
const UID = '11111111-1111-4111-8111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const fakeUser = {
  id: UID, aud: 'authenticated', role: 'authenticated', email: 'demo@example.com',
  email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' },
  user_metadata: { name: 'Demo' }, created_at: '2026-01-01T00:00:00Z',
};
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, exp, role: 'authenticated', aud: 'authenticated', email: fakeUser.email })}.sig`,
  token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'fake-refresh', user: fakeUser,
};
const TENANT = { id: 1, name: 'Tienda Demo', slug: 'catalogohoy' };
const MAX_VARIANTS = 20;

// Producto que YA existe, con fotos en sus variantes y en su adicional.
const EXISTING = {
  id: 500, name: 'Franela Demo', sku: 'FRA-001', price: 15, stock: null,
  is_variant: true, is_sized: false, sizes: [],
  variants: [
    { id: 'v-roja', name: 'Roja', price: 15, originalPrice: 0, sku: 'FRA-R', photos: ['https://cdn.catalogohoy.com/test/roja.jpg'], stock: null, sizes: [{ name: 'S', stock: 5, sku: 'FRA-R-S' }, { name: 'M', stock: 3, sku: null }], isHidden: false },
    { id: 'v-azul', name: 'Azul', price: 15, originalPrice: 0, sku: null, photos: ['https://cdn.catalogohoy.com/test/azul.jpg'], stock: 10, sizes: [], isHidden: false },
  ],
  addons: [{ id: 'a-tarjeta', name: 'Tarjeta', price: 0, photo: 'https://cdn.catalogohoy.com/test/tarjeta.jpg', isDefault: false }],
};

// ── Excel de prueba ───────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'import-variants-'));
const xlsxPath = join(dir, 'productos-con-variantes.xlsx');
const many = Array.from({ length: MAX_VARIANTS + 5 }, (_, i) => `Modelo ${i + 1}: ${10 + i}`).join(' | ');
const sheet = XLSX.utils.json_to_sheet([
  { nombre: 'Franela Demo', precio: 15, sku: 'FRA-001', categorias: '',
    variantes: 'Roja: 16 (antes 18) [tallas: S: 2, M: 0, L: 4] | Verde: 15 (stock 7)',
    adicionales: 'Tarjeta: 1 (por defecto) | Envoltorio: 2', tallas: '' },
  { nombre: 'Casco Integral X', precio: 120, sku: 'CAS-NEW',
    variantes: 'Negro mate: 120 (sku CAS-N) | Rojo: 125 (stock 3)',
    adicionales: 'Visor oscuro: 15' },
  { nombre: 'Gorra Única', precio: 8, sku: 'GOR-NEW', tallas: 'Única: 20' },
  { nombre: 'Producto simple', precio: 3, sku: 'SIM-NEW' },
  { nombre: 'Muchas variantes', precio: 10, sku: 'MUC-NEW', variantes: many },
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, 'Productos');
XLSX.writeFile(wb, xlsxPath);

function tableData(table, url) {
  const select = url.searchParams.get('select') ?? '';
  switch (table) {
    case 'users':
      return [{ id: 1, auth_user_id: UID, name: 'Demo', last_name: '', email: fakeUser.email, phone: null, photo: null }];
    case 'users_tenants':
      return [{ tenant_id: 1, user_id: 1, is_default: true, role: 'owner', tenants: TENANT }];
    case 'tenants':
      return [{
        ...TENANT, created_at: '2026-01-01T00:00:00Z', plan_expired: false,
        plans: { id: 'pro', name: 'Pro', description: '', price: 20, max_products: 0, max_catalogs: 1,
          max_team_members: 3, max_variants: MAX_VARIANTS, max_addons: 10, max_photos: 10, is_free: false, position: 3 },
      }];
    case 'products': {
      // Solo las consultas del import ven el producto existente.
      const sku = url.searchParams.get('sku');
      const id = url.searchParams.get('id');
      if (select === 'sku,name' || select === 'sku, name') return [EXISTING];
      if (select === 'id' && sku) return sku === `eq.${EXISTING.sku}` ? [{ id: EXISTING.id }] : [];
      if (select.startsWith('id') && url.searchParams.get('name')) return [];
      if (select.includes('variants') && id === `eq.${EXISTING.id}`) return [EXISTING];
      return [];
    }
    case 'categories':
    case 'product_backups':
      return [];
    default:
      return undefined;
  }
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const writes = [];
let job = null;
try {
  const ctx = await browser.newContext(
    MOBILE
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-VE', acceptDownloads: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-VE', acceptDownloads: true }
  );
  await ctx.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('slug', 'catalogohoy');
  }, ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

  await page.route(/supabase\.co\/auth\/v1\/|api\.catalogohoy\.com\/auth\/v1\//, (route) => {
    const u = route.request().url();
    const body = u.includes('/token') ? session : fakeUser;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1];
    const method = req.method();
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const reply = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (table === 'product_import_jobs') {
      if (method === 'GET') return reply(job && !job.dismissed_at ? [job] : []);
      const body = req.postDataJSON?.() ?? {};
      const now = new Date().toISOString();
      if (method === 'POST') {
        job = { id: '00000000-0000-4000-8000-000000000002', status: 'running', processed: 0, success: 0, errors: 0,
          skipped: 0, failed: [], backgrounded: false, created_at: now, updated_at: now, finished_at: null, dismissed_at: null, ...body };
        return reply(wantsObject ? { id: job.id } : [{ id: job.id }], 201);
      }
      job = { ...job, ...body, updated_at: now };
      return reply(wantsObject ? job : [job]);
    }
    if (table.startsWith('rpc/')) {
      if (table === 'rpc/create_product_backup') return reply(1);
      if (table === 'rpc/get_my_team_permissions') return reply([{ module: '', action: '', is_member: false, is_owner: true }]);
      return reply(null);
    }
    if (method === 'GET' || method === 'HEAD') {
      const list = tableData(table, url) ?? [];
      if (wantsObject) {
        return list[0] ? reply(list[0]) : reply({ message: 'no rows', code: 'PGRST116' }, 406);
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${Math.max(0, list.length - 1)}/${list.length}` },
        body: JSON.stringify(list),
      });
    }
    const body = req.postDataJSON?.() ?? null;
    writes.push({ method, table, query: url.search, body });
    if (table === 'products' && method === 'POST') {
      const row = { id: 900000 + writes.length, ...body };
      return reply(wantsObject ? row : [row], 201);
    }
    return reply(wantsObject ? {} : [], 201);
  });
  await page.route('**/functions/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"balance":500,"credits":500}' })
  );

  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Productos")', { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.locator('button:has-text("Exportar/Importar"):visible').first().click();
  await page.waitForSelector('text=Exportar / Importar productos', { timeout: 15000 });
  await page.locator('button:has(h3:text-is("Importar")):visible').first().click();
  await page.locator('button:has(h3:has-text("Microsoft Excel")):visible').first().click();
  await page.waitForSelector('text=También puedes subir variantes', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/${P}1-subir-con-aviso.png` });
  log('pantalla de subir con el aviso de variantes ✅');

  // Plantilla: ejemplos + hoja de ayuda.
  if (!MOBILE) {
    const dl = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('button:has-text("Descargar plantilla"):visible').click();
    const download = await dl;
    const tpl = join(dir, download.suggestedFilename());
    await download.saveAs(tpl);
    const twb = XLSX.read(readFileSync(tpl), { type: 'buffer' });
    assert(twb.SheetNames.join(',') === 'Plantilla,Como llenar', `hojas: ${twb.SheetNames}`);
    const trows = XLSX.utils.sheet_to_json(twb.Sheets.Plantilla);
    assert(trows.some((r) => String(r.variantes ?? '').includes('[tallas:')), 'la plantilla no trae ejemplo de variantes');
    assert(trows.some((r) => String(r.adicionales ?? '').includes('(por defecto)')), 'la plantilla no trae ejemplo de adicionales');
    log('plantilla con ejemplos y hoja "Como llenar" ✅');
  }

  await page.locator('input[type="file"]').first().setInputFiles(xlsxPath);
  await page.waitForSelector('text=Casco Integral X', { timeout: 20000 });
  await page.waitForSelector('text=2 variantes · 2 adicionales', { timeout: 5000 });
  await page.waitForSelector('text=1 talla', { timeout: 5000 });
  await page.waitForSelector('text=Se actualizará', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${P}2-preview.png` });
  log('preview con el resumen de variantes/tallas/adicionales ✅');

  await page.locator('ui-button:has-text("Importar") button:visible').last().click();
  await page.locator('button:has-text("Crear respaldo e importar"):visible').click();
  await page.waitForSelector('text=Importacion completada', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/${P}3-resultado.png`, fullPage: false });
  const bodyText = await page.locator('body').textContent();
  assert(/tu plan permite hasta 20 por producto/i.test(bodyText ?? ''), 'no se ve el error de límite de variantes');
  log('resultado: la fila con 25 variantes falla con el límite del plan ✅');

  // ── Validar lo escrito ──────────────────────────────────────────────────
  const patch = writes.find((w) => w.table === 'products' && w.method === 'PATCH' && w.query.includes(`id=eq.${EXISTING.id}`) && w.body?.variants);
  assert(patch, 'no se actualizó el producto existente con variantes');
  const vs = patch.body.variants;
  assert(vs.map((v) => v.name).join(',') === 'Roja,Verde', `variantes: ${vs.map((v) => v.name)}`);
  const roja = vs[0];
  assert(roja.id === 'v-roja', 'Roja perdió su id');
  assert(roja.photos[0] === EXISTING.variants[0].photos[0], 'Roja perdió su foto');
  assert(roja.price === 16 && roja.originalPrice === 18, 'precio de Roja');
  assert(JSON.stringify(roja.sizes) === JSON.stringify([{ name: 'S', stock: 2, sku: 'FRA-R-S' }, { name: 'M', stock: 0, sku: null }, { name: 'L', stock: 4, sku: null }]), `tallas Roja: ${JSON.stringify(roja.sizes)}`);
  assert(roja.sku === 'FRA-R', 'Roja perdió su SKU');
  assert(vs[1].stock === 7 && vs[1].photos.length === 0 && vs[1].id !== 'v-azul', 'Verde');
  assert(patch.body.is_variant === true, 'is_variant');
  const addons = patch.body.addons;
  assert(addons[0].id === 'a-tarjeta' && addons[0].photo === EXISTING.addons[0].photo && addons[0].price === 1 && addons[0].isDefault === true, `Tarjeta: ${JSON.stringify(addons[0])}`);
  assert(addons[1].name === 'Envoltorio' && addons[1].price === 2, 'Envoltorio');
  log('existente: Roja conserva id/foto/SKU, Azul se quitó, Verde nueva, Tarjeta conserva foto ✅');

  const inserts = writes.filter((w) => w.table === 'products' && w.method === 'POST').map((w) => w.body);
  const casco = inserts.find((b) => b.name === 'Casco Integral X');
  assert(casco?.is_variant && casco.variants.length === 2, 'Casco sin variantes');
  assert(casco.variants[0].sku === 'CAS-N' && casco.variants[1].stock === 3 && casco.variants[1].price === 125, `Casco variantes: ${JSON.stringify(casco.variants)}`);
  assert(casco.addons[0].name === 'Visor oscuro' && casco.addons[0].price === 15, 'Casco adicional');
  const gorra = inserts.find((b) => b.name === 'Gorra Única');
  assert(gorra?.is_sized && gorra.sizes[0].name === 'Única' && gorra.sizes[0].stock === 20 && gorra.stock === null, 'Gorra con talla');
  const simple = inserts.find((b) => b.name === 'Producto simple');
  assert(simple && !simple.is_variant && !simple.is_sized && simple.variants.length === 0, 'simple');
  assert(!inserts.find((b) => b.name === 'Muchas variantes'), 'se creó el de 25 variantes');
  log('nuevos: Casco con 2 variantes + adicional, Gorra con talla, simple sin cambios ✅');

  log('✅ TEST OK: el Excel importa variantes, tallas y adicionales');
  process.exitCode = 0;
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: `${SHOTS}/${P}fallo.png` }).catch(() => undefined);
  log(`escrituras: ${writes.map((w) => `${w.method} ${w.table}${w.query}`).join(' | ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
