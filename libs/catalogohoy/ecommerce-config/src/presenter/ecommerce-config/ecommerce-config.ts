import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
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
import { EcommerceConfig } from '../../domain';
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

  ngOnInit() {
    const tenantId = this.tenantStore.tenantId();
    if (tenantId) {
      this.configStore.loadConfig(String(tenantId));
    }
  }

  onNameChange(name: string) {
    this.configStore.updateName(name);
  }

  onGenericChange(partial: Partial<EcommerceConfig>) {
    this.configStore.updatePartialConfig(partial);
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
