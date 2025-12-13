import { CommonModule } from '@angular/common';
import {
  Component,
  contentChild,
  input,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { MenuItem as PrimeNgMenuItem } from 'primeng/api';
import { PanelMenu, PanelMenuModule } from 'primeng/panelmenu';

export type PanelMenuItem = PrimeNgMenuItem;

@Component({
  selector: 'ui-panel-menu',
  imports: [CommonModule, PanelMenuModule],
  template: `
    <p-panelmenu
      #panelMenu
      [model]="items()"
      [multiple]="multiple()"
      [style]="style()"
      [class]="styleClass()"
      [transitionOptions]="transitionOptions()"
      [tabindex]="tabindex()"
    >
      @if(itemTemplate()){
      <ng-template #item let-item>
        <ng-container
          [ngTemplateOutlet]="itemTemplate()!"
          [ngTemplateOutletContext]="{ $implicit: item }"
        />
      </ng-template>
      }
    </p-panelmenu>
  `,
})
export class PanelMenuComponent {
  public readonly items = input<PanelMenuItem[]>([]);
  public readonly multiple = input(false);
  public readonly style = input<{ [klass: string]: string } | null>(null);
  public readonly styleClass = input('');
  public readonly transitionOptions = input(
    '400ms cubic-bezier(0.86, 0, 0.07, 1)'
  );
  public readonly tabindex = input(0);

  public readonly panelMenu = viewChild.required<PanelMenu>('panelMenu');

  public readonly itemTemplate =
    contentChild<TemplateRef<{ $implicit: PanelMenuItem }>>('item');

  public collapseAll() {
    this.items().forEach((item) => {
      if (item.expanded) {
        item.expanded = false;
      }
    });
  }

  public expandAll() {
    this.items().forEach((item) => {
      if (item.items && item.items.length > 0) {
        item.expanded = true;
      }
    });
  }

  public toggleAll() {
    const hasExpandedItems = this.items().some((item) => item.expanded);
    if (hasExpandedItems) {
      this.collapseAll();
    } else {
      this.expandAll();
    }
  }
}
