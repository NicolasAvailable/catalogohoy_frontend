import { EnvironmentProviders, Provider, inject, provideEnvironmentInitializer } from '@angular/core';
import { UiConfig } from './services/config';
import { UI_CONFIG } from './services/config/config.constant';
import { SplashScreenService } from './services/splash-screen';

export type UiProviderConfig = { config?: UiConfig };

export const provideUi = ({ config }: UiProviderConfig): Array<Provider | EnvironmentProviders> => {
  const providers: Array<Provider | EnvironmentProviders> = [
    { provide: UI_CONFIG, useValue: config ?? {} },
    provideEnvironmentInitializer(() => inject(SplashScreenService)),
  ];

  return providers;
};
