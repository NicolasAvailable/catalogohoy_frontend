---
name: qa
description: "QA con evidencia al terminar un fix o funcionalidad. Corre las pruebas unitarias de lo afectado y, si es front, levanta Playwright (contra prod con sesión Supabase inyectada, o contra la app servida), prueba TODO el flujo afectado + edge cases + mobile, lanza agentes de QA en paralelo para cazar bugs/regresiones, y deja la evidencia (capturas + resultados) en un Artifact con el link para el usuario. Invocar con /qa, o AUTO-invocar cuando el usuario diga cosas como 'lanzá/corré los agentes de QA', 'hacé QA de esto', 'probá todo', 'dejá evidencia', o cuando se acaba de terminar un fix/feature de calibre y hay que verificarlo antes de darlo por hecho."
metadata:
  author: Nicolas Soto
  version: 1.0.0
---

# /qa — QA con evidencia (unit + Playwright + agentes + Artifact)

Verificar un fix o funcionalidad **de verdad**: que compile y pasen los tests NO alcanza para algo
visible o de comportamiento. Este es el proceso a seguir cuando se termina un cambio (o cuando Nicolas
pide "QA", "probá todo", "lanzá los agentes", "dejá evidencia").

> Regla de oro (feedback de Nicolas): los cambios visibles/de comportamiento se verifican **viéndolos
> correr** y quedan con **evidencia en un Artifact**, no con "confío en que anda". Un cambio que compila
> puede igual verse mal, romper otro tipo de tenant, o cortarse en mobile.

## Cuándo se dispara
Al terminar un fix o feature que toque: precios/moneda, carrito, checkout, factura/PDF, catálogo,
órdenes, forms, componentes, estados, i18n visible, layout/responsive, o cualquier lógica de negocio.
Para un cambio trivial (un texto, un typo) alcanza con criterio; para lo demás, correr QA.

## Paso 0 — Scope
1. `git diff HEAD` (o el diff del worktree) → qué archivos/proyectos cambiaron.
2. ¿Es **front** (Angular, afecta UI/flujo) o solo **back/lógica**? Define si hay que levantar Playwright.
3. Identificá el/los proyecto(s) Nx afectados (p. ej. `e-commerce`, `order`, `catalogohoy`).

## Paso 1 — Pruebas unitarias
Corré los specs del/los proyecto(s) afectado(s). Si el cambio es lógica pura (store, model, service),
**agregá o extendé un spec** que cubra el caso nuevo + un edge case.
```bash
NX_DAEMON=false npx nx test <proyecto> --testPathPattern='<archivo>\.spec\.ts$' --skip-nx-cache
```
- ⚠️ `--testPathPattern` de Nx es laxo (los `.` son comodín) y suele correr specs de más. Filtrá la
  salida por el archivo que te importa y confirmá su línea `PASS`.
- ⚠️ **Fallos pre-existentes conocidos (NO los introdujiste vos):** en `e-commerce` fallan
  `tenant-currency.store.spec.ts`, `ecommerce-config.store.spec.ts`, `ecommerce-config-editor.spec.ts`
  (asertan conteos de llamadas a Supabase, sensibles al entorno). Verificá que TU spec pase y que los
  fallos sean solo esos; no los cuentes como tuyos.

## Paso 2 — Build / typecheck (si es front)
```bash
NX_DAEMON=false npx nx build catalogohoy --skip-nx-cache   # rc 0 = OK
```

## Paso 3 — E2E con Playwright (si es front)
Probar el flujo afectado corriendo de verdad. Dos modos:
- **Contra PROD** (recomendado tras deployar): `https://catalogohoy.catalogohoy.com/admin/...` para el
  admin, o `https://<slug>.catalogohoy.com` para el storefront de un tenant (p. ej.
  `distribuidoramotofox.catalogohoy.com`). El carrito es localStorage → **no destructivo**.
- **Contra la app servida**: `npm run serve:catalogohoy` (usa Supabase de PROD; el slug dev por defecto
  resuelve al **tenant 6** `catalogohoy`).

