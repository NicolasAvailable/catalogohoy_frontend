-- Permisos de equipo para las funciones nuevas (2026-10-22): pos:use,
-- meta:view/connect y asistente:view/connect. Para no quitarle acceso a nadie,
-- los miembros que ya podían usarlas lo conservan:
--   · POS: quien podía crear órdenes (antes el POS no tenía permiso propio).
--   · Instagram y Facebook: quien podía editar el catálogo (era su permiso).
-- El asistente era solo del dueño, así que no se le da a nadie.
insert into public.team_member_permissions (team_member_id, module, action)
select p.team_member_id, 'pos', 'use'
from public.team_member_permissions p
where p.module = 'ordenes' and p.action = 'create'
  and not exists (select 1 from public.team_member_permissions x
    where x.team_member_id = p.team_member_id and x.module = 'pos' and x.action = 'use');

insert into public.team_member_permissions (team_member_id, module, action)
select p.team_member_id, 'meta', a.action
from public.team_member_permissions p
cross join (values ('view'), ('connect')) as a(action)
where p.module = 'catalogo' and p.action = 'edit'
  and not exists (select 1 from public.team_member_permissions x
    where x.team_member_id = p.team_member_id and x.module = 'meta' and x.action = a.action);
