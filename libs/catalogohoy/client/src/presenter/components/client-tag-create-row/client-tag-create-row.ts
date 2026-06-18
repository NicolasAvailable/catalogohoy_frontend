import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, InputTextComponent } from '@ui';
import { CLIENT_TAG_COLORS, ClientTag } from '../../../domain/client.model';
import { ClientStore } from '../../../infrastructure/client.store';

/**
 * Inline "create a tag" control meant to live in the footer of a tag
 * dropdown (ui-multi-select / ui-select). Emits the created tag so the host
 * can pre-select it. Stops click/keydown propagation so typing/clicking
 * doesn't trigger the surrounding overlay's keyboard navigation or close it.
 */
@Component({
  selector: 'lib-client-tag-create-row',
  standalone: true,
  imports: [FormsModule, InputTextComponent, ButtonComponent],
  templateUrl: './client-tag-create-row.html',
})
export class ClientTagCreateRowComponent {
  public readonly clientStore = inject(ClientStore);
  private readonly toast = inject(ToastService);

  public readonly created = output<ClientTag>();

  public readonly name = signal('');
  public readonly color = signal(CLIENT_TAG_COLORS[0]);
  public readonly palette = CLIENT_TAG_COLORS;
  public readonly saving = signal(false);

  public async create(): Promise<void> {
    const name = this.name().trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    this.toast.wait('Creando etiqueta...');
    const tag = await this.clientStore.addTag(name, this.color());
    this.toast.dismissWait();
    this.saving.set(false);
    if (tag) {
      this.name.set('');
      this.color.set(CLIENT_TAG_COLORS[0]);
      this.toast.success('Etiqueta creada exitosamente');
      this.created.emit(tag);
    } else {
      this.toast.warning('No se pudo crear la etiqueta (¿ya existe?)');
    }
  }
}
