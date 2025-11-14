import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import { is } from '@shared/domain';
import { TranslatePipe } from '@shared/presenter';
import { StepperModule } from 'primeng/stepper';

@_.Directive({ selector: '[stepPanel]' })
export class StepPanelDirective {
  public readonly stepPanel = _.input.required<number>();
}

@_.Component({
  selector: 'ui-stepper',
  imports: [CommonModule, StepperModule, TranslatePipe],
  template: `
    <section class="grid grid-rows-[auto_1fr] h-full gap-3">
      <span class="text-sm font-medium font-sans! text-grey-300">
        {{ 'UI.STEPPER.STEP' | translate : { step: (stepperRef.value() || 0) + 1, total: length() } }}
      </span>

      <p-stepper #stepperRef [value]="value()">
        <p-step-list>
          @for(_ of steps(); track $index) {
          <p-step [value]="$index" />
          }
        </p-step-list>

        <p-step-panels>
          @for(step of steps(); track $index) {
          <p-step-panel [value]="$index">
            <ng-template #content>
              <ng-container
                *ngTemplateOutlet="
                  templateMap.get($index + 1);
                  context: { next: next.bind(this), prev: prev.bind(this), goToStep: goTo.bind(this), state: state() }
                "
              ></ng-container>
            </ng-template>
          </p-step-panel>
          }
        </p-step-panels>
      </p-stepper>
    </section>
  `,
})
export class StepperComponent implements _.OnChanges, _.AfterContentInit {
  public readonly length = _.input.required<number>();
  public readonly initialState = _.input<object>({});

  public readonly state = _.signal<object>({});
  public readonly value = _.signal(0);

  public readonly steps = _.computed(() => Array.from({ length: this.length() + 1 }));

  public readonly templateMap = new Map<number, _.TemplateRef<any>>();
  @_.ContentChildren(StepPanelDirective, { read: _.TemplateRef }) stepTemplates!: _.QueryList<_.TemplateRef<any>>;
  @_.ContentChildren(StepPanelDirective) stepPanels!: _.QueryList<StepPanelDirective>;

  ngOnChanges(changes: _.SimpleChanges) {
    is.affirmative(changes['initialState']).map(() => this.state.set(this.initialState()));
  }

  ngAfterContentInit() {
    this.state.set(this.initialState());

    const templates = this.stepTemplates.toArray();
    const panels = this.stepPanels.toArray();

    for (let i = 0; i < templates.length; i++) {
      if (panels[i] && panels[i].stepPanel()) {
        const stepNumber = panels[i].stepPanel();
        this.templateMap.set(stepNumber, templates[i]);
      }
    }
  }

  public next(state: object = {}) {
    if (this.value() >= this.length() - 1) return;
    this.state.update((oldState) => ({ ...oldState, ...state }));
    this.value.update((value) => value + 1);
  }

  public prev(state: object = {}) {
    if (this.value() <= 0) return;
    this.state.update((oldState) => ({ ...oldState, ...state }));
    this.value.update((value) => value - 1);
  }

  public goTo(step: number, state: object = {}) {
    if (step < 0 || step >= this.length()) return;
    if (step === this.value()) return;
    this.state.update((oldState) => ({ ...oldState, ...state }));
    this.value.set(step);
  }
}
