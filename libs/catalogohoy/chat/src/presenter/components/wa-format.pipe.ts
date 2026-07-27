import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Renderiza el formato de texto de WhatsApp en las burbujas:
 *  *negrita* · _cursiva_ · ~tachado~ · `monoespaciado` · ```bloques```.
 *  Escapa el HTML del mensaje ANTES de inyectar los tags propios, así el
 *  [innerHTML] es seguro aunque el texto venga del cliente. */
@Pipe({ name: 'waFormat', standalone: true })
export class WaFormatPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    let t = (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Los marcadores solo aplican si el contenido no empieza/termina en espacio
    // (regla de WhatsApp) — evita convertir "5 * 3 * 2" en negritas.
    t = t.replace(/```([\s\S]+?)```/g, '<code>$1</code>');
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '<strong>$1</strong>');
    t = t.replace(/_(\S(?:[^_\n]*\S)?)_/g, '<em>$1</em>');
    t = t.replace(/~(\S(?:[^~\n]*\S)?)~/g, '<s>$1</s>');

    return this.sanitizer.bypassSecurityTrustHtml(t);
  }
}
