import * as _ from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { when } from '@shared/domain';
import { TranslatePipe } from '@shared/presenter';
import { InputSearchComponent } from '../input';

export type TabHeader = { ref: string; label: string; isDisabled?: boolean };

@_.Directive({ selector: '[tabPanel]' })
export class TabPanelDirective {
  public readonly tabPanel = _.input.required<string>();
}

@_.Component({
  selector: 'ui-tabs',
  imports: [CommonModule, TranslatePipe, TabsModule, InputSearchComponent],
  template: `
    <p-tabs (valueChange)="change($event)" [value]="defaultTab()" [class]="styleClass()">
   
      <header class="grid grid-cols-[1fr_auto]">
        <p-tablist>
          @for(header of headers(); track header.ref) {
          <p-tab [value]="header.ref" [disabled]="header.isDisabled" [class]="headerStyleClass()">
            {{ header.label | translate }}
            @if (templateHeaderIcon()) {
            <ng-template
              [ngTemplateOutlet]="templateHeaderIcon()"
              [ngTemplateOutletContext]="{ $implicit: header, last: $last }"
            >
            </ng-template>
            }
          </p-tab>
          }
        </p-tablist>
        
        @if (searchable()) {
          <ui-input-search #inputSearch (valueChange)="searchChange.emit($event)" [resizable]="true" />
        }
      </header>

      <p-tabpanels>
        @for(header of headers(); track header.ref) {
        <p-tabpanel [value]="header.ref">
          <ng-container [ngTemplateOutlet]="templateMap.get(header.ref)" [ngTemplateOutletContext]="{ $implicit: inputSearch()?.value() }"></ng-container>
        </p-tabpanel>
        }
      </p-tabpanels>
    </p-tabs>
  `,
})
export class TabsComponent {
  public readonly headers = _.input<TabHeader[]>([]);
  public readonly navigation = _.input<boolean>(false);
  public readonly searchable = _.input<boolean>(false);
  public readonly activeTab = _.model<string | number>('');
  public readonly headerStyleClass = _.input<string>('');
  public readonly styleClass = _.input<string>('');

  public readonly valueChange = _.output<string | number>();
  public readonly searchChange = _.output<string>();

  public readonly templateMap = new Map<string, _.TemplateRef<any>>();
  @_.ContentChildren(TabPanelDirective, { read: _.TemplateRef }) tabTemplates!: _.QueryList<_.TemplateRef<any>>;
  @_.ContentChildren(TabPanelDirective) tabPanels!: _.QueryList<TabPanelDirective>;
  public readonly templateHeaderIcon =
    _.contentChild<_.TemplateRef<{ $implicit: TabHeader; last: boolean }>>('headerIcon');
  public readonly inputSearch = _.viewChild<InputSearchComponent>('inputSearch');

  public defaultTab = _.computed(() => this.activeTab() ?? this.headers()[0]?.ref);

  constructor() {
    const activeRoute = _.inject(ActivatedRoute);
    const router = _.inject(Router);

    _.effect(() => {
      const child = activeRoute.firstChild?.snapshot?.url[0]?.path;
      if (child && this.headers().some((h) => h.ref === child)) {
        this.activeTab.set(child);
      } else if (!this.activeTab()) {
        this.activeTab.set(this.headers()[0]?.ref);
      }
    });

    _.effect(() => {
      if (this.navigation() && this.activeTab()) {
        router.navigate([this.activeTab()], { relativeTo: activeRoute });
      }
    });
  }

  ngAfterContentInit() {
    const templates = this.tabTemplates.toArray();
    const panels = this.tabPanels.toArray();

    for (let i = 0; i < templates.length; i++) {
      if (panels[i] && panels[i].tabPanel()) {
        this.templateMap.set(panels[i].tabPanel(), templates[i]);
      }
    }
  }

  public change(activeTab: string | number) {
    when(this.activeTab.set(activeTab)).map(() => this.valueChange.emit(this.activeTab()));
  }
}
