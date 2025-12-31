import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import {
  Building,
  ChevronDown,
  ChevronRight,
  CircleUser,
  Copy,
  ExternalLink,
  Home,
  LogOut,
  LucideAngularModule,
  MessageCircleQuestion,
  NotepadText,
  Package,
  QrCode,
  Share2,
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
      Copy,
      Share2,
      QrCode,
    })
  );
};
