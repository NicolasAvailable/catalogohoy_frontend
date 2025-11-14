import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideCustomIcons } from './providers/custom.provide';
import { provideLucideIcons } from './providers/lucide.provide';

export const provideIcons = (): EnvironmentProviders => {
  return makeEnvironmentProviders([provideCustomIcons(), provideLucideIcons()]);
};
