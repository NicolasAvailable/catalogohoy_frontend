// E2E: editor de catálogo en PLAN GRATIS con opciones premium (tema/fuente).
//
// Bug: en plan gratis, elegir un tema premium (ej. "Carbón") y guardar abría el
// aviso premium; luego "Ver planes" → "Cambios sin guardar" → "Guardar y salir"
// no guardaba NADA (ni los cambios gratis). Fix: se quitan las opciones premium
// nuevas, la vista previa vuelve al diseño guardado y se guarda todo lo demás.
//
// La tienda demo (tenant 6) está en plan pago: el plan gratis se simula
// reescribiendo con page.route la respuesta de `tenants?select=plans:plan_id(...)`
// (la que usa PlanService.getTenantPlan) → is_free=true, name "Gratis".
//
// ⚠️ Tenant 6 es la tienda real de Nicolas: se guarda una copia de
// tenants.name + tenant_ecommerce_config.{design,description,theme_color} y se
// restaura EXACTA al final (también si algo falla).
//
// Escenarios (escritorio 1440x900 y móvil 390x844):
//   a) nombre + tema Carbón + fuente premium → Guardar → aviso con "Temas" y
//      "Tus demás cambios sí se guardaron." → la vista previa vuelve al tema viejo.
//   b) nombre + tema Carbón → Guardar → aviso → "Ver planes" (→ "Guardar y salir"
//      si aparece) → /admin/plans.
//   c) nombre + tema Carbón → salir sin guardar → "Cambios sin guardar" →
//      "Guardar y salir".
//   En todos: REST confirma que el nombre se guardó y design.look.theme NO.
//
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-premium-free-save.mjs [baseUrl] [shotsDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4274';
const SHOTS = process.argv[3] ?? '.e2e-evidence/premium-gratis';
const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error('Falta E2E_EMAIL / E2E_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const TENANT_ID = 6;
const PREMIUM_THEME = { id: 'carbon', label: 'Carbón' };
const PREMIUM_FONT = 'Poppins';
const log = (m) => console.log(`[e2e] ${m}`);
const fail = (m) => {
  throw new Error(`❌ ${m}`);
};
const results = [];

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

const readState = async () => {
  const [t] = await rest(`tenants?id=eq.${TENANT_ID}&select=name`);
  const [c] = await rest(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}&select=design,description,theme_color`);
  return { name: t.name, design: c.design, description: c.description, theme_color: c.theme_color };
};
const restore = async (snap) => {
  await rest(`tenants?id=eq.${TENANT_ID}`, { method: 'PATCH', body: JSON.stringify({ name: snap.name }) });
  await rest(`tenant_ecommerce_config?tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify({ design: snap.design, description: snap.description, theme_color: snap.theme_color }),
  });
};

// ── Copia de seguridad ──────────────────────────────────────────────────
const original = await readState();
log(`snapshot: name="${original.name}" theme=${original.design?.look?.theme ?? '(sin tema)'} font=${original.design?.look?.font ?? '-'} color=${original.theme_color}`);
if (original.design?.look?.theme === PREMIUM_THEME.id) fail('el tema guardado ya es Carbón: la prueba no distinguiría nada');

const browser = await chromium.launch();

async function openEditor(viewport, tag) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`pageerror(${tag}): ${e.message}`));
  // Plan gratis simulado.
  let planHits = 0;
  await page.route(
    (url) => url.pathname.endsWith('/rest/v1/tenants') && decodeURIComponent(url.search).includes('plans:plan_id'),
    async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      const patch = (row) => ({ ...row, plans: { ...(row.plans ?? {}), is_free: true, name: 'Gratis', price: 0 } });
      planHits++;
      await route.fulfill({ response: res, json: Array.isArray(json) ? json.map(patch) : patch(json) });
    }
  );
  await page.goto(`${BASE}/admin/catalog/edit?seccion=general`, { waitUntil: 'domcontentloaded' });
  await page.locator('#de-shop-name').waitFor({ timeout: 60000 });
  await page.waitForFunction(
    (n) => document.querySelector('#de-shop-name')?.value === n,
    original.name,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
  if (!planHits) fail('no se interceptó la consulta del plan (¿cambió la query?)');
  return { ctx, page, mobile: viewport.width < 768 };
}

