export interface PlatformOrderStats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  pending: number;
  completed: number;
  cancelled: number;
  revenueUsd: number;
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
  totalUsd: number;
  totalBs: number;
  itemCount: number;
  createdAt: string;
}

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
