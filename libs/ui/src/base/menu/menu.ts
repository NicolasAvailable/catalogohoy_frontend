import { CommonModule } from '@angular/common';
import { Component, contentChild, ElementRef, input, output, TemplateRef, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { MenuItem as PrimeNgMenuItem } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';

export type MenuItem = PrimeNgMenuItem;

@Component({
  selector: 'ui-menu',
  imports: [CommonModule, LucideAngularModule, MenuModule],
  template: `
    <p-menu
      #menu
      (onShow)="open.emit()"
      [model]="items()"
      [popup]="popup()"
      [styleClass]="styleClass()"
      [appendTo]="appendTo()"
    >
      @if(startTemplate()){
      <ng-template pTemplate="start">
        <ng-container [ngTemplateOutlet]="startTemplate()!" />
      </ng-template>
      } @if(endTemplate()){
      <ng-template pTemplate="end">
        <ng-container [ngTemplateOutlet]="endTemplate()!" />
      </ng-template>
      } @if(itemTemplate()){
      <ng-template pTemplate="item" let-item>
        <div (click)="!autoClose() && $event.stopPropagation()">
          <ng-container [ngTemplateOutlet]="itemTemplate()!" [ngTemplateOutletContext]="{ $implicit: item }" />
        </div>
      </ng-template>
      }
    </p-menu>
  `,
})
export class MenuComponent {
  public readonly items = input<MenuItem[]>([{}]);
  public readonly popup = input(true);
  public readonly autoClose = input(true);
  public readonly styleClass = input('');
  public readonly appendTo = input<HTMLElement | ElementRef | string | null | undefined>('body');

  public readonly open = output<void>();

  public readonly menu = viewChild.required<Menu>('menu');

  public readonly startTemplate = contentChild<TemplateRef<unknown>>('start');
  public readonly endTemplate = contentChild<TemplateRef<unknown>>('end');
  public readonly itemTemplate = contentChild<TemplateRef<{ $implicit: MenuItem }>>('item');

  public readonly isOpen = () => this.menu().visible;

  public hide() {
    this.menu().hide();
  }

  public toggle(event: Event) {
    this.menu().toggle(event);
  }
}
