import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  ChevronRight,
  Home,
  LogOut,
  LucideAngularModule,
  NotepadText,
  ShoppingBag,
  SquareArrowOutUpRight,
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
      ChevronRight,
      SquareArrowOutUpRight,
    })
  );
};
