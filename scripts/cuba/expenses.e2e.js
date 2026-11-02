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
    try { await fn(); results.push(`✅ ${name}`); }
    catch (e) { results.push(`❌ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`); await shot('fallo'); }
  };
  const expectText = async (loc, text) => {
    await loc.filter({ hasText: text }).first().waitFor({ timeout: 5000 });
  };
  const field = (label) => page.locator('.p-dialog div.flex.flex-col', { has: page.locator(`label:text-is("${label}")`) }).last();
  const pick = async (label, option) => {
    await field(label).locator('p-select').click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const fill = async (label, value) => { await field(label).locator('input').first().fill(value); };
  const amount = async (value) => { const i = field('Monto *').locator('input'); await i.click(); await i.press('Control+A'); await i.pressSequentially(value); };
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

  await step('Registrar factura pagada con PDF adjunto', async () => {
    await page.getByRole('button', { name: 'Registrar gasto' }).first().click();
    await fill('Proveedor', 'Repuestos El Motor C.A.');
    await fill('Nº de factura', '000123');
    await fill('Descripción', '20 cascos y 50 cauchos');
    await amount('450');
    const pdf = path.join(OUT, 'factura-000123.pdf');
    fs.writeFileSync(pdf, '%PDF-1.4\n%demo\n');
    await page.locator('.p-dialog input[type=file]').setInputFiles(pdf);
    await expectText(page.locator('.p-dialog a'), 'factura-000123.pdf');
    await shot('formulario-lleno');
    await save();
    await expectText(rows(), 'Repuestos El Motor C.A.');
    await expectText(totals(), '450,00');
    if (!db.tenant_expenses[0].file_url?.includes('factura-000123.pdf')) throw new Error('No se guardó el archivo');
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
    await fill('Descripción', 'Alquiler del local');
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
