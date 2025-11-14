import { UiConfig } from './config.types';

export class ConfigStore {
  private readonly KEY = 'UI_CONFIG';

  public get value(): Partial<UiConfig> {
    return JSON.parse(localStorage.getItem(this.KEY) ?? '{}');
  }

  public set value(config: UiConfig) {
    localStorage.setItem(this.KEY, JSON.stringify(config));
  }
}
