import { computed, effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Título de la pestaña del navegador.
 *
 * En el ADMIN muestra "<Nombre del negocio> | <Módulo>" (p. ej.
 * "Distribuidora moto Fox | Órdenes") tomando el nombre del catálogo del
 * tenant logueado y el `title` de la ruta activa (definido en admin.routes.ts).
 *
 * Las rutas del STOREFRONT no llevan `title` (buildTitle → undefined): las
 * dejamos intactas para no pisar el título SEO que setean e-commerce.ts /
 * product-detail.ts. Es decir, esta estrategia SOLO actúa cuando la ruta
 * define un título (el admin).
 */
@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly transloco = inject(TranslocoService);

  /** Nombre del negocio (catálogo del tenant); '' mientras no cargó. */
  private readonly businessName = computed(
    () => this.configStore.config()?.name || this.tenantStore.tenantName() || ''
  );

  /** Título crudo (clave i18n) de la última ruta admin navegada. */
  private lastRouteTitle: string | null = null;

  constructor() {
    super();
    // El nombre del negocio suele cargar DESPUÉS de la primera navegación al
    // admin; cuando llega (o cambia), re-aplicamos el título.
    effect(() => {
      this.businessName();
      this.apply();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastRouteTitle = this.buildTitle(snapshot) ?? null;
    this.apply();
  }

  private apply(): void {
    // Sin título de ruta → storefront u otra vista que maneja su propio título:
    // no tocar nada.
    if (!this.lastRouteTitle) return;
    const module = this.transloco.translate(this.lastRouteTitle);
    const biz = this.businessName();
    this.title.setTitle(biz ? `${biz} | ${module}` : `${module} · CatalogoHoy`);
  }
}
