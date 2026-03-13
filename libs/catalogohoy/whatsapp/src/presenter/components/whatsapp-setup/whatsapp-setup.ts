import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  IconComponent,
  InputTextComponent,
  InputTelComponent,
} from '@ui';
import { WhatsAppAccount } from '../../../domain';
import { WhatsAppStore } from '../../../infrastructure';

@Component({
  selector: 'lib-whatsapp-setup',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    InputTelComponent,
  ],
  templateUrl: './whatsapp-setup.html',
})
export class WhatsAppSetupComponent {
  readonly whatsAppStore = inject(WhatsAppStore);
  readonly mode = input<'fullpage' | 'dialog'>('fullpage');
  readonly registered = output<WhatsAppAccount>();

  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly phoneNumber = signal('');
  readonly displayName = signal('');
  readonly wabaId = signal('');
  readonly phoneNumberId = signal('');

  get isFormValid(): boolean {
    return this.phoneNumber().trim().length > 0;
  }

  goToStep2(): void {
    if (!this.isFormValid) return;
    this.currentStep.set(2);
  }

  goBack(): void {
    if (this.currentStep() === 2) this.currentStep.set(1);
    if (this.currentStep() === 3) this.currentStep.set(2);
  }

  async register(): Promise<void> {
    const account = await this.whatsAppStore.registerAccount({
      phoneNumber: this.phoneNumber().trim(),
      displayName: this.displayName().trim() || null,
      wabaId: this.wabaId().trim() || null,
      phoneNumberId: this.phoneNumberId().trim() || null,
    });

    if (account) {
      this.currentStep.set(3);
      this.registered.emit(account);
    }
  }
}