async function goSection(ed, label) {
  const re = new RegExp(`^\\s*${label}\\s*$`);
  const item = ed.mobile
    ? ed.page.locator('.de-tabs button.de-tab').filter({ hasText: re })
    : ed.page.locator('.de-nav li[role="button"]').filter({ hasText: re });
  await item.first().click();
  await ed.page.waitForTimeout(400);
}

async function makeChanges(ed, newName, withFont) {
  await goSection(ed, 'General');
  await ed.page.locator('#de-shop-name').fill(newName);
  await goSection(ed, 'Tema');
  const tile = ed.page.locator('.de-tile', { hasText: PREMIUM_THEME.label });
  await tile.click();
  await ed.page.waitForTimeout(500);
  if (!(await tile.evaluate((el) => el.classList.contains('is-active')))) fail('el tema Carbón no quedó activo en el borrador');
  if (!(await tile.evaluate((el) => el.classList.contains('is-premium')))) fail('Carbón no muestra la corona (¿no se simuló el plan gratis?)');
  if (withFont) {
    await goSection(ed, 'Fuente y texto');
    await ed.page.locator('.de-tile', { hasText: PREMIUM_FONT }).click();
  }
  await ed.page.waitForTimeout(600);
}

const saveBtn = (ed) => ed.page.locator(ed.mobile ? '.de-m-save button' : '.de-save-top button');

