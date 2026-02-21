import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantStore } from '@catalogohoy/tenant';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputTextComponent,
  TextareaComponent,
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import { WhatsappButton } from '../../domain';
import { EcommerceConfigStore } from '../../infrastructure';

@Component({
  selector: 'lib-ecommerce-config',
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    InputTextComponent,
    ToggleComponent,
    IconComponent,
    CardComponent,
    UploaderComponent,
    TextareaComponent,
  ],
  templateUrl: './ecommerce-config.html',
  styleUrl: './ecommerce-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcommerceConfigComponent implements OnInit {
  public readonly tenantStore = inject(TenantStore);
  public readonly configStore = inject(EcommerceConfigStore);

  // Estado local para el formulario de identidad
  public readonly draftName = signal('');
  public readonly draftWhatsappButtons = signal<WhatsappButton[]>([]);
  public readonly draftDescription = signal('');

  constructor() {
    // Sincronizar estado local cuando se carga la config del servidor
    effect(() => {
      const config = this.configStore.config();
      if (config) {
        this.draftName.set(config.name ?? '');
        this.draftWhatsappButtons.set(
          config.whatsappButtons?.length
            ? config.whatsappButtons.map((b) => ({ ...b }))
            : [{ name: '', number: '' }]
        );
        this.draftDescription.set(config.description ?? '');
      }
    });
  }

  async ngOnInit() {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.configStore.loadConfig(String(tenantId));
    }
  }

  addWhatsappButton() {
    const current = this.draftWhatsappButtons();
    if (current.length >= 3) return;
    this.draftWhatsappButtons.set([...current, { name: '', number: '' }]);
  }

  removeWhatsappButton(index: number) {
    const current = this.draftWhatsappButtons();
    this.draftWhatsappButtons.set(current.filter((_, i) => i !== index));
  }

  updateButtonName(index: number, name: string) {
    const current = this.draftWhatsappButtons();
    const updated = current.map((b, i) => (i === index ? { ...b, name } : b));
    this.draftWhatsappButtons.set(updated);
  }

  updateButtonNumber(index: number, number: string) {
    const current = this.draftWhatsappButtons();
    const updated = current.map((b, i) =>
      i === index ? { ...b, number } : b
    );
    this.draftWhatsappButtons.set(updated);
  }

  async saveIdentity() {
    await this.configStore.updatePartialConfig({
      name: this.draftName(),
      description: this.draftDescription(),
    });
  }

  async saveWhatsappButtons() {
    await this.configStore.updatePartialConfig({
      whatsappButtons: this.draftWhatsappButtons(),
    });
  }

  onToggleOrders(enabled: boolean) {
    this.configStore.updateIsAcceptingOrders(enabled);
  }

  onUrlChange(url: string | string[]) {
    if (typeof url === 'string') {
      this.configStore.updateLogoUrl(url);
    }
  }
}
