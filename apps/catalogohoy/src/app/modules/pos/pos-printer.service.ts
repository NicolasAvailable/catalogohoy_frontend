import { Injectable, signal } from '@angular/core';

/** Una línea del ticket para imprimir. */
export interface ThermalLine {
  label: string;
  qty: number;
  total: number;
}

/** Datos para imprimir un comprobante en la impresora térmica. */
export interface ThermalReceipt {
  header: string;
  footer: string;
  currency: string;
  number: number | null;
  dateStr: string;
  customer: string;
  lines: ThermalLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  adjustAmount: number;
  method: string;
  total: number;
  received: number | null;
  change: number;
}

// ── Tipos mínimos de WebUSB (no siempre están en lib.dom) ───────────────────
interface UsbEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: string;
}
interface UsbAlternate {
  endpoints: UsbEndpoint[];
}
interface UsbInterface {
  interfaceNumber: number;
  alternate: UsbAlternate;
}
interface UsbConfiguration {
  interfaces: UsbInterface[];
}
interface UsbDevice {
  productName?: string;
  manufacturerName?: string;
  configuration?: UsbConfiguration;
  configurations: UsbConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
}
interface UsbApi {
  requestDevice(opts: { filters: { classCode?: number }[] }): Promise<UsbDevice>;
}

const ESC = 0x1b;
const GS = 0x1d;

/** Acumulador de bytes ESC/POS. */
class EscPosBuilder {
  private chunks: number[] = [];

  raw(...bytes: number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  init(): this {
    return this.raw(ESC, 0x40); // ESC @
  }
  align(a: 'left' | 'center' | 'right'): this {
    return this.raw(ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0);
  }
  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  /** Tamaño: 0 normal, 1 doble ancho/alto. */
  size(big: boolean): this {
    return this.raw(GS, 0x21, big ? 0x11 : 0x00);
  }
  feed(n = 1): this {
    for (let i = 0; i < n; i++) this.chunks.push(0x0a);
    return this;
  }
  /** Texto (se normaliza a ASCII para evitar codepages: á→a, ñ→n). */
  text(s: string): this {
    const ascii = (s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7e]/g, '?');
    for (let i = 0; i < ascii.length; i++)
      this.chunks.push(ascii.charCodeAt(i) & 0xff);
    return this;
  }
  line(s = ''): this {
    return this.text(s).feed();
  }
  cut(): this {
    // GS V 66 0 → corte parcial con avance
    return this.feed(3).raw(GS, 0x56, 66, 0);
  }
  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

/**
 * Impresora térmica por WebUSB (ESC/POS). Solo Chrome/Edge de escritorio sobre
 * HTTPS o localhost, y requiere un gesto del usuario para elegir el dispositivo.
 * El objeto USB vive en memoria (se pierde al recargar) — la UI usa `connected()`
 * para saber el estado real. Si no hay impresora conectada, la Venta cae al
 * `window.print` del navegador.
 */
@Injectable({ providedIn: 'root' })
export class PosPrinterService {
  private device: UsbDevice | null = null;
  private ifaceNumber = 0;
  private outEndpoint = 0;

  /** Estado reactivo para la UI de Configuración. */
  readonly connected = signal(false);
  readonly deviceName = signal('');

