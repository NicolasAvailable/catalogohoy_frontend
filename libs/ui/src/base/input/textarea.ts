import { NgClass } from '@angular/common';
import { Component, forwardRef, Injector, input, signal } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'ui-textarea',
  imports: [NgClass, TextareaModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
  template: `
    <textarea
      pTextarea
      [ngModel]="value()"
      (ngModelChange)="change($event)"
      (keydown.enter)="onEnterKey($any($event))"
      [id]="textareaId()"
      [rows]="rows()"
      [cols]="cols()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [autoResize]="autoResize()"
      [class]="'h-full w-full resize-none ' + styleClass()"
      [ngClass]="{
        'ng-invalid ng-dirty':
          (control?.invalid && (control?.dirty || control?.touched)) ||
          invalid()
      }"
    ></textarea>
  `,
})
export class TextareaComponent {
  public readonly rows = input<number | 'auto'>('auto');
  public readonly cols = input<number>(30);
  public readonly autoResize = input(false);
  public readonly invalid = input(false);
  public readonly placeholder = input('');
  public readonly preventEnter = input(false);
  public readonly styleClass = input('');
  public readonly textareaId = input('');

  public readonly value = signal<string>('');
  public readonly disabled = signal(false);

  public control: NgControl | null = null;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.control = this.injector.get(NgControl, null) as NgControl;
    this.control.valueAccessor = this;
  }

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
    this.onChange(value);
    this.onTouched();
  }

  public clear() {
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }

  public onEnterKey(event: KeyboardEvent) {
    if (this.preventEnter()) {
      event.preventDefault();
    }
  }
}
