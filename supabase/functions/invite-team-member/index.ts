// Edge Function: invite-team-member
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// --- Email (MailerSend con fallback a Resend) ---------------------------------
// Usa MailerSend si MAILER_SEND_API_KEY está seteado; si no, cae a Resend con
// RESEND_API_KEY. El switch es por presencia del token: se deploya sin romper
// nada y se flipea a MailerSend seteando el secret cuando el dominio esté
// verificado. MailerSend responde 202 y el id viene en el header x-message-id.
function hasEmailProvider() {
  return !!(Deno.env.get('AWS_SES_ACCESS_KEY_ID') || Deno.env.get('MAILER_SEND_API_KEY') || Deno.env.get('RESEND_API_KEY'));
}
// AWS SES (v2 SendEmail, SigV4 con aws4fetch). Proveedor principal: se activa por
// presencia de AWS_SES_ACCESS_KEY_ID (prioridad sobre MailerSend/Resend).
async function sendViaSes(to, fromName, fromEmail, subject, html, text) {
  const region = Deno.env.get('AWS_SES_REGION') ?? 'sa-east-1';
  const aws = new AwsClient({
    accessKeyId: Deno.env.get('AWS_SES_ACCESS_KEY_ID'),
    secretAccessKey: Deno.env.get('AWS_SES_SECRET_ACCESS_KEY'),
    region,
    service: 'ses'
  });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      FromEmailAddress: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: to
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8'
            },
            ...text ? {
              Text: {
                Data: text,
                Charset: 'UTF-8'
              }
            } : {}
          }
        }
      },
      ConfigurationSetName: 'catalogohoy-prod'
    })
  });
  if (!res.ok) return {
    ok: false,
    id: null,
    status: res.status,
    error: await res.text().catch(()=>'')
  };
  const j = await res.json().catch(()=>null);
  return {
    ok: true,
    id: j?.MessageId ?? null,
    status: res.status
  };
}
async function deliverEmail(opts) {
  const to = (Array.isArray(opts.to) ? opts.to : [
    opts.to
  ]).filter((e)=>e && e.includes('@'));
  if (to.length === 0) return {
    ok: false,
    id: null,
    status: 0,
    error: 'no recipients'
  };
  const fromName = opts.fromName ?? 'CatalogoHoy';
  const fromEmail = opts.fromEmail ?? 'noreply@catalogohoy.com';
  if (Deno.env.get('AWS_SES_ACCESS_KEY_ID') && Deno.env.get('AWS_SES_SECRET_ACCESS_KEY')) {
    return await sendViaSes(to, fromName, fromEmail, opts.subject, opts.html, opts.text);
  }
  const msToken = Deno.env.get('MAILER_SEND_API_KEY');
  if (msToken) {
    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${msToken}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        from: {
          email: fromEmail,
          name: fromName
        },
        to: to.map((email)=>({
            email
          })),
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? {
          text: opts.text
        } : {}
      })
    });
    const id = res.headers.get('x-message-id');
    if (!res.ok) return {
      ok: false,
      id,
      status: res.status,
      error: await res.text().catch(()=>'')
    };
    return {
      ok: true,
      id,
      status: res.status
    };
  }
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: opts.subject,
        html: opts.html,
        ...opts.text ? {
          text: opts.text
        } : {}
      })
    });
    if (!res.ok) return {
      ok: false,
      id: null,
      status: res.status,
      error: await res.text().catch(()=>'')
    };
    const j = await res.json().catch(()=>null);
    return {
      ok: true,
      id: j?.id ?? null,
      status: res.status
    };
  }
  return {
    ok: false,
    id: null,
    status: 0,
    error: 'No email provider (MAILER_SEND_API_KEY / RESEND_API_KEY)'
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({
      error: 'Unauthorized'
    }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({
      error: 'Unauthorized'
    }, 401);
    const { teamId, email, tenantId, permissions = [] } = await req.json();
    if (!teamId || !email || !tenantId) {
      return json({
        error: 'teamId, email y tenantId son requeridos'
      }, 400);
    }
    // Verify caller belongs to this tenant
    const { data: userRow } = await supabase.from('users').select('id').eq('auth_user_id', user.id).single();
    if (!userRow) return json({
      error: 'Usuario no encontrado'
    }, 404);
    const { data: ownerCheck } = await supabase.from('users_tenants').select('id').eq('tenant_id', tenantId).eq('user_id', userRow.id).maybeSingle();
    if (!ownerCheck) return json({
      error: 'Sin permisos para invitar miembros'
    }, 403);
    // Check plan limit
    const { data: planData } = await supabase.from('users_tenants').select('tenants(plans(max_team_members))').eq('tenant_id', tenantId).limit(1).maybeSingle();
    const maxMembers = planData?.tenants?.plans?.max_team_members ?? 0;
    const { count: currentCount } = await supabase.from('team_members').select('id', {
      count: 'exact',
      head: true
    }).eq('team_id', teamId).eq('status', 'accepted');
    if ((currentCount ?? 0) >= maxMembers) {
      return json({
        error: `Has alcanzado el límite de ${maxMembers} miembros de tu plan`
      }, 422);
    }
    // Check for existing invitation
    const { data: existing } = await supabase.from('team_members').select('id, status').eq('team_id', teamId).eq('invited_email', email.toLowerCase().trim()).maybeSingle();
    if (existing) {
      return json({
        error: 'Ya existe una invitación para este correo'
      }, 409);
    }
    // Create invitation record
    const { data: member, error: insertError } = await supabase.from('team_members').insert({
      team_id: teamId,
      invited_email: email.toLowerCase().trim(),
      status: 'pending'
    }).select('id, team_id, user_id, invited_email, status, invite_token, invite_expires_at, created_at').single();
    if (insertError) return json({
      error: insertError.message
    }, 500);
    // Save pre-assigned permissions if provided
    if (permissions.length > 0) {
      const permRows = permissions.map((p)=>({
          team_member_id: member.id,
          module: p.module,
          action: p.action
        }));
      await supabase.from('team_member_permissions').insert(permRows);
    }
    // Get tenant name
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
    const tenantName = tenant?.name ?? 'tu catálogo';
    const inviteUrl = `https://auth.catalogohoy.com/accept-invite?token=${member.invite_token}`;
    const year = new Date().getFullYear();
    const emailHtml = `<!DOCTYPE html>
<html lang="es" style="margin:0;padding:0;background:#eaf1ff;">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="light only" />
  <title>Invitación a CatalogoHoy</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#eaf1ff;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaf1ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px 30px;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <img src="https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/catalogohoy-logo.png" alt="CatalogoHoy" width="90" style="display:block;" />
            </td>
          </tr>
          <tr>
            <td style="font-size:22px;font-weight:bold;color:#16367f;text-align:center;padding-bottom:10px;">
              Te invitaron a unirte a un equipo
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;color:#383838;text-align:left;line-height:1.6;padding-bottom:25px;">
              Fuiste invitado a colaborar en <strong>${String(tenantName).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong> en CatalogoHoy.<br /><br />
              Haz clic en el siguiente botón para aceptar la invitación y configurar tu acceso:
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <a href="${inviteUrl}" style="background-color:#3e7bfa;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">Aceptar invitación</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#646464;text-align:center;padding-bottom:15px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
              <a href="${inviteUrl}" style="word-break:break-all;color:#214da8;text-decoration:none;">Enlace mágico 🪄</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#646464;text-align:center;padding-bottom:15px;">
              Si no esperabas esta invitación, puedes ignorar este correo.
            </td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#a6a6a6;text-align:center;padding-top:25px;">
              &copy; ${year} CatalogoHoy &mdash; Todos los derechos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    // Best-effort: el email no debe tumbar la invitación ya creada.
    if (hasEmailProvider()) {
      try {
        await deliverEmail({
          to: email,
          subject: `Te invitaron a colaborar en ${tenantName}`,
          html: emailHtml,
          fromName: 'Nicolas de CatalogoHoy',
          fromEmail: 'nicolas@catalogohoy.com'
        });
      } catch (_) {
      /* noop */ }
    }
    return json(member, 200);
  } catch (err) {
    return json({
      error: String(err)
    }, 500);
  }
});
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
