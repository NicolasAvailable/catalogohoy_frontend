// E2E: importar productos en SEGUNDO PLANO.
//
// Valida: subir un Excel → confirmar → "Seguir usando la app" cierra el modal
// → aviso flotante con el avance → navegar a Órdenes mientras importa → toast
// al terminar → aviso en Productos con lo que falló → se pidió el correo de
// resumen (send-import-summary) con el id del job.
//
// NO toca la base real: sesión falsa y TODO Supabase (auth, lecturas,
// escrituras, edge functions) se simula con page.route. Una fila (la 5)
// falla a propósito.
//
// Uso: node scripts/e2e-import-background.mjs <baseUrl>
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-import-background';
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const ROWS = 30;
const FAIL_ROW = 5;
const log = (m) => console.log(`[e2e] ${m}`);

// Sesión falsa (todo Supabase está simulado: no toca la base real).
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
const unknown = new Set();

// Excel de prueba (SKUs que no existen → todos "nuevos").
const dir = mkdtempSync(join(tmpdir(), 'import-bg-'));
const xlsxPath = join(dir, 'productos-prueba.xlsx');
const sheet = XLSX.utils.json_to_sheet(
  Array.from({ length: ROWS }, (_, i) => ({
    nombre: `Producto prueba segundo plano ${i + 1}`,
    precio: 10 + i,
    sku: `ZZ-BG-TEST-${i + 1}`,
  }))
);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, 'Productos');
XLSX.writeFile(wb, xlsxPath);

