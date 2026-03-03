// Edge Function: invite-team-member
// Desplegar en: supabase functions deploy invite-team-member
//
// Valida que el tenant no haya alcanzado el límite del plan,
// crea el registro en team_members y envía el email de invitación.

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

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { teamId, email, tenantId }: { teamId: number; email: string; tenantId: number } =
      await req.json();

    if (!teamId || !email || !tenantId) {
      return json({ error: 'teamId, email y tenantId son requeridos' }, 400);
    }

    // Verify caller is owner of this tenant
    const { data: ownerCheck } = await supabase
      .from('users_tenants')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', (
        await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()
      ).data?.id)
      .maybeSingle();

    if (!ownerCheck) return json({ error: 'Sin permisos para invitar miembros' }, 403);

    // Check plan limit
    const { data: planData } = await supabase
      .from('users_tenants')
      .select('tenants(plans(max_team_members))')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    const maxMembers: number = (planData as any)?.tenants?.plans?.max_team_members ?? 0;

    const { count: currentCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'accepted');

    if ((currentCount ?? 0) >= maxMembers) {
      return json({ error: `Has alcanzado el límite de ${maxMembers} miembros de tu plan` }, 422);
    }

    // Check for existing invitation
    const { data: existing } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('team_id', teamId)
      .eq('invited_email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return json({ error: 'Ya existe una invitación para este correo' }, 409);
    }

    // Create invitation
    const { data: member, error: insertError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        invited_email: email.toLowerCase().trim(),
        status: 'pending',
      })
      .select('id, team_id, user_id, invited_email, status, invite_token, invite_expires_at, created_at')
      .single();

    if (insertError) return json({ error: insertError.message }, 500);

    // Get tenant name for email
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    // Send invite email
    const inviteUrl = `https://auth.catalogohoy.com/accept-invite?token=${member.invite_token}`;
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: { inviteUrl, tenantName: tenant?.name ?? 'tu catálogo' },
      redirectTo: inviteUrl,
    });

    return json(member, 200);
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
