// Órdenes → Métricas: ganancia filtrable por estado de orden (CAT-102).
// Chips de estados (base + propios), ganancia/top productos/desglose según los
// estados elegidos, se recuerda al recargar, y se recalcula en tiempo real
// cuando una orden cambia (WebSocket de Supabase Realtime simulado).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const PREFIX = process.env.PREFIX || 'ganancia-estado';
const BASE = process.env.BASE || 'http://localhost:4200';
const results = [];

// Estados como los de Motofox: Revisión (base pendiente) y Despachado (base a crédito).
const REVISION = 'aaaaaaaa-0000-0000-0000-000000000001';
const DESPACHADO = 'aaaaaaaa-0000-0000-0000-000000000002';
const STAGES = [
  { id: REVISION, tenant_id: 1, label: 'Revisión', color: '#8b5cf6', base_status: 'pending', position: 1, is_hidden: false, system_status: null },
  { id: DESPACHADO, tenant_id: 1, label: 'Despachado', color: '#0ea5e9', base_status: 'credit', position: 2, is_hidden: false, system_status: null },
];

// Productos con costo de producción (para la ganancia).
const PRODUCTS = [
  { id: 101, name: 'Casco integral', cost: 30, price: 50 },
  { id: 102, name: 'Guantes moto', cost: 8, price: 15 },
  { id: 103, name: 'Aceite 20W50', cost: 5, price: 9 },
  { id: 104, name: 'Kit de arrastre', cost: 25, price: 45 },
];
const line = (p, qty) => ({ productId: p.id, name: p.name, price: p.price, quantity: qty, total: p.price * qty, photo: null });

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
let nextId = 5001;
const order = (name, status, stageId, items, h, payment = 'Pago móvil') => {
  const total = items.reduce((a, i) => a + i.total, 0);
  const id = nextId++;
  return { id, order_number: id - 4000, tenant_id: 1, name, status, stage_id: stageId, products: items, total_usd: total, total_bs: total * 40, created_at: ago(h), updated_at: ago(h), payment_method: payment, phone: '+584141234567', commission: 0 };
};
const [P1, P2, P3, P4] = PRODUCTS;
const db = {
  orders: [
    order('Carlos Pérez', 'completed', null, [line(P1, 1), line(P2, 2)], 2),
    order('Taller El Rápido', 'completed', null, [line(P3, 6)], 20),
    order('María Gómez', 'completed', null, [line(P4, 1)], 50, 'Zelle'),
    order('José Rodríguez', 'credit', null, [line(P1, 2)], 30, 'Crédito'),
    order('Moto Repuestos Lara', 'credit', DESPACHADO, [line(P4, 2), line(P3, 4)], 70, 'Crédito'),
    order('Ana Torres', 'pending', REVISION, [line(P2, 3)], 5),
    order('Luis Medina', 'pending', null, [line(P3, 2)], 1),
    order('Pedro Salas', 'cancelled', null, [line(P1, 1)], 40),
  ],
};
const COUNT = (pred) => db.orders.filter(pred).length;

