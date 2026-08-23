// E2E: acciones rápidas del listado de productos — editar / ocultar-mostrar
// (eye) / compartir / menú ⋯ (duplicar + eliminar).
//
// Flujo (admin real, tenant del DEV_TENANT_SLUG en local o subdominio en prod):
//   1. Listado: cada fila tiene 4 acciones (pencil, eye-off, share2, ⋯).
//   2. Toggle ocultar: eye-off → toast + badge "Oculto"; eye → vuelve visible.
//   3. Menú ⋯ → Duplicar → aparece "(copia)" oculto.
//   4. Menú ⋯ de la copia → Eliminar → confirmar → desaparece (sin residuos).
//
// Uso: node scripts/e2e-product-quick-actions.mjs <baseUrl>
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4272';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/e2e-quick-actions';

const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';

const log = (m) => console.log(`[e2e] ${m}`);

const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: APIKEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'nicaso3006@gmail.com', password: 'nicolas' }),
});
const session = await res.json();
if (!session.access_token) throw new Error('login fallo');

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    'sb-yvkurjivijnhliofmfmj-auth-token',
    JSON.stringify(session),
  ]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('section.hidden.sm\\:flex, [class*="sm:flex"]', { timeout: 30000 });
  await page.waitForTimeout(2500);

  // ── 1. Layout de acciones: pencil, eye-off, share2, ellipsis ──────────
  const firstRow = page.locator('section:has(button:has(svg))').filter({ hasText: '$' }).first();
  const iconsOk = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('section')].filter((s) =>
      s.querySelector('.lucide-pencil, svg.lucide-pencil')
    );
    const row = rows[0];
    if (!row) return 'no-row';
    const has = (name) => !!row.querySelector(`.lucide-${name}, svg.lucide-${name}`);
    return JSON.stringify({
      pencil: has('pencil'),
      eyeOff: has('eye-off'),
      share: has('share2') || has('share-2'),
      ellipsis: has('ellipsis-vertical'),
      copyStandalone: has('copy'),
      trashStandalone: has('trash'),
    });
  });
  log(`layout fila 1: ${iconsOk}`);
  const layout = JSON.parse(iconsOk);
  if (!layout.pencil || !layout.eyeOff || !layout.share || !layout.ellipsis) {
    throw new Error('faltan acciones en la fila');
  }
  if (layout.copyStandalone || layout.trashStandalone) {
    throw new Error('duplicar/eliminar siguen como botones sueltos');
  }
  await page.screenshot({ path: `${SHOTS}/1-layout-acciones.png` });

  // ── 2. Toggle ocultar/mostrar sobre la primera fila ───────────────────
  const eyeOffBtn = page.locator('button:has(.lucide-eye-off)').first();
  await eyeOffBtn.click();
  await page.waitForSelector('text=Producto oculto del catálogo', { timeout: 10000 });
  log('toggle: oculto ✅ (toast)');
  await page.waitForTimeout(2500); // refresh de la lista
  await page.waitForSelector('text=Oculto', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/2-producto-oculto.png` });

  const eyeBtn = page.locator('button:has(.lucide-eye)').first();
  await eyeBtn.click();
  await page.waitForSelector('text=Producto visible en el catálogo', { timeout: 10000 });
  log('toggle: visible de nuevo ✅ (toast)');
  await page.waitForTimeout(2500);

  // ── 3. Menú ⋯ → Duplicar ─────────────────────────────────────────────
  await page.locator('button:has(.lucide-ellipsis-vertical)').first().click();
  await page.waitForSelector('text=Duplicar', { timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/3-menu-abierto.png` });
  await page.getByText('Duplicar', { exact: true }).click();
  await page.waitForSelector('text=Producto duplicado correctamente', { timeout: 15000 });
  log('menú ⋯ → Duplicar ✅');
  await page.waitForTimeout(3000);
  // La copia queda al FINAL (última página) → ubicarla con el buscador.
  await page.locator('input[placeholder*="Buscar"]').fill('(copia)');
  await page.waitForSelector('text=(copia)', { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/4-copia-creada.png` });

  // ── 4. Menú ⋯ de la copia → Eliminar → confirmar ─────────────────────
  const copyRow = page.locator('section', { hasText: '(copia)' }).last();
  await copyRow.locator('button:has(.lucide-ellipsis-vertical)').first().click();
  await page.waitForSelector('text=Eliminar', { timeout: 5000 });
  await page.getByText('Eliminar', { exact: true }).first().click();
  // Confirm dialog (header "Eliminar producto" + botón aceptar "Eliminar").
  await page.waitForSelector('text=Eliminar producto', { timeout: 8000 });
  await page.locator('.p-dialog button:has-text("Eliminar"), [role="dialog"] button:has-text("Eliminar")').last().click();
  await page.waitForSelector('text=Se eliminó el producto correctamente', { timeout: 10000 });
  log('menú ⋯ → Eliminar (con confirmación) ✅ (toast de eliminado)');
  await page.screenshot({ path: `${SHOTS}/5-copia-eliminada.png` });

  log('✅ TEST OK: layout nuevo + ocultar/mostrar + duplicar + eliminar');
  process.exitCode = 0;
} catch (err) {
  console.error('❌ TEST FALLO:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
