import { Route } from '@angular/router';

export const onboardingRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./presenter/onboarding/onboarding').then((m) => m.Onboarding),
  },
];