const metrics = () => {
  const live = db.orders.filter((o) => o.status !== 'cancelled');
  const amt = (s) => db.orders.filter((o) => o.status === s).reduce((a, o) => a + o.total_usd, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = live.filter((o) => new Date(o.created_at) >= today);
  return {
    todayAmount: todays.reduce((a, o) => a + o.total_usd, 0), todayOrders: todays.length,
    rangeTotalOrders: live.length, rangeTotalAmount: live.reduce((a, o) => a + o.total_usd, 0), rangeAvgTicket: 0,
    byStatus: ['completed', 'pending', 'credit', 'cancelled'].map((s) => ({ status: s, count: COUNT((o) => o.status === s), amount: amt(s) })),
    byDay: [], byPaymentMethod: [],
  };
};

// ── Realtime simulado (protocolo Phoenix vsn 1.0.0 de Supabase) ──────────────
let rtSocket = null;
let rtTopic = null;
let rtSubId = null;
async function setupRealtime(context) {
  await context.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw));
      const reply = (response = {}) => ws.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', payload: { status: 'ok', response }, ref: msg.ref, join_ref: msg.join_ref }));
      if (msg.event === 'phx_join' && msg.topic.startsWith('realtime:orders-tenant-')) {
        rtSocket = ws; rtTopic = msg.topic; rtSubId = 777;
        const pc = (msg.payload?.config?.postgres_changes ?? []).map((c) => ({ ...c, id: rtSubId }));
        reply({ postgres_changes: pc });
        ws.send(JSON.stringify({ topic: msg.topic, event: 'system', payload: { status: 'ok', message: 'Subscribed to PostgreSQL', extension: 'postgres_changes', channel: msg.topic.replace('realtime:', '') }, ref: null }));
        return;
      }
      reply();
    });
  });
}
function pushOrderUpdate(row) {
  if (!rtSocket) throw new Error('el canal realtime de órdenes no se suscribió');
  rtSocket.send(JSON.stringify({
    topic: rtTopic, event: 'postgres_changes', ref: null,
    payload: { ids: [rtSubId], data: { type: 'UPDATE', schema: 'public', table: 'orders', commit_timestamp: new Date().toISOString(), columns: [], record: row, old_record: { id: row.id }, errors: null } },
  }));
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-ES', deviceScaleFactor: 2 });
  await setupRealtime(context);
  const page = await context.newPage();
  const ordersRoute = (route, req, url, _db, single) => {
    const q = url.searchParams;
    const id = q.get('id')?.replace('eq.', '');
    let rows = db.orders;
    if (id) rows = rows.filter((o) => String(o.id) === id);
    const gte = q.getAll('created_at').find((v) => v.startsWith('gte.'))?.slice(4);
    const lt = q.getAll('created_at').find((v) => v.startsWith('lt.'))?.slice(3);
    if (gte) rows = rows.filter((o) => o.created_at >= gte);
    if (lt) rows = rows.filter((o) => o.created_at < lt);
    const st = q.get('status')?.replace('eq.', '');
    if (st) rows = rows.filter((o) => o.status === st);
    rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return route.fulfill({ status: 200, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` }, json: single ? rows[0] ?? null : rows });
  };
  const { unmatched } = await setupMock(page, {
    routes: {
      '/rest/v1/order_stages': (route) => route.fulfill({ json: STAGES }),
      '/rest/v1/orders': ordersRoute,
      '/rest/v1/products': (route) => route.fulfill({ json: PRODUCTS.map((p) => ({ id: p.id, production_cost: p.cost })) }),
      '/rest/v1/rpc/order_metrics': (route) => route.fulfill({ json: metrics() }),
      '/rest/v1/rpc/order_metrics_by_day_status': (route) => route.fulfill({ json: [] }),
    },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, opts = {}) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`), ...opts });
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); await shot(`fallo-${results.length}`); }
  };

  const chips = page.locator('button[aria-pressed]');
  const chip = (label) => chips.filter({ hasText: label });
  const header = page.locator('h3', { hasText: 'Órdenes del periodo' }).locator('xpath=..');
  const profitCard = page.locator('div', { has: page.locator('p', { hasText: /^\s*Ganancia\s*$/ }) }).last();
  const expectHeader = async (count, sales, profit) => {
    const re = new RegExp(`${count} órdenes[\\s\\S]*ventas \\$${sales}[\\s\\S]*ganancia[\\s\\S]*\\$${profit}`);
    await header.filter({ hasText: re }).waitFor({ timeout: 8000 });
  };
  const goMetrics = async () => {
    await page.goto(`${BASE}/admin/orders`);
    await page.getByText('Métricas', { exact: true }).first().click({ timeout: 30000 });
    await chips.first().waitFor({ timeout: 15000 });
  };

  // Por defecto: todo menos canceladas → 7 órdenes.
  // Ventas: 80+54+45+100+126+45+18 = 468. Ganancia: 34+24+20+40+56+21+8 = 203.
  await step('Abre Órdenes → Métricas con los chips de estados (base + propios)', async () => {
    await goMetrics();
    const labels = await chips.allInnerTexts();
    for (const l of ['Pendiente', 'Revisión', 'Despachado', 'Completada', 'A crédito', 'Cancelada']) {
      if (!labels.some((t) => t.includes(l))) throw new Error(`falta el chip ${l} (hay: ${labels.join(', ')})`);
    }
    if ((await chip('Cancelada').getAttribute('aria-pressed')) !== 'false') throw new Error('Cancelada debería venir desmarcada');
    await expectHeader(7, '468.00', '203.00');
    await page.waitForTimeout(400);
    await shot('1-por-defecto');
  });

  // Caso Saúl: solo Completada → 3 órdenes, ventas 179, ganancia 78.
  await step('Caso Saúl: solo Completada (sin A crédito ni pendientes)', async () => {
    for (const l of ['Pendiente', 'Revisión', 'Despachado', 'A crédito']) await chip(l).click();
    await expectHeader(3, '179.00', '78.00');
    const rows = page.locator('table').last().locator('tbody tr');
    if ((await rows.count()) !== 3) throw new Error(`la tabla tiene ${await rows.count()} filas, esperaba 3`);
    const top = await page.locator('h3', { hasText: 'Productos más vendidos' }).locator('xpath=..').innerText();
    if (/Kit de arrastre[\s\S]*\b3\b/.test(top)) throw new Error('top productos todavía cuenta órdenes a crédito');
    await profitCard.filter({ hasText: '$78.00' }).first().waitFor({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    await shot('2-solo-completadas');
    await header.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot('3-desglose-completadas');
  });

  await step('La elección se recuerda al recargar', async () => {
    await goMetrics();
    await expectHeader(3, '179.00', '78.00');
  });

  // Tiempo real: la orden a crédito de José (2 cascos, $100, ganancia $40)
  // pasa a Completada desde otro lado → 4 órdenes, $279, ganancia $118.
  await step('Tiempo real: una orden pasa a Completada y se suma sola', async () => {
    const jose = db.orders.find((o) => o.name === 'José Rodríguez');
    jose.status = 'completed';
    jose.payment_method = 'Pago móvil';
    jose.updated_at = new Date().toISOString();
    await page.mouse.move(10, 10);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    pushOrderUpdate(jose);
    await expectHeader(4, '279.00', '118.00');
    await page.getByText('José Rodríguez').first().waitFor({ timeout: 5000 });
    await header.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot('4-tiempo-real');
  });

  await step('Restablecer vuelve a todo menos canceladas', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Restablecer' }).click();
    await expectHeader(7, '468.00', '203.00');
  });

  await step('Ninguna orden en los estados elegidos muestra aviso claro', async () => {
    for (const l of ['Pendiente', 'Revisión', 'Despachado', 'Completada', 'A crédito']) await chip(l).click();
    await page.getByText('Ninguna orden del periodo está en los estados elegidos').waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Restablecer' }).click();
  });

  await step('Teléfono: chips en una fila deslizable y desglose', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.removeItem('orders.profitStatuses.1'));
    await goMetrics();
    for (const l of ['Pendiente', 'Revisión', 'Despachado', 'A crédito']) await chip(l).click();
    await expectHeader(4, '279.00', '118.00');
    await page.waitForTimeout(400);
    await shot('5-movil');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) throw new Error(`la página se desborda ${overflow}px en el teléfono`);
  });

  if (errors.length) results.push(`⚠️ Errores JS: ${errors.slice(0, 3).join(' | ')}`);
  if (process.env.DEBUG) console.log([...unmatched].join('\n'));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('❌')) ? 1 : 0);
})();
