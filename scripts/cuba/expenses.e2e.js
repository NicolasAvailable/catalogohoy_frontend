// Paso a paso de "Gastos y facturas" contra el dev server local con backend falso.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
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

  const shot = async (name) => { n++; const f = path.join(OUT, `${String(n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f }); return f; };
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); console.error(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); await shot('fallo'); }
  };
  const expectText = async (loc, text) => {
    await loc.filter({ hasText: text }).first().waitFor({ timeout: 5000 });
  };
  // Campo del formulario por el texto de su etiqueta (sin el "*" ni "(opcional)").
  const field = (label) =>
    page.locator('.p-dialog div.flex.flex-col', { has: page.locator('label').filter({ hasText: new RegExp(`^\\s*${label}(\\s|$)`) }) }).last();
  const pick = async (label, option) => {
    await field(label).locator('p-select').click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const fill = async (label, value) => { await field(label).locator('input').first().fill(value); };
  const amount = async (value) => { const i = field('Monto').locator('input'); await i.click(); await i.press('Control+A'); await i.pressSequentially(value); };
  const totals = () => page.getByTestId('expense-totals');
  const rows = () => page.locator('table tbody tr');
  const expectRows = async (count, what) => {
    for (let i = 0; i < 25 && (await rows().count()) !== count; i++) await page.waitForTimeout(200);
    const got = await rows().count();
    if (got !== count) throw new Error(`${what}: ${got} filas (esperaba ${count})`);
  };
  const save = async () => { await page.locator('.p-dialog ui-button').last().click(); await page.locator('.p-dialog >> visible=true').waitFor({ state: 'detached', timeout: 5000 }); };

  await page.goto('http://localhost:4200/admin/expenses');
  await page.getByRole('heading', { name: 'Gastos y facturas' }).waitFor({ timeout: 20000 });

  await step('Abre la sección vacía desde el menú', async () => {
    await expectText(page.locator('p'), 'Aún no hay gastos en este mes');
    await shot('vacio');
  });

  await step('Campos obligatorios: no deja guardar vacío', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await page.locator('.p-dialog ui-button').last().click();
    await expectText(page.locator('.p-dialog p'), 'El proveedor es obligatorio');
    await expectText(page.locator('.p-dialog p'), 'El monto es obligatorio');
    const optional = await page.locator('.p-dialog label:has-text("(opcional)")').count();
    if (optional < 4) throw new Error(`Solo ${optional} campos marcados como opcionales`);
    await shot('obligatorios');
  });

  await step('Registrar factura pagada con PDF + Excel adjuntos', async () => {
    await fill('Proveedor', 'Repuestos El Motor C.A.');
    await fill('Nº de factura', '000123');
    await fill('Descripción', '20 cascos y 50 cauchos');
    await amount('450');
    const pdf = path.join(OUT, 'factura-000123.pdf');
    fs.writeFileSync(pdf, '%PDF-1.4\n%demo\n');
    const xlsx = path.join(OUT, 'detalle-000123.xlsx');
    fs.writeFileSync(xlsx, 'demo');
    await page.getByTestId('expense-dropzone').locator('input[type=file]').setInputFiles([pdf, xlsx]);
    await expectText(page.getByTestId('expense-attachments').locator('li'), 'factura-000123.pdf');
    await expectText(page.getByTestId('expense-attachments').locator('li'), 'detalle-000123.xlsx');
    await shot('formulario-lleno');
    await save();
    await expectText(rows(), 'Repuestos El Motor C.A.');
    await expectText(totals(), '450,00');
    const att = db.tenant_expenses[0].attachments || [];
    if (att.length !== 2) throw new Error(`Se guardaron ${att.length} archivos (esperaba 2)`);
  });

  await step('Registrar factura por pagar ya vencida (transporte)', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await fill('Proveedor', 'Transporte Rápido');
    await fill('Descripción', 'Flete de mercancía');
    await amount('80');
    await pick('Categoría', 'Transporte y envíos');
    await pick('Estado', 'Por pagar');
    await field('Vence el').locator('input').click();
    await page.locator('.p-datepicker-day-view td:not(.p-datepicker-other-month) span:text-is("1")').first().click();
    await save();
    await expectText(rows(), 'Vencido');
    await expectText(totals(), '80,00');
  });

  await step('Registrar gasto en bolívares (no se suma con dólares)', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await fill('Proveedor', 'Alquiler del local');
    await amount('15000');
    await pick('Moneda', 'VES');
    await pick('Categoría', 'Alquiler');
    await save();
    await expectText(totals(), 'Bs 15.000,00');
    await expectText(totals(), '$ 530,00');
    await shot('lista-con-totales');
  });

  await step('Filtrar "Por pagar" y buscar', async () => {
    await page.getByRole('button', { name: 'Por pagar', exact: true }).click();
    await expectRows(1, 'Filtro por pagar');
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await page.locator('input[placeholder^="Buscar por proveedor"]').first().fill('cascos');
    await expectRows(1, 'Búsqueda');
    await shot('busqueda');
    await page.locator('input[placeholder^="Buscar por proveedor"]').first().fill('');
    await expectRows(3, 'Sin filtros');
  });

  await step('Marcar como pagado', async () => {
    const row = rows().filter({ hasText: 'Transporte Rápido' });
    await row.locator('button').first().click();
    await expectText(row, 'Pagado');
    const pend = totals().locator(':scope > div').nth(2);
    await expectText(pend, '$ 0,00');
  });

  await step('Editar monto de una factura', async () => {
    await rows().filter({ hasText: 'Repuestos El Motor' }).locator('button').nth(1).click();
    await amount('500');
    await save();
    await expectText(rows().filter({ hasText: 'Repuestos El Motor' }), '500,00');
    await expectText(totals(), '$ 580,00');
  });

  await step('Eliminar un gasto (con confirmación)', async () => {
    await rows().filter({ hasText: 'Alquiler del local' }).locator('button').last().click();
    await page.getByRole('button', { name: 'Eliminar' }).last().click();
    await page.waitForTimeout(500);
    if (await rows().filter({ hasText: 'Alquiler del local' }).count()) throw new Error('Sigue en la lista');
    if (db.tenant_expenses.length !== 2) throw new Error('No se borró en la base');
    await shot('despues-de-editar-y-borrar');
  });

  await step('Cambiar de mes (mes anterior vacío y volver)', async () => {
    await page.getByTitle('Mes anterior').click();
    await expectText(page.locator('p'), 'Aún no hay gastos en este mes');
    await page.getByText('Ir al mes actual').click();
    await expectText(rows(), 'Repuestos El Motor');
  });

  await step('Gráfica "Gastos por día" apilada por categoría y por estado', async () => {
    // Siembra gastos en varios días del mes para ver las barras apiladas.
    // En el mes anterior (mes completo) para que se vean varios días.
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const seed = [
      ['mercancia', 120, 'paid'], ['transporte', 35, 'pending'], ['servicios', 60, 'paid'],
      ['mercancia', 240, 'pending'], ['publicidad', 45, 'paid'], ['alquiler', 300, 'paid'],
      ['sueldos', 180, 'paid'], ['mercancia', 90, 'paid'], ['impuestos', 70, 'pending'],
      ['mercancia', 150, 'paid'], ['transporte', 40, 'paid'], ['mercancia', 310, 'pending'],
      ['servicios', 25, 'paid'], ['publicidad', 80, 'paid'], ['mercancia', 60, 'paid'],
    ];
    seed.forEach(([category, amount, status], i) => {
      const day = String([2, 2, 5, 8, 8, 1, 15, 12, 20, 20, 22, 26, 26, 18, 9][i]).padStart(2, '0');
      db.tenant_expenses.push({ id: `seed-${i}`, created_at: now.toISOString(), supplier: `Proveedor ${i + 1}`, invoice_number: null, category, description: null, amount, currency: 'USD', issue_date: `${ym}-${day}`, due_date: null, status, paid_at: null, attachments: [], notes: null });
    });
    await page.getByTitle('Mes anterior').click();
    await page.getByText('Ir al mes actual').waitFor();
    await page.waitForTimeout(1000); // la gráfica se vuelve a dibujar con el mes nuevo
    const chart = page.getByTestId('expense-daily-chart');
    await chart.locator('.apexcharts-bar-area:not([val="0"])').first().waitFor({ timeout: 8000 });
    await chart.scrollIntoViewIfNeeded();
    { const b = await chart.locator('.apexcharts-bar-area:not([val="0"])').first().boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
    await expectText(chart.locator('.apexcharts-tooltip'), 'Total');
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-grafica-por-categoria.png`) });
    await chart.getByRole('button', { name: 'Pagado / por pagar' }).click();
    await expectText(chart.locator('.apexcharts-legend'), 'Por pagar');
    { const b = await chart.locator('.apexcharts-bar-area:not([val="0"])').first().boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
    await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-grafica-por-estado.png`) });
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
