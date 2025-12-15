import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  ChevronRight,
  CircleUser,
  ExternalLink,
  Home,
  LogOut,
  LucideAngularModule,
  MessageCircleQuestion,
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
      MessageCircleQuestion,
      CircleUser,
      ExternalLink,
    })
  );
};
