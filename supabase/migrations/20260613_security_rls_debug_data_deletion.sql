-- Security advisor (ERROR: rls_disabled_in_public): enable RLS on two tables
-- that are written exclusively by SECURITY DEFINER functions / edge functions
-- using the service role (which bypasses RLS). No frontend path reads them
-- (zero references in the codebase), so enabling RLS with no policy closes them
-- to anon/authenticated without affecting the existing write paths.
alter table public._debug_logs enable row level security;
alter table public.data_deletion_requests enable row level security;
