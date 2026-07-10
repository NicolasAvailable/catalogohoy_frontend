import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// delete-account — hard-delete the authenticated user's account.
//
// Invoked from profile.service.ts:
//   await supabase.functions.invoke('delete-account')
//
// Debe desplegarse con verify_jwt: FALSE — la función hace su propia auth
// (getUser sobre el JWT) y responde el preflight OPTIONS ella misma. Con
// verify_jwt: true la plataforma rechaza el OPTIONS (que va sin Authorization)
// y el browser reporta "Failed to send a request to the Edge Function".
//
// Orden de borrado (respetando las foreign keys):
//   1. Resolver el usuario desde el JWT (anon client).
//   2. Por cada tenant donde el usuario es ÚNICO owner (no rompemos catálogos
//      compartidos con el equipo):
//        a. Borrar referrals que referencian el tenant (FK NO ACTION).
//        b. Null a tenants.referred_by_tenant_id que apunten al tenant (self-FK).
//        c. Borrar users_tenants del tenant (FK NO ACTION) ANTES del tenant.
//        d. Borrar el tenant → el resto de hijos caen por ON DELETE CASCADE
//           (products, categories, orders, config, subscriptions, chats, …).
//   3. Borrar los users_tenants restantes del usuario + su fila public.users.
//   4. Best-effort: null a las columnas nullable que apuntan a auth.users desde
//      datos que hayan quedado (products/categories.auth_user_id,
//      tenant_subscriptions.created_by) → así deleteUser no falla por FK.
//   5. Hard-delete auth.users vía service-role admin API.
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

        // Solo borrar el tenant si el usuario es el ÚNICO owner.
        const { count } = await admin
          .from("users_tenants")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("role", "owner");
        if (count !== 1) continue;

        // a. Referrals que apuntan al tenant (FK NO ACTION).
        {
          const { error } = await admin
            .from("referrals")
            .delete()
            .or(
              `referrer_tenant_id.eq.${tenantId},referred_tenant_id.eq.${tenantId}`,
            );
          if (error) {
            cleanupErrors.push(`referrals ${tenantId}: ${error.message}`);
          }
        }

        // b. Otros tenants referidos POR este tenant (self-FK NO ACTION).
        {
          const { error } = await admin
            .from("tenants")
            .update({ referred_by_tenant_id: null })
            .eq("referred_by_tenant_id", tenantId);
          if (error) {
            cleanupErrors.push(`referred_by ${tenantId}: ${error.message}`);
          }
        }

        // c. Links del tenant (FK NO ACTION) ANTES de borrar el tenant.
        {
          const { error } = await admin
            .from("users_tenants")
            .delete()
            .eq("tenant_id", tenantId);
          if (error) {
            cleanupErrors.push(
              `users_tenants(tenant ${tenantId}): ${error.message}`,
            );
          }
        }

        // d. Borrar el tenant → cascada sobre el resto de hijos.
        {
          const { error } = await admin
            .from("tenants")
            .delete()
            .eq("id", tenantId);
          if (error) {
            cleanupErrors.push(`delete tenant ${tenantId}: ${error.message}`);
          }
        }
      }

      // Links restantes del usuario (a tenants compartidos) + su fila.
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

    // Best-effort: limpiar refs NO ACTION a auth.users que hayan quedado (datos
    // en tenants compartidos que no borramos). Columnas nullable → van a null.
    for (
      const [table, column] of [
        ["products", "auth_user_id"],
        ["categories", "auth_user_id"],
        ["tenant_subscriptions", "created_by"],
      ] as const
    ) {
      const { error } = await admin
        .from(table)
        .update({ [column]: null })
        .eq(column, user.id);
      if (error) {
        cleanupErrors.push(`null ${table}.${column}: ${error.message}`);
      }
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
