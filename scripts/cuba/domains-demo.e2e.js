// Video + capturas de "Comprar dominio" (PR #165) contra el dev server local con
// backend falso (mock.js). La edge `domains` y el pago de Stripe se simulan:
// no se compra nada ni se toca producción.
//
// Uso: CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-domains node scripts/cuba/domains-demo.e2e.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const BASE = process.env.BASE || 'http://localhost:4200';
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-domains');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const TENANT = { id: 1, name: 'Tienda Demo', slug: 'catalogohoy' }; // en dev el slug siempre es DEV_TENANT_SLUG
// [renovación, primer año] en centavos, con la fórmula de _shared/domains.ts y costos de Namecheap.
const PRICES = { com: [3199, 2799], net: [3099, 2799], xyz: [3199, 1699], online: [4199, 1699], store: [5199, 1699], shop: [6299, 1699], site: [3899, 1699], co: [5899, 2399] };
const TAKEN = new Set(['catalogohoy.com', 'catalogohoy.co', 'catalogohoy.shop']);
const FAKE_STRIPE = 'https://checkout.stripe.mock/pay';
const results = [];
let n = 0;

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const W = 1280;
  const H = 860;
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    locale: 'es-ES',
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });
  // Cursor visible + subtítulos.
  await ctx.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const dot = document.createElement('div');
      dot.style.cssText = 'position:fixed;z-index:999999;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px';
      document.body.appendChild(dot);
      addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
      const cap = document.createElement('div');
      cap.id = '__caption';
      cap.style.cssText = 'position:fixed;z-index:999998;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(17,24,39,.9);color:#fff;font:600 18px/1.35 system-ui,sans-serif;padding:10px 18px;border-radius:12px;max-width:80%;text-align:center;display:none';
      document.body.appendChild(cap);
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // ── Edge `domains` simulada ───────────────────────────────────────────────
  const state = { owned: [], calls: [] };
  const FLOW = ['registering', 'registered', 'connecting', 'active'];
  const domains = async (route, req) => {
    const body = JSON.parse(req.postData() || '{}');
    state.calls.push(body.action);
    if (body.action === 'status') {
      for (const d of state.owned) {
        const i = FLOW.indexOf(d.status);
        if (i >= 0 && i < FLOW.length - 1) d.status = FLOW[i + 1];
        if (d.status === 'active' && !d.activatedAt) {
          d.activatedAt = new Date().toISOString();
          const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
          d.expiresAt = exp.toISOString();
        }
      }
      return route.fulfill({ json: { success: true, domains: state.owned } });
    }
    if (body.action === 'search') {
      const label = String(body.query).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').split('.')[0];
      const results = Object.entries(PRICES).map(([tld, [cents, first]]) => {
        const domain = `${label}.${tld}`;
        const taken = TAKEN.has(domain);
        return { domain, tld, available: !taken, sellable: !taken, reason: taken ? 'taken' : null, priceCents: taken ? null : cents, firstYearPriceCents: taken ? null : first };
      });
      await new Promise((r) => setTimeout(r, 1600)); // para que se vea el esqueleto
      return route.fulfill({ json: { success: true, query: label, results } });
    }
    if (body.action === 'checkout') {
      state.pending = { domain: body.domain, returnUrl: body.returnUrl, successUrl: body.successUrl, priceCents: PRICES[body.domain.split('.').slice(1).join('.')][0], firstCents: PRICES[body.domain.split('.').slice(1).join('.')][1] };
      return route.fulfill({ json: { success: true, url: FAKE_STRIPE } });
    }
    if (body.action === 'cancel') {
      state.owned.forEach((d) => { if (d.id === body.id) d.autoRenew = false; });
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ status: 400, json: { success: false, error: 'Acción inválida' } });
  };
  // Tienda de ejemplo + configuración del catálogo (lo mínimo para Editar catálogo).
  const storeRoutes = () => ({
    '/functions/v1/domains': domains,
    '/rest/v1/users_tenants': (route) => route.fulfill({ json: [{ tenant_id: 1, is_default: true, role: 'owner', tenants: TENANT }] }),
    '/rest/v1/tenants': (route, req, url, db, single) => {
      const row = { ...TENANT, plan: 'pro', country_code: 'VE', custom_domain: null, slug_change_limit: 2, whatsapp_notify_numbers_limit: 1 };
      return route.fulfill({ json: single ? row : [row] });
    },
    '/rest/v1/rpc/get_my_profile_with_tenants': (route) => route.fulfill({ json: { user: { id: 1, name: 'Demo', email: 'demo@catalogohoy.com' }, tenants: [{ ...TENANT, role: 'owner', is_default: true }] } }),
    '/rest/v1/rpc/get_my_tenant': (route) => route.fulfill({ json: [TENANT] }),
    '/rest/v1/tenant_ecommerce_config': (route, req, url, db, single) => {
      const row = { tenant_id: 1, currency: 'USD', template: 'default', description: 'Calzado para toda la familia' };
      return route.fulfill({ json: single ? row : [row] });
    },
  });
  await setupMock(page, { routes: storeRoutes() });
  // Página de pago simulada (en producción es el checkout real de Stripe).
  await page.route(/^https:\/\/checkout\.stripe\.mock\//, (route) => {
    const p = state.pending;
    const okUrl = p.successUrl || p.returnUrl;
    const back = `${okUrl}${okUrl.includes('?') ? '&' : '?'}domain_session=cs_mock`;
    state.owned = [{ id: 'd1', domain: p.domain, status: 'registering', priceCents: p.priceCents, autoRenew: true, expiresAt: null, activatedAt: null, createdAt: new Date().toISOString() }];
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body style="font-family:system-ui;background:#f6f9fc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="background:#fff;padding:36px 40px;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.08);width:380px">
          <div style="color:#888;font-size:13px;margin-bottom:6px">PAGO SIMULADO (en la app real es Stripe)</div>
          <div style="font-size:15px;color:#333">Dominio ${p.domain}</div>
          <div style="font-size:34px;font-weight:700;margin:6px 0 4px">$${(p.firstCents / 100).toFixed(2)}</div>
          <div style="color:#888;font-size:13px;margin-bottom:22px">el primer año · luego $${(p.priceCents / 100).toFixed(2)} al año</div>
          <a id="pay" href="${back}" style="display:block;text-align:center;background:#635bff;color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:600">Pagar</a>
        </div></body></html>`,
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const caption = async (text, ms = 2300) => {
    await page.evaluate((t) => {
      const c = document.getElementById('__caption');
      if (!c) return;
      c.textContent = t;
      c.style.display = t ? 'block' : 'none';
    }, text).catch(() => {});
    if (ms) await page.waitForTimeout(ms);
  };
  const pause = (ms = 700) => page.waitForTimeout(ms);
  const moveTo = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
  };
  const clickOn = async (loc) => { await moveTo(loc); await pause(250); await loc.click(); };
  const shot = async (name) => { n++; await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`) }); };
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); console.error(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n')[0]}`); console.error(`❌ ${name}: ${e.message}`); await shot('fallo'); }
  };
  // Entrar como lo hace el usuario: menú → Mi catálogo → Editar.
  const openEditor = async (pg) => {
    await pg.goto(`${BASE}/admin`);
    await pg.waitForLoadState('networkidle');
    const link = pg.getByText('Editar', { exact: true }).first();
    if (pg === page) await clickOn(link); else await link.click();
    await pg.waitForLoadState('networkidle');
  };
  const TITLE = '¿Te gustaría tener un dominio personalizado?';
  const card = () => page.locator('ui-card').filter({ has: page.getByText(TITLE) });
  const toCard = async (pg = page) => {
    await pg.getByText(TITLE).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    await pg.waitForTimeout(900);
  };

  // ── 1. Editar catálogo → tarjeta al final con sugerencias ────────────────
  await step('Editar catálogo muestra la tarjeta con dominios sugeridos', async () => {
    await openEditor(page);
    await caption('Editar catálogo: al final aparece una tarjeta nueva', 1500);
    await toCard();
    await page.getByTestId('domain-results').waitFor({ timeout: 15000 });
    await pause(400);
    await toCard();
    await caption('Sugiere dominios con el nombre del catálogo: precio del 1er año y de la renovación', 3400);
    await shot('sugerencias-editar-catalogo');
    if (!(await page.getByText('catalogohoy.net').isVisible())) throw new Error('no aparece catalogohoy.net');
    if (!(await page.getByText('No disponible').first().isVisible())) throw new Error('no marca los tomados');
  });

  // ── 2. Buscar otro nombre ────────────────────────────────────────────────
  await step('Buscar otro nombre', async () => {
    await caption('El .com ya está tomado. Busquemos otro nombre…', 2000);
    const input = page.getByTestId('domain-search-input');
    await clickOn(input);
    await input.fill('');
    await input.pressSequentially('lunazapatos', { delay: 120 });
    await caption('No hace falta darle a Buscar: a los 2 segundos busca solo', 0);
    await page.getByTestId('domain-skeleton').waitFor({ timeout: 6000 });
    await pause(300);
    await shot('esqueleto-buscando');
    await page.getByText('lunazapatos.com').waitFor({ timeout: 8000 });
    await pause(500);
    await caption('lunazapatos.com: $27.99 el primer año, luego $31.99 al año', 2800);
    await shot('busqueda-lunazapatos');
  });

  // ── 3. Comprar → pago → vuelve a la app ──────────────────────────────────
  await step('Comprar y pagar', async () => {
    const row = page.locator('li', { hasText: 'lunazapatos.com' });
    await clickOn(row.getByRole('button', { name: 'Comprar' }));
    await page.waitForURL(/checkout\.stripe\.mock/, { timeout: 8000 });
    await caption('Paga con tarjeta (en la app real es el checkout de Stripe)', 2400);
    await shot('pago');
    await clickOn(page.locator('#pay'));
    await page.waitForURL(/plans\/domain-success/, { timeout: 15000 });
  });

  // ── 4. Registrando → conectando → activo (automático) ────────────────────
  await step('Se registra y conecta solo', async () => {
    await page.waitForLoadState('networkidle');
    const success = page.getByTestId('domain-success');
    await success.getByText('lunazapatos.com').waitFor({ timeout: 15000 });
    await caption('Al volver del pago: ¡el dominio es tuyo!', 2200);
    await shot('exito');
    // A los 5 s lleva solo a Editar catálogo, con la tarjeta del dominio a la vista.
    await page.waitForURL(/admin\/catalog\/edit/, { timeout: 15000 });
    await page.getByTestId('domain-owned').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await caption('Te lleva a Editar catálogo: el dominio se sincroniza solo', 2400);
    await shot('editar-registrando');
    await page.getByText('Conectando con tu catálogo…').waitFor({ timeout: 30000 });
    await caption('Configurando DNS y conectando con el catálogo…', 1800);
    await shot('editar-conectando');
    await page.getByText('Activo: tu catálogo ya abre en este dominio.').waitFor({ timeout: 30000 });
    await caption('¡Listo! El catálogo ya abre en lunazapatos.com', 3000);
    await shot('editar-activo');
  });

  // ── 5. Perfil → Dominio ──────────────────────────────────────────────────
  await step('Perfil → pestaña Dominio', async () => {
    await page.goto(`${BASE}/admin/profile?tab=domain`);
    await page.getByTestId('domain-owned').waitFor({ timeout: 15000 });
    await caption('También se ve y se administra en Perfil → Dominio', 2600);
    await shot('perfil-dominio');
    await clickOn(page.getByText('Cancelar renovación'));
    await caption('Desde aquí puede cancelar la renovación cuando quiera', 2600);
    await shot('perfil-cancelar');
    await caption('', 0);
  });

  // Captura móvil de la tarjeta.
  await step('Vista móvil', async () => {
    const m = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, locale: 'es-ES' });
    const mp = await m.newPage();
    state.owned = [];
    await setupMock(mp, { routes: storeRoutes() });
    await openEditor(mp);
    await mp.setViewportSize({ width: 390, height: 844 });
    await mp.waitForTimeout(800);
    await mp.getByText(TITLE).waitFor({ timeout: 15000 });
    await toCard(mp);
    await mp.getByTestId('domain-results').waitFor({ timeout: 20000 });
    await toCard(mp);
    await mp.waitForTimeout(500);
    n++;
    await mp.screenshot({ path: path.join(OUT, `${String(n).padStart(2, '0')}-movil.png`) });
    await m.close();
  });

  const video = page.video();
  await ctx.close();
  await browser.close();
  fs.renameSync(await video.path(), path.join(OUT, 'comprar-dominio-demo.webm'));
  console.log(results.join('\n'));
  if (errors.length) console.log('Errores de página:', [...new Set(errors)].slice(0, 5).join(' | '));
  console.log('Llamadas a domains:', state.calls.join(', '));
})();