function tableData(table) {
  switch (table) {
    case 'users':
      return [{ id: 1, auth_user_id: UID, name: 'Demo', last_name: '', email: fakeUser.email, phone: null, photo: null }];
    case 'users_tenants':
      return [{ tenant_id: 1, user_id: 1, is_default: true, role: 'owner', tenants: TENANT }];
    case 'tenants':
      return [{
        ...TENANT, created_at: '2026-01-01T00:00:00Z', plan_expired: false,
        plans: { id: 'pro', name: 'Pro', description: '', price: 20, max_products: 0, max_catalogs: 1,
          max_team_members: 3, max_variants: 20, max_addons: 10, max_photos: 10, is_free: false, position: 3 },
      }];
    case 'products':
    case 'categories':
    case 'product_backups':
      return [];
    default:
      return undefined;
  }
}
function rpcData(name) {
  if (name === 'rpc/get_my_team_permissions') {
    return [{ module: '', action: '', is_member: false, is_owner: true }];
  }
  if (name === 'rpc/get_my_profile_with_tenants') {
    return {
      user: { id: 1, name: 'Demo', email: fakeUser.email, phone: null, photo: null },
      tenants: [{ id: 1, name: TENANT.name, slug: TENANT.slug, role: 'owner', is_default: true }],
    };
  }
  if (name === 'rpc/check_slug' || name.includes('slug')) return true;
  return null;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const mocked = [];
let job = null;
let emailedJobId = null;
let productInserts = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-VE' });
  await ctx.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('slug', 'catalogohoy');
  }, ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));

  await page.route(/supabase\.co\/auth\/v1\/|api\.catalogohoy\.com\/auth\/v1\//, (route) => {
    const u = route.request().url();
    if (u.includes('/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeUser) });
  });

  // ── Escrituras simuladas ────────────────────────────────────────────────
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1];
    const method = req.method();
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const reply = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (table === 'product_import_jobs') {
      mocked.push(`${method} ${table}`);
      if (method === 'GET') return reply(job && !job.dismissed_at ? [job] : []);
      const body = req.postDataJSON?.() ?? {};
      const now = new Date().toISOString();
      if (method === 'POST') {
        job = {
          id: '00000000-0000-4000-8000-000000000001', status: 'running', processed: 0,
          success: 0, errors: 0, skipped: 0, failed: [], backgrounded: false,
          created_at: now, updated_at: now, finished_at: null, dismissed_at: null, ...body,
        };
        return reply(wantsObject ? { id: job.id } : [{ id: job.id }], 201);
      }
      if (method === 'PATCH') {
        job = { ...job, ...body, updated_at: now };
        return reply(wantsObject ? job : [job]);
      }
    }
    if (table.startsWith('rpc/')) {
      if (table === 'rpc/create_product_backup') {
        mocked.push(`RPC ${table}`);
        return reply(1);
      }
      unknown.add(table);
      return reply(rpcData(table));
    }
    if (method === 'GET' || method === 'HEAD') {
      const rows = tableData(table, url);
      if (rows === undefined) unknown.add(`GET ${table}`);
      const list = rows ?? [];
      if (wantsObject) {
        return list[0] ? reply(list[0]) : reply({ message: 'no rows', code: 'PGRST116' }, 406);
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': `0-${Math.max(0, list.length - 1)}/${list.length}` },
        body: JSON.stringify(list),
      });
    }

    // Cualquier otra escritura: simulada.
    mocked.push(`${method} ${table}`);
    if (table === 'products' && method === 'POST') {
      productInserts++;
      await new Promise((r) => setTimeout(r, 700)); // que tarde, como en la vida real
      const body = req.postDataJSON?.() ?? {};
      if (String(body.sku) === `ZZ-BG-TEST-${FAIL_ROW}`) {
        return reply({ message: 'Precio inválido (fila de prueba)', code: 'P0001' }, 400);
      }
      const row = { id: 900000 + productInserts, ...body };
      return reply(wantsObject ? row : [row], 201);
    }
    return reply(wantsObject ? {} : [], 201);
  });
  await page.route('**/functions/v1/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/functions/v1/')[1];
    if (name === 'get-credits') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"balance":500,"credits":500}' });
    }
    mocked.push(`FN ${name}`);
    if (name === 'send-import-summary') {
      emailedJobId = route.request().postDataJSON()?.jobId ?? null;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1:has-text("Productos")', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Abrir el hub → Importar → Excel → subir archivo.
  await page.locator('button:has-text("Exportar/Importar"):visible').first().click();
  await page.waitForSelector('text=Exportar / Importar productos', { timeout: 15000 });
  await page.locator('button:has(h3:text-is("Importar")):visible').first().click();
  await page.locator('button:has(h3:has-text("Microsoft Excel")):visible').first().click();
  await page.locator('input[type="file"]').first().setInputFiles(xlsxPath);
  await page.waitForSelector('text=Producto prueba segundo plano 1', { timeout: 20000 });
  log('preview con las filas del Excel ✅');

  await page.locator('ui-button:has-text("Importar") button:visible').last().click();
  await page.locator('button:has-text("Crear respaldo e importar"):visible').click();
  await page.waitForSelector('text=Importando productos...', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/1-progreso-con-boton.png` });
  log('progreso con botón "Seguir usando la app" ✅');

  // Seguir usando la app: el modal se cierra y aparece el aviso flotante.
  await page.locator('button:has-text("Seguir usando la app"):visible').first().click();
  await page.waitForSelector('[role="status"]:has-text("Importando productos")', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/2-aviso-flotante.png` });
  log('modal cerrado + aviso flotante con el avance ✅');

  // Navegar a otra sección mientras importa (navegación SPA del sidebar).
  await page.locator('app-sidebar').getByText('Ordenes', { exact: true }).first().click();
  await page.waitForURL('**/admin/orders**', { timeout: 15000 });
  const pillText = await page.locator('[role="status"]:has-text("Importando productos")').first().textContent();
  log(`en Órdenes, el aviso sigue: "${pillText?.trim().replace(/\s+/g, ' ')}" ✅`);
  await page.screenshot({ path: `${SHOTS}/3-otra-seccion-importando.png` });

  // Termina en segundo plano → toast + aviso "Importación lista".
  await page.waitForSelector('text=La importación terminó', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/4-termino-toast.png` });
  log('toast al terminar ✅');

  if (!job || job.status !== 'done') throw new Error(`job no quedó done: ${job?.status}`);
  if (job.success !== ROWS - 1 || job.errors !== 1) {
    throw new Error(`conteos inesperados: ${job.success} ok / ${job.errors} error`);
  }
  if (!job.backgrounded) throw new Error('job no marcado como backgrounded');
  if (job.failed?.[0]?.name !== `Producto prueba segundo plano ${FAIL_ROW}`) {
    throw new Error(`fila fallida inesperada: ${JSON.stringify(job.failed)}`);
  }
  await page.waitForTimeout(1000);
  if (emailedJobId !== job.id) throw new Error('no se pidió el correo de resumen');
  log(`job: ${job.success} bien, ${job.errors} con error, correo pedido ✅`);

  // Volver a Productos: aviso con lo que falló.
  await page.locator('app-sidebar').getByText('Listado de productos', { exact: true }).first().click();
  await page.waitForSelector('text=Importación terminada con errores', { timeout: 15000 });
  await page.locator('button:has-text("Ver qué falló")').click();
  await page.waitForSelector('text=Precio inválido (fila de prueba)', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/5-aviso-en-productos.png` });
  log('aviso en Productos con el detalle del error ✅');

  // Reabrir desde el aviso flotante → modal con el resultado.
  const pill = page.locator('[role="status"]:has-text("Importación lista")');
  if (await pill.count()) {
    await pill.locator('button:has-text("Ver")').click();
    await page.waitForSelector('text=Importacion completada', { timeout: 10000 });
    await page.screenshot({ path: `${SHOTS}/6-modal-resultado.png` });
    log('reabrir desde el aviso muestra el resultado ✅');
  }

  const unexpected = mocked.filter(
    (m) => !/products|product_import_jobs|create_product_backup|FN /.test(m)
  );
  log(`escrituras simuladas: ${mocked.length} (${[...new Set(mocked)].join(', ')})`);
  if (unexpected.length) log(`⚠️ otras escrituras simuladas: ${[...new Set(unexpected)].join(', ')}`);
  log(`consultas sin datos simulados: ${[...unknown].join(', ')}`);
  log('✅ TEST OK: el import corre en segundo plano y avisa al terminar');
  process.exitCode = 0;
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  await browser.contexts()[0]?.pages()[0]?.screenshot({ path: `${SHOTS}/fallo.png` }).catch(() => undefined);
  log(`consultas sin datos simulados: ${[...unknown].join(', ')}`);
  log(`escrituras simuladas: ${[...new Set(mocked)].join(', ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
