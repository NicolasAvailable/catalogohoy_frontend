import { Component, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, MenuComponent, MenuItem } from '@ui';

@Component({
  selector: 'app-profile-menu',
  imports: [RouterLink, RouterLinkActive, MenuComponent, IconComponent],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.css',
})
export class ProfileMenu {
  public readonly menu = viewChild<MenuComponent>('profileMenu');
  public readonly profileItems = signal<MenuItem[]>([
    {
      label: 'CatalogoHoyasdasd asdasdasd asdasdasdasd',
      icon: 'user',
    },
    {
      label: 'CatalogoHoy',
      icon: 'user',
    },
    {
      label: 'CatalogoHoy',
      icon: 'user',
    },
    {
      label: 'CatalogoHoy',
      icon: 'user',
    },
  ]);
}
