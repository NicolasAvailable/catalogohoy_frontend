import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject } from '@angular/core';
import { ProfileStore } from '@catalogohoy/profile';
import { is, qr } from '@shared/domain';
import { BaseComponent } from '@shared/presenter';
import { AvatarComponent, ButtonComponent, TooltipDirective } from '@ui';
import { ProfileMenu } from './components';

@Component({
  selector: 'app-navbar',
  imports: [AvatarComponent, ButtonComponent, TooltipDirective, ProfileMenu],
  templateUrl: './navbar.html',
})
export class Navbar extends BaseComponent {
  private readonly clipboard = inject(Clipboard);
  public readonly profileStore = inject(ProfileStore);

  public share() {
    const url = this.profileStore.profile().tenantList.first.url;
    is.affirmative(this.clipboard.copy(url)).mapRight(() =>
      this.useCaseProgress
        .completeFor('Se ha copiado al portapapeles')
        .complete()
    );
  }

  public async generateQR() {
    const tenant = this.profileStore.profile().tenantList.first;

    await qr.to.pdf(tenant.url, `QR-${tenant.slug}`, tenant.name);

    this.useCaseProgress.completeFor('QR generado con éxito').complete();
  }
}
