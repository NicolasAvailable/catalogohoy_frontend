import { EnvironmentProviders, Provider } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';
import { providePrimeNG as providePrimeNgImpl } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';
import { resolveInitialLanguage } from '../transloco/language.const';
import { PRIMENG_TRANSLATIONS } from './primeng.i18n';
import {
  accordion,
  avatar,
  badge,
  breadcrumb,
  button,
  card,
  checkbox,
  chip,
  colorpicker,
  confirmdialog,
  datepicker,
  dialog,
  inputnumber,
  inputotp,
  inputtext,
  menu,
  menubar,
  message,
  multiselect,
  panelmenu,
  progressbar,
  select,
  selectbutton,
  stepper,
  table,
  tabs,
  textarea,
  toggleswitch,
  tooltip,
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
    panelmenu,
    multiselect,
  },
});

export const providePrimeNG = (): Array<Provider | EnvironmentProviders> => {
  const providers: Array<Provider | EnvironmentProviders> = [
    DialogService,
    provideAnimationsAsync(),
    providePrimeNgImpl({
      ripple: false,
      // Textos internos (datepicker, filtros…) en el idioma inicial; los
      // cambios en vivo los aplica LanguageService via setTranslation().
      translation: PRIMENG_TRANSLATIONS[resolveInitialLanguage()],
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
