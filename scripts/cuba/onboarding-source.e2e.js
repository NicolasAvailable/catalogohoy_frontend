// Onboarding paso 4 "¿Cómo nos conociste?" (CAT-122). Teléfono (390px) y
// computadora. Arranca en el paso 3 (Entrega y pago) para probar el paso
// 3 → 4 con "Finalizar" y con "Saltar", y que al final guarda heard_from en
// user_metadata (PUT /auth/v1/user) y cierra el onboarding (set step null).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { setupMock } = require('./mock');

const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'cuba-shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4200';
const results = [];
const step = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

async function open(browser, viewport, startStep) {
  const mobile = viewport.width < 640;
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const calls = { userUpdates: [], steps: [] };
  await setupMock(page, {
    routes: {
      '/rest/v1/rpc/get_my_onboarding_step': (route) => route.fulfill({ json: startStep }),
      '/rest/v1/rpc/set_my_onboarding_step': (route, req) => { calls.steps.push(JSON.parse(req.postData() || '{}').p_step); return route.fulfill({ json: null }); },
      '/auth/v1/user': (route, req) => {
        if (req.method() === 'PUT') calls.userUpdates.push(JSON.parse(req.postData() || '{}'));
        return route.fulfill({ json: { id: '00000000-0000-0000-0000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'demo@catalogohoy.com', app_metadata: {}, user_metadata: { name: 'Demo' } } });
      },
    },
  });
  await page.goto(`${BASE}/onboarding?slug=catalogohoy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return { ctx, page, calls };
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  // 1) Teléfono: paso 3 → Finalizar → paso 4 → "Otro" + texto → Finalizar
  {
    const { ctx, page, calls } = await open(browser, { width: 390, height: 844 }, 2);
    step('Paso 3 dice "Paso 3 / 4"', await page.getByText(/Paso\s*3\s*\/\s*4/).first().isVisible().catch(() => false));
    await page.getByRole('button', { name: 'Finalizar' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1200);
    const onSource = await page.getByRole('heading', { name: '¿Cómo nos conociste?' }).isVisible().catch(() => false);
    step('Finalizar en paso 3 lleva al paso 4 (¿Cómo nos conociste?)', onSource);
    step('Paso 4 dice "Paso 4 / 4"', await page.getByText(/Paso\s*4\s*\/\s*4/).first().isVisible().catch(() => false));
    step('Guarda el paso 4 en DB para retomar', calls.steps.includes(3), JSON.stringify(calls.steps));
    const labels = await page.locator('button[data-testid^="heard-from-"]').filter({ visible: true }).allInnerTexts();
    step('Muestra las opciones', ['Instagram', 'TikTok', 'Facebook', 'Google', 'ChatGPT', 'Claude', 'Gemini', 'Un amigo', 'Otro'].every((l) => labels.map((x) => x.trim()).includes(l)), labels.join(', '));
    const finish = page.getByRole('button', { name: 'Finalizar' }).filter({ visible: true }).first();
    const isOff = async () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && /Finalizar/.test(x.textContent || '')); return b.length > 0 && b.every((x) => x.disabled); });
    step('Finalizar desactivado sin elegir', await isOff());
    await page.screenshot({ path: path.join(OUT, '01-movil-paso4.png') });
    await page.locator('button[data-testid="heard-from-other"]').click();
    await page.waitForTimeout(400);
    const input = page.locator('ui-input-text[data-testid="heard-from-other-text"] input');
    step('Al elegir "Otro" aparece el campo para escribir', await input.isVisible());
    step('Con "Otro" vacío, Finalizar sigue desactivado', await isOff());
    await input.fill('Un grupo de Facebook de emprendedores');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '02-movil-otro.png') });
    await finish.click();
    await page.waitForTimeout(2000);
    const upd = calls.userUpdates.at(-1);
    step('Guarda heard_from=other + texto en el perfil', upd?.data?.heard_from === 'other' && upd?.data?.heard_from_other === 'Un grupo de Facebook de emprendedores', JSON.stringify(upd));
    step('Cierra el onboarding (paso null) y va al admin', calls.steps.includes(null) && /\/admin/.test(page.url()), page.url());
    await page.screenshot({ path: path.join(OUT, '03-movil-admin.png') });
    await ctx.close();
  }

  // 2) Teléfono: paso 3 → Saltar → paso 4 → Instagram → Finalizar
  {
    const { ctx, page, calls } = await open(browser, { width: 390, height: 844 }, 2);
    await page.getByRole('button', { name: 'Saltar' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(1200);
    step('Saltar en paso 3 también lleva al paso 4', await page.getByRole('heading', { name: '¿Cómo nos conociste?' }).isVisible().catch(() => false));
    await page.locator('[data-testid="heard-from-instagram"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '04-movil-instagram.png') });
    await page.getByRole('button', { name: 'Finalizar' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000);
    const upd = calls.userUpdates.at(-1);
    step('Guarda heard_from=instagram', upd?.data?.heard_from === 'instagram' && upd?.data?.heard_from_other === null, JSON.stringify(upd));
    await ctx.close();
  }

  // 3) Paso 4 → Saltar: cierra sin guardar
  {
    const { ctx, page, calls } = await open(browser, { width: 390, height: 844 }, 3);
    step('Retoma directo en el paso 4', await page.getByRole('heading', { name: '¿Cómo nos conociste?' }).isVisible().catch(() => false));
    await page.getByRole('button', { name: 'Saltar' }).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000);
    step('Saltar en paso 4 cierra sin guardar canal', calls.userUpdates.length === 0 && /\/admin/.test(page.url()), page.url());
    await ctx.close();
  }

  // 4) Computadora
  {
    const { ctx, page } = await open(browser, { width: 1400, height: 900 }, 3);
    await page.locator('[data-testid="heard-from-chatgpt"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '05-escritorio-paso4.png') });
    step('En computadora se ve el paso 4', await page.getByRole('heading', { name: '¿Cómo nos conociste?' }).isVisible().catch(() => false));
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'resultados.txt'), results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`).join('\n'));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
