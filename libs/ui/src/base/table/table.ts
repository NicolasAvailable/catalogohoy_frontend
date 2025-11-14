import { CommonModule } from '@angular/common';
import { Component, contentChild, input, TemplateRef } from '@angular/core';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'ui-table',
  imports: [CommonModule, TableModule],
  template: `
    <section class="rounded-base! overflow-hidden bg-white-500 p-10 pb-0">
      @if(title()){
      <header class="mb-8">
        <h3 class="font-bold text-2xl">{{ title() }}</h3>
      </header>
      }

      <p-table
        [value]="items()"
        [styleClass]="styleClass()"
        [scrollable]="scrollable()"
        [scrollHeight]="scrollHeight()"
      >
        <ng-template #header>
          <ng-container [ngTemplateOutlet]="headerTemplate()!" />
        </ng-template>

        <ng-template #body let-item>
          <ng-container [ngTemplateOutlet]="bodyTemplate()!" [ngTemplateOutletContext]="{ $implicit: item }" />
        </ng-template>
      </p-table>
    </section>
  `,
})
export class TableComponent {
  public readonly title = input<string>('');
  public readonly items = input<unknown[]>([]);
  public readonly styleClass = input<string>('');
  // NUEVOS INPUTS OPCIONALES
  public readonly scrollable = input<boolean>(false);
  public readonly scrollHeight = input<string>(''); // puede ser 'flex', '60vh', etc.

  public readonly headerTemplate = contentChild<TemplateRef<unknown>>('header');
  public readonly bodyTemplate = contentChild<TemplateRef<unknown>>('body');
}
