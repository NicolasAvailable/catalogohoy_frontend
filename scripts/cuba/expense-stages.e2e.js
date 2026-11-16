// Estados propios de "Gastos y facturas" + abonos, contra el dev server local con backend falso.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots-stages');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const results = [];
let n = 0;

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-ES' });
  const page = await ctx.newPage();
  const { db } = await setupMock(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const shot = async (name, full = false) => { n++; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, fullPage: full }); return f; };
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); console.error(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); await shot('fallo'); }
  };
  const expectText = async (loc, text) => { await loc.filter({ hasText: text }).first().waitFor({ timeout: 5000 }); };
  const field = (label) =>
    page.locator('.p-dialog div.flex.flex-col', { has: page.locator('label').filter({ hasText: new RegExp(`^\\s*${label}(\\s|$)`) }) }).last();
  const pick = async (label, option) => {
    await field(label).locator('p-select').click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const fill = async (label, value) => { await field(label).locator('input').first().fill(value); };
  const number = async (label, value) => { const i = field(label).locator('input'); await i.click(); await i.press('Control+A'); await i.pressSequentially(value); };
  const totals = () => page.getByTestId('expense-totals');
  const card = (i) => totals().locator(':scope > div').nth(i);
  const rows = () => page.locator('table tbody tr');
  const save = async () => { await page.locator('.p-dialog ui-button').last().click(); await page.locator('.p-dialog >> visible=true').waitFor({ state: 'detached', timeout: 5000 }); };
  const modal = () => page.locator('lib-expense-stages-modal');

  await page.goto('http://localhost:4200/admin/expenses');
  await page.getByRole('heading', { name: 'Gastos y facturas' }).waitFor({ timeout: 20000 });

  await step('Filtros con los estados base y botón "Estados"', async () => {
    const f = page.getByTestId('expense-status-filters');
    await expectText(f.locator('button'), 'Por pagar');
    await expectText(f.locator('button'), 'Pagada');
    await page.getByTestId('expense-stages-button').waitFor();
    await shot('filtros-base');
  });

  await step('Crear el estado "A crédito" (funciona como Por pagar)', async () => {
    await page.getByTestId('expense-stages-button').click();
    await modal().getByText('Estados de los gastos').waitFor();
    await modal().getByRole('button', { name: 'Agregar estado' }).click();
    await modal().locator('input[type=text]').fill('A crédito');
    await modal().locator('button[aria-label="#3b82f6"]').click();
    await expectText(modal().locator('button'), 'Funciona como Por pagar');
    await shot('editor-estados');
    await modal().getByRole('button', { name: 'Guardar cambios' }).click();
    await modal().waitFor({ state: 'detached', timeout: 5000 });
    const own = db.expense_stages.filter((s) => !s.system_status);
    if (own.length !== 1 || own[0].label !== 'A crédito' || own[0].base_status !== 'pending') throw new Error(JSON.stringify(own));
    await expectText(page.getByTestId('expense-status-filters').locator('button'), 'A crédito');
  });

  await step('Registrar factura "A crédito" con abono de 400 de 1000', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await fill('Proveedor', 'Distribuidora Andina');
    await number('Monto', '1000');
    await pick('Estado', 'A crédito');
    await page.getByTestId('expense-paid-amount').waitFor();
    await number('Abonado', '400');
    await expectText(page.getByTestId('expense-paid-amount'), 'Falta por pagar');
    await shot('formulario-abono');
    await save();
    const e = db.tenant_expenses[0];
    if (e.status !== 'pending' || !e.stage_id || Number(e.paid_amount) !== 400) throw new Error(JSON.stringify(e));
    await expectText(rows(), 'A crédito');
    await expectText(rows(), 'Abonado');
    await expectText(card(1), '400,00');
    await expectText(card(2), '600,00');
  });

  await step('Otra factura pagada y filtro por "A crédito"', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await fill('Proveedor', 'Luz y agua');
    await number('Monto', '50');
    await pick('Categoría', 'Servicios');
    await save();
    await page.getByTestId('expense-status-filters').getByRole('button', { name: 'A crédito' }).click();
    for (let i = 0; i < 20 && (await rows().count()) !== 1; i++) await page.waitForTimeout(200);
    if ((await rows().count()) !== 1) throw new Error(`Filtro A crédito: ${await rows().count()} filas`);
    await shot('filtro-a-credito');
    await page.getByTestId('expense-status-filters').getByRole('button', { name: 'Todos' }).click();
  });

  await step('Cambiar el estado desde la tabla a "Pagada"', async () => {
    const row = rows().filter({ hasText: 'Distribuidora Andina' });
    await row.locator('p-select').click();
    await shot('selector-estado-fila');
    await page.getByRole('option', { name: 'Pagada', exact: true }).click();
    await expectText(card(2), '$ 0,00');
    const e = db.tenant_expenses.find((x) => x.supplier === 'Distribuidora Andina');
    if (e.status !== 'paid' || e.stage_id !== null) throw new Error(JSON.stringify(e));
  });

  await step('Gráfica por estado muestra el estado propio', async () => {
    const stageId = db.expense_stages.find((s) => s.label === 'A crédito').id;
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    [[3, 200, 'pending', stageId, 50], [3, 120, 'paid', null, 0], [10, 300, 'pending', null, 0], [10, 90, 'pending', stageId, 0], [18, 150, 'paid', null, 0]]
      .forEach(([d, amount, status, stage_id, paid_amount], i) => db.tenant_expenses.push({
        id: `seed-${i}`, created_at: now.toISOString(), supplier: `Proveedor ${i + 1}`, invoice_number: null, category: 'mercancia', description: null,
        amount, currency: 'USD', issue_date: `${ym}-${String(d).padStart(2, '0')}`, due_date: null, status, stage_id, paid_amount, paid_at: null, attachments: [], notes: null,
      }));
    await page.getByTitle('Mes anterior').click();
    await page.getByText('Ir al mes actual').waitFor();
    await page.waitForTimeout(1000);
    const chart = page.getByTestId('expense-daily-chart');
    await chart.getByRole('button', { name: 'Por estado' }).click();
    await page.waitForTimeout(800);
    await expectText(chart.locator('.apexcharts-legend'), 'A crédito');
    await chart.scrollIntoViewIfNeeded();
    { const b = await chart.locator('.apexcharts-bar-area:not([val="0"])').first().boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
    await page.waitForTimeout(400);
    await shot('grafica-por-estado');
    await page.mouse.move(5, 5);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('mes-con-estados', true);
  });

  await step('Borrar el estado: sus gastos vuelven a "Por pagar"', async () => {
    await page.getByTestId('expense-stages-button').click();
    await modal().getByText('A crédito', { exact: true }).first().click();
    await modal().getByRole('button', { name: 'Eliminar estado' }).click();
    await modal().getByRole('button', { name: 'Sí, eliminar' }).click();
    await modal().getByRole('button', { name: 'Guardar cambios' }).click();
    await modal().waitFor({ state: 'detached', timeout: 5000 });
    if (db.expense_stages.some((s) => s.label === 'A crédito')) throw new Error('No se borró');
    if ((await page.getByTestId('expense-status-filters').getByRole('button', { name: 'A crédito' }).count()) !== 0) throw new Error('Sigue el filtro');
  });

  await step('Vista en celular', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await shot('movil');
  });

  if (errors.length) results.push(`⚠️ Errores JS: ${errors.slice(0, 3).join(' | ')}`);
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('❌')) ? 1 : 0);
})();
