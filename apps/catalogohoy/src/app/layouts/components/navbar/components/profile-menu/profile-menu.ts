import { Component, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, MenuComponent } from '@ui';

@Component({
  selector: 'app-profile-menu',
  imports: [RouterLink, MenuComponent, IconComponent],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.css',
})
export class ProfileMenu {
  public readonly menu = viewChild<MenuComponent>('profileMenu');

  public close(): void {
    this.menu()?.hide();
  }
}
