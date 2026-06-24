import { inject, Pipe, PipeTransform } from '@angular/core';
import { EcommerceStore } from '../../infrastructure';

/**
 * Formatea un precio con los separadores de miles/decimales configurados por el
 * tenant (`tenant_currency_config` → `decimalSeparator` / `thousandSeparator`,
 * expuestos por `EcommerceStore.numberFormat`). Así un mismo número se ve:
 *   - "1.234,50" en VE/AR (decimal ',', miles '.')
 *   - "1,234.50" en GT/MX/US (decimal '.', miles ',')
 *
 * Reglas:
 *   - Agrupa SIEMPRE los miles con el separador del país.
 *   - Muestra 2 decimales SOLO cuando el precio tiene parte fraccionaria, para
 *     no llenar de ",00" los catálogos con precios enteros.
 *   - NO antepone el símbolo de moneda: ese se pone aparte con `currencySymbol`
 *     (p. ej. `{{ cs() }}{{ price | tenantPrice }}`).
 *
 * Es **impuro** a propósito: lee la config de moneda del store, que puede
 * cargar después del primer render (y cambia en el preview del editor).
 */
@Pipe({ name: 'tenantPrice', standalone: true, pure: false })
export class TenantPricePipe implements PipeTransform {
  private readonly store = inject(EcommerceStore);

  transform(value: number | null | undefined): string {
    const n = Number(value ?? 0);
    if (!isFinite(n)) return '0';

    const { decimalSeparator, thousandSeparator } = this.store.numberFormat();
    const negative = n < 0;
    const abs = Math.abs(n);
    const hasFraction = !Number.isInteger(abs);
    const fixed = hasFraction ? abs.toFixed(2) : abs.toFixed(0);
    const [intPart, fracPart] = fixed.split('.');
    const grouped = intPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      thousandSeparator
    );
    const out = fracPart ? `${grouped}${decimalSeparator}${fracPart}` : grouped;
    return negative ? `-${out}` : out;
  }
}
