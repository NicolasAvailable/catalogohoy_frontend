import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { ProfileStore } from './profile.store';

export const profileResolver: ResolveFn<boolean> = () => {
  const profileStore = inject(ProfileStore);
  profileStore.$profile();
  return true;
};
