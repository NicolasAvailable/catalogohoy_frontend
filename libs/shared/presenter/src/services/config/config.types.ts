import { is } from '@shared/domain';

export type LayoutType = 'empty' | 'basic';

export enum Scheme {
  AUTO = 'auto',
  DARK = 'dark',
  LIGHT = 'light',
}

export type UiConfig = {
  layout: LayoutType;
  scheme: Scheme;
};

export const scheme = (scheme: Scheme) => ({
  is: {
    auto: is.affirmative(scheme === Scheme.AUTO),
    dark: is.affirmative(scheme === Scheme.DARK),
    light: is.affirmative(scheme === Scheme.LIGHT),
  },
});
