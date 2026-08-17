/** A customer tag (label) the merchant can create and assign to clients. */
export interface ClientTag {
  id: number;
  name: string;
  /** Hex color used for the chip, e.g. `#6366f1`. */
  color: string;
}

export interface Client {
  /**
   * `customers.id`. Present once the client exists as a row (manual or backfilled
   * from orders). May be null only for transient/optimistic items.
   */
  id: number | null;
  phone: string;
  name: string;
  /** Apodo con el que el comerciante reconoce al cliente (opcional). */
  nickname: string | null;
  /** Most recent email the client provided, if any. */
  email: string | null;
  /** ISO date (YYYY-MM-DD) of the client's birthday, if known. */
  birthday: string | null;
  address: string | null;
  notes: string | null;
  /** Optional referral code captured for the client. */
  referralCode: string | null;
  /** Tags assigned to this client. */
  tags: ClientTag[];
  totalOrders: number;
  totalSpentUsd: number;
  totalSpentBs: number;
  avgOrderUsd: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

export interface ClientList {
  items: Client[];
}

export const emptyClientList = (): ClientList => ({ items: [] });

/** Payload for creating/editing a client manually from the admin. */
export interface ClientInput {
  name: string;
  nickname: string | null;
  phone: string;
  email: string | null;
  birthday: string | null;
  address: string | null;
  notes: string | null;
  referralCode: string | null;
  tagIds: number[];
}

/** Default palette offered when creating a new tag. */
export const CLIENT_TAG_COLORS: string[] = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#6b7280', // grey
];
