import { Injectable, inject, signal } from '@angular/core';
import { OrderService } from './order.service';

/**
 * Nombres de los vendedores de la tienda (CAT-87), para mostrar
 * "Vendedor: Juan" en las órdenes que entraron por el link de un vendedor.
 * Se carga una vez por tienda; si el usuario no tiene permiso queda vacío.
 */
@Injectable({ providedIn: 'root' })
export class OrderSellerNamesService {
  private readonly orderService = inject(OrderService);
  private readonly names = signal<Record<string, string>>({});
  private loadedFor: number | null = null;

  public async load(tenantId: number, force = false): Promise<void> {
    if (!force && this.loadedFor === tenantId) return;
    this.loadedFor = tenantId;
    const list = await this.orderService.listSellers(tenantId);
    this.names.set(Object.fromEntries(list.map((s) => [s.id, s.name])));
  }

  /** Nombre del vendedor de la orden, o null si no viene de un vendedor. */
  public nameFor(sellerId: string | null | undefined): string | null {
    if (!sellerId) return null;
    return this.names()[sellerId] ?? null;
  }
}
