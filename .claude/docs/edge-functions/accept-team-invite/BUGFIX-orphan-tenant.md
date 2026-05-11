# Bugfix: orphan tenant creado al invitar a un usuario nuevo

## Síntoma

Cuando el dueño de un catálogo invita a alguien que **no está registrado**, el
invitado termina con **dos catálogos** en el selector: el del dueño (al que
fue invitado) y uno auto-creado con nombre derivado del email (p. ej.
`essence-royale.catalogohoy...`). Se ve como un duplicado y confunde al
usuario.

## Causa raíz

El trigger `handle_new_user` de Supabase crea un tenant automáticamente para
**todo** nuevo `auth.users` usando `raw_user_meta_data.store_name` (o un
fallback derivado del email). `signupInvitee()` no pasaba esos campos, pero
el trigger igualmente creaba un tenant con el fallback. Luego
`accept-team-invite` vinculaba al invitado al tenant del invitador sin
borrar el huérfano.

## Fix aplicado (frontend + edge function)

1. **Frontend** — `libs/catalogohoy/auth/src/infrastructure/authentication.service.ts`:
   `signupInvitee()` ahora marca `user_metadata.is_invitee = true` y guarda
   `invite_token`.

2. **Edge function** — `accept-team-invite/index.ts`:
   después de vincular al invitado, si `user_metadata.is_invitee === true`
   busca tenants donde el invitado sea el único `role='owner'` y que **no
   sean** el tenant invitado, y los borra en cascada (`users_tenants` +
   `tenants`).

Para desplegar:

```bash
supabase functions deploy accept-team-invite
```

## Cambio recomendado en el trigger (opcional pero más limpio)

El fix del edge function **limpia el huérfano después** — pero lo ideal es
que el trigger no lo cree de entrada. SQL sugerido (ajusta al nombre real
del trigger / esquema):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Skip tenant bootstrap when the user is signing up via team invite.
  -- The `accept-team-invite` edge function links them to the inviter's
  -- tenant, so creating a new one here would just be an orphan.
  IF (NEW.raw_user_meta_data->>'is_invitee')::boolean IS TRUE THEN
    -- Still insert into public.users (needed for FKs), but skip tenant.
    INSERT INTO public.users (auth_user_id, email, name, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name'
    );
    RETURN NEW;
  END IF;

  -- ... existing logic (create tenant, link via users_tenants, etc.) ...

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Con este cambio, el bloque de limpieza en la edge function queda como
salvaguarda defensiva (y cubre casos históricos que todavía tengan tenants
huérfanos al aceptar).

## Limpieza de huérfanos existentes

Para clientes ya afectados, ejecuta en SQL editor (ajusta IDs):

```sql
-- Encuentra candidatos: tenants donde un solo usuario es owner Y ese usuario
-- está en otro tenant como member (invitado).
SELECT t.id, t.name, u.email
FROM tenants t
JOIN users_tenants ut_owner ON ut_owner.tenant_id = t.id AND ut_owner.role = 'owner'
JOIN users u ON u.id = ut_owner.user_id
WHERE (SELECT COUNT(*) FROM users_tenants WHERE tenant_id = t.id) = 1
  AND EXISTS (
    SELECT 1 FROM users_tenants
    WHERE user_id = ut_owner.user_id AND role = 'member'
  );
```

Revisa los resultados y elimina los que confirmes como huérfanos.
