/**
 * Whitelist of emails allowed to access the internal admin panel.
 * Authentication succeeds against Supabase, but the guard rejects
 * sessions whose email is not in this list.
 */
export const ALLOWED_ADMIN_EMAILS: readonly string[] = [
  'nicaso3006@gmail.com',
];