### Receta base (sesión inyectada + Playwright del repo)
```js
import { createRequire } from 'node:module';
const require = createRequire('/Users/nicolassoto/Desktop/projects/catalogohoy_frontend/');
const { chromium } = require('playwright');           // usar el playwright del repo
const SUPA = 'https://yvkurjivijnhliofmfmj.supabase.co';
const APIKEY = 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs'; // publishable (front)
// login de prueba: nicaso3006@gmail.com / nicolas  → resuelve al ADMIN del tenant 6
const s = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method:'POST', headers:{apikey:APIKEY,'Content-Type':'application/json'},
  body:JSON.stringify({email:'nicaso3006@gmail.com', password:'nicolas'})})).json();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:950} });
await ctx.addInitScript(([k,v])=>{try{localStorage.setItem(k,v)}catch{}},
  ['sb-yvkurjivijnhliofmfmj-auth-token', JSON.stringify(s)]);   // inyecta la sesión
const page = await ctx.newPage();
```

### Selectores y gotchas de Playwright (probados)
- Los íconos Lucide renderizan `<svg class="lucide lucide-<name>">` → seleccioná `button:has(svg.lucide-download)`.
- **Filtrá `:visible`** (`...:visible`): el DOM tiene layout mobile Y desktop a la vez; `.first()` puede
  agarrar el oculto y el click cuelga (timeout de actionability).
- Si el ícono **cambia al hacer click** (p. ej. download → spinner), tomá `const h = await loc.elementHandle()`
  ANTES y consultá el mismo `h` después (si re-resolvés por el ícono viejo agarrás otro botón).
- Toasts = ngx-sonner: `page.getByText('...')` (el loading `toast.loading` dura hasta que cierra).
- **Mobile**: `newContext({ viewport:{width:390,height:844}, isMobile:true })` para cazar cortes/overflow.
  Chequeo de corte horizontal: `container.scrollWidth <= container.clientWidth`.
- Descargas (jsPDF `doc.save`): `acceptDownloads:true` + `page.on('download', d=>d.saveAs(...))`.
- Para PDFs: `pdftotext -layout` (contar/leer) y `pdftoppm -r 130 -png` + `PIL` para recortar zonas; los
  PDF/PNG se inspeccionan con el propio Read (renderiza páginas).
- **No destructivo**: no completes órdenes reales; si tocás config del tenant demo (6) o data de prueba,
  **revertí al terminar y decilo**. Para realtime sin disparar triggers: `SET session_replication_role = replica;`.

## Paso 4 — Agentes de QA en paralelo
Lanzá **2+ agentes en un solo mensaje** (Agent tool) con el diff + las capturas, cada uno con una lente
distinta, a cazar lo que se te escapó:
- **Correctness / edge cases**: valores límite, null/vacíos, monedas (solo-Bs vs dual vs no-VE), permisos.
- **Regresiones / visual**: que el cambio no rompa otros flujos ni otros tipos de tenant; revisar mobile.
- **Adversarial** (para cambios grandes): intentar refutar que el fix realmente arregla el caso reportado.
Consolidá los hallazgos reales (descartá falsos positivos) y arreglá lo que sobreviva antes de cerrar.

## Paso 5 — Evidencia en un Artifact
Antes de escribir la página, **cargá la skill `artifact-design`**. Armá un Artifact (HTML) con:
- Antes/después con **capturas reales** (embebé PNG como data URI; recortá con PIL para que se vea el punto).
- Resultados de los tests (unit + E2E, el JSON de asserts).
- Hallazgos de los agentes y qué se corrigió.
- El commit/deploy (`main <hash>`, bundle en prod).
Pasale el **link del Artifact** al usuario.

## Cierre
- Reportá con franqueza: si algo no se pudo reproducir o quedó sin verificar, decilo (no lo maquilles).
- Borrá scripts/temporales del scratchpad si molestan; revertí cualquier data de prueba.
- Si deployaste: dejá el commit y el bundle en prod anotados.

## Referencias del repo (memorias)
`[[visual-qa-process]]` (origen del proceso), `[[playwright-admin-credentials]]` (login de prueba),
`[[e2e-admin-prod]]` (sesión inyectada contra prod), `[[deploy-push-to-main]]` (deploy aislado por
worktree + poll del bundle), `[[whatsapp-demo-tenant]]` (cuidar config del tenant 6), `[[use-rem-not-px]]`.
