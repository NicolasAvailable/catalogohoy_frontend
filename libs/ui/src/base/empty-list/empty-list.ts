import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { SkeletonListComponent } from '../skeleton';
import { CtaComponent, EmptyResultsComponent } from './components';

@Component({
  selector: 'ui-empty-list',
  imports: [CommonModule, SkeletonListComponent, CtaComponent, EmptyResultsComponent],
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  template: `
    @if(isLoading()){
    <ui-skeleton-list
      [count]="count()"
      [width]="width()"
      [height]="height()"
      [styleClass]="'h-full ' + skeletonStyleClass()"
    />
    }@else if(hasItems()){
    <ui-empty-results [class]="isScreenView() ? 'block pt-26 4xl:pt-32 ' + styleClassContainer() : ''" />
    }@else{
    <ui-cta
      (ctaClick)="ctaClick.emit()"
      [label]="label()"
      [description]="description()"
      [cta]="cta()"
      [ctaLink]="ctaLink()"
      [icon]="icon()"
      [styleClass]="styleClass()"
      [class]="isScreenView() ? 'block pt-26 4xl:pt-32 ' + styleClassContainer() : ''"
    />
    }
  `,
})
export class EmptyListComponent {
  public readonly label = input('');
  public readonly description = input('');
  public readonly cta = input('');
  public readonly ctaLink = input('');
  public readonly icon = input('folder-open');
  public readonly hasItems = input(false);
  public readonly isLoading = input(false);
  public readonly isScreenView = input(true);
  public readonly count = input(1);
  public readonly width = input('');
  public readonly height = input('');
  public readonly skeletonStyleClass = input('');
  public readonly styleClassContainer = input('');
  public readonly styleClass = input('');

  public readonly ctaClick = output<void>();
}
