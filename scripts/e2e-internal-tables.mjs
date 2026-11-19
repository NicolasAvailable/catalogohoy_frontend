// E2E: tablas del panel interno con alto fijo + scroll interno.
//
// Valida en escritorio y móvil que las tablas de Notificaciones WhatsApp,
// Bot de WhatsApp (usuarios + conversación) y Uso de IA:
//  - tienen un alto visible razonable (no se aplastan a 0),
//  - hacen scroll por dentro (scrollHeight > clientHeight),
//  - mantienen el encabezado fijo al hacer scroll,
//  - en móvil permiten scroll horizontal.
//
// Uso: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-internal-tables.mjs <baseUrl>
// (cuenta admin del panel interno, la de los otros scripts e2e-*)
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:6274';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-internal-tables';
mkdirSync(SHOTS, { recursive: true });

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';
const log = (m) => console.log(`[e2e] ${m}`);
const fails = [];
const check = (ok, msg) => {
  log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) fails.push(msg);
};

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }),
});
const session = await res.json();
if (!session.access_token) throw new Error('login fallo');

/** Mide el contenedor con scroll que envuelve a `selector` (tabla o chat). */
async function measure(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    let box = el.tagName === 'TABLE' ? el.parentElement : el;
    const r = box.getBoundingClientRect();
    return {
      clientHeight: box.clientHeight,
      scrollHeight: box.scrollHeight,
      clientWidth: box.clientWidth,
      scrollWidth: box.scrollWidth,
      top: r.top,
    };
  }, selector);
}

async function scrollInside(page, selector, y) {
  await page.evaluate(
    ([sel, y]) => {
      const el = document.querySelector(sel);
      const box = el.tagName === 'TABLE' ? el.parentElement : el;
      box.scrollTop = y;
    },
    [selector, y],
  );
  await page.waitForTimeout(300);
}

async function headerStillVisible(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const box = el.parentElement.getBoundingClientRect();
    const th = el.querySelector('th').getBoundingClientRect();
    return Math.abs(th.top - box.top) < 4;
  }, selector);
}

async function run(label, ctxOpts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.setItem('internal-theme', 'dark');
  }, ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(session)]);
  const page = await ctx.newPage();
  const mobile = label === 'movil';

  // ---------- Notificaciones WhatsApp ----------
  await page.goto(`${BASE}/whatsapp-logs`, { waitUntil: 'domcontentloaded' });
  const waTable = 'section table.min-w-\\[52rem\\]';
  await page.waitForSelector(`${waTable} tbody tr:nth-child(5)`, { timeout: 45000 });
  await page.waitForTimeout(1500);
  // Lleva la tabla a la vista (scroll de la página).
  await page.locator(waTable).scrollIntoViewIfNeeded();
  let m = await measure(page, waTable);
  log(`[${label}] whatsapp-logs ${JSON.stringify(m)}`);
  check(m.clientHeight >= 300, `[${label}] Notificaciones: tabla visible con alto ${m.clientHeight}px`);
  check(m.scrollHeight > m.clientHeight, `[${label}] Notificaciones: scroll interno`);
  if (mobile) check(m.scrollWidth > m.clientWidth, `[${label}] Notificaciones: scroll horizontal`);
  await page.screenshot({ path: `${SHOTS}/${label}-1-notificaciones.png` });
  await scrollInside(page, waTable, 800);
  check(await headerStillVisible(page, waTable), `[${label}] Notificaciones: encabezado fijo`);
  if (mobile) await page.evaluate((s) => (document.querySelector(s).parentElement.scrollLeft = 300), waTable);
  await page.screenshot({ path: `${SHOTS}/${label}-2-notificaciones-scroll.png` });

  // ---------- Uso de IA ----------
  await page.goto(`${BASE}/ai-usage`, { waitUntil: 'domcontentloaded' });
  const aiTable = 'section table.min-w-\\[56rem\\]';
  await page.waitForSelector(`${aiTable} tbody tr:nth-child(5)`, { timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.locator(aiTable).scrollIntoViewIfNeeded();
  m = await measure(page, aiTable);
  log(`[${label}] ai-usage ${JSON.stringify(m)}`);
  check(m.clientHeight >= 300, `[${label}] Uso de IA: tabla visible con alto ${m.clientHeight}px`);
  check(m.scrollHeight > m.clientHeight, `[${label}] Uso de IA: scroll interno`);
  if (mobile) check(m.scrollWidth > m.clientWidth, `[${label}] Uso de IA: scroll horizontal`);
  await page.screenshot({ path: `${SHOTS}/${label}-3-uso-ia.png` });
  await scrollInside(page, aiTable, 800);
  check(await headerStillVisible(page, aiTable), `[${label}] Uso de IA: encabezado fijo`);
  if (mobile) await page.evaluate((s) => (document.querySelector(s).parentElement.scrollLeft = 300), aiTable);
  await page.screenshot({ path: `${SHOTS}/${label}-4-uso-ia-scroll.png` });

  // ---------- Bot de WhatsApp ----------
  await page.goto(`${BASE}/wa-bot`, { waitUntil: 'domcontentloaded' });
  const usersTable = 'table.whitespace-nowrap';
  await page.waitForSelector(`${usersTable} tbody tr:nth-child(5)`, { timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.locator(usersTable).scrollIntoViewIfNeeded();
  m = await measure(page, usersTable);
  log(`[${label}] wa-bot usuarios ${JSON.stringify(m)}`);
  check(m.clientHeight >= 250, `[${label}] Bot usuarios: alto ${m.clientHeight}px`);
  check(m.scrollHeight > m.clientHeight, `[${label}] Bot usuarios: scroll interno`);
  if (mobile) check(m.scrollWidth > m.clientWidth, `[${label}] Bot usuarios: scroll horizontal`);
  await page.screenshot({ path: `${SHOTS}/${label}-5-bot-usuarios.png` });
  await scrollInside(page, usersTable, 600);
  check(await headerStillVisible(page, usersTable), `[${label}] Bot usuarios: encabezado fijo`);
  await page.screenshot({ path: `${SHOTS}/${label}-6-bot-usuarios-scroll.png` });

  // Toca el usuario con más mensajes para ver su conversación.
  await page.locator('button:has-text("Más uso")').click();
  await scrollInside(page, usersTable, 0);
  await page.locator(`${usersTable} tbody tr`).first().click();
  await page.waitForSelector('#wa-log >> text=Quitar filtro', { timeout: 30000 });
  await page.waitForTimeout(2000);
  const chat = '#wa-log .wa-chat';
  m = await measure(page, chat);
  log(`[${label}] wa-bot chat ${JSON.stringify(m)}`);
  check(m.clientHeight >= 300, `[${label}] Conversación: alto ${m.clientHeight}px`);
  check(m.scrollHeight > m.clientHeight, `[${label}] Conversación: scroll interno`);
  const atBottom = await page.evaluate((s) => {
    const b = document.querySelector(s);
    return b.scrollHeight - b.scrollTop - b.clientHeight < 8;
  }, chat);
  check(atBottom, `[${label}] Conversación: arranca en el mensaje más reciente`);
  await page.locator('#wa-log').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${label}-7-bot-conversacion.png` });

  await browser.close();
}

await run('escritorio', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await run('movil', { ...devices['iPhone 13'] });

if (fails.length) {
  console.log(`\n${fails.length} chequeos fallaron:\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
console.log('\nTodo OK');
