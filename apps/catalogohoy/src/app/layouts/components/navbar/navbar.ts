import { Component, inject } from '@angular/core';
import { RouterLinkActive } from '@angular/router';
import { ProfileStore } from '@catalogohoy/profile';
import { AvatarComponent, ButtonComponent } from '@ui';
import { ProfileMenu } from './components';

@Component({
  selector: 'app-navbar',
  imports: [RouterLinkActive, AvatarComponent, ButtonComponent, ProfileMenu],
  templateUrl: './navbar.html',
})
export class Navbar {
  public readonly profileStore = inject(ProfileStore);
}
