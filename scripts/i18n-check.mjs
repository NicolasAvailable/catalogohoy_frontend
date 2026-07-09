/**
 * Chequeo de paridad de keys de i18n: en/fr/pt deben tener exactamente las
 * mismas keys que es.json (la fuente). Falla con exit 1 si hay drift.
 *
 * Uso: node scripts/i18n-check.mjs [appDir...]   (default: las 3 apps)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apps = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['apps/catalogohoy', 'apps/authentication', 'apps/internal'];

const LANGS = ['en', 'fr', 'pt'];
let failed = false;

for (const app of apps) {
  const dir = resolve(app, 'public/i18n');
  const source = JSON.parse(readFileSync(resolve(dir, 'es.json'), 'utf8'));
  const sourceKeys = new Set(Object.keys(source));

  for (const lang of LANGS) {
    const target = JSON.parse(readFileSync(resolve(dir, `${lang}.json`), 'utf8'));
    const targetKeys = new Set(Object.keys(target));

    const missing = [...sourceKeys].filter((k) => !targetKeys.has(k));
    const extra = [...targetKeys].filter((k) => !sourceKeys.has(k));
    const empty = [...targetKeys].filter((k) => !String(target[k]).trim());

    if (missing.length || extra.length || empty.length) {
      failed = true;
      console.error(`\n✗ ${app} → ${lang}.json`);
      for (const k of missing) console.error(`  faltante: ${k}`);
      for (const k of extra) console.error(`  sobrante: ${k}`);
      for (const k of empty) console.error(`  vacía:    ${k}`);
    } else {
      console.log(`✓ ${app} → ${lang}.json (${targetKeys.size} keys)`);
    }
  }
}

process.exit(failed ? 1 : 0);
