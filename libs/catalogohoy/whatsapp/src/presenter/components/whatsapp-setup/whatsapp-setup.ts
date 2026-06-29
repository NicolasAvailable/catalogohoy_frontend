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
  host: { class: 'flex-1 flex min-h-0 min-w-0' },
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

  // El Embedded Signup entrega el `code` por el callback de FB.login y el
  // `waba_id`/`phone_number_id` por un postMessage (orden no garantizado). Los
  // juntamos acá y recién con ambos completamos el alta.
  private pendingCode: string | null = null;
  private pendingData: EmbeddedSignupData | null = null;

  ngOnInit(): void {
    this.facebookSdk.loadSdk().then(() => this.sdkReady.set(true));

    this.removeMessageListener = this.facebookSdk.onEmbeddedSignupMessage(
      (event) => {
        if (event.event === 'FINISH') {
          this.pendingData = event.data;
          this.tryComplete();
        }
      }
    );

    this.destroyRef.onDestroy(() => this.removeMessageListener?.());
  }

  async connectWithFacebook(): Promise<void> {
    this.pendingCode = null;
    this.pendingData = null;

    const response = await this.facebookSdk.launchEmbeddedSignup();

    if (response.status !== 'connected' || !response.authResponse?.code) {
      return;
    }

    this.pendingCode = response.authResponse.code;
    this.tryComplete();
  }

  /** Connect a demo account so the inbox unlocks without the real Meta API. */
  async connectDemo(): Promise<void> {
    const account = await this.whatsAppStore.connectDemoAccount();
    if (account) {
      this.signupComplete.set(true);
      this.registered.emit(account);
    }
  }

  /** Cuando ya tenemos el `code` Y los ids de la WABA, completa el alta vía
   *  `wa-onboard` (el backend intercambia el code por el token). */
  private async tryComplete(): Promise<void> {
    if (!this.pendingCode || !this.pendingData) return;

    const data = this.pendingData;
    const code = this.pendingCode;
    this.pendingCode = null;
    this.pendingData = null;

    const account = await this.whatsAppStore.registerFromEmbeddedSignup({
      wabaId: data.waba_id,
      phoneNumberId: data.phone_number_id,
      authCode: code,
    });

    if (account) {
      this.signupComplete.set(true);
      this.registered.emit(account);
    }
  }
}
