import { Injectable } from '@angular/core';
import * as DOMPurifyNS from 'dompurify';

interface PurifierApi {
  sanitize(html: string, config?: Record<string, unknown>): string;
  addHook(name: string, hook: (node: Element) => void): void;
}

const DOMPurify: PurifierApi =
  (DOMPurifyNS as unknown as { default?: PurifierApi }).default ??
  (DOMPurifyNS as unknown as PurifierApi);

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ol',
  'ul',
  'li',
  'a',
  'h2',
  'h3',
  'blockquote',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

const MAX_LENGTH = 5000;

@Injectable({ providedIn: 'root' })
export class HtmlSanitizerService {
  private readonly purifier: PurifierApi = DOMPurify;

  constructor() {
    this.purifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  sanitizeRichText(html: string | null | undefined): string {
    if (!html) return '';
    // Editors (Quill) and pasted content often litter the text with
    // non-breaking spaces — as the `&nbsp;` entity or the raw U+00A0 char —
    // between words. A run of NBSPs is unbreakable, so the whole description
    // renders as a single line that overflows its container instead of
    // wrapping. Collapse them to regular spaces so the text flows normally.
    const normalized = html.replace(/&nbsp;|\u00a0/gi, ' ');
    const clean = this.purifier.sanitize(normalized, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
    });

    if (this.stripTags(clean).trim().length === 0) return '';

    return clean.length > MAX_LENGTH ? clean.slice(0, MAX_LENGTH) : clean;
  }

  stripTags(html: string | null | undefined): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }
}
