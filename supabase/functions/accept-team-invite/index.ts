// Edge Function: accept-team-invite
// Modo 'check' (sin auth): valida el token y retorna { email, tenantName, isRegistered }
// Modo normal (con auth): acepta la invitación y vincula el user al equipo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: { token: string; action?: 'check' } = await req.json();
    const { token, action } = body;

    if (!token) return json({ error: 'token es requerido' }, 400);

    // ── CHECK MODE (no auth required) ───────────────────
    if (action === 'check') {
      const { data: member, error } = await supabase
        .from('team_members')
        .select('id, invited_email, invite_expires_at, team_id, teams(tenant_id, tenants(name))')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .maybeSingle();

      if (error || !member) {
        return json({ error: 'Invitación no encontrada o ya utilizada' }, 404);
      }

      if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
        return json({ error: 'La invitación ha expirado' }, 410);
      }

      const tenantName: string = (member as any).teams?.tenants?.name ?? 'el catálogo';

      // Check if this email is already a registered user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', member.invited_email)
        .maybeSingle();

      return json({
        email: member.invited_email,
        tenantName,
        isRegistered: !!existingUser,
      }, 200);
    }

    // ── ACCEPT MODE (auth required) ───────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Find the pending invitation
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('id, invited_email, invite_expires_at, team_id, teams(tenant_id)')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (memberError || !member) {
      return json({ error: 'Invitación no encontrada o ya utilizada' }, 404);
    }

    if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
      return json({ error: 'La invitación ha expirado' }, 410);
    }

    // Get the user's internal id.
    // Self-heal: los invitados (signupInvitee) NO traen store_name, así que el
    // hook handle_new_user hace early-return y NO crea la fila public.users; los
    // invitados por Google tampoco. Sin esa fila no se podía vincular
    // ("Usuario no encontrado") y el login del invitado quedaba colgado. Si
    // falta, la creamos acá con los datos del auth user autenticado.
    let userData: { id: number } | null = null;
    {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      userData = data;
    }

    if (!userData) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (meta['name'] as string) ||
        (meta['full_name'] as string) ||
        (meta['display_name'] as string) ||
        (user.email ? user.email.split('@')[0] : 'Miembro');
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({ auth_user_id: user.id, email: user.email, name: fullName })
        .select('id')
        .single();
      if (created) {
        userData = created;
      } else {
        // Puede existir una fila con ese email (conflict) → recuperarla.
        const { data: byEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (!byEmail) {
          return json({ error: createErr?.message ?? 'No se pudo crear el usuario' }, 500);
        }
        userData = byEmail;
      }
    }

    const tenantId: number = (member as any).teams?.tenant_id;
    if (!tenantId) return json({ error: 'Equipo sin catálogo asociado' }, 500);

    // Update team_member: mark as accepted (status='accepted' invalidates the token for future lookups)
    const { error: updateError } = await supabase
      .from('team_members')
      .update({
        status: 'accepted',
        user_id: userData.id,
      })
      .eq('id', member.id);

    if (updateError) return json({ error: updateError.message }, 500);

    // El catálogo de la invitación pasa a ser el ÚNICO por defecto del usuario.
    // Antes se insertaba con is_default=true sin tocar los otros vínculos: si el
    // invitado ya estaba en otro catálogo (p. ej. el principal del mismo dueño,
    // invitado antes a su catálogo adicional), quedaban DOS is_default=true y
    // el TenantStore elegía el primero → el invitado veía el catálogo anterior.
    const { error: unsetError } = await supabase
      .from('users_tenants')
      .update({ is_default: false })
      .eq('user_id', userData.id)
      .neq('tenant_id', tenantId)
      .eq('is_default', true);
    if (unsetError) return json({ error: unsetError.message }, 500);

    // Link user to tenant in users_tenants (if not already there)
    const { data: existingLink } = await supabase
      .from('users_tenants')
      .select('id')
      .eq('user_id', userData.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { error: linkError } = existingLink
      ? await supabase
          .from('users_tenants')
          .update({ is_default: true })
          .eq('id', existingLink.id)
      : await supabase.from('users_tenants').insert({
          user_id: userData.id,
          tenant_id: tenantId,
          role: 'member',
          is_default: true,
        });
    if (linkError) return json({ error: linkError.message }, 500);

    return json({ ok: true, tenantId }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
