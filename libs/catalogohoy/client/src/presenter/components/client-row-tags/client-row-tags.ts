import { Component, computed, inject, input } from '@angular/core';
import { PopoverModule } from 'primeng/popover';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { Client, ClientTag } from '../../../domain/client.model';
import { ClientStore } from '../../../infrastructure/client.store';
import { ClientTagCreateRowComponent } from '../client-tag-create-row/client-tag-create-row';

/**
 * Per-row tag editor: always shows the client's assigned tags as chips (with an
 * × to remove) plus a "+" button that opens a body-appended popover listing all
 * tenant tags (checkable) and an inline create row. Toggling a tag assigns or
 * unassigns it for this client immediately.
 */
@Component({
  selector: 'lib-client-row-tags',
  standalone: true,
  imports: [PopoverModule, IconComponent, ClientTagCreateRowComponent],
  templateUrl: './client-row-tags.html',
})
export class ClientRowTagsComponent {
  public readonly client = input.required<Client>();
  public readonly clientStore = inject(ClientStore);
  private readonly toast = inject(ToastService);

  public readonly assignedIds = computed(
    () => new Set(this.client().tags.map((t) => t.id))
  );

  /** Show at most 2 chips inline; the rest collapse into a "+N" badge. */
  public readonly visibleTags = computed(() => this.client().tags.slice(0, 2));
  public readonly extraCount = computed(() =>
    Math.max(0, this.client().tags.length - 2)
  );

  isAssigned(tagId: number): boolean {
    return this.assignedIds().has(tagId);
  }

  async toggleTag(tag: ClientTag, event?: Event) {
    event?.stopPropagation();
    const id = this.client().id;
    if (id === null) return;

    if (this.isAssigned(tag.id)) {
      this.toast.wait('Removiendo etiqueta...');
      const ok = await this.clientStore.unlinkTag(id, tag.id);
      this.toast.dismissWait();
      if (ok) this.toast.success('Etiqueta removida exitosamente');
      else this.toast.warning('No se pudo remover la etiqueta');
    } else {
      this.toast.wait('Asignando etiqueta...');
      const ok = await this.clientStore.assignTag(tag.id, [id]);
      this.toast.dismissWait();
      if (ok) this.toast.success('Etiqueta asignada exitosamente');
      else this.toast.warning('No se pudo asignar la etiqueta');
    }
  }

  onCreated(tag: ClientTag) {
    // A freshly created tag isn't assigned yet → assign it to this client.
    this.toggleTag(tag);
  }
}
