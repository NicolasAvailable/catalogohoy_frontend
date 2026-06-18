import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  BadgeComponent,
  ButtonComponent,
  CheckboxComponent,
  ConfirmDialogComponent,
  DialogComponent,
  EmptyListComponent,
  IconComponent,
  InputSearchComponent,
  SelectComponent,
} from '@ui';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { Client } from '../../../domain/client.model';
import { ClientRealtimeService } from '../../../infrastructure/client-realtime.service';
import { ClientStore } from '../../../infrastructure/client.store';
import { ClientFormDialogComponent } from '../../components/client-form-dialog/client-form-dialog';
import { ClientRowTagsComponent } from '../../components/client-row-tags/client-row-tags';
import { ClientTagCreateRowComponent } from '../../components/client-tag-create-row/client-tag-create-row';

@Component({
  selector: 'lib-client-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    EmptyListComponent,
    InputSearchComponent,
    ButtonComponent,
    CheckboxComponent,
    BadgeComponent,
    DialogComponent,
    ConfirmDialogComponent,
    SelectComponent,
    ClientFormDialogComponent,
    ClientTagCreateRowComponent,
    ClientRowTagsComponent,
  ],
  templateUrl: './client-list.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export default class ClientListComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  public readonly clientStore = inject(ClientStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly clientRealtime = inject(ClientRealtimeService);
  private readonly toast = inject(ToastService);
  public readonly cs = computed(() => this.tenantCurrency.localSymbol() || '$');

  @ViewChild(ClientFormDialogComponent)
  private formDialog!: ClientFormDialogComponent;
  @ViewChild(ConfirmDialogComponent)
  private confirmDialog!: ConfirmDialogComponent;
  @ViewChild('assignDialog') private assignDialog!: DialogComponent;

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  public readonly searchQuery = signal('');
  public readonly selectedTagId = signal<number | null>(null);
  public readonly selectedIds = signal<Set<number>>(new Set());
  public readonly bulkTagId = signal<number | null>(null);
  public readonly confirmMode = signal<'clients' | 'tag'>('clients');
  public readonly pendingTagId = signal<number | null>(null);

  public readonly filteredClients = computed(() => {
    let clients = [...this.clientStore.clientList().items];
    const query = this.searchQuery().toLowerCase().trim();
    const tagId = this.selectedTagId();

    if (query) {
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          (c.email?.toLowerCase().includes(query) ?? false)
      );
    }
    if (tagId !== null) {
      clients = clients.filter((c) => c.tags.some((t) => t.id === tagId));
    }
    return clients;
  });

  public readonly totalClients = computed(
    () => this.clientStore.clientList().items.length
  );

  public readonly selectedCount = computed(() => this.selectedIds().size);

  public readonly isAllVisibleSelected = computed(() => {
    const visible = this.filteredClients();
    if (!visible.length) return false;
    const ids = this.selectedIds();
    return visible.every((c) => c.id !== null && ids.has(c.id));
  });

  ngOnInit() {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.searchQuery.set(query));

    this.clientStore.loadClients();
    this.clientStore.loadTags();
    this.clientRealtime.subscribe();
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
    this.clientRealtime.unsubscribe();
  }

  onSearch(query: string) {
    this.searchSubject.next(query);
  }

  navigateToClient(client: Client) {
    this.router.navigate(['/admin/clients', encodeURIComponent(client.phone)]);
  }

  // --------------------------------------------------------------- filters ---

  setTagFilter(tagId: number | null) {
    this.selectedTagId.set(tagId);
  }

  onDeleteTag(tagId: number, event: Event) {
    event.stopPropagation();
    this.confirmMode.set('tag');
    this.pendingTagId.set(tagId);
    this.confirmDialog.warning();
  }

  private async confirmDeleteTag() {
    const tagId = this.pendingTagId();
    if (tagId === null) return;
    this.toast.wait('Eliminando etiqueta...');
    const ok = await this.clientStore.removeTag(tagId);
    this.toast.dismissWait();
    if (ok) {
      if (this.selectedTagId() === tagId) this.selectedTagId.set(null);
      this.toast.success('Etiqueta eliminada');
    } else {
      this.toast.warning('No se pudo eliminar la etiqueta');
    }
    this.pendingTagId.set(null);
  }

  // ------------------------------------------------------------- selection ---

  toggleSelect(client: Client) {
    if (client.id === null) return;
    const ids = new Set(this.selectedIds());
    if (ids.has(client.id)) ids.delete(client.id);
    else ids.add(client.id);
    this.selectedIds.set(ids);
  }

  isSelected(client: Client): boolean {
    return client.id !== null && this.selectedIds().has(client.id);
  }

  toggleAllVisible() {
    const visible = this.filteredClients();
    const ids = new Set(this.selectedIds());
    const allSelected = this.isAllVisibleSelected();
    for (const c of visible) {
      if (c.id === null) continue;
      if (allSelected) ids.delete(c.id);
      else ids.add(c.id);
    }
    this.selectedIds.set(ids);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  // --------------------------------------------------------- add / edit ---

  openAdd() {
    this.formDialog.open(null);
  }

  openEdit(client: Client, event?: Event) {
    event?.stopPropagation();
    this.formDialog.open(client);
  }

  onSaved() {
    this.clearSelection();
  }

  // ------------------------------------------------------------ delete ---

  onDeleteSelected() {
    if (!this.selectedCount()) return;
    this.confirmMode.set('clients');
    this.confirmDialog.warning();
  }

  async onConfirmDelete() {
    if (this.confirmMode() === 'tag') {
      await this.confirmDeleteTag();
      return;
    }
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.toast.wait(ids.length === 1 ? 'Eliminando cliente...' : 'Eliminando clientes...');
    const ok = await this.clientStore.removeClients(ids);
    this.toast.dismissWait();
    if (ok) {
      this.toast.success(
        ids.length === 1
          ? 'Cliente eliminado exitosamente'
          : `${ids.length} clientes eliminados exitosamente`
      );
      this.clearSelection();
    } else {
      this.toast.warning('No se pudieron eliminar los clientes');
    }
  }

  confirmHeader(): string {
    return this.confirmMode() === 'tag' ? 'Eliminar etiqueta' : 'Eliminar clientes';
  }

  deleteDialogContent(): string {
    if (this.confirmMode() === 'tag') {
      return 'Se eliminará la etiqueta y se desvinculará de todos los clientes. Esta acción no se puede deshacer.';
    }
    const n = this.selectedCount();
    return n === 1
      ? '¿Seguro que quieres eliminar este cliente? Esta acción no se puede deshacer.'
      : `¿Seguro que quieres eliminar ${n} clientes? Esta acción no se puede deshacer.`;
  }

  // -------------------------------------------------------- assign tag ---

  openAssignTag() {
    if (!this.selectedCount()) return;
    this.bulkTagId.set(null);
    this.clientStore.loadTags();
    this.assignDialog.show();
  }

  async onConfirmAssignTag() {
    const tagId = this.bulkTagId();
    const ids = Array.from(this.selectedIds());
    if (tagId === null || !ids.length) return;
    this.toast.wait('Asignando etiqueta...');
    const ok = await this.clientStore.assignTag(tagId, ids);
    this.toast.dismissWait();
    if (ok) {
      this.toast.success('Etiqueta asignada exitosamente');
      this.assignDialog.hide();
      this.clearSelection();
    } else {
      this.toast.warning('No se pudo asignar la etiqueta');
    }
  }

  // ---------------------------------------------------------------- utils ---

  getWhatsAppLink(phone: string): string {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
