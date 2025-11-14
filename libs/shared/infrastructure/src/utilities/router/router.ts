import { ActivatedRoute, Router } from '@angular/router';

export type RouterRemover = { param: (param: string) => Promise<boolean> };

export const router = (router: Router) => {
  return {
    remove: (route: ActivatedRoute): RouterRemover => {
      return {
        param: (param: string) =>
          router.navigate([], {
            relativeTo: route,
            queryParams: { [param]: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          }),
      };
    },
  };
};
