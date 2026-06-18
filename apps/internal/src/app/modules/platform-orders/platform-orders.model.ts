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
