import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// delete-account — hard-delete the authenticated user's account
//
// Invoked from profile.service.ts:
//   await supabase.functions.invoke('delete-account')
//
// Flow:
//   1. Resolve caller via Authorization JWT (anon client).
//   2. Best-effort cleanup of `public.*` rows owned by this user:
//      - tenants where the user is the SOLE owner (avoids wiping catalogs
//        shared with team members).
//      - users_tenants links for this user.
//      - public.users row.
//   3. Hard-delete auth.users via service-role admin API.
// -----------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Server misconfigured: missing env vars" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } =
      await userClient.auth.getUser();
    if (authError || !user) {
      return json(
        { error: "Unauthorized: " + (authError?.message ?? "no user") },
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const cleanupErrors: string[] = [];

    const { data: userRow, error: userRowError } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userRowError) {
      cleanupErrors.push(`lookup users: ${userRowError.message}`);
    }

    if (userRow) {
      const { data: ownerships } = await admin
        .from("users_tenants")
        .select("tenant_id")
        .eq("user_id", userRow.id)
        .eq("role", "owner");

      for (const o of ownerships ?? []) {
        const tenantId = (o as { tenant_id: number }).tenant_id;
        const { count } = await admin
          .from("users_tenants")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("role", "owner");
        if (count === 1) {
          const { error } = await admin.from("tenants").delete().eq(
            "id",
            tenantId,
          );
          if (error) {
            cleanupErrors.push(
              `delete tenant ${tenantId}: ${error.message}`,
            );
          }
        }
      }

      const { error: utError } = await admin
        .from("users_tenants")
        .delete()
        .eq("user_id", userRow.id);
      if (utError) {
        cleanupErrors.push(`delete users_tenants: ${utError.message}`);
      }

      const { error: uError } = await admin
        .from("users")
        .delete()
        .eq("id", userRow.id);
      if (uError) cleanupErrors.push(`delete users: ${uError.message}`);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return json(
        {
          error: `auth.admin.deleteUser failed: ${deleteError.message}`,
          cleanupErrors,
        },
        500,
      );
    }

    return json({ ok: true, cleanupErrors }, 200);
  } catch (err) {
    return json(
      {
        error: "Unhandled: " +
          (err instanceof Error ? err.message : String(err)),
      },
      500,
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
