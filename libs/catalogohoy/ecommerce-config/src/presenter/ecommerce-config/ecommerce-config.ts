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
  public readonly draftWhatsapp = signal('');
  public readonly draftDescription = signal('');

  constructor() {
    // Sincronizar estado local cuando se carga la config del servidor
    effect(() => {
      const config = this.configStore.config();
      if (config) {
        this.draftName.set(config.name ?? '');
        this.draftWhatsapp.set(config.whatsapp ?? '');
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

  async saveIdentity() {
    await this.configStore.updatePartialConfig({
      name: this.draftName(),
      whatsapp: this.draftWhatsapp(),
      description: this.draftDescription(),
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