  /** ¿El navegador soporta WebUSB? */
  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as unknown as { usb?: UsbApi }).usb;
  }

  private get usb(): UsbApi | null {
    return (navigator as unknown as { usb?: UsbApi }).usb ?? null;
  }

  /** Pide al usuario elegir la impresora USB y reclama su endpoint de salida. */
  async connect(): Promise<{ ok: boolean; name?: string; error?: string }> {
    const usb = this.usb;
    if (!usb) return { ok: false, error: 'Tu navegador no soporta impresión por USB (usá Chrome/Edge de escritorio).' };
    try {
      const device = await usb.requestDevice({ filters: [{ classCode: 7 }] });
      await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      const config = device.configuration ?? device.configurations[0];
      // Buscar la interfaz con un endpoint BULK de salida.
      let claimed = false;
      for (const iface of config.interfaces) {
        const out = iface.alternate.endpoints.find(
          (e) => e.direction === 'out'
        );
        if (out) {
          await device.claimInterface(iface.interfaceNumber);
          this.ifaceNumber = iface.interfaceNumber;
          this.outEndpoint = out.endpointNumber;
          claimed = true;
          break;
        }
      }
      if (!claimed) {
        await device.close();
        return { ok: false, error: 'La impresora no expone un canal de salida USB compatible.' };
      }
      this.device = device;
      const name = device.productName || 'Impresora USB';
      this.connected.set(true);
      this.deviceName.set(name);
      return { ok: true, name };
    } catch (e) {
      // El usuario canceló el selector, o error de permiso/dispositivo.
      const msg = (e as Error)?.message || '';
      if (/no device selected|cancel/i.test(msg)) {
        return { ok: false, error: '' }; // cancelado, sin ruido
      }
      return { ok: false, error: 'No se pudo conectar la impresora.' };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.device) {
        await this.device.releaseInterface(this.ifaceNumber);
        await this.device.close();
      }
    } catch {
      /* ignore */
    }
    this.device = null;
    this.connected.set(false);
    this.deviceName.set('');
  }

  private async send(bytes: Uint8Array): Promise<boolean> {
    if (!this.device) return false;
    try {
      // Enviar en bloques por si el buffer del endpoint es chico.
      const CHUNK = 4096;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        await this.device.transferOut(this.outEndpoint, bytes.slice(i, i + CHUNK));
      }
      return true;
    } catch {
      // Se desconectó físicamente.
      this.connected.set(false);
      this.device = null;
      return false;
    }
  }

  /** Imprime un ticket de prueba. */
  async printTest(width: '58' | '80'): Promise<boolean> {
    const cols = width === '58' ? 32 : 48;
    const b = new EscPosBuilder().init().align('center').bold(true).size(true)
      .line('TICKET DE PRUEBA').size(false).bold(false)
      .line('Punto de Venta - CatalogoHoy')
      .align('left').text('-'.repeat(cols)).feed()
      .line('Si podes leer esto, la impresora')
      .line('esta configurada correctamente.')
      .cut();
    return this.send(b.build());
  }

  /** Construye e imprime el comprobante de una venta. */
  async printReceipt(r: ThermalReceipt, width: '58' | '80'): Promise<boolean> {
    if (!this.device) return false;
    const cols = width === '58' ? 32 : 48;
    const money = (n: number) => `${r.currency}${n.toFixed(2)}`;
    // Fila "izquierda ....... derecha" ajustada al ancho (siempre ≥1 espacio
    // entre etiqueta y monto; trunca la etiqueta si no entra).
    const row = (left: string, right: string) => {
      const room = cols - right.length - 1;
      const l = left.length > room ? left.slice(0, Math.max(0, room)) : left;
      const pad = Math.max(1, cols - l.length - right.length);
      return l + ' '.repeat(pad) + right;
    };

    const b = new EscPosBuilder().init().align('center');
    if (r.header) b.bold(true).line(r.header).bold(false);
    b.text(r.dateStr + (r.number != null ? ` #${r.number}` : '')).feed();
    if (r.customer) b.line(r.customer);
    b.align('left').text('-'.repeat(cols)).feed();

    for (const l of r.lines) {
      b.line(row(`${l.qty}x ${l.label}`, money(l.total)));
    }
    b.text('-'.repeat(cols)).feed();
    b.line(row('Subtotal', money(r.subtotal)));
    if (r.discount > 0) b.line(row('Descuento', '-' + money(r.discount)));
    if (r.shipping > 0) b.line(row('Envio', money(r.shipping)));
    if (r.adjustAmount)
      b.line(
        row(
          `${r.adjustAmount > 0 ? 'Recargo' : 'Descuento'} (${r.method})`,
          (r.adjustAmount > 0 ? '+' : '-') + money(Math.abs(r.adjustAmount))
        )
      );
    b.bold(true).size(true).line(row('TOTAL', money(r.total))).size(false).bold(false);
    if (r.method) b.line(row('Pago', r.method));
    if (r.received != null) {
      b.line(row('Recibido', money(r.received)));
      b.line(row('Vuelto', money(r.change)));
    }
    if (r.footer) {
      b.feed().align('center').line(r.footer);
    }
    b.cut();
    return this.send(b.build());
  }
}
