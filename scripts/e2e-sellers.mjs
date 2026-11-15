// E2E: Vendedores con comisión (CAT-87).
//
// Flujo con la cuenta demo (tienda catalogohoy, plan Avanzado):
//   1. Admin → Vendedores: vacío → "Agregar vendedor" → aparece en la lista con su link.
//   2. Cliente (sin sesión) entra por /v/<slug>: franja "Te atiende …", la URL queda
//      en la portada, el checkout muestra "Realizar pedido (<vendedor>)" y la orden
//      se crea con seller_id + % copiado por la DB.
//   3. Se agrega una venta manual con el vendedor (como el selector de la orden
//      manual) y ambas se completan → el reporte muestra ventas, comisión y
//      "Por pagar" → "Marcar pagada" lo pasa a "Pagado". Excel descargado.
//   4. Orden manual: aparece la tarjeta "Vendedor".
//   5. Móvil: Vendedores + catálogo con la franja.
//   Limpieza: borra las órdenes y el vendedor de prueba.
//
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-sellers.mjs [baseUrl] [shotsDir]
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.argv[3] ?? '/tmp/e2e-sellers';
const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const TENANT_ID = 6;
const SELLER_NAME = 'Juan Prueba';
const SELLER_SLUG = `juan-prueba-${Date.now().toString(36).slice(-4)}`;
const log = (m) => console.log(`[e2e] ${m}`);
const fail = (m) => {
  throw new Error(`❌ ${m}`);
};

const session = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
}).then((r) => r.json());
if (!session.access_token) fail('login falló');
const auth = { apikey: APIKEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
const rest = (path, init = {}) =>
  fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...auth, Prefer: 'return=representation', ...(init.headers ?? {}) } }).then(
    async (r) => {
      const body = await r.text();
      if (!r.ok) fail(`${init.method ?? 'GET'} ${path}: ${r.status} ${body}`);
      return body ? JSON.parse(body) : null;
    }
  );

