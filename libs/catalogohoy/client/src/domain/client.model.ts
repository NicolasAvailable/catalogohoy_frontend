export interface Client {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpentUsd: number;
  totalSpentBs: number;
  avgOrderUsd: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface ClientList {
  items: Client[];
}

export const emptyClientList = (): ClientList => ({ items: [] });
