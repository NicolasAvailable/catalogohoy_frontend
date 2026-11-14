// Panel interno → Temas de catálogo + editor de diseño de la tienda leyendo
// los temas de la base (`catalog_themes`). Backend falso en memoria: los temas
// iniciales salen de la semilla de la migración 20261114_catalog_themes.sql.
//
//   npx nx serve internal --port 6200       # panel interno
//   npx nx serve catalogohoy --port 4200    # admin de tiendas (paso final)
//   CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/catalog-themes.e2e.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const INTERNAL = process.env.INTERNAL || 'http://localhost:6200';
const ADMIN = process.env.BASE || 'http://localhost:4200';
const REF = 'yvkurjivijnhliofmfmj';
const results = [];

// ── Semilla → filas en memoria ───────────────────────────────────────────
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261114_catalog_themes.sql'), 'utf8');
const rowRe = /\('([^']+)', '((?:[^']|'')+)', '(#[0-9a-f]+)', '((?:[^']|'')+)'::jsonb, (true|false), (true|false), (\d+)\)/g;
const db = { themes: [] };
for (const m of sql.matchAll(rowRe)) {
  db.themes.push({ id: m[1], name: m[2].replace(/''/g, "'"), color: m[3], look: JSON.parse(m[4].replace(/''/g, "'")), is_premium: m[5] === 'true', is_active: m[6] === 'true', sort_order: Number(m[7]), updated_at: '2026-11-14T00:00:00Z' });
}
// Uso simulado: cuántas tiendas tienen cada tema en design.look.theme.
const USING = { claro: 3, atardecer: 2, jade: 1 };
const adminEmail = (fs.readFileSync(path.join(__dirname, '../../apps/internal/src/app/modules/auth/auth.constants.ts'), 'utf8').match(/'([^']+@[^']+)'/) || [])[1];

