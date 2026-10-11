/**
 * Auditoría i18n profunda (KEY-AS-TEXT): extrae keys usadas en el código y
 * las compara contra el es.json de cada app. Reporta keys usadas que NO
 * existen en es.json (se verían en español en en/fr/pt).
 *
 * Uso: node i18n-audit.mjs <repoRoot>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(process.argv[2] ?? ".");

function walk(dir, exts, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.') || e === 'dist') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.endsWith(x)) && !e.includes('.spec.') && !e.includes('.test.')) out.push(p);
  }
  return out;
}

// des-escapa \' dentro de strings TS/HTML
const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\`/g, '`');

function extractFromHtml(src) {
  const keys = [];
  // '...' | transloco   (con o sin params después)
  const re = /'((?:[^'\\]|\\.)+)'\s*\|\s*transloco/g;
  let m;
  while ((m = re.exec(src))) keys.push(unesc(m[1]));
  return keys;
}

function extractFromTs(src) {
  const keys = [];
  const patterns = [
    // translate('...'), transloco.translate('...'), translate.translate('...')
    /\btranslate\(\s*'((?:[^'\\]|\\.)+)'/g,
    /\bselectTranslate\(\s*'((?:[^'\\]|\\.)+)'/g,
    // toaster (SonnerService): success/info/warning/loading con literal
    /\b(?:toast|toaster|sonner)\w*\.(?:success|info|warning|loading|error)\(\s*'((?:[^'\\]|\\.)+)'/gi,
    // ConfirmService labels
    /\b(?:headerLabel|acceptLabel|rejectLabel)\s*:\s*'((?:[^'\\]|\\.)+)'/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) keys.push(unesc(m[1]));
  }
  return keys;
}

function collect(dirs) {
  const used = new Map(); // key -> [files]
  for (const d of dirs) {
    for (const f of walk(join(ROOT, d), ['.html', '.ts'])) {
      const src = readFileSync(f, 'utf8');
      const ks = f.endsWith('.html') ? extractFromHtml(src) : extractFromTs(src);
      for (const k of ks) {
        if (!used.has(k)) used.set(k, []);
        used.get(k).push(relative(ROOT, f));
      }
    }
  }
  return used;
}

const scopes = {
  'apps/catalogohoy': ['apps/catalogohoy/src', 'libs'],
  'apps/authentication': ['apps/authentication/src', 'libs/catalogohoy/auth'],
  'apps/internal': ['apps/internal/src'],
};

for (const [app, dirs] of Object.entries(scopes)) {
  const es = JSON.parse(readFileSync(join(ROOT, app, 'public/i18n/es.json'), 'utf8'));
  const esKeys = new Set(Object.keys(es));
  const used = collect(dirs);
  const missing = [...used.keys()].filter((k) => !esKeys.has(k));
  console.log(`\n### ${app}: ${used.size} keys usadas, ${missing.length} FALTAN en es.json`);
  for (const k of missing.sort()) {
    console.log(`  ✗ "${k}"`);
    for (const f of [...new Set(used.get(k))].slice(0, 2)) console.log(`      ${f}`);
  }
}
