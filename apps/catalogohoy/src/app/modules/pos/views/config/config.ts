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
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosSettingsStore } from '../../pos-settings.store';
import { PosPrinterService } from '../../pos-printer.service';

type ConfigPanel = 'printer' | 'methods' | 'cash' | 'tickets';

interface NavGroup {
  title: string;
  items: { id: ConfigPanel; label: string; icon: string }[];
}

@Component({
  selector: 'pos-config',
  standalone: true,
  imports: [DecimalPipe, FormsModule, IconComponent, TranslocoPipe],
  templateUrl: './config.html',
  styleUrl: './config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosConfig implements OnInit {
  readonly settings = inject(PosSettingsStore);
  readonly printer = inject(PosPrinterService);
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  readonly isConnecting = signal(false);

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

  // ── Impresora (WebUSB / ESC-POS) ────────────────────────────────────────────
  /** Empareja una impresora térmica USB real vía WebUSB (Chrome/Edge de
   *  escritorio). El estado real vive en el servicio; también lo persistimos en
   *  settings para recordar el último dispositivo. */
  async connectPrinter(): Promise<void> {
    if (!this.printer.supported) {
      this.toast.error(
        'Tu navegador no soporta impresión por USB. Usá Chrome o Edge de escritorio.' as unknown as Exception
      );
      return;
    }
    this.isConnecting.set(true);
    const res = await this.printer.connect();
    this.isConnecting.set(false);
    if (res.ok) {
      this.settings.setPrinterConnected(true, res.name ?? 'Impresora USB');
      this.toast.success('Impresora conectada ✓');
    } else if (res.error) {
      this.toast.error(res.error as unknown as Exception);
    }
  }

  async disconnectPrinter(): Promise<void> {
    await this.printer.disconnect();
    this.settings.setPrinterConnected(false, '');
  }

  async printTest(): Promise<void> {
    if (!this.printer.connected()) {
      this.toast.error('Conectá una impresora primero' as unknown as Exception);
      return;
    }
    const ok = await this.printer.printTest(this.settings.printer().width);
    if (ok) this.toast.success('Ticket de prueba enviado a la impresora');
    else this.toast.error('No se pudo imprimir. Revisá la conexión.' as unknown as Exception);
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
