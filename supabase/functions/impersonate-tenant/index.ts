import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Keep in sync with apps/internal/src/app/modules/auth/auth.constants.ts
const ALLOWED_ADMIN_EMAILS: readonly string[] = [
  "nicaso3006@gmail.com",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // 1. Verify caller via their JWT
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user?.email) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // 2. Whitelist check
  if (!ALLOWED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  // 3. Parse request
  let tenantId: number;
  try {
    const body = await req.json();
    tenantId = Number(body.tenantId);
    if (!Number.isFinite(tenantId)) {
      throw new Error("invalid tenantId");
    }
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  // 4. Admin client (service role bypasses RLS)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 5. Fetch tenant
  const { data: tenant, error: tenantError } = await adminClient
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant?.slug) {
    return jsonResponse({ error: "Tenant not found" }, 404);
  }

  // 6. Fetch owner user_id from users_tenants
  const { data: ownerLink, error: ownerLinkError } = await adminClient
    .from("users_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (ownerLinkError || !ownerLink?.user_id) {
    return jsonResponse({ error: "Owner not found for tenant" }, 404);
  }

  // 7. Fetch owner email from users table
  const { data: owner, error: ownerError } = await adminClient
    .from("users")
    .select("email")
    .eq("id", ownerLink.user_id)
    .single();

  if (ownerError || !owner?.email) {
    return jsonResponse({ error: "Owner email not found" }, 404);
  }

  // 8. Build redirect URL — always use the subdomain so it matches the
  //    Supabase Auth allowlist pattern (https://*.catalogohoy.com/**).
  const redirectTo = `https://${tenant.slug}.catalogohoy.com/admin`;

  // 9. Generate magic link for the target owner
  const { data: linkData, error: linkError } = await adminClient.auth.admin
    .generateLink({
      type: "magiclink",
      email: owner.email,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[impersonate-tenant] generateLink error:", linkError);
    return jsonResponse(
      { error: "Could not generate impersonation link" },
      500
    );
  }

  // Audit log (visible in Supabase Edge Function logs)
  console.log(
    `[impersonate-tenant] ${user.email} -> tenantId=${tenantId} slug=${tenant.slug} owner=${owner.email}`
  );

  return jsonResponse({
    actionLink: linkData.properties.action_link,
    slug: tenant.slug,
    ownerEmail: owner.email,
  });
});
