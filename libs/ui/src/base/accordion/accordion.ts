import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import { AccordionModule } from 'primeng/accordion';
import { sleep } from '@shared/domain';
import { ButtonComponent } from '../button';

export interface AccordionPanel {
  ref: string;
  label: string;
  disabled?: boolean;
  [key: string]: any;
}

@_.Directive({ selector: '[accordionPanel]' })
export class AccordionPanelDirective {
  public readonly accordionPanel = _.input.required<string>();
}

@_.Directive({ selector: '[accordionHeader]' })
export class AccordionHeaderDirective {
  public readonly accordionHeader = _.input.required<string>();
}

@_.Component({
  selector: 'ui-accordion',
  imports: [CommonModule, AccordionModule, ButtonComponent],
  template: `
    <p-accordion [(value)]="value" [multiple]="multiple()" [styleClass]="styleClass()">
      @for(item of items(); track item.ref; let i = $index) {
        <p-accordion-panel [value]="i" [disabled]="!!item.disabled">
          <p-accordion-header [class]="headerStyleClass()">
            @if (headerTemplateMap.get(item.ref)) {
              <ng-container
                *ngTemplateOutlet="headerTemplateMap.get(item.ref); context: { item: item, active: value() === i }"
              ></ng-container>
            } @else {
              <span>{{ item.label }}</span>
            }

            <ng-template #toggleicon let-active="active">
                <ui-button icon="chevronDown" severity="contrast" [styleClass]="'size-10 aspect-square ' + toggleStyleClass()" [iconStyleClass]="(active ? 'rotate-180' : '')"/>
            </ng-template>
          </p-accordion-header>
          <p-accordion-content [class]="contentStyleClass()">
            <ng-container
              *ngTemplateOutlet="panelTemplateMap.get(item.ref); context: { item: item , active: value() === i }"
            ></ng-container>
          </p-accordion-content>
        </p-accordion-panel>
      }
    </p-accordion>
  `,
})
export class AccordionComponent implements _.AfterContentInit {
  public readonly items = _.input.required<AccordionPanel[]>();
  public readonly multiple = _.input<boolean>(false);
  public readonly headerStyleClass = _.input<string>('');
  public readonly toggleStyleClass = _.input<string>('');
  public readonly contentStyleClass = _.input<string>('');
  public readonly styleClass = _.input<string>('');

  public readonly value = _.model<number>(-1);

  public readonly panelTemplateMap = new Map<string, _.TemplateRef<any>>();
  public readonly headerTemplateMap = new Map<string, _.TemplateRef<any>>();

  @_.ContentChildren(AccordionPanelDirective, { read: _.TemplateRef }) panelTemplates!: _.QueryList<_.TemplateRef<any>>;
  @_.ContentChildren(AccordionPanelDirective) panelDirectives!: _.QueryList<AccordionPanelDirective>;

  @_.ContentChildren(AccordionHeaderDirective, { read: _.TemplateRef }) headerTemplates!: _.QueryList<
    _.TemplateRef<any>
  >;
  @_.ContentChildren(AccordionHeaderDirective) headerDirectives!: _.QueryList<AccordionHeaderDirective>;

  async ngAfterContentInit() {
    const headerTemplates = this.headerTemplates.toArray();
    const headerDirectives = this.headerDirectives.toArray();

    for (let i = 0; i < headerTemplates.length; i++) {
      if (headerDirectives[i] && headerDirectives[i].accordionHeader()) {
        const headerRef = headerDirectives[i].accordionHeader();
        this.headerTemplateMap.set(headerRef, headerTemplates[i]);
      }
    }

    await sleep(300);

    const panelTemplates = this.panelTemplates.toArray();
    const panelDirectives = this.panelDirectives.toArray();

    for (let i = 0; i < panelTemplates.length; i++) {
      if (panelDirectives[i] && panelDirectives[i].accordionPanel()) {
        const panelRef = panelDirectives[i].accordionPanel();
        this.panelTemplateMap.set(panelRef, panelTemplates[i]);
      }
    }
  }
}