async function step(name, fn) {
  try {
    await fn();
    results.push(`✅ ${name}`);
  } catch (e) {
    results.push(`❌ ${name}: ${e.message.split('\n')[0]}`);
  }
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const sorted = () => [...db.themes].sort((a, b) => a.sort_order - b.sort_order);

/** Mock del panel interno: sesión del admin + RPCs de temas. */
async function internalPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (process.env.DEBUG) page.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 200)));
  const user = { id: '00000000-0000-0000-0000-0000000000ad', aud: 'authenticated', role: 'authenticated', email: adminEmail, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const session = { access_token: 'x.eyJzdWIiOiIwIn0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 36000, user };
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  await page.route(/^https:\/\/[^/]*(supabase\.co|api\.catalogohoy\.com|posthog|sentry)/, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const body = JSON.parse(req.postData() || '{}');
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ json: session });
    if (p === '/rest/v1/rpc/list_catalog_themes_admin') return route.fulfill({ json: sorted().map((t) => ({ ...t, stores_using: USING[t.id] ?? 0 })) });
    if (p === '/rest/v1/rpc/save_catalog_theme_admin') {
      const row = { id: body.p_id, name: body.p_name, color: body.p_color, look: body.p_look, is_premium: body.p_is_premium, is_active: body.p_is_active, updated_at: new Date().toISOString() };
      const i = db.themes.findIndex((t) => t.id === body.p_id);
      if (body.p_is_new && i >= 0) return route.fulfill({ status: 400, json: { message: `Ya existe un tema con el id ${body.p_id}` } });
      if (i >= 0) db.themes[i] = { ...db.themes[i], ...row };
      else db.themes.push({ ...row, sort_order: Math.max(...db.themes.map((t) => t.sort_order)) + 1 });
      db.lastSaved = body;
      return route.fulfill({ json: body.p_id });
    }
    if (p === '/rest/v1/rpc/reorder_catalog_themes_admin') {
      body.p_ids.forEach((id, i) => { const t = db.themes.find((x) => x.id === id); if (t) t.sort_order = i; });
      return route.fulfill({ status: 204, body: '' });
    }
    if (p === '/rest/v1/rpc/delete_catalog_theme_admin') {
      db.themes = db.themes.filter((t) => t.id !== body.p_id);
      return route.fulfill({ status: 204, body: '' });
    }
    if (p.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

  // ── 1. Panel interno, escritorio ─────────────────────────────────────────
  const page = await internalPage(browser, { width: 1440, height: 1000 });
  await step('Sidebar muestra "Temas de catálogo" y abre la lista con los 12 temas', async () => {
    await page.goto(`${INTERNAL}/`);
    if (process.env.DEBUG) { await page.waitForTimeout(4000); console.log(page.url()); await shot(page, '00-debug'); }
    await page.getByText('Temas de catálogo', { exact: true }).first().click();
    await page.waitForSelector('.ct-item');
    const n = await page.locator('.ct-item').count();
    if (n !== 12) throw new Error(`esperaba 12 temas, hay ${n}`);
    await page.waitForTimeout(800);
    await shot(page, '01-lista');
  });

  await step('Filtro "Gratis" deja solo Claro', async () => {
    await page.locator('.ct-chip', { hasText: 'Gratis' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ct-item').length === 1);
    const names = await page.locator('.ct-item strong').allTextContents();
    if (names.length !== 1 || names[0].trim() !== 'Claro') throw new Error(names.join(','));
    await page.locator('.ct-chip', { hasText: 'Todos' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ct-item').length > 1);
  });

  await step('Editar "Atardecer": abre el editor con vista previa', async () => {
    await page.locator('.ct-item', { hasText: 'Atardecer' }).getByRole('button', { name: 'Editar' }).last().click();
    await page.waitForSelector('.ct-phone');
    if (!(await page.locator('.ct-seg button.is-active', { hasText: 'Degradado' }).count())) throw new Error('fondo no es degradado');
    await page.waitForTimeout(500);
    await shot(page, '02-editar-atardecer');
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  await step('Crear tema nuevo "Rosa pastel" (degradado, vidrio, Playfair, píldora)', async () => {
    await page.getByRole('button', { name: 'Nuevo tema' }).click();
    await page.getByPlaceholder('Ej. Rosa pastel').fill('Rosa pastel');
    const id = await page.getByPlaceholder('rosa-pastel').inputValue();
    if (id !== 'rosa-pastel') throw new Error(`id = ${id}`);
    await page.locator('.ct-seg button', { hasText: 'Degradado' }).click();
    const fields = (label) => page.locator('.ct-field', { has: page.locator(`span:text-is("${label}")`) }).locator('input.ct-input');
    await fields('Arriba').fill('#f9a8d4');
    await fields('Medio (opcional)').fill('#fbcfe8');
    await fields('Abajo').fill('#fde68a');
    await fields('Color principal').fill('#be185d');
    await fields('Texto').fill('#4a0d2b');
    await fields('Texto secundario').fill('#8a3b63');
    await page.locator('.ct-toggle', { hasText: 'Tarjetas de vidrio' }).click();
    await page.locator('.ct-font', { hasText: 'Playfair Display' }).click();
    await page.locator('.ct-field', { hasText: 'Forma' }).locator('button', { hasText: 'Píldora' }).click();
    await page.locator('.ct-field', { hasText: 'Estilo' }).locator('button', { hasText: 'Suave' }).click();
    await page.waitForTimeout(600);
    await shot(page, '03-nuevo-tema-editor');
    await page.getByRole('button', { name: 'Crear tema' }).click();
    await page.waitForSelector('.ct-item >> text=Rosa pastel');
    const s = db.lastSaved;
    if (!s || !s.p_is_new || s.p_look.bgType !== 'gradient' || s.p_look.font !== 'Playfair Display' || s.p_look.buttonShape !== 'pill' || !s.p_look.glassCards) throw new Error(JSON.stringify(s));
    await page.waitForTimeout(600);
    await shot(page, '04-lista-con-nuevo');
  });

  await step('Avisa contraste bajo (texto claro sobre fondo claro)', async () => {
    await page.locator('.ct-item', { hasText: 'Claro' }).first().getByRole('button', { name: 'Editar' }).last().click();
    await page.locator('.ct-field', { has: page.locator('span:text-is("Texto")') }).locator('input.ct-input').fill('#f1f1f1');
    await page.waitForSelector('.ct-warn');
    await shot(page, '05-aviso-contraste');
    await page.getByRole('button', { name: 'Cancelar' }).click();
  });

  await step('Subir "Rosa pastel" al primer lugar y ocultar "Carbón"', async () => {
    const firstName = async () => (await page.locator('.ct-item strong').first().textContent()).trim();
    for (let i = 0; i < 14 && (await firstName()) !== 'Rosa pastel'; i++) {
      await page.locator('.ct-item', { hasText: 'Rosa pastel' }).getByTitle('Subir').click();
      await page.waitForTimeout(150);
    }
    if (sorted()[0].id !== 'rosa-pastel') throw new Error(`en la base el primero es ${sorted()[0].id}`);
    const first = (await page.locator('.ct-item strong').first().textContent()).trim();
    if (first !== 'Rosa pastel') throw new Error(`primero = ${first}`);
    await page.locator('.ct-item', { hasText: 'Carbón' }).getByTitle('Ocultar del editor').click();
    await page.waitForSelector('.ct-item.is-hidden');
    if (db.themes.find((t) => t.id === 'carbon').is_active) throw new Error('Carbón sigue activo');
    await page.waitForTimeout(400);
    await shot(page, '06-ordenado-y-oculto');
  });

  await step('Duplicar "Jade" y borrar la copia (con confirmación)', async () => {
    await page.locator('.ct-item', { hasText: 'Jade' }).getByTitle('Duplicar').click();
    const id = await page.getByPlaceholder('rosa-pastel').inputValue();
    if (id !== 'jade-copia') throw new Error(`id = ${id}`);
    await page.getByRole('button', { name: 'Crear tema' }).click();
    await page.waitForSelector('.ct-item >> text=Jade copia');
    await page.locator('.ct-item', { hasText: 'Jade copia' }).getByRole('button', { name: 'Editar' }).last().click();
    await page.getByRole('button', { name: 'Borrar tema' }).click();
    await shot(page, '07-confirmar-borrar');
    await page.getByRole('button', { name: 'Sí, borrar' }).click();
    await page.waitForSelector('.ct-item');
    if (await page.locator('.ct-item', { hasText: 'Jade copia' }).count()) throw new Error('no se borró');
  });

  // ── 2. Panel interno, móvil ──────────────────────────────────────────────
  const mobile = await internalPage(browser, { width: 390, height: 844 });
  await step('Móvil: lista y editor se ven bien', async () => {
    await mobile.goto(`${INTERNAL}/catalog-themes`);
    await mobile.waitForSelector('.ct-item');
    await mobile.waitForTimeout(500);
    await shot(mobile, '08-movil-lista');
    await mobile.locator('.ct-item', { hasText: 'Rosa pastel' }).getByRole('button', { name: 'Editar' }).last().click();
    await mobile.waitForSelector('.ct-phone');
    await mobile.evaluate(() => document.querySelector('.ct-phone')?.scrollIntoView());
    await mobile.waitForTimeout(400);
    await shot(mobile, '09-movil-editor');
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error('scroll horizontal en móvil');
  });

  // ── 3. Editor de la tienda: lee los temas de la base ─────────────────────
  if (process.env.SKIP_ADMIN !== '1') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', deviceScaleFactor: 2 });
    const store = await ctx.newPage();
    await setupMock(store, {
      routes: {
        // RLS en prod solo devuelve los activos; el mock hace lo mismo.
        '/rest/v1/catalog_themes': (route) => route.fulfill({ json: sorted().filter((t) => t.is_active) }),
      },
    });
    await step('Editor de la tienda muestra "Rosa pastel" primero y no muestra "Carbón" (oculto)', async () => {
      await store.goto(`${ADMIN}/admin/catalog/edit`);
      await store.getByText('Identidad de la Marca').first().waitFor({ timeout: 90000 });
      await store.getByText('Tema', { exact: true }).locator('visible=true').first().click();
      await store.waitForTimeout(800);
      if (!(await store.locator('.de-tile').count())) await store.getByText('Tema', { exact: true }).locator('visible=true').nth(1).click();
      await store.waitForSelector('.de-tile', { timeout: 15000 });
      const names = (await store.locator('.de-tile:has(.de-theme-aa)').allTextContents()).map((s) => s.replace(/^\s*Aa\s*Comprar\s*/, '').trim());
      if (names[0] !== 'Rosa pastel') throw new Error(`primero = ${names[0]} (${names.join(', ')})`);
      if (names.includes('Carbón')) throw new Error('Carbón aparece');
      await store.locator('.de-tile', { hasText: 'Rosa pastel' }).click();
      await store.waitForTimeout(1200);
      await shot(store, '10-editor-tienda-tema-nuevo');
    });
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(`Capturas en ${OUT}`);
  if (results.some((r) => r.startsWith('❌'))) process.exit(1);
})();
