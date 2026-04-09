import { NgClass } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '@ui';
import { INTERNAL_NAV, InternalNavItem } from './sidebar.constants';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass, IconComponent],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  public visible = input<boolean>(false);
  public closeSidebar = output<void>();

  private readonly router = inject(Router);

  public readonly navItems: InternalNavItem[] = INTERNAL_NAV;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.visible()) {
        this.closeSidebar.emit();
      }
    });
  }
}
