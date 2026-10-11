import { Injectable, signal } from '@angular/core';
import { OrderExcelParseResult } from '../domain';

/** Puente efímero entre el hub de import (lista de órdenes) y el editor de
 *  orden: el hub deja acá el Excel de pedido ya parseado y navega a "crear
 *  orden"; el editor lo consume UNA sola vez en su init, matchea las líneas
 *  contra el catálogo y precarga la orden. */
@Injectable({ providedIn: 'root' })
export class OrderImportDraftService {
  private readonly _draft = signal<OrderExcelParseResult | null>(null);

  set(draft: OrderExcelParseResult): void {
    this._draft.set(draft);
  }

  /** Lee y limpia el draft (el editor lo toma una sola vez). */
  consume(): OrderExcelParseResult | null {
    const draft = this._draft();
    this._draft.set(null);
    return draft;
  }
}
