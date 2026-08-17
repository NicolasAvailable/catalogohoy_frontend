import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Renderiza el formato de texto de WhatsApp en las burbujas:
 *  *negrita* · _cursiva_ · ~tachado~ · `monoespaciado` · ```bloques```.
 *  Además detecta URLs y las convierte en hipervínculos (abren en pestaña nueva)
 *  con un botón para copiarlas.
 *  Escapa el HTML del mensaje ANTES de inyectar los tags propios, así el
 *  [innerHTML] es seguro aunque el texto venga del cliente. */
@Pipe({ name: 'waFormat', standalone: true })
export class WaFormatPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /** Ícono "copiar" (Lucide copy) embebido para el botón junto a cada enlace. */
  private static readonly COPY_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  transform(value: string | null | undefined): SafeHtml {
    let t = (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Centinela imposible de tipear (carácter NUL) para marcar los enlaces sin
    // agregar espacios ni caracteres visibles al mensaje.
    const NUL = String.fromCharCode(0);

    // Los enlaces se extraen a placeholders ANTES de aplicar el formato, para que
    // los marcadores (_ * ~) que aparezcan dentro de una URL no la rompan; se
    // reinyectan al final.
    const links: string[] = [];
    t = t.replace(/(\b(?:https?:\/\/|www\.)[^\s<]+)/gi, (raw) => {
      // No arrastrar la puntuación final típica (. , ) ] ! ? …) dentro del href.
      const trail = raw.match(/[.,;:!?)\]}'"]+$/)?.[0] ?? '';
      const url = raw.slice(0, raw.length - trail.length);
      const safe = url.replace(/"/g, '%22');
      const href = safe.startsWith('www.') ? 'https://' + safe : safe;
      const token = `${NUL}${links.length}${NUL}`;
      links.push(
        `<span class="wa-linkwrap"><a href="${href}" target="_blank" ` +
          `rel="noopener noreferrer" class="wa-link">${url}</a>` +
          `<button type="button" class="wa-copy" data-url="${href}" ` +
          `aria-label="Copiar enlace" title="Copiar enlace">${WaFormatPipe.COPY_SVG}</button></span>`
      );
      return token + trail;
    });

    // Los marcadores solo aplican si el contenido no empieza/termina en espacio
    // (regla de WhatsApp) — evita convertir "5 * 3 * 2" en negritas.
    t = t.replace(/```([\s\S]+?)```/g, '<code>$1</code>');
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '<strong>$1</strong>');
    t = t.replace(/_(\S(?:[^_\n]*\S)?)_/g, '<em>$1</em>');
    t = t.replace(/~(\S(?:[^~\n]*\S)?)~/g, '<s>$1</s>');

    // Reinyectar los enlaces ya formateados.
    t = t.replace(new RegExp(NUL + '(\\d+)' + NUL, 'g'), (_, i) => links[+i]);

    return this.sanitizer.bypassSecurityTrustHtml(t);
  }
}
