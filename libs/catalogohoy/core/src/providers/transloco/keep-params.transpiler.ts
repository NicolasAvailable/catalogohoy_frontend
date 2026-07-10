import { Injectable } from '@angular/core';
import { DefaultTranspiler } from '@jsverse/transloco';

/**
 * Igual que el DefaultTranspiler pero CONSERVA los placeholders sin resolver
 * ('{currentPage}', '{totalPages}'…) en vez de reemplazarlos por string vacío.
 * Necesario para strings tipo el paginador de PrimeNG, cuyos placeholders los
 * rellena PrimeNG DESPUÉS de la traducción, y hace que un param olvidado
 * degrade a mostrar el placeholder en vez de borrar el texto.
 * El regex asume la interpolación de una llave configurada en
 * transloco.provider.ts (interpolation: ['{','}']).
 */
@Injectable()
export class KeepParamsTranspiler extends DefaultTranspiler {
  public override transpile(
    args: Parameters<DefaultTranspiler['transpile']>[0]
  ): ReturnType<DefaultTranspiler['transpile']> {
    const { value, params = {} } = args as {
      value: unknown;
      params?: Record<string, unknown>;
    };
    if (typeof value !== 'string') return super.transpile(args);

    return value.replace(/\{([^{}]+)\}/g, (match, name: string) => {
      const param = resolvePath(params, name.trim());
      return param === undefined || param === null ? match : String(param);
    });
  }
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      obj
    );
}
