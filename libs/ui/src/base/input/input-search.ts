import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ClickOutsideDirective, TranslatePipe } from '@shared/presenter';
import { AutoFocusModule } from 'primeng/autofocus';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../button';
import { IconComponent } from '../icon';

@Component({
  selector: 'ui-input-search',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    InputTextModule,
    AutoFocusModule,
    IconFieldModule,
    InputIconModule,
    ClickOutsideDirective,
    IconComponent,
    ButtonComponent,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputSearchComponent),
      multi: true,
    },
  ],
  animations: [
    trigger('expandWidth', [
      state(
        'collapsed',
        style({
          transform: 'scaleX(0)',
          opacity: 0,
          transformOrigin: 'right center',
        })
      ),
      state(
        'expanded',
        style({
          transform: 'scaleX(1)',
          opacity: 1,
          transformOrigin: 'right center',
        })
      ),
      transition('collapsed => expanded', [animate('150ms ease-out')]),
      transition('expanded => collapsed', [animate('150ms ease-out')]),
    ]),
  ],
  styles: [
    `
      :host {
        --p-form-field-padding-x: 1rem;
      }
    `,
  ],
  template: `
    <div class="flex items-center">
      @if (!isExpanded()) {
      <ui-button
        (click)="expand()"
        icon="search"
        [size]="size()"
        severity="contrast"
        styleClass="rounded-full! aspect-square"
      />
      }

      <div
        [@expandWidth]="animationState()"
        class="w-full flex-shrink-0"
        [class.ml-2]="isExpanded() && resizable()"
      >
        @if (isExpanded()) {
        <p-iconfield (appClickOutside)="!value() && collapse()">
          <p-inputicon>
            <ui-icon
              name="search"
              class="text-grey-300"
              [styleClass]="iconStyleClass()"
            />
          </p-inputicon>
          <input
            pInputText
            [ngModel]="value()"
            (ngModelChange)="change($event)"
            [pAutoFocus]="true"
            [placeholder]="placeholder() | translate"
            [disabled]="disabled()"
            [pSize]="size()"
            [fluid]="true"
            [class]="'search rounded-lg! ' + styleClass()"
          />
          <p-inputicon>
            @if(value()) {
            <ui-icon
              (click)="clear()"
              name="x"
              styleClass="size-5!"
              class="text-grey-300 cursor-pointer"
            />
            }
          </p-inputicon>
        </p-iconfield>
        }
      </div>
    </div>
  `,
})
export class InputSearchComponent {
  public readonly placeholder = input('GLOBAL.SEARCH');
  public readonly size = input<'small' | 'large' | any>(undefined);
  public readonly resizable = input<boolean>(false);
  public readonly styleClass = input('');
  public readonly iconStyleClass = input<string>('size-6!');

  public readonly valueChange = output<string>();

  public readonly value = signal<string>('');
  public readonly disabled = signal(false);
  public readonly isCollapsed = signal(true);

  public readonly isExpanded = computed(
    () => !this.resizable() || !this.isCollapsed()
  );
  public readonly animationState = computed(() =>
    this.isExpanded() ? 'expanded' : 'collapsed'
  );

  private onChange: (value: string) => void = () => {
    /* This will be overridden by registerOnChange */
  };
  private onTouched: () => void = () => {
    /* This will be overridden by registerOnTouched */
  };

  public writeValue(value: string): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabled(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  public change(value: string) {
    this.value.set(value);
    this.valueChange.emit(value);
    this.onChange(value);
    this.onTouched();
  }

  public clear() {
    this.change('');
  }

  public expand() {
    this.isCollapsed.set(false);
  }

  public collapse() {
    this.isCollapsed.set(true);
  }
}
