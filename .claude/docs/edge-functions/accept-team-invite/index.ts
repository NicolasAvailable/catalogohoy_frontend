// Edge Function: accept-team-invite
// Desplegar en: supabase functions deploy accept-team-invite
//
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

    // ── CHECK MODE (no auth required) ─────────────────────────────────
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

    // ── ACCEPT MODE (auth required) ───────────────────────────────────
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

    // Get the user's internal id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (userError || !userData) {
      return json({ error: 'Usuario no encontrado' }, 404);
    }

    const tenantId: number = (member as any).teams?.tenant_id;

    // Update the team_member record
    const { error: updateError } = await supabase
      .from('team_members')
      .update({
        status: 'accepted',
        user_id: userData.id,
        invite_token: null, // invalidate
      })
      .eq('id', member.id);

    if (updateError) return json({ error: updateError.message }, 500);

    // Link user to tenant in users_tenants (if not already there)
    const { data: existingLink } = await supabase
      .from('users_tenants')
      .select('id')
      .eq('user_id', userData.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!existingLink) {
      await supabase.from('users_tenants').insert({
        user_id: userData.id,
        tenant_id: tenantId,
        role: 'member',
        is_default: true, // this is the invited user's default tenant
      });
    }

    // Clean up orphan tenants auto-created by the `handle_new_user` trigger
    // when this user signed up through an invitation. Without this, the
    // invitee ends up with two tenants in the switcher (their auto-created
    // one + the inviter's), which looks like a duplicate (see bug where
    // "Essence Royale" owner invited X → invitee saw both "Essence Royale"
    // and "Essence Royalee").
    //
    // We only delete tenants where this user is the *sole* owner and which
    // are NOT the tenant they were just invited to — that's always an
    // orphan from the signup trigger.
    if (user.user_metadata?.is_invitee === true) {
      const { data: ownedLinks } = await supabase
        .from('users_tenants')
        .select('tenant_id')
        .eq('user_id', userData.id)
        .eq('role', 'owner');

      const orphanTenantIds = (ownedLinks ?? [])
        .map((r: { tenant_id: number }) => r.tenant_id)
        .filter((id: number) => id !== tenantId);

      for (const orphanId of orphanTenantIds) {
        // Only delete if this user is the only member — protects against
        // unexpected multi-owner tenants.
        const { count } = await supabase
          .from('users_tenants')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', orphanId);

        if (count === 1) {
          await supabase.from('users_tenants').delete().eq('tenant_id', orphanId);
          await supabase.from('tenants').delete().eq('id', orphanId);
        }
      }
    }

    return json({ ok: true }, 200);
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
