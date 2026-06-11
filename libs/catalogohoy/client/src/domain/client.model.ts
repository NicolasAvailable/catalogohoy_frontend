export interface Client {
  phone: string;
  name: string;
  /** Most recent email the client provided at checkout, if any. */
  email: string | null;
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
