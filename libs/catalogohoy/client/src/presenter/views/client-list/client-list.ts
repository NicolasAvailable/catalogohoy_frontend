import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import {
  EmptyListComponent,
  IconComponent,
  InputSearchComponent,
} from '@ui';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { Client } from '../../../domain/client.model';
import { ClientRealtimeService } from '../../../infrastructure/client-realtime.service';
import { ClientStore } from '../../../infrastructure/client.store';

type FilterValue = 'all' | 'with_completed' | 'with_pending' | 'no_completed';

@Component({
  selector: 'lib-client-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    EmptyListComponent,
    InputSearchComponent,
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
  public readonly cs = computed(() => this.tenantCurrency.localSymbol() || '$');

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  public readonly searchQuery = signal('');
  public readonly selectedFilter = signal<FilterValue>('all');

  public readonly filterTabs: { label: string; value: FilterValue }[] = [
    { label: 'Todos', value: 'all' },
  ];

  public readonly filteredClients = computed(() => {
    let clients = [...this.clientStore.clientList().items];
    const query = this.searchQuery().toLowerCase().trim();

    if (query) {
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query)
      );
    }

    return clients;
  });

  public readonly totalClients = computed(
    () => this.clientStore.clientList().items.length
  );

  ngOnInit() {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });

    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.searchQuery.set(query));

    this.clientStore.loadClients();
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

  getWhatsAppLink(phone: string): string {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
