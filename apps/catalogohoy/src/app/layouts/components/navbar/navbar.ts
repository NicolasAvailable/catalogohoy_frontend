import { Component } from '@angular/core';
import { AvatarComponent, ButtonComponent } from '@ui';
import { ProfileMenu } from './components';

@Component({
  selector: 'app-navbar',
  imports: [AvatarComponent, ButtonComponent, ProfileMenu],
  templateUrl: './navbar.html',
})
export class Navbar {}
