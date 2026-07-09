import { CommonModule } from '@angular/common';
import { Component, contentChild, input, output, TemplateRef } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TableModule, TablePageEvent } from 'primeng/table';

@Component({
  selector: 'ui-table',
  imports: [CommonModule, TableModule, TranslocoPipe],
  host: {
    class: 'block w-full h-full',
  },
  template: `
    <section
      [class]="
        'rounded-base! overflow-hidden bg-white-500 p-8 pb-0 flex flex-col h-full ' +
        sectionStyleClass()
      "
    >
      @if(title()){
      <header class="mb-4">
        <h3 class="font-bold text-2xl">{{ title() }}</h3>
      </header>
      }

      <p-table
        [value]="items()"
        [styleClass]="styleClass() + ' flex-1'"
        [scrollable]="scrollable()"
        [scrollHeight]="scrollHeight()"
        [paginator]="paginator()"
        [rows]="rows()"
        [pageLinks]="pageLinks()"
        [showCurrentPageReport]="showCurrentPageReport()"
        [currentPageReportTemplate]="currentPageReportTemplate() | transloco"
        (onPage)="pageChange.emit($event)"
      >
        <ng-template pTemplate="header">
          <ng-container [ngTemplateOutlet]="headerTemplate()!" />
        </ng-template>

        <ng-template pTemplate="body" let-item>
          <ng-container
            [ngTemplateOutlet]="bodyTemplate()!"
            [ngTemplateOutletContext]="{ $implicit: item }"
          />
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td [attr.colspan]="columnsCount()">
              <ng-container [ngTemplateOutlet]="emptyTemplate()!" />
            </td>
          </tr>
        </ng-template>
      </p-table>
    </section>
  `,
})
export class TableComponent {
  public readonly title = input<string>('');
  public readonly items = input<unknown[]>([]);
  public readonly sectionStyleClass = input<string>('');
  public readonly styleClass = input<string>('');
  public readonly scrollable = input<boolean>(false);
  public readonly scrollHeight = input<string>(''); // puede ser 'flex', '60vh', etc.
  public readonly paginator = input<boolean>(false);
  public readonly rows = input<number>(10);
  public readonly pageLinks = input<number>(5);
  public readonly showCurrentPageReport = input<boolean>(false);
  public readonly currentPageReportTemplate = input<string>('{currentPage} de {totalPages}');
  public readonly columnsCount = input<number>(1);

  public readonly pageChange = output<TablePageEvent>();

  public readonly headerTemplate = contentChild<TemplateRef<unknown>>('header');
  public readonly bodyTemplate = contentChild<TemplateRef<unknown>>('body');
  public readonly emptyTemplate = contentChild<TemplateRef<unknown>>('empty');
}
