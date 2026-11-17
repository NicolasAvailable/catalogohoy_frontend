// E2E: "Ocultar productos agotados" en Editar catálogo → Productos.
//
// Flujo con la cuenta demo (tienda catalogohoy, tenant 6):
//   1. Se marca un producto como agotado (is_sold_out) → el catálogo público
//      lo muestra con la etiqueta "Agotado".
//   2. Editar catálogo → Productos: se activa "Ocultar productos agotados" y se
//      guarda → customer_fields.hideSoldOut = true en la DB.
//   3. Catálogo público: el producto ya no aparece.
//   4. Móvil: editor y catálogo.
//   Limpieza: se desactiva el toggle desde el editor y se devuelve el producto.
//
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-hide-sold-out.mjs [baseUrl] [shotsDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.argv[3] ?? '/tmp/e2e-hide-sold-out';
const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const TENANT_ID = 6;
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
const hideFlag = async () =>
  (await rest(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}&select=customer_fields`))[0]?.customer_fields?.hideSoldOut ?? false;

// Producto de prueba: el primero del catálogo (sin tallas, con stock).
const [prod] = await rest(
  `products?tenant_id=eq.${TENANT_ID}&is_hidden=eq.false&is_sized=eq.false&is_sold_out=eq.false&or=(stock.is.null,stock.gt.0)&order=position.asc,id.asc&limit=1&select=id,name`
);
if (!prod) fail('no hay producto para la prueba');
const startFlag = await hideFlag();
log(`producto de prueba: #${prod.id} "${prod.name}" · hideSoldOut al inicio: ${startFlag}`);
if (startFlag) fail('la tienda demo ya tenía el toggle activo; apágalo antes de correr la prueba');

const browser = await chromium.launch();
const cardOf = (page) => page.locator('.product-card', { hasText: prod.name }).first();

async function toggleInEditor(page, shotName) {
  await page.goto(`${BASE}/admin/catalog/edit?seccion=productos`, { waitUntil: 'domcontentloaded' });
  const group = page.locator('[data-testid="de-hide-sold-out"]');
  await group.waitFor({ timeout: 40000 });
  await group.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await group.locator('p-toggleswitch, .p-toggleswitch').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, shotName) });
  await page.locator('.de-save-top button').first().click();
  await page.waitForTimeout(3000);
}

try {
  await rest(`products?id=eq.${prod.id}`, { method: 'PATCH', body: JSON.stringify({ is_sold_out: true }) });

  // ── 1) Catálogo público: aparece con "Agotado" ───────────────────────
  const pub = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const cpage = await pub.newPage();
  cpage.on('pageerror', (e) => log(`pageerror: ${e.message}`));
  await cpage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await cardOf(cpage).waitFor({ timeout: 40000 });
  await cardOf(cpage).scrollIntoViewIfNeeded();
  if (!(await cardOf(cpage).locator('text=Agotado').count())) fail('la tarjeta no muestra "Agotado"');
  await cpage.waitForTimeout(1000);
  await cpage.screenshot({ path: join(SHOTS, '01-catalogo-antes-con-agotado.png') });
  log('✓ antes: el producto sale con "Agotado"');

  // ── 2) Editor → Productos: activar y guardar ──────────────────────────
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  await admin.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await admin.newPage();
  page.on('pageerror', (e) => log(`pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  await toggleInEditor(page, '02-editor-productos-activado.png');
  if (!(await hideFlag())) fail('hideSoldOut no quedó en true después de guardar');
  await page.screenshot({ path: join(SHOTS, '03-editor-guardado.png') });
  log('✓ guardado: hideSoldOut = true');

  // ── 3) Catálogo público: ya no aparece ───────────────────────────────
  const pub2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
  const c2 = await pub2.newPage();
  await c2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await c2.locator('.product-card').first().waitFor({ timeout: 40000 });
  await c2.waitForTimeout(2500);
  if (await cardOf(c2).count()) fail('el producto agotado sigue apareciendo');
  await c2.screenshot({ path: join(SHOTS, '04-catalogo-despues-oculto.png') });
  log('✓ después: el producto agotado ya no aparece');

  // ── 4) Móvil ─────────────────────────────────────────────────────────
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  await mob.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const m = await mob.newPage();
  await m.goto(`${BASE}/admin/catalog/edit?seccion=productos`, { waitUntil: 'domcontentloaded' });
  const mg = m.locator('[data-testid="de-hide-sold-out"]');
  await mg.waitFor({ timeout: 40000 });
  await mg.scrollIntoViewIfNeeded();
  await m.waitForTimeout(1500);
  await m.screenshot({ path: join(SHOTS, '05-movil-editor.png') });
  const mc = await mob.newPage();
  await mc.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await mc.locator('.product-card').first().waitFor({ timeout: 40000 });
  await mc.waitForTimeout(2000);
  if (await cardOf(mc).count()) fail('móvil: el producto agotado sigue apareciendo');
  await mc.screenshot({ path: join(SHOTS, '06-movil-catalogo.png') });
  log('✓ móvil OK');

  // ── Limpieza: apagar desde el editor ─────────────────────────────────
  await toggleInEditor(page, '07-editor-desactivado.png');
  if (await hideFlag()) fail('no se pudo apagar desde el editor');
  log('✓ apagado otra vez desde el editor');
  log('TODO OK');
} finally {
  await rest(`products?id=eq.${prod.id}`, { method: 'PATCH', body: JSON.stringify({ is_sold_out: false }) }).catch((e) => log(`limpieza producto: ${e.message}`));
  // Si algo falló a mitad, deja el toggle como estaba (apagado).
  try {
    const [cfg] = await rest(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}&select=customer_fields`);
    if (cfg?.customer_fields?.hideSoldOut) {
      await rest(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ customer_fields: { ...cfg.customer_fields, hideSoldOut: false } }),
      });
    }
  } catch (e) {
    log(`limpieza toggle: ${e.message}`);
  }
  await browser.close();
}
