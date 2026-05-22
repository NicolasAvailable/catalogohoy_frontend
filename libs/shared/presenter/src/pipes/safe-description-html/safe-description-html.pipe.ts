import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HtmlSanitizerService } from '@shared/infrastructure';

const HTML_TAG_REGEX = /<[a-z][\s\S]*?>/i;

@Pipe({ name: 'safeDescriptionHtml' })
export class SafeDescriptionHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(HtmlSanitizerService);
  private readonly domSanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';

    const looksLikeHtml = HTML_TAG_REGEX.test(value);
    const html = looksLikeHtml
      ? this.sanitizer.sanitizeRichText(value)
      : `<p>${this.escapeAndBreak(value)}</p>`;

    return this.domSanitizer.bypassSecurityTrustHtml(html);
  }

  private escapeAndBreak(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
  }
}
