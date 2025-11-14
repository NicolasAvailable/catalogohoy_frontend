import { Provider } from '@angular/core';
import { Scheme, provideUi as provideUiImpl } from '@shared/presenter';

export const provideUi = (): Array<Provider> => {
  return [provideUiImpl({ config: { layout: 'basic', scheme: Scheme.LIGHT } })];
};
