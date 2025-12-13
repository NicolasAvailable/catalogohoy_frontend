import { Component, signal } from '@angular/core';
import { AvatarComponent, ButtonComponent } from '@ui';

@Component({
  selector: 'app-navbar',
  imports: [AvatarComponent, ButtonComponent],
  templateUrl: './navbar.html',
})
export class Navbar {
  public readonly image = signal(
    'https://prod-files.socialgest.net/356607/images/09264503-17d6-43b4-b8c4-9f3de6908fdc.jpeg'
  );
}
