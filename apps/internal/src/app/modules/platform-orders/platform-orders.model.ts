export interface PlatformOrderStats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  pending: number;
  completed: number;
  cancelled: number;
  /** Completadas de catálogos cuya moneda es USD — `orders.total_usd` guarda
   *  el monto en la MONEDA DEL CATÁLOGO, así que no se puede sumar todo junto. */
  revenueUsd: number;
  /** Completadas agrupadas por moneda del catálogo, desc por total. */
  revenueByCurrency: { currency: string; orders: number; total: number }[];
  topTenants: { name: string | null; slug: string | null; orders: number }[];
  daily: { date: string; count: number }[];
}

export type PlatformOrderStatus = 'pending' | 'completed' | 'cancelled';

export interface PlatformOrder {
  id: number;
  orderNumber: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
  customerName: string | null;
  phone: string | null;
  status: PlatformOrderStatus;
  /** Monto en la moneda del catálogo (`currency`), no siempre USD. */
  totalUsd: number;
  totalBs: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

/** Nombres legibles de las monedas que aparecen en la plataforma. */
export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'Dólar',
  VES: 'Bolívar',
  COP: 'Peso colombiano',
  ARS: 'Peso argentino',
  MXN: 'Peso mexicano',
  CLP: 'Peso chileno',
  PEN: 'Sol peruano',
  BOB: 'Boliviano',
  GTQ: 'Quetzal',
  HNL: 'Lempira',
  CRC: 'Colón costarricense',
  DOP: 'Peso dominicano',
  PYG: 'Guaraní',
  UYU: 'Peso uruguayo',
  NIO: 'Córdoba',
  PAB: 'Balboa',
  EUR: 'Euro',
};

export function orderStatusLabel(status: PlatformOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Pendiente';
  }
}
