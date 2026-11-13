import { Injectable, signal } from '@angular/core';

/**
 * Partes del diseño del catálogo (`design.look`) que NO se pueden aplicar solo
 * con CSS y que los componentes del catálogo necesitan leer. Lo actualiza el
 * shell del catálogo cada vez que aplica un diseño (guardado o de vista previa).
 */
@Injectable({ providedIn: 'root' })
export class CatalogLookState {
  /** Texto del botón de agregar al carrito ("Agregar", "Comprar", o uno propio).
   *  Vacío = el texto por defecto. */
  public readonly buttonText = signal<string>('');
}
