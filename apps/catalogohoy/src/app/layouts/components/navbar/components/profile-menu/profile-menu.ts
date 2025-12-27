import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileStore } from '@catalogohoy/profile';
import { IconComponent, MenuComponent, MenuItem } from '@ui';

@Component({
  selector: 'app-profile-menu',
  imports: [RouterLink, MenuComponent, IconComponent],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.css',
})
export class ProfileMenu {
  public readonly profileStore = inject(ProfileStore);
  public readonly menu = viewChild<MenuComponent>('profileMenu');
  public readonly profileItems = computed(
    () =>
      this.profileStore.profile().tenantList.tenants.map((tenant) => ({
        label: tenant.name,
        icon: 'building',
        command: () => window.open(tenant.url, '_blank'),
      })) as MenuItem[]
  );
}
