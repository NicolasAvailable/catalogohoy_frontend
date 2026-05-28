import { PlanTier } from '../shared/plan-cycle.model';
import { PayingClient } from '../paying-clients/paying-clients.model';

/**
 * A single Supabase Auth account that owns one or more catalogs with an
 * active paid plan. Built client-side by grouping `list_paying_clients_admin`
 * rows by `owner_email`, so we don't need a separate RPC.
 */
export interface PayingAccount {
  /** Stable key — Supabase Auth enforces unique emails per user. */
  email: string;
  name: string | null;
  avatarUrl: string | null;
  catalogs: PayingClient[];
  catalogCount: number;
  /** Most valuable tier the account is currently paying for. */
  highestTier: PlanTier;
}

const TIER_RANK: Record<PlanTier, number> = {
  gratis: 0,
  basico: 1,
  avanzado: 2,
};

/**
 * Groups paying clients into one row per owner email. Rows without an email
 * are dropped (we have nothing to key on).
 */
export function groupByOwner(clients: PayingClient[]): PayingAccount[] {
  const byEmail = new Map<string, PayingAccount>();

  for (const client of clients) {
    const email = client.ownerEmail?.trim().toLowerCase();
    if (!email) continue;

    const existing = byEmail.get(email);
    if (existing) {
      existing.catalogs.push(client);
      existing.catalogCount = existing.catalogs.length;
      if (TIER_RANK[client.tier] > TIER_RANK[existing.highestTier]) {
        existing.highestTier = client.tier;
      }
      // Backfill profile fields if the first row had nulls.
      existing.name ??= client.ownerName;
      existing.avatarUrl ??= client.ownerAvatarUrl;
    } else {
      byEmail.set(email, {
        email: client.ownerEmail ?? email,
        name: client.ownerName,
        avatarUrl: client.ownerAvatarUrl,
        catalogs: [client],
        catalogCount: 1,
        highestTier: client.tier,
      });
    }
  }

  // Sort by catalog count desc, then by email asc for stable ordering.
  return Array.from(byEmail.values()).sort((a, b) => {
    if (b.catalogCount !== a.catalogCount) {
      return b.catalogCount - a.catalogCount;
    }
    return a.email.localeCompare(b.email);
  });
}
