// Productos en teléfono (CAT-133): cada fila muestra solo lápiz y ⋯;
// ocultar/mostrar y compartir viven dentro del ⋯. En computadora no cambia.
// Usa productos reales de la cuenta demo (tenant 1997) leídos de prod en solo
// lectura a un JSON: PRODUCTS_JSON=/ruta/demo-products.json
// Además pone el plan en periodo de gracia para ver el aviso "Tienes N días".
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4200';
const results = [];
const step = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const demo = process.env.PRODUCTS_JSON ? JSON.parse(fs.readFileSync(process.env.PRODUCTS_JSON, 'utf8')) : [];
const base = { tenant_id: 1, description: '', production_cost: null, is_wholesale: false, wholesale_tiers: [], is_sized: false, sizes: [], is_variant: false, variants: [], addons: [], product_categories: [], created_at: '2026-11-14T00:00:00Z' };
const PRODUCTS = demo.map((p) => ({ ...base, ...p, tenant_id: 1 }));

const PLANS = [{ id: 'basico', name: 'Básico', description: '', price: 11.99, max_products: 500, max_catalogs: 1, is_free: false, position: 1 }];
const tenantRow = { id: 1, name: 'AutoRepuestos Rodriguez (demo)', slug: 'catalogohoy', country_code: 'VE', plan_id: 'basico', plans: PLANS[0], plan_expires_at: new Date(Date.now() - 0.2 * 86400000).toISOString(), plan_expired: true };

async function run(browser, viewport, tag) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', hasTouch: viewport.width < 640, isMobile: viewport.width < 640 });
  const page = await ctx.newPage();
  const patches = [];
  await setupMock(page, {
    routes: {
      '/rest/v1/users_tenants': (route, req, url, db, single) => { const r = { tenant_id: 1, is_default: true, role: 'owner', tenants: tenantRow }; return route.fulfill({ json: single ? r : [r] }); },
      '/rest/v1/rpc/get_my_profile_with_tenants': (route) => route.fulfill({ json: { user: { id: 6475, name: 'Demo', email: 'demo@catalogohoy.com' }, tenants: [{ ...tenantRow, role: 'owner', is_default: true }] } }),
      '/rest/v1/plans': (route) => route.fulfill({ json: PLANS }),
      '/rest/v1/tenants': (route, req, url, db, single) => route.fulfill({ json: single ? tenantRow : [tenantRow] }),
      '/rest/v1/products': (route, req, url) => {
        if (req.method() === 'PATCH') {
          const body = JSON.parse(req.postData() || '{}');
          const id = Number((url.searchParams.get('id') || '').replace('eq.', ''));
          patches.push({ id, body });
          const p = PRODUCTS.find((x) => x.id === id);
          if (p) Object.assign(p, body);
          return route.fulfill({ json: p ? [p] : [] });
        }
        const sel = url.searchParams.get('select') || '';
        if (req.method() === 'HEAD' || sel === 'id') return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${PRODUCTS.length}`, 'access-control-expose-headers': 'content-range' }, json: [] });
        return route.fulfill({ json: PRODUCTS, headers: { 'content-range': `0-${PRODUCTS.length - 1}/${PRODUCTS.length}`, 'access-control-expose-headers': 'content-range' } });
      },
    },
  });
  await page.goto(`${BASE}/admin/products?slug=catalogohoy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, `${tag}-1-lista.png`) });
  return { ctx, page, patches };
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  // --- Teléfono ---
  const { ctx, page, patches } = await run(browser, { width: 390, height: 844 }, 'movil');
  const row = page.locator('div.flex.sm\\:hidden').filter({ hasText: 'BUJIA PLATINO FIESTA' }).first();
  const btns = row.locator('ui-button');
  const n = await btns.count();
  step('En teléfono cada fila tiene solo 2 botones (lápiz y ⋯)', n === 2, `${n} botones`);
  const nameBox = await row.locator('h2').boundingBox();
  step('El nombre tiene más espacio', !!nameBox && nameBox.width > 150, nameBox ? `${Math.round(nameBox.width)}px de ancho` : '');
  const banner = await page.getByText(/Tienes/).first().isVisible().catch(() => false);
  const vos = await page.getByText(/Tenés/).count();
  step('Aviso de plan vencido dice "Tienes" (no "Tenés")', banner && vos === 0);

  await btns.nth(1).click();
  await page.waitForTimeout(600);
  const menuText = await page.locator('.p-menu, .p-popover, [role="menu"]').filter({ visible: true }).first().innerText().catch(() => '');
  step('El ⋯ trae Ocultar y Compartir', /Ocultar/.test(menuText) && /Compartir/.test(menuText), menuText.replace(/\n+/g, ' · '));
  step('El ⋯ sigue trayendo Duplicar y Eliminar', /Duplicar/.test(menuText) && /Eliminar/.test(menuText));
  await page.screenshot({ path: path.join(OUT, 'movil-2-menu.png') });

  await page.getByRole('button', { name: 'Ocultar' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1500);
  const hid = patches.find((p) => p.id === 17840 && p.body.is_hidden === true);
  step('Ocultar desde el ⋯ oculta el producto', !!hid, JSON.stringify(patches));
  await page.screenshot({ path: path.join(OUT, 'movil-3-oculto.png') });

  // El producto oculto ofrece "Mostrar"
  const hiddenRow = page.locator('div.flex.sm\\:hidden').filter({ hasText: 'BUJIA DOBLE PUNTA' }).first();
  await hiddenRow.scrollIntoViewIfNeeded();
  await hiddenRow.locator('ui-button').nth(1).click();
  await page.waitForTimeout(600);
  const menu2 = await page.locator('.p-menu, .p-popover, [role="menu"]').filter({ visible: true }).first().innerText().catch(() => '');
  step('Un producto oculto ofrece "Mostrar"', /Mostrar/.test(menu2), menu2.replace(/\n+/g, ' · '));
  await page.screenshot({ path: path.join(OUT, 'movil-4-mostrar.png') });
  await page.getByRole('button', { name: 'Compartir' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'movil-5-compartir.png') });
  await ctx.close();

  // --- Computadora: sin cambios (4 botones) ---
  const d = await run(browser, { width: 1400, height: 900 }, 'escritorio');
  const drow = d.page.locator('section.hidden.sm\\:flex').filter({ hasText: 'BUJIA PLATINO FIESTA' }).first();
  const dn = await drow.locator('ui-button').count();
  step('En computadora siguen los 4 botones', dn === 4, `${dn} botones`);
  await d.ctx.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'resultados.txt'), results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`).join('\n'));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
