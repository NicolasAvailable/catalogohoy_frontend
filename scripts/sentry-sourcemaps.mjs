#!/usr/bin/env node
/**
 * Sube los source maps de un build de prod a Sentry y luego los BORRA del
 * output, para que nunca se publiquen (no exponer el código fuente).
 *
 * Uso (corre como postbuild, ver scripts build:* en package.json):
 *   node scripts/sentry-sourcemaps.mjs <distPath> <sentryProject>
 *   ej: node scripts/sentry-sourcemaps.mjs dist/apps/catalogohoy admin-dashboard
 *
 * Requiere la env `SENTRY_AUTH_TOKEN` (se configura en Vercel, no en el repo).
 * Es FAIL-SAFE: si no hay token o falla la subida, NO rompe el build —
 * solo avisa y de todas formas borra los .map para no filtrarlos.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SENTRY_ORG = 'catalogohoy';
const [distPath, sentryProject] = process.argv.slice(2);

if (!distPath || !sentryProject) {
  console.error('[sentry-sourcemaps] faltan args: <distPath> <sentryProject>');
  process.exit(0); // no romper el build
}

if (!existsSync(distPath)) {
  console.warn(`[sentry-sourcemaps] no existe ${distPath}, nada que hacer.`);
  process.exit(0);
}

const token = process.env.SENTRY_AUTH_TOKEN;
const cli = join('node_modules', '.bin', 'sentry-cli');

function deleteMaps(dir) {
  let removed = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) removed += deleteMaps(p);
    else if (entry.endsWith('.map')) {
      rmSync(p);
      removed++;
    }
  }
  return removed;
}

try {
  if (!token) {
    console.warn(
      '[sentry-sourcemaps] SENTRY_AUTH_TOKEN no seteado — se omite la subida ' +
        'a Sentry (los stack traces saldrán minificados).'
    );
  } else {
    const env = { ...process.env, SENTRY_ORG, SENTRY_PROJECT: sentryProject };
    console.log(`[sentry-sourcemaps] inyectando debug ids en ${distPath}…`);
    execFileSync(cli, ['sourcemaps', 'inject', distPath], {
      stdio: 'inherit',
      env,
    });
    console.log(
      `[sentry-sourcemaps] subiendo source maps a Sentry (${SENTRY_ORG}/${sentryProject})…`
    );
    execFileSync(
      cli,
      [
        'sourcemaps',
        'upload',
        '--org',
        SENTRY_ORG,
        '--project',
        sentryProject,
        distPath,
      ],
      { stdio: 'inherit', env }
    );
    console.log('[sentry-sourcemaps] ✓ source maps subidos.');
  }
} catch (err) {
  // Nunca romper el deploy por un problema de Sentry.
  console.warn(
    '[sentry-sourcemaps] ⚠ falló la subida a Sentry (se continúa):',
    err?.message ?? err
  );
} finally {
  // Pase lo que pase, borrar los .map para que NO se publiquen.
  const removed = deleteMaps(distPath);
  console.log(`[sentry-sourcemaps] ✓ ${removed} archivo(s) .map borrados del output.`);
}