const created = { orders: [], sellerId: null };
const browser = await chromium.launch();
try {
  // ── 1) Admin escritorio ────────────────────────────────────────────────
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', acceptDownloads: true });
  await admin.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await admin.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/admin/sellers`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1:has-text("Vendedores")').waitFor({ timeout: 40000 });
  await page.locator('[data-testid="seller-add"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, '01-vendedores-inicio.png') });
  log(`límite visible: ${await page.locator('[data-testid="seller-limit"]').innerText()}`);

  await page.locator('[data-testid="seller-add"] button').click();
  const form = page.locator('[data-testid="seller-form"]');
  await form.waitFor({ timeout: 10000 });
  await form.locator('[data-testid="seller-name"] input').fill(SELLER_NAME);
  await form.locator('[data-testid="seller-slug"] input').fill(SELLER_SLUG);
  await form.locator('[data-testid="seller-whatsapp"] input').fill('+58 412 0000000');
  const pct = form.locator('[data-testid="seller-pct"] input');
  await pct.fill('');
  await pct.type('10');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, '02-agregar-vendedor.png') });
  await form.locator('[data-testid="seller-save"] button').click();
  await page.locator(`[data-testid="seller-row"]:has-text("${SELLER_NAME}")`).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, '03-vendedor-creado.png') });
  const [seller] = await rest(`sellers?tenant_id=eq.${TENANT_ID}&slug=eq.${SELLER_SLUG}&select=id,commission_pct,whatsapp`);
  if (!seller) fail('el vendedor no quedó en la DB');
  created.sellerId = seller.id;
  log(`vendedor creado ${seller.id} (${seller.commission_pct}%) ✅`);

  // ── 2) Cliente entra por el link del vendedor ─────────────────────────
  const customer = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const cpage = await customer.newPage();
  cpage.on('pageerror', (e) => log(`pageerror cliente: ${e.message}`));
  await cpage.route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: 'wa' }));
  await cpage.route('https://api.whatsapp.com/**', (r) => r.fulfill({ status: 200, body: 'wa' }));
  await cpage.goto(`${BASE}/v/${SELLER_SLUG}`, { waitUntil: 'domcontentloaded' });
  const bar = cpage.locator('[data-testid="seller-bar"]');
  await cpage.locator('button:has-text("Agregar")').first().waitFor({ timeout: 30000 });
  await cpage.waitForTimeout(2500);
  if (new URL(cpage.url()).pathname !== '/') fail(`la URL no volvió a la portada: ${cpage.url()}`);
  if (await bar.count()) fail('la franja no debe salir en el catálogo (solo en el checkout)');
  await cpage.screenshot({ path: join(SHOTS, '04-catalogo-por-link.png') });
  log('catálogo normal por el link + URL en portada ✅');

  // Recarga sin el link: la atribución sigue (localStorage) y se ve en el checkout.
  await cpage.reload({ waitUntil: 'domcontentloaded' });
  await cpage.locator('button:has-text("Agregar")').first().waitFor({ timeout: 30000 });

  await cpage.locator('button:has-text("Agregar")').first().click();
  try {
    await cpage.locator('.product-detail-modal button:has-text("Agregar")').first().click({ timeout: 3000 });
  } catch {
    /* quick-add */
  }
  await cpage.waitForTimeout(1000);
  await cpage.locator('button:has-text("arrito")').first().click();
  await cpage.locator('.cart-drawer__checkout-btn').click();
  const submit = cpage.locator('.checkout__submit').first();
  await submit.waitFor({ timeout: 20000 });
  await bar.waitFor({ timeout: 15000 });
  if (!(await bar.innerText()).includes(SELLER_NAME)) fail('la franja del checkout no muestra al vendedor');
  log('checkout: "Te atiende" + atribución persistente tras recargar ✅');
  const label = await submit.innerText();
  if (!label.includes(SELLER_NAME)) fail(`el botón no va al vendedor: "${label}"`);
  if ((await cpage.locator('.checkout__submit').count()) !== 1) fail('hay más de un botón de WhatsApp');
  await cpage.locator('input[placeholder="Tu nombre"]').fill('Cliente E2E vendedores');
  await cpage.locator('input[placeholder="4121234567"]').fill('4120000000');
  // Si el catálogo exige elegir envío / pago, se toma la primera opción.
  // Envío y método de pago usan las mismas filas `.checkout__ship`: se elige
  // la primera de cada tarjeta (y la opción "contado" si hay selector de crédito).
  const cards = cpage.locator('section.checkout__card');
  for (let i = 0; i < (await cards.count()); i++) {
    const opt = cards.nth(i).locator('button.checkout__ship').first();
    if (await opt.count()) await opt.click().catch(() => {});
    await cpage.waitForTimeout(200);
  }
  await cpage.waitForTimeout(500);
  await cpage.screenshot({ path: join(SHOTS, '05-checkout-pedido-al-vendedor.png'), fullPage: true });
  if (!(await submit.isEnabled())) {
    const missing = await cpage.locator('.checkout__missing').innerText().catch(() => '');
    fail(`no se pudo enviar el pedido (${missing})`);
  }
  const popup = customer.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await submit.click();
  const wa = await popup;
  const waUrl = wa?.url() ?? '';
  log(`WhatsApp abierto: ${waUrl.slice(0, 60)}`);
  if (waUrl && !waUrl.includes('584120000000')) fail('el pedido no se envió al WhatsApp del vendedor');
  await cpage.waitForTimeout(2000);

  const [order] = await rest(
    `orders?tenant_id=eq.${TENANT_ID}&seller_id=eq.${seller.id}&select=id,total_usd,shipping_fee,seller_commission_pct,source&order=id.desc&limit=1`
  );
  if (!order) fail('la orden del catálogo no quedó atribuida al vendedor');
  created.orders.push(order.id);
  if (Number(order.seller_commission_pct) !== 10) fail(`% esperado 10, quedó ${order.seller_commission_pct}`);
  log(`orden #${order.id} atribuida con 10% ✅`);

  // ── 3) Venta manual con el vendedor + completar ────────────────────────
  const [manual] = await rest('orders', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID, name: 'Venta manual E2E', products: [], total_usd: 50, total_bs: 0,
      shipping_fee: 0, status: 'pending', source: 'manual', seller_id: seller.id,
      seller_commission_pct: 99, // el cliente no puede forzar el %: la DB pone el del vendedor
    }),
  });
  created.orders.push(manual.id);
  if (Number(manual.seller_commission_pct) !== 10) fail('la DB no reemplazó el % enviado');
  // La orden del catálogo pasa a "manual" antes de completarla para no mandar
  // el aviso de "pedido completado" por WhatsApp al número de prueba.
  await rest(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ source: 'manual' }) });
  await rest(`orders?id=in.(${order.id},${manual.id})`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
  const expectedBase = Number(order.total_usd) - Number(order.shipping_fee || 0) + 50;
  const expectedCommission = Math.round(expectedBase * 10) / 100;
  log(`esperado: ventas ${expectedBase.toFixed(2)}, comisión ${expectedCommission.toFixed(2)}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const row = page.locator(`[data-testid="seller-row"]:has-text("${SELLER_NAME}")`);
  await row.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  const rowText = await row.innerText();
  const fmt = (n) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!rowText.includes(fmt(expectedCommission))) fail(`la comisión no cuadra: ${rowText}`);
  await row.locator('[data-testid="seller-orders"] button').click();
  await row.locator('[data-testid="seller-order-list"] table').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, '06-reporte-por-pagar.png'), fullPage: true });
  log('reporte con comisión por pagar ✅');

  await row.locator('[data-testid="seller-pay"] button').click();
  await page.locator('text=Comisión marcada como pagada').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const paidRows = await rest(`orders?id=in.(${order.id},${manual.id})&select=seller_commission_paid_at`);
  if (paidRows.some((o) => !o.seller_commission_paid_at)) fail('no quedaron marcadas como pagadas');
  await page.screenshot({ path: join(SHOTS, '07-reporte-pagado.png'), fullPage: true });
  log('marcar pagada ✅');

  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('[data-testid="seller-excel"] button').click();
  const file = await dl;
  const xlsxPath = join(SHOTS, file.suggestedFilename());
  await file.saveAs(xlsxPath);
  const wb = XLSX.read(readFileSync(xlsxPath));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Comisiones']);
  const xr = rows.find((r) => r.Vendedor === SELLER_NAME);
  if (!xr) fail('el Excel no trae al vendedor');
  log(`Excel ${file.suggestedFilename()}: ${JSON.stringify(xr)} ✅`);

  // ── 4) Orden manual: tarjeta "Vendedor" ────────────────────────────────
  await page.goto(`${BASE}/admin/orders/create`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('[data-testid="order-seller"]');
  await card.waitFor({ timeout: 30000 });
  await card.scrollIntoViewIfNeeded();
  await card.locator('.p-select').click();
  await page.locator(`.p-select-option:has-text("${SELLER_NAME}")`).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, '08-orden-manual-vendedor.png') });
  await page.keyboard.press('Escape');
  log('selector de vendedor en la orden manual ✅');

  // ── 5) Móvil ───────────────────────────────────────────────────────────
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  await mobile.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const m = await mobile.newPage();
  await m.goto(`${BASE}/admin/sellers`, { waitUntil: 'domcontentloaded' });
  await m.locator(`[data-testid="seller-row"]:has-text("${SELLER_NAME}")`).waitFor({ timeout: 40000 });
  await m.waitForTimeout(1200);
  await m.screenshot({ path: join(SHOTS, '09-movil-vendedores.png'), fullPage: true });
  const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const mcp = await mc.newPage();
  await mcp.goto(`${BASE}/v/${SELLER_SLUG}`, { waitUntil: 'domcontentloaded' });
  await mcp.locator('button:has-text("Agregar")').first().waitFor({ timeout: 30000 });
  await mcp.waitForTimeout(1500);
  await mcp.screenshot({ path: join(SHOTS, '10-movil-catalogo.png') });
  await mcp.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
  await mcp.locator('[data-testid="seller-bar"]').waitFor({ timeout: 30000 });
  await mcp.waitForTimeout(1200);
  await mcp.screenshot({ path: join(SHOTS, '11-movil-checkout.png') });
  log('móvil ✅');

  // Link inválido: catálogo normal, sin franja.
  const other = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await other.newPage();
  await op.goto(`${BASE}/v/no-existe-xyz`, { waitUntil: 'domcontentloaded' });
  await op.locator('button:has-text("Agregar")').first().waitFor({ timeout: 30000 });
  await op.waitForTimeout(1500);
  if (await op.locator('[data-testid="seller-bar"]').count()) fail('un link inválido mostró la franja');
  log('link inválido → catálogo normal sin vendedor ✅');

  log('TODO OK ✅');
} finally {
  await browser.close();
  for (const id of created.orders) await rest(`orders?id=eq.${id}`, { method: 'DELETE' }).catch((e) => log(`limpieza orden: ${e.message}`));
  if (created.sellerId) await rest(`sellers?id=eq.${created.sellerId}`, { method: 'DELETE' }).catch((e) => log(`limpieza vendedor: ${e.message}`));
  log('limpieza hecha');
}
