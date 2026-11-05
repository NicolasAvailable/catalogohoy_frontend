// Órdenes → Métricas: gráfica "Órdenes por día y estado" (incluye estados
// propios) contra el dev server local con backend falso.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const PREFIX = process.env.PREFIX || 'ordenes';
const results = [];

// 30 días hasta hoy, con el mismo corte (medianoche local) que usa el front.
const days = [];
for (let i = 29; i >= 0; i--) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
  days.push(d.toISOString());
}
const STAGES = [
  { id: '11111111-1111-1111-1111-111111111111', tenant_id: 1, label: 'Despacho', color: '#8b5cf6', base_status: 'pending', position: 1, is_hidden: false, system_status: null },
  { id: '22222222-2222-2222-2222-222222222222', tenant_id: 1, label: 'Por retirar', color: '#0ea5e9', base_status: 'credit', position: 2, is_hidden: false, system_status: null },
];
const rnd = (i, k) => ((i * 7 + k * 13) % 5);
const byDayStatus = [];
days.forEach((date, i) => {
  const push = (status, stageId, count, price) => count > 0 && byDayStatus.push({ date, status, stageId, count, amount: count * price });
  push('completed', null, rnd(i, 1) + 1, 25);
  push('pending', null, rnd(i, 2) % 3, 30);
  push('pending', STAGES[0].id, rnd(i, 3) % 2, 40);
  push('credit', STAGES[1].id, i % 4 === 0 ? 1 : 0, 60);
  push('cancelled', null, i % 6 === 0 ? 1 : 0, 20);
});
const byDay = days.map((date) => {
  const rows = byDayStatus.filter((r) => r.date === date && r.status !== 'cancelled');
  return { date, count: rows.reduce((a, r) => a + r.count, 0), amount: rows.reduce((a, r) => a + r.amount, 0) };
});
const sum = (f) => byDayStatus.filter(f).reduce((a, r) => a + r.count, 0);
const metrics = {
  todayAmount: byDay[29].amount, todayOrders: byDay[29].count,
  rangeTotalOrders: byDay.reduce((a, d) => a + d.count, 0),
  rangeTotalAmount: byDay.reduce((a, d) => a + d.amount, 0),
  rangeAvgTicket: 30,
  byStatus: ['completed', 'pending', 'credit', 'cancelled'].map((s) => ({ status: s, count: sum((r) => r.status === s), amount: 0 })),
  byDay,
  byPaymentMethod: [{ method: 'Pago móvil', count: 20, amount: 500 }],
};

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-ES' })).newPage();
  const { unmatched } = await setupMock(page, {
    routes: {
      '/rest/v1/order_stages': (route) => route.fulfill({ json: STAGES }),
      '/rest/v1/rpc/order_metrics': (route) => route.fulfill({ json: metrics }),
      '/rest/v1/rpc/order_metrics_by_day_status': (route, req) => {
        const body = JSON.parse(req.postData() || '{}');
        if (!body.p_tenant_id || !body.p_start || !body.p_end) return route.fulfill({ status: 400, json: { message: 'faltan parámetros' } });
        return route.fulfill({ json: byDayStatus });
      },
    },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`) });
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); await shot('fallo'); }
  };

  await page.goto('http://localhost:4200/admin/orders');
  await step('Abre Órdenes → Métricas', async () => {
    await page.getByText('Métricas', { exact: true }).first().click({ timeout: 20000 });
  });
  const chart = page.getByTestId('orders-status-daily-chart');
  await step('Gráfica por día y estado con estados propios', async () => {
    await chart.locator('.apexcharts-bar-area:not([val="0"])').first().waitFor({ timeout: 10000 });
    for (const label of ['Despacho', 'Por retirar', 'Cancelada']) {
      await chart.locator('.apexcharts-legend').filter({ hasText: label }).waitFor({ timeout: 3000 });
    }
    await chart.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const bars = chart.locator('.apexcharts-bar-area:not([val="0"])');
    const b = await bars.nth(Math.floor((await bars.count()) / 3)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await chart.locator('.apexcharts-tooltip').filter({ hasText: 'Total' }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    await shot('por-estado-cantidad');
  });
  await step('Cambiar a monto', async () => {
    await chart.getByRole('button', { name: 'Monto' }).click();
    await page.waitForTimeout(800);
    const bars = chart.locator('.apexcharts-bar-area:not([val="0"])');
    const b = await bars.nth(Math.floor((await bars.count()) / 3)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await chart.locator('.apexcharts-tooltip').filter({ hasText: '$' }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    await shot('por-estado-monto');
  });

  if (errors.length) results.push(`⚠️ Errores JS: ${errors.slice(0, 3).join(' | ')}`);
  if (process.env.DEBUG) console.log([...unmatched].join('\n'));
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('❌')) ? 1 : 0);
})();
