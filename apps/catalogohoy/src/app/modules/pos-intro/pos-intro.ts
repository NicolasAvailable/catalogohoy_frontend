import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import { DialogComponent, IconComponent } from '@ui';
import { POS_ENABLED_PLANS } from '../pos/pos-enabled.guard';

interface Step {
  icon: string;
  title: string;
  text: string;
}

/**
 * Vista inicial del Punto de Venta dentro del admin (estilo el landing del POS
 * de TiendaNube): explica qué es y cómo funciona, visible para TODOS los planes.
 * El CTA "Ir a Punto de Venta" abre el POS en una ventana nueva si el plan lo
 * incluye (Avanzado/Enterprise); si no, muestra el MISMO modal de upgrade que
 * el CRM (Chats) que lleva a la página de Planes.
 */
@Component({
  selector: 'app-pos-intro',
  standalone: true,
  imports: [RouterLink, IconComponent, DialogComponent, TranslocoPipe],
  templateUrl: './pos-intro.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosIntro implements OnInit {
  private readonly planStore = inject(PlanStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly configStore = inject(EcommerceConfigStore);

  private readonly upgradeDialog = viewChild<DialogComponent>('upgradeDialog');

  readonly steps: Step[] = [
    { icon: 'scan-barcode', title: 'Buscá o escaneá', text: 'Encontrá productos por nombre, descripción, SKU o con el lector de código de barras.' },
    { icon: 'shopping-cart', title: 'Armá el carrito', text: 'Sumá productos y variantes, aplicá descuentos y agregá un cliente si querés.' },
    { icon: 'banknote', title: 'Cobrá y entregá', text: 'Elegí el medio de pago (efectivo con vuelto, tarjeta, transferencia) e imprimí o compartí el recibo.' },
    { icon: 'wallet', title: 'Caja y estadísticas', text: 'Abrí y cerrá caja con arqueo, registrá movimientos y seguí tus ventas del día.' },
  ];

  ngOnInit(): void {
    // El plan puede no estar cargado si se entra directo a esta ruta.
    this.planStore.loadTenantPlanUsage();
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.configStore.loadConfig(String(tid));
    });
  }

  /** CTA principal: abre el POS o muestra el gate de plan (como el CRM). */
  goToPos(): void {
    const plan = this.planStore.currentPlan()?.id;
    // Plan cargado y NO habilitado → modal de upgrade a Planes.
    if (plan && !POS_ENABLED_PLANS.includes(plan)) {
      this.upgradeDialog()?.show();
      return;
    }
    // Habilitado (o plan aún no cargado → el guard de /pos decide): ventana nueva
    // nombrada, para reenfocar la misma en un segundo clic. El título de la
    // ventana lo pone el shell del POS ("Punto de venta | <catálogo>").
    const availW = window.screen?.availWidth || 1440;
    const availH = window.screen?.availHeight || 900;
    const w = Math.min(1600, availW);
    const left = Math.max(0, Math.round((availW - w) / 2));
    window.open(
      '/pos',
      'catalogohoy-pos',
      `popup=yes,width=${w},height=${availH},left=${left},top=0`
    );
  }

  closeUpgrade(): void {
    this.upgradeDialog()?.hide();
  }
}
