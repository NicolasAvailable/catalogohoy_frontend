import {
  Component,
  inject,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  InputTextComponent,
  MultiSelectComponent,
  TextareaComponent,
} from '@ui';
import { Client, ClientInput, ClientTag } from '../../../domain/client.model';
import { ClientStore } from '../../../infrastructure/client.store';
import { ClientTagCreateRowComponent } from '../client-tag-create-row/client-tag-create-row';

@Component({
  selector: 'lib-client-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    DialogComponent,
    InputTextComponent,
    TextareaComponent,
    MultiSelectComponent,
    ButtonComponent,
    IconComponent,
    ClientTagCreateRowComponent,
  ],
  templateUrl: './client-form-dialog.html',
})
export class ClientFormDialogComponent {
  public readonly clientStore = inject(ClientStore);
  private readonly toast = inject(ToastService);

  @ViewChild(DialogComponent) private dialog!: DialogComponent;

  public readonly saved = output<void>();

  public readonly editingId = signal<number | null>(null);
  public readonly name = signal('');
  public readonly phone = signal('');
  public readonly email = signal('');
  public readonly address = signal('');
  public readonly referralCode = signal('');
  public readonly notes = signal('');
  public readonly tagIds = signal<number[]>([]);
  public readonly submitted = signal(false);

  public open(client: Client | null = null): void {
    this.submitted.set(false);

    if (client) {
      this.editingId.set(client.id);
      this.name.set(client.name);
      this.phone.set(client.phone);
      this.email.set(client.email ?? '');
      this.address.set(client.address ?? '');
      this.referralCode.set(client.referralCode ?? '');
      this.notes.set(client.notes ?? '');
      this.tagIds.set(client.tags.map((t) => t.id));
    } else {
      this.editingId.set(null);
      this.name.set('');
      this.phone.set('');
      this.email.set('');
      this.address.set('');
      this.referralCode.set('');
      this.notes.set('');
      this.tagIds.set([]);
    }

    this.clientStore.loadTags();
    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public get isEditing(): boolean {
    return this.editingId() !== null;
  }

  public onTagCreated(tag: ClientTag): void {
    this.tagIds.set([...this.tagIds(), tag.id]);
  }

  public async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.name().trim() || !this.phone().trim()) return;

    const input: ClientInput = {
      name: this.name().trim(),
      phone: this.phone().trim(),
      email: this.email().trim() || null,
      birthday: null,
      address: this.address().trim() || null,
      referralCode: this.referralCode().trim() || null,
      notes: this.notes().trim() || null,
      tagIds: this.tagIds(),
    };

    const id = this.editingId();
    this.toast.wait(id ? 'Guardando cambios...' : 'Creando cliente...');
    const ok = id
      ? await this.clientStore.editClient(id, input)
      : await this.clientStore.addClient(input);
    this.toast.dismissWait();

    if (ok) {
      this.toast.success(
        id ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente'
      );
      this.dialog.hide();
      this.saved.emit();
    } else {
      this.toast.warning(
        'No se pudo guardar. Verifica que el teléfono no esté repetido.'
      );
    }
  }
}
