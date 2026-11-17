// E2E: buscar clientes por cédula/RIF en "Crear orden" (tienda de Venezuela).
//
// 1. Editar catálogo → Envío → Datos del cliente: activa "Cédula / RIF".
// 2. Catálogo público → checkout: aparece el campo Cédula / RIF.
// 3. Se guarda una orden con cédula (mismo insert que hace el checkout) → el
//    trigger la copia a la ficha del cliente.
// 4. Crear orden → el buscador encuentra al cliente por cédula en varios
//    formatos (completa, con puntos y V-, trozo de 4 dígitos, minúscula).
// 5. Limpia: borra la orden y el cliente de prueba.
//
// Requiere el dev server con DEV_TENANT_SLUG = la tienda VE de prueba
// (catalogohoy-demo, tenant 1992, de la cuenta de Nicolas).
// Uso: SHOTS_DIR=... node scripts/e2e-cedula-search.mjs http://localhost:4274
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-cedula';
mkdirSync(SHOTS, { recursive: true });
const TENANT_ID = 1992;
const NAME = 'Prueba Cédula E2E';
const PHONE = '+58 4120009871';
const CEDULA = 'V-30.123.456';

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[e2e] ${m}`);

async function login() {
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nicaso3006@gmail.com', password: 'nicolas' }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error('login fallo');
  return session;
}

const rest = (session) => async (path, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: APIKEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

const browser = await chromium.launch();
const session = await login();
const api = rest(session);
let orderId = null;
const results = [];
try {
  // ── 1. Admin: activar Cédula / RIF ─────────────────────────────────────
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await admin.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token',
    JSON.stringify(session),
  ]);
  const pa = await admin.newPage();
  await pa.goto(`${BASE}/admin/catalog/edit`, { waitUntil: 'domcontentloaded' });
  await pa.locator('button:has-text("Envío")').first().click({ timeout: 40000 });
  const row = pa.locator('.customer-field-row:has-text("Cédula / RIF")');
  await row.waitFor({ timeout: 20000 });
  await row.scrollIntoViewIfNeeded();
  await pa.screenshot({ path: `${SHOTS}/01-editor-cedula-apagada.png` });
  await row.locator('ui-toggle').first().click();
  await pa.waitForTimeout(400);
  await pa.screenshot({ path: `${SHOTS}/02-editor-cedula-activa.png` });
  await pa.locator('button:has-text("Guardar cambios")').first().click();
  await pa.waitForTimeout(3000);
  const [cfg] = await api(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}&select=customer_fields`);
  log(`customer_fields.document = ${JSON.stringify(cfg.customer_fields.document)}`);
  if (!cfg.customer_fields.document?.visible) throw new Error('no se guardó document.visible');
  results.push('editor guarda Cédula/RIF: OK');

  // ── 2. Checkout público: aparece el campo ──────────────────────────────
  for (const [label, vp] of [['escritorio', { width: 1280, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const cust = await browser.newContext({ viewport: vp });
    const pc = await cust.newPage();
    await pc.goto(BASE, { waitUntil: 'domcontentloaded' });
    await pc.waitForSelector('text=Agregar', { timeout: 40000 });
    await pc.locator('button:has-text("Agregar")').first().click();
    try { await pc.locator('.product-detail-modal button:has-text("Agregar")').first().click({ timeout: 3000 }); } catch { /* quick add */ }
    await pc.waitForTimeout(1000);
    await pc.locator('button:has-text("arrito")').first().click();
    await pc.locator('.cart-drawer__checkout-btn').click();
    const field = pc.locator('.checkout__field:has-text("Cédula / RIF")');
    await field.waitFor({ timeout: 20000 });
    await field.locator('input').fill(CEDULA);
    await field.scrollIntoViewIfNeeded();
    await pc.screenshot({ path: `${SHOTS}/03-checkout-campo-${label}.png` });
    await cust.close();
  }
  results.push('checkout muestra Cédula/RIF (escritorio y móvil): OK');

  // ── 3. Orden con cédula (mismo insert del checkout) ────────────────────
  const [order] = await api('orders', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: TENANT_ID, name: NAME, phone: PHONE, nit: CEDULA,
      products: [], total_usd: 0, total_bs: 0, comments: 'Prueba e2e cédula (se borra)',
      status: 'pending', source: 'manual',
    }),
  });
  orderId = order.id;
  const [cust] = await api(`customers?tenant_id=eq.${TENANT_ID}&phone=eq.${encodeURIComponent(PHONE)}&select=id,document`);
  log(`cliente creado por trigger: ${JSON.stringify(cust)}`);
  if (cust?.document !== CEDULA) throw new Error('el trigger no copió la cédula');
  results.push('la cédula del pedido queda en la ficha del cliente: OK');

  // ── 4. Crear orden: buscar por cédula ──────────────────────────────────
  const queries = ['30123456', 'V-30.123.456', '30.123', '3012', 'v30123456', 'Prueba Cédula'];
  for (const [label, vp] of [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
      'sb-yvkurjivijnhliofmfmj-auth-token',
      JSON.stringify(session),
    ]);
    const po = await ctx.newPage();
    await po.goto(`${BASE}/admin/orders/create`, { waitUntil: 'domcontentloaded' });
    const input = po.locator('#customerSearch');
    await input.waitFor({ timeout: 40000 });
    const qs = label === 'escritorio' ? queries : ['30.123'];
    for (const [i, q] of qs.entries()) {
      await input.fill('');
      await input.fill(q);
      const hit = po.locator(`[data-testid="customer-results"] button:has-text("${NAME}")`);
      let ok = true;
      try { await hit.first().waitFor({ timeout: 8000 }); } catch { ok = false; }
      results.push(`buscar "${q}" (${label}): ${ok ? 'OK' : 'NO ENCONTRÓ'}`);
      await po.screenshot({ path: `${SHOTS}/04-buscar-${label}-${i + 1}.png` });
      if (!ok) throw new Error(`no encontró con "${q}"`);
    }
    if (label === 'escritorio') {
      await po.locator(`[data-testid="customer-results"] button:has-text("${NAME}")`).first().click();
      await po.waitForTimeout(500);
      await po.screenshot({ path: `${SHOTS}/05-cliente-elegido.png` });
    }
    await ctx.close();
  }
  log('✅ TEST OK');
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  process.exitCode = 1;
} finally {
  for (const r of results) log(r);
  // ── 5. Limpieza ────────────────────────────────────────────────────────
  try {
    if (orderId) await api(`orders?id=eq.${orderId}`, { method: 'DELETE' });
    await api(`customers?tenant_id=eq.${TENANT_ID}&phone=eq.${encodeURIComponent(PHONE)}`, { method: 'DELETE' });
    log('limpieza: orden y cliente de prueba borrados');
  } catch (e) {
    log(`limpieza falló: ${e.message}`);
  }
  await browser.close();
}
