import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppAccount } from '../../../domain';
import {
  EmbeddedSignupData,
  FacebookSdkService,
  WhatsAppStore,
} from '../../../infrastructure';

@Component({
  selector: 'lib-whatsapp-setup',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  templateUrl: './whatsapp-setup.html',
})
export class WhatsAppSetupComponent implements OnInit {
  readonly whatsAppStore = inject(WhatsAppStore);
  readonly mode = input<'fullpage' | 'dialog'>('fullpage');
  readonly registered = output<WhatsAppAccount>();

  private readonly facebookSdk = inject(FacebookSdkService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sdkReady = signal(false);
  readonly signupComplete = signal(false);

  private removeMessageListener?: () => void;

  ngOnInit(): void {
    this.facebookSdk.loadSdk().then(() => this.sdkReady.set(true));

    this.removeMessageListener = this.facebookSdk.onEmbeddedSignupMessage(
      (event) => {
        if (event.event === 'FINISH') {
          this.handleSignupFinish(event.data);
        }
      }
    );

    this.destroyRef.onDestroy(() => this.removeMessageListener?.());
  }

  async connectWithFacebook(): Promise<void> {
    const response = await this.facebookSdk.launchEmbeddedSignup();

    if (response.status !== 'connected' || !response.authResponse?.code) {
      return;
    }

    // The auth code will be used by the backend to exchange for a long-lived token.
    // The waba_id and phone_number_id come from the message event listener.
  }

  /** Connect a demo account so the inbox unlocks without the real Meta API. */
  async connectDemo(): Promise<void> {
    const account = await this.whatsAppStore.connectDemoAccount();
    if (account) {
      this.signupComplete.set(true);
      this.registered.emit(account);
    }
  }

  private async handleSignupFinish(data: EmbeddedSignupData): Promise<void> {
    const account = await this.whatsAppStore.registerFromEmbeddedSignup({
      wabaId: data.waba_id,
      phoneNumberId: data.phone_number_id,
      authCode: '',
    });

    if (account) {
      this.signupComplete.set(true);
      this.registered.emit(account);
    }
  }
}
