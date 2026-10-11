// E2E: el botón "Realizar pedido" del checkout se activa EN VIVO cuando el
// dueño agrega su vendedor de WhatsApp — sin que el cliente recargue.
//
// Flujo (2 navegadores):
//   A (cliente):  catálogo → agrega producto → checkout (sin vendedores).
//   B (admin):    Editar catálogo → Pagos → agrega vendedor → Guardar.
//   A: SIN recargar, el botón con el nombre del vendedor aparece solo.
//
// Requiere: el tenant target SIN whatsapp_buttons al inicio (el runner los
// respalda/limpia/restaura por SQL). Credenciales: cuenta de prueba nicaso3006.
//
// Uso: node scripts/e2e-checkout-live-seller.mjs <baseUrl> [adminBaseUrl]
//   local: node ... http://localhost:4271
//   prod:  node ... https://catalogohoy-demo.catalogohoy.com
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4271';
const ADMIN_BASE = process.argv[3] ?? BASE;
const SELLER_NAME = 'Vendedor Test';
const SELLER_PHONE = '4121234567';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-live-seller';

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';

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

const log = (m) => console.log(`[e2e] ${m}`);

const browser = await chromium.launch();
try {
  // ── Contexto A: cliente ──────────────────────────────────────────────
  const customer = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await customer.newPage();
  await pageA.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector('text=Agregar', { timeout: 30000 });
  log('A: catálogo cargado');

  // Agregar el primer producto simple al carrito.
  await pageA.locator('button:has-text("Agregar")').first().click();
  // Si abre el modal (producto con variantes), agregar desde ahí.
  const modalAdd = pageA.locator('.product-detail-modal button:has-text("Agregar")').first();
  try { await modalAdd.click({ timeout: 3000 }); } catch { /* quick-add directo */ }
  await pageA.waitForTimeout(1000);

  // Abrir carrito → checkout.
  await pageA.locator('button:has-text("arrito")').first().click();
  await pageA.locator('.cart-drawer__checkout-btn').click();
  await pageA.waitForSelector('.checkout__submit', { timeout: 20000 });
  log('A: en el checkout');

  const before = await pageA.locator('.checkout__submit').allTextContents();
  log(`A: botones ANTES: ${JSON.stringify(before)}`);
  if (before.some((t) => t.includes(SELLER_NAME))) {
    throw new Error('el vendedor de prueba ya estaba configurado — estado sucio');
  }
  await pageA.screenshot({ path: `${SHOTS}/1-checkout-sin-vendedor.png`, fullPage: false });

  // ── Contexto B: admin ────────────────────────────────────────────────
  const session = await login();
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await admin.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    'sb-yvkurjivijnhliofmfmj-auth-token',
    JSON.stringify(session),
  ]);
  const pageB = await admin.newPage();
  // OJO: el bootstrap limpia query params no permitidos (?tab= se pierde en
  // carga directa) → entrar al editor y clickear el tab Pagos como un humano.
  await pageB.goto(`${ADMIN_BASE}/admin/catalog/edit`, { waitUntil: 'domcontentloaded' });
  await pageB.locator('button:has-text("Pagos")').first().click({ timeout: 30000 });
  await pageB.waitForSelector('#whatsapp-sellers:visible', { timeout: 15000 });
  log('B: editor de catálogo (Pagos) cargado');

  // Agregar vendedor: nombre + teléfono.
  await pageB.locator('#whatsapp-sellers button:has-text("Agregar vendedor")').click();
  const row = pageB.locator('#whatsapp-sellers .whatsapp-button-item').last();
  await row.locator('input[placeholder*="Nombre"]').fill(SELLER_NAME);
  await row.locator('.ui-phone__input').fill(SELLER_PHONE);
  await pageB.screenshot({ path: `${SHOTS}/2-admin-vendedor-cargado.png` });

  // Guardar cambios (botón global del editor).
  await pageB.locator('button:has-text("Guardar cambios")').first().click();
  log('B: guardado disparado');
  await pageB.waitForTimeout(2500);
  await pageB.screenshot({ path: `${SHOTS}/3-admin-guardado.png` });

  // ── Contexto A: SIN recargar, el botón del vendedor debe aparecer ────
  const t0 = Date.now();
  await pageA
    .locator(`.checkout__submit:has-text("${SELLER_NAME}")`)
    .waitFor({ timeout: 15000 });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const after = await pageA.locator('.checkout__submit').allTextContents();
  await pageA.screenshot({ path: `${SHOTS}/4-checkout-vendedor-activo.png` });
  log(`A: botones DESPUÉS (${elapsed}s tras guardar): ${JSON.stringify(after)}`);
  log('✅ TEST OK: el botón del vendedor apareció EN VIVO, sin recargar');
  process.exitCode = 0;
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
