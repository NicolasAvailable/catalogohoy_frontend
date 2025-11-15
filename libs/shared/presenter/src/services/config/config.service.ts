import { inject, Injectable } from '@angular/core';
import { mergeDeepRight } from 'ramda';
import { BehaviorSubject } from 'rxjs';
import { UI_CONFIG } from './config.constant';
import { ConfigStore } from './config.store';
import { Scheme, scheme, UiConfig } from './config.types';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  public readonly config$ = new BehaviorSubject(inject(UI_CONFIG));
  private readonly store = new ConfigStore();

  constructor() {
    this.config = this.store.value;
  }

  public set config(value: Partial<UiConfig>) {
    const config = mergeDeepRight(this.config$.getValue(), value);
    this.store.value = config as Required<UiConfig>;
    this.config$.next(config as Required<UiConfig>);
  }

  public get is() {
    return {
      dark: scheme(this.store.value.scheme as Scheme).is.dark.isRight(),
    };
  }

  public get switch() {
    return {
      dark: () => {
        this.config = { scheme: Scheme.DARK };
      },
      light: () => {
        this.config = { scheme: Scheme.LIGHT };
      },
    };
  }

  public reset(): void {
    this.config$.next(this.config as Required<UiConfig>);
  }
}
