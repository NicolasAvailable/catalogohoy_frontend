import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosSettingsStore } from '../../pos-settings.store';

type ConfigPanel = 'printer' | 'methods' | 'cash' | 'tickets';

interface NavGroup {
  title: string;
  items: { id: ConfigPanel; label: string; icon: string }[];
}

@Component({
  selector: 'pos-config',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent],
  templateUrl: './config.html',
  styleUrl: './config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosConfig implements OnInit {
  readonly settings = inject(PosSettingsStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  readonly panel = signal<ConfigPanel>('printer');

  readonly groups: NavGroup[] = [
    {
      title: 'Dispositivos',
      items: [{ id: 'printer', label: 'Impresora térmica', icon: 'printer' }],
    },
    {
      title: 'Configuraciones avanzadas',
      items: [
        { id: 'methods', label: 'Medios de pago', icon: 'wallet' },
        { id: 'cash', label: 'Cajas', icon: 'inbox' },
        { id: 'tickets', label: 'Tickets', icon: 'file-text' },
      ],
    },
  ];

  /** Líneas de ejemplo para la vista previa del ticket. */
  readonly sampleLines = [
    { name: 'Remera algodón', qty: 2, total: 39.98 },
    { name: 'Gorra trucker', qty: 1, total: 14.5 },
  ];
  readonly sampleTotal = computed(() =>
    this.sampleLines.reduce((t, l) => t + l.total, 0)
  );

  ngOnInit(): void {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      this.settings.load(tid ? String(tid) : 'default');
    });
  }

  select(p: ConfigPanel): void {
    this.panel.set(p);
  }

  // ── Impresora ──────────────────────────────────────────────────────────────
  /** Stub de conexión: la integración real WebUSB/ESC-POS es F3. Simula el
   *  emparejamiento para poder maquetar y probar el flujo de tickets. */
  connectPrinter(): void {
    this.settings.setPrinterConnected(true, 'Impresora térmica USB');
    this.toast.success('Impresora conectada (demo)');
  }

  disconnectPrinter(): void {
    this.settings.setPrinterConnected(false, '');
  }

  printTest(): void {
    if (!this.settings.printer().connected) {
      this.toast.error('Conectá una impresora primero' as unknown as Exception);
      return;
    }
    this.toast.success('Ticket de prueba enviado a la impresora (demo)');
  }

  // ── Tickets ────────────────────────────────────────────────────────────────
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('El logo debe ser una imagen' as unknown as Exception);
      return;
    }
    if (file.size > 500_000) {
      this.toast.error('La imagen es muy pesada (máx. 500 KB)' as unknown as Exception);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.settings.setTicketLogo(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeLogo(): void {
    this.settings.setTicketLogo(null);
  }

  saveTickets(): void {
    // La persistencia ya ocurre en cada cambio; el botón da feedback explícito.
    this.toast.success('Ticket guardado');
  }

  // ── Cajas ──────────────────────────────────────────────────────────────────
  /** El alta de cajas necesita tablas de caja (F2). Por ahora, aviso. */
  addCash(): void {
    this.toast.success('Las cajas llegan en la próxima versión del POS');
  }
}
