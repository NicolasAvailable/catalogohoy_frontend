-- CAT-56 (fase 1): UPDATE/DELETE de orders solo para miembros del tenant.
-- Antes: cualquier usuario autenticado de CUALQUIER cuenta podía editar/borrar
-- órdenes ajenas (using true). El aislamiento vivía solo en el código de la app.
-- Se reutiliza _pos_can_access_tenant(): SECURITY DEFINER, cubre users_tenants
-- O team_members aceptados (mismo patrón ya probado en pos_cash_sessions,
-- customers y order_backups).
-- SELECT e INSERT públicos quedan intactos a propósito: el checkout anon crea
-- órdenes y la factura pública (order/:id/invoice) las lee. El endurecimiento
-- del SELECT (token por orden) es la fase 2 del ticket.
-- Validado: dry-run BEGIN..ROLLBACK en prod + E2E Playwright con usuarios
-- reales (checkout público anon ✓, factura pública ✓, owner edita/borra ✓,
-- miembro de equipo edita ✓, autenticado ajeno y usuario nuevo bloqueados ✓).
-- APLICADA EN PROD el 2026-10-09 vía mcp apply_migration.

drop policy "Allow update orders for authenticated users" on public.orders;
drop policy "Allow delete orders for authenticated users" on public.orders;

create policy orders_update_tenant_members on public.orders
  for update to authenticated
  using (public._pos_can_access_tenant(tenant_id))
  with check (public._pos_can_access_tenant(tenant_id));

create policy orders_delete_tenant_members on public.orders
  for delete to authenticated
  using (public._pos_can_access_tenant(tenant_id));

-- Colateral: TRUNCATE no respeta RLS y anon/authenticated lo tenían grantado
-- (default ancho). PostgREST no lo expone, pero se revoca por higiene.
revoke truncate on public.orders from anon, authenticated;
