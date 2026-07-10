import { Component, inject, input, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent, MenuComponent, MenuItem } from '@ui';
import { AppLanguage } from '../language.const';
import { LanguageService } from '../language.service';

/**
 * Selector de idioma estilo "ES ▾": el trigger muestra el código actual y el
 * menú lista cada idioma con su bandera y nombre nativo. Se usa en el navbar
 * del admin, el header del catálogo público y el login.
 */
@Component({
  selector: 'lib-language-selector',
  imports: [IconComponent, MenuComponent, TranslocoPipe],
  template: `
    <button
      type="button"
      (click)="menu()?.toggle($event)"
      class="flex items-center gap-1 rounded-lg py-2 px-2 cursor-pointer hover:bg-primary-50 transition-colors"
      [class]="styleClass()"
      [attr.aria-label]="'Cambiar idioma' | transloco"
    >
      <span class="text-sm font-semibold uppercase leading-none">
        {{ language.current() }}
      </span>
      <ui-icon name="chevron-down" styleClass="w-4 h-4" />
    </button>
    <ui-menu #langMenu [items]="items" [autoClose]="false">
      <ng-template #item let-item>
        <button
          type="button"
          (click)="select(item)"
          class="w-full flex items-center gap-3 px-3 py-2 cursor-pointer text-sm text-grey-700 hover:bg-primary-50 rounded-md"
        >
          <img [src]="item.icon" [alt]="item.label" class="w-5 h-5 rounded-full shrink-0" />
          <span class="flex-1 text-left">{{ item.label }}</span>
          @if (item.id === language.current()) {
            <ui-icon name="check" styleClass="w-4 h-4 text-primary-500" />
          }
        </button>
      </ng-template>
    </ui-menu>
  `,
})
export class LanguageSelectorComponent {
  protected readonly language = inject(LanguageService);
  protected readonly menu = viewChild<MenuComponent>('langMenu');

  /** Clases extra para adaptar el botón al contexto (navbar vs storefront). */
  public readonly styleClass = input('');

  protected readonly items: MenuItem[] = this.language.languages.map((l) => ({
    id: l.code,
    label: l.label,
    icon: l.flag,
  }));

  protected select(item: MenuItem): void {
    this.language.set(item.id as AppLanguage);
    this.menu()?.hide();
  }
}
