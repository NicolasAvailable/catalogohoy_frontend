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
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Fetches the full list of platform users via the
   * `list_all_users_admin` RPC. The RPC is `SECURITY DEFINER` and
   * gates access by checking the caller's email matches the hardcoded
   * admin (`nicaso3006@gmail.com`), so it bypasses RLS for that user only.
   */
  async list(): Promise<Either<Error, PlatformUser[]>> {
    const { data, error } = await this.client.rpc('list_all_users_admin');

    if (error) {
      return E.left(new Error(error.message));
    }

    const users: PlatformUser[] = ((data as UserRow[]) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
    }));

    return E.right(users);
  }
}
