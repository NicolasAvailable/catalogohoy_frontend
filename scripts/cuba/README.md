# Cuba — pruebas locales con evidencia

Probar una feature del admin en local **sin tocar producción**: el dev server corre normal y
Playwright intercepta todas las llamadas a Supabase (`mock.js`) con una sesión falsa de dueño
("Tienda Demo", tenant 1, moneda USD + Bs). Cada paso queda con ✅/❌ y capturas.

```bash
npx jest -c libs/catalogohoy/<lib>/jest.config.ts   # unitarias de la lib tocada
npx nx build catalogohoy                            # compila
npx nx serve catalogohoy --port 4200                # en segundo plano
# En el contenedor cloud hay que pasar el Chromium preinstalado:
CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/expenses.e2e.js
CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/orders-metrics.e2e.js
CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/bulk-edit.e2e.js
# Export de productos (CAT-114) con los productos reales de la cuenta demo (tenant 1997),
# bajados de prod en solo lectura a un JSON (ver cabecera del script):
PRODUCTS_JSON=/tmp/demo-products.json CHROME_PATH=/opt/pw-browsers/chromium OUT=/tmp/cuba-shots node scripts/cuba/products-export.e2e.js
```

- `mock.js`: `setupMock(page, { log, routes })`. Con `log: true` imprime cada request para
  descubrir qué endpoints usa la pantalla; lo que no está mockeado responde `[]` / `null`.
  Agrega los de tu feature en `routes` (o un handler en memoria como `tenant_expenses`).
- `<feature>.e2e.js`: un script por feature, con `step()` por cada paso del usuario.
- Trampas: los `p-dialog` de PrimeNG se renderizan en `body` (no dentro de `ui-dialog`); usa
  `locale: 'es-ES'` en el contexto (si no, el admin sale en inglés); preferir `data-testid`
  a selectores de layout.
- Gráficas ApexCharts: espera una barra con `:not([val="0"])` (las de valor 0 no son visibles) y
  mueve el mouse con `page.mouse.move` al centro de la barra para que salga el tooltip; espera
  ~1 s tras cambiar de mes/periodo porque la gráfica se vuelve a dibujar.

- **Datos de la cuenta demo** (demo@catalogohoy.com → AutoRepuestos Rodriguez, tenant 1997): el
  contenedor cloud no llega a Supabase, así que no se puede hacer login real. Se leen sus filas de
  prod en solo lectura (Supabase MCP `execute_sql`) a un JSON y el mock las sirve. Nunca escribir
  en prod desde una prueba.
- **Descargas**: `acceptDownloads: true` en el contexto + `page.waitForEvent('download')`, y leer el
  archivo con `xlsx` para verificar el contenido real, no solo el toast.
