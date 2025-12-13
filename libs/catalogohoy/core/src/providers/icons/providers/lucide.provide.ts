import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  Home,
  LogOut,
  LucideAngularModule,
  NotepadText,
  ShoppingBag,
  Tag,
} from 'lucide-angular';

export const provideLucideIcons = (): EnvironmentProviders => {
  return importProvidersFrom(
    LucideAngularModule.pick({
      Home,
      Tag,
      NotepadText,
      ShoppingBag,
      LogOut,
    })
  );
};
