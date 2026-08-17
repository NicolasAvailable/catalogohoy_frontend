import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { PlatformUser } from './users.model';

interface UserRow {
  id: number;
  name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  total_count: number;
}

export interface UsersQuery {
  search?: string | null;
  limit?: number;
  offset?: number;
}

/** Page of users + the server-side total that matches the search. */
export interface UsersPage {
  rows: PlatformUser[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Fetches a page of platform users via the `list_all_users_admin` RPC.
   * The RPC is `SECURITY DEFINER` and gates access by checking the caller's
   * email matches the hardcoded admin (`nicaso3006@gmail.com`), so it
   * bypasses RLS for that user only.
   *
   * Search + pagination are server-side (PostgREST caps responses at 1000
   * rows, so a full client-side list could never reach older users). Every
   * row carries `total_count` = users matching the search before LIMIT/OFFSET.
   */
  async list(query: UsersQuery = {}): Promise<Either<Error, UsersPage>> {
    const { data, error } = await this.client.rpc('list_all_users_admin', {
      p_search: query.search?.trim() || null,
      p_limit: query.limit ?? 100,
      p_offset: query.offset ?? 0,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    const rows = (data as UserRow[]) ?? [];
    const users: PlatformUser[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    }));

    return E.right({ rows: users, total: Number(rows[0]?.total_count ?? 0) });
  }
}
