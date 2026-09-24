import { Order } from './order';
import {
  buildInvoiceFilename,
  invoiceFilenameUsesPhone,
} from './invoice-filename';

const MOTO_FOX = 2421;

function order(partial: Partial<Order>): Order {
  return {
    id: 10,
    tenantId: 999,
    name: 'Juan Pérez',
    phone: '+58 412 1234567',
    ...partial,
  } as Order;
}

describe('buildInvoiceFilename', () => {
  describe('default (todas las tiendas)', () => {
    it('usa solo el nombre del cliente', () => {
      expect(buildInvoiceFilename(order({}))).toBe('Juan Pérez.pdf');
    });

    it('no numera la primera orden del cliente (seq 1)', () => {
      expect(buildInvoiceFilename(order({}), { seq: 1 })).toBe('Juan Pérez.pdf');
    });

    it('numera de la segunda orden en adelante', () => {
      expect(buildInvoiceFilename(order({}), { seq: 2 })).toBe(
        'Juan Pérez (2).pdf'
      );
      expect(buildInvoiceFilename(order({}), { seq: 5 })).toBe(
        'Juan Pérez (5).pdf'
      );
    });

    it('ignora el teléfono aunque la orden lo traiga', () => {
      expect(buildInvoiceFilename(order({ phone: '+58 4120000000' }))).toBe(
        'Juan Pérez.pdf'
      );
    });
  });

  describe('Moto Fox (allowlist)', () => {
    it('concatena el teléfono sin el código de país (58) con guion', () => {
      expect(
        buildInvoiceFilename(order({ tenantId: MOTO_FOX, phone: '+58 412 1234567' }))
      ).toBe('Juan Pérez-4121234567.pdf');
    });

    it('numera repetidos del mismo cliente conservando el teléfono', () => {
      expect(
        buildInvoiceFilename(order({ tenantId: MOTO_FOX }), { seq: 3 })
      ).toBe('Juan Pérez-4121234567 (3).pdf');
    });

    it('cae a solo nombre si la orden no tiene teléfono', () => {
      expect(
        buildInvoiceFilename(order({ tenantId: MOTO_FOX, phone: undefined }))
      ).toBe('Juan Pérez.pdf');
    });

    it('deja el número tal cual cuando no empieza por el código de país', () => {
      expect(
        buildInvoiceFilename(order({ tenantId: MOTO_FOX, phone: '0412 1234567' }))
      ).toBe('Juan Pérez-04121234567.pdf');
    });
  });

  describe('fallbacks y saneamiento', () => {
    it('sin nombre usa el esquema "pedido-<n>"', () => {
      expect(buildInvoiceFilename(order({ name: '', orderNumber: 63 }))).toBe(
        'pedido-63.pdf'
      );
    });

    it('sin nombre y recibo usa "recibo-<n>"', () => {
      expect(
        buildInvoiceFilename(order({ name: '   ', orderNumber: 8 }), {
          isReceipt: true,
        })
      ).toBe('recibo-8.pdf');
    });

    it('usa el id cuando no hay orderNumber', () => {
      expect(
        buildInvoiceFilename(order({ name: '', orderNumber: undefined, id: 4046 }))
      ).toBe('pedido-4046.pdf');
    });

    it('quita caracteres inválidos para nombre de archivo', () => {
      expect(
        buildInvoiceFilename(order({ name: 'Juan / "Pepe" : Pérez*' }))
      ).toBe('Juan Pepe Pérez.pdf');
    });
  });

  describe('invoiceFilenameUsesPhone', () => {
    it('true solo para las tiendas del allowlist', () => {
      expect(invoiceFilenameUsesPhone(MOTO_FOX)).toBe(true);
      expect(invoiceFilenameUsesPhone(999)).toBe(false);
      expect(invoiceFilenameUsesPhone(null)).toBe(false);
      expect(invoiceFilenameUsesPhone(undefined)).toBe(false);
    });
  });
});
