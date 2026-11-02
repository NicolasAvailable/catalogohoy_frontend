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
```

- `mock.js`: `setupMock(page, { log, routes })`. Con `log: true` imprime cada request para
  descubrir qué endpoints usa la pantalla; lo que no está mockeado responde `[]` / `null`.
  Agrega los de tu feature en `routes` (o un handler en memoria como `tenant_expenses`).
- `<feature>.e2e.js`: un script por feature, con `step()` por cada paso del usuario.
- Trampas: los `p-dialog` de PrimeNG se renderizan en `body` (no dentro de `ui-dialog`); usa
  `locale: 'es-ES'` en el contexto (si no, el admin sale en inglés); preferir `data-testid`
  a selectores de layout.
