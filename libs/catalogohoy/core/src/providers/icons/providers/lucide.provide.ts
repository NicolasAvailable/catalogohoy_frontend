import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  Building,
  ChevronDown,
  ChevronRight,
  CircleUser,
  ExternalLink,
  Home,
  LogOut,
  LucideAngularModule,
  MessageCircleQuestion,
  NotepadText,
  Package,
  ShoppingBag,
  SquareArrowOutUpRight,
  Tag,
  TicketPercent,
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
      ChevronDown,
      SquareArrowOutUpRight,
      MessageCircleQuestion,
      CircleUser,
      ExternalLink,
      Building,
      Package,
      TicketPercent,
    })
  );
};