async function checkDb(label, expectedName) {
  // la escritura es async: reintentar unos segundos
  let st;
  for (let i = 0; i < 10; i++) {
    st = await readState();
    if (st.name === expectedName) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  const theme = st.design?.look?.theme ?? null;
  const font = st.design?.look?.font ?? null;
  const origTheme = original.design?.look?.theme ?? null;
  const origFont = original.design?.look?.font ?? null;
  if (st.name !== expectedName) fail(`${label}: el nombre NO se guardó (db="${st.name}")`);
  if (theme !== origTheme) fail(`${label}: el tema premium SÍ se guardó (db=${theme})`);
  if (font !== origFont) fail(`${label}: la fuente cambió en la DB (db=${font}, antes=${origFont})`);
  if (st.theme_color !== original.theme_color) fail(`${label}: theme_color cambió (db=${st.theme_color})`);
  log(`${label}: DB nombre="${st.name}" ✅ tema=${theme} (sin cambios) ✅ fuente=${font} ✅ color=${st.theme_color} ✅`);
}

async function scenarioA(vp, tag) {
  const ed = await openEditor(vp, tag);
  const name = `${original.name} (e2e-a ${tag})`;
  await makeChanges(ed, name, true);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-a1-borrador-premium.png`) });
  await saveBtn(ed).click();
  const modal = ed.page.locator('.de-premium');
  await modal.waitFor({ timeout: 15000 });
  await ed.page.waitForTimeout(800);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-a2-aviso-premium.png`) });
  const items = (await modal.locator('.de-premium__list li').allInnerTexts()).map((s) => s.trim());
  const text = await modal.innerText();
  log(`${tag} a) aviso lista: ${JSON.stringify(items)}`);
  if (!items.includes('Temas')) fail('el aviso no lista "Temas"');
  if (!text.includes('Tus demás cambios sí se guardaron.')) fail('falta "Tus demás cambios sí se guardaron."');
  if (!text.includes('Gratis')) fail('el aviso no nombra el plan Gratis');
  await checkDb(`${tag} a)`, name);
  await modal.locator('button', { hasText: 'Cerrar' }).click();
  await modal.waitFor({ state: 'detached', timeout: 5000 });
  await goSection(ed, 'Tema');
  const carbonActive = await ed.page.locator('.de-tile', { hasText: PREMIUM_THEME.label }).evaluate((el) => el.classList.contains('is-active'));
  if (carbonActive) fail('la vista previa sigue en Carbón tras guardar');
  const disabled = await saveBtn(ed).isDisabled();
  if (!disabled) fail('quedaron "cambios sin guardar" tras guardar (botón Guardar habilitado)');
  await ed.page.waitForTimeout(800);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-a3-tras-guardar-tema-viejo.png`) });
  log(`${tag} a) vista previa volvió al tema guardado + sin cambios pendientes ✅`);
  await ed.ctx.close();
}

async function scenarioB(vp, tag) {
  const ed = await openEditor(vp, tag);
  const name = `${original.name} (e2e-b ${tag})`;
  await makeChanges(ed, name, false);
  await saveBtn(ed).click();
  const modal = ed.page.locator('.de-premium');
  await modal.waitFor({ timeout: 15000 });
  await ed.page.waitForTimeout(500);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-b1-aviso-premium.png`) });
  await modal.locator('button', { hasText: 'Ver planes' }).click();
  const unsaved = ed.page.locator('button', { hasText: 'Guardar y salir' });
  let sawUnsaved = false;
  try {
    await unsaved.waitFor({ timeout: 3000 });
    sawUnsaved = true;
    await ed.page.screenshot({ path: join(SHOTS, `${tag}-b2-cambios-sin-guardar.png`) });
    await unsaved.click();
  } catch {
    /* sin diálogo: todo quedó guardado */
  }
  await ed.page.waitForURL(/\/admin\/plans/, { timeout: 20000 });
  await ed.page.waitForTimeout(1500);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-b3-planes.png`) });
  log(`${tag} b) llegó a /admin/plans (diálogo "Cambios sin guardar": ${sawUnsaved ? 'sí → Guardar y salir' : 'no apareció'}) ✅`);
  await checkDb(`${tag} b)`, name);
  await ed.ctx.close();
}

async function scenarioC(vp, tag) {
  const ed = await openEditor(vp, tag);
  const name = `${original.name} (e2e-c ${tag})`;
  await makeChanges(ed, name, false);
  const exit = ed.page.locator('.de-back--exit');
  if (await exit.isVisible()) {
    await exit.click();
  } else {
    // Teléfono: el botón Volver no se ve; se sale por el menú de la app.
    await ed.page.locator('.de-back--menu').click();
    await ed.page.waitForTimeout(700);
    await ed.page.locator('a:visible, li:visible').filter({ hasText: /^\s*Clientes\s*$/ }).first().click();
  }
  const unsaved = ed.page.locator('button', { hasText: 'Guardar y salir' });
  await unsaved.waitFor({ timeout: 10000 });
  await ed.page.waitForTimeout(400);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-c1-cambios-sin-guardar.png`) });
  await unsaved.click();
  await ed.page.waitForURL((u) => !u.pathname.includes('/catalog/edit'), { timeout: 20000 });
  await ed.page.waitForTimeout(1500);
  await ed.page.screenshot({ path: join(SHOTS, `${tag}-c2-tras-salir.png`) });
  const premiumVisible = await ed.page.locator('.de-premium').count();
  log(`${tag} c) salió a ${new URL(ed.page.url()).pathname} (aviso premium visible: ${premiumVisible ? 'sí' : 'no'})`);
  await checkDb(`${tag} c)`, name);
  await ed.ctx.close();
}

async function run(label, fn) {
  try {
    await fn();
    results.push(`✅ ${label}`);
  } catch (e) {
    results.push(`❌ ${label}: ${e.message}`);
    log(`FALLÓ ${label}: ${e.stack ?? e.message}`);
  } finally {
    await restore(original); // cada escenario parte del estado original
  }
}

try {
  for (const [tag, vp] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    await run(`${tag} a) nombre + Carbón + fuente → Guardar`, () => scenarioA(vp, tag));
    await run(`${tag} b) Guardar → Ver planes → Guardar y salir`, () => scenarioB(vp, tag));
    await run(`${tag} c) salir sin guardar → Guardar y salir`, () => scenarioC(vp, tag));
  }
} finally {
  await browser.close();
  await restore(original);
  const after = await readState();
  const same = JSON.stringify(after) === JSON.stringify(original);
  log(`restauración: ${same ? 'idéntica al original ✅' : '⚠️ DIFIERE: ' + JSON.stringify(after)}`);
  console.log('\n' + results.join('\n'));
  if (!same || results.some((r) => r.startsWith('❌'))) process.exitCode = 1;
}
