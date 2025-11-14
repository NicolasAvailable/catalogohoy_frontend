import { EnvironmentProviders, Provider } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';
import { providePrimeNG as providePrimeNgImpl } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';
import {
  avatar,
  badge,
  breadcrumb,
  button,
  card,
  confirmdialog,
  dialog,
  inputotp,
  inputtext,
  menu,
  menubar,
  message,
  select,
  table,
  tabs,
  textarea,
  toggleswitch,
  tooltip,
  stepper,
  chip,
  selectbutton,
  datepicker,
  inputnumber,
  progressbar,
  accordion,
  checkbox,
  colorpicker,
} from './components';
import { dark, light, primary, secondary } from './semantic';

const preset = definePreset(Lara, {
  semantic: { primary, secondary, colorScheme: { light, dark } },
  components: {
    button,
    select,
    card,
    inputtext,
    textarea,
    inputotp,
    toggleswitch,
    tabs,
    dialog,
    confirmdialog,
    menubar,
    badge,
    avatar,
    menu,
    breadcrumb,
    table,
    message,
    tooltip,
    stepper,
    chip,
    selectbutton,
    datepicker,
    inputnumber,
    progressbar,
    accordion,
    checkbox,
    colorpicker,
  },
});

export const providePrimeNG = (): Array<Provider | EnvironmentProviders> => {
  const providers: Array<Provider | EnvironmentProviders> = [
    DialogService,
    provideAnimationsAsync(),
    providePrimeNgImpl({
      ripple: false,
      theme: {
        preset,
        options: {
          darkModeSelector: '[data-theme=dark]',
        },
      },
    }),
  ];

  return providers;
};
